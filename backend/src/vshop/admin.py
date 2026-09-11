"""Domain-aware Piccolo Admin for the shop.

Instead of eight generic CRUD pages, the admin is organised around the three
business domains (Catalog / Orders / Inventory) and every state-changing
operation goes through the existing services:

- Orders are read-only tables; status changes run through
  ``orders_usecases.update_status`` (the state machine + stock side effects).
- Inventory counters are never edited directly; the stock forms call the
  inventory service, which locks the row and appends a ledger transaction.
- ``InventoryTransaction`` is an append-only ledger: view only.
"""

import datetime
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from piccolo.query.functions.aggregate import Count, Sum
from piccolo.table import Table
from piccolo_admin.endpoints import (
    FormConfig,
    TableConfig,
    Validators,
    create_admin,
    handle_auth_exception,
)
from piccolo_api.crud.endpoints import PiccoloCRUD
from piccolo_api.session_auth.middleware import SessionsAuthBackend
from pydantic import BaseModel, Field
from starlette.middleware.authentication import AuthenticationMiddleware

from features.inventory import inventory_usecases
from features.inventory.inventory_service import InventoryError
from features.inventory.schemas import TransactionType
from features.orders import orders_usecases
from features.orders.orders_usecases import OrderError
from features.orders.schemas import OrderStatus
from settings import get_settings
from vshop.tables import (
    PRODUCT_IMAGE_STORAGE,
    CartItem,
    Category,
    Inventory,
    InventoryTransaction,
    Order,
    OrderItem,
    Product,
    ProductPrice,
)

###############################################################################
# Guardrails
#
# Validators run inside Piccolo Admin's CRUD endpoints; raising an
# HTTPException blocks the request before any row is touched.


def _blocked(reason: str):
    def validator(piccolo_crud: PiccoloCRUD, request: Request) -> None:
        raise HTTPException(status_code=405, detail=reason)

    return validator


def _read_only(reason: str) -> Validators:
    """Block every mutating CRUD operation with an explanatory message."""
    block = _blocked(reason)
    return Validators(
        post_single=[block],
        put_single=[block],
        patch_single=[block],
        delete_single=[block],
        delete_all=[block],
    )


_ORDER_READ_ONLY = _read_only(
    "Orders are managed by the shop. Use the 'Change order status' form so "
    "stock reservations and the movement ledger stay consistent."
)
_ORDER_ITEM_READ_ONLY = _read_only(
    "Order items are historical records (price at purchase). They can only "
    "be created through checkout."
)
_INVENTORY_READ_ONLY = _read_only(
    "Stock levels only change through the inventory service. Use the "
    "'Inventory' forms (receive / adjust / damage / return)."
)
_LEDGER_READ_ONLY = _read_only(
    "The stock movement ledger is append-only; entries are created by the "
    "inventory service and are never edited."
)

# Cart rows may be removed (support/debugging) but not created or edited:
# quantities are validated against live stock by the cart service.
_cart_block = _blocked(
    "Cart contents are managed by customers through the shop. Rows may only "
    "be viewed or removed here."
)
_CART_VIEW_AND_REMOVE = Validators(
    post_single=[_cart_block],
    put_single=[_cart_block],
    patch_single=[_cart_block],
    delete_all=[_cart_block],
)

###############################################################################
# Tables

ADMIN_TABLES: list[type[Table] | TableConfig] = [
    # --- Catalog ------------------------------------------------------------
    TableConfig(
        table_class=Product,
        menu_group="Catalog",
        media_storage=[PRODUCT_IMAGE_STORAGE],
    ),
    TableConfig(
        table_class=Category,
        menu_group="Catalog",
    ),
    TableConfig(
        table_class=ProductPrice,
        menu_group="Catalog",
    ),
    # --- Orders ---------------------------------------------------------
    TableConfig(
        table_class=Order,
        menu_group="Orders",
        validators=_ORDER_READ_ONLY,
    ),
    TableConfig(
        table_class=OrderItem,
        menu_group="Orders",
        validators=_ORDER_ITEM_READ_ONLY,
    ),
    TableConfig(
        table_class=CartItem,
        menu_group="Orders",
        validators=_CART_VIEW_AND_REMOVE,
    ),
    # --- Inventory --------------------------------------------------------
    TableConfig(
        table_class=Inventory,
        menu_group="Inventory",
        validators=_INVENTORY_READ_ONLY,
    ),
    TableConfig(
        table_class=InventoryTransaction,
        menu_group="Inventory",
        validators=_LEDGER_READ_ONLY,
    ),
]

###############################################################################
# Custom forms: safe business operations through the existing services.


class ChangeOrderStatusModel(BaseModel):
    order_id: uuid.UUID
    new_status: OrderStatus


async def _change_order_status(request: Request, data: ChangeOrderStatusModel) -> str:
    try:
        order = await orders_usecases.update_status(data.order_id, data.new_status)
    except OrderError as error:
        raise ValueError(str(error)) from error
    if order is None:
        raise ValueError(f"order {data.order_id} not found")
    return (
        f"Order {data.order_id} is now '{order['status']}' "
        f"(total {order['total_amount']})."
    )


class ReceiveStockModel(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(gt=0)
    type: TransactionType = TransactionType.PURCHASE
    note: str | None = None


async def _receive_stock(request: Request, data: ReceiveStockModel) -> str:
    try:
        inventory = await inventory_usecases.receive_stock(
            data.product_id, data.quantity, data.type, data.note
        )
    except InventoryError as error:
        raise ValueError(str(error)) from error
    return _stock_summary(inventory)


class AdjustStockModel(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(description="signed delta, e.g. -3 or +10")
    note: str | None = None


async def _adjust_stock(request: Request, data: AdjustStockModel) -> str:
    try:
        inventory = await inventory_usecases.adjust_stock(
            data.product_id, data.quantity, data.note
        )
    except InventoryError as error:
        raise ValueError(str(error)) from error
    return _stock_summary(inventory)


class RecordDamageModel(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(gt=0)
    note: str | None = None


async def _record_damage(request: Request, data: RecordDamageModel) -> str:
    try:
        inventory = await inventory_usecases.record_damage(
            data.product_id, data.quantity, data.note
        )
    except InventoryError as error:
        raise ValueError(str(error)) from error
    return _stock_summary(inventory)


class RecordReturnModel(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(gt=0)
    note: str | None = None


async def _record_return(request: Request, data: RecordReturnModel) -> str:
    try:
        inventory = await inventory_usecases.process_return(
            data.product_id, data.quantity, data.note
        )
    except InventoryError as error:
        raise ValueError(str(error)) from error
    return _stock_summary(inventory)


class ReorderLevelModel(BaseModel):
    product_id: uuid.UUID
    reorder_level: int = Field(ge=0)


async def _set_reorder_level(request: Request, data: ReorderLevelModel) -> str:
    inventory = await inventory_usecases.set_reorder_level(
        data.product_id, data.reorder_level
    )
    return _stock_summary(inventory)


def _stock_summary(inventory: dict) -> str:
    return (
        f"'{inventory['product_name']}': on hand {inventory['quantity_on_hand']}, "
        f"reserved {inventory['quantity_reserved']}, "
        f"available {inventory['quantity_available']}, "
        f"reorder level {inventory['reorder_level']}."
    )


ADMIN_FORMS = [
    FormConfig(
        name="Change order status",
        pydantic_model=ChangeOrderStatusModel,
        endpoint=_change_order_status,
        description=(
            "Move an order through its lifecycle (pending -> paid -> shipped "
            "-> delivered, or cancel). Stock reservations, sales and returns "
            "are applied automatically."
        ),
        form_group="Orders",
    ),
    FormConfig(
        name="Receive stock",
        pydantic_model=ReceiveStockModel,
        endpoint=_receive_stock,
        description=(
            "Goods in (purchase or transfer in): increases on-hand stock and "
            "records a ledger entry."
        ),
        form_group="Inventory",
    ),
    FormConfig(
        name="Adjust stock",
        pydantic_model=AdjustStockModel,
        endpoint=_adjust_stock,
        description=(
            "Manual stocktake correction with a signed quantity (e.g. -3). "
            "Cannot drop on-hand below the reserved quantity."
        ),
        form_group="Inventory",
    ),
    FormConfig(
        name="Record damage",
        pydantic_model=RecordDamageModel,
        endpoint=_record_damage,
        description="Write off damaged goods from on-hand stock.",
        form_group="Inventory",
    ),
    FormConfig(
        name="Record return",
        pydantic_model=RecordReturnModel,
        endpoint=_record_return,
        description=(
            "Customer return outside the order flow: goods come back on hand. "
            "(Cancelling a paid order already restocks automatically.)"
        ),
        form_group="Inventory",
    ),
    FormConfig(
        name="Set reorder level",
        pydantic_model=ReorderLevelModel,
        endpoint=_set_reorder_level,
        description="The low-stock warning threshold for a product.",
        form_group="Inventory",
    ),
]

###############################################################################
# Dashboard
#
# A live commerce overview served inside the admin (same session auth,
# admin-only). Linked from the sidebar.

# Revenue only counts orders whose goods actually left the warehouse:
# 'paid' commits the sale in the state machine; shipped/delivered follow it.
# Pending orders are unconfirmed and cancelled ones are refunded/restocked.
REVENUE_STATUSES = (OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED)


async def _sales_since(cutoff: datetime.datetime | None) -> str:
    query = Order.select(Sum(Order.total_amount, alias="total")).where(
        Order.status.is_in([status.value for status in REVENUE_STATUSES])
    )
    if cutoff is not None:
        query = query.where(Order.created_at >= cutoff)
    row = await query.first()
    total = row["total"] if row and row["total"] is not None else 0
    return f"{total:,.2f}"


async def _order_status_counts() -> dict[str, int]:
    counts = {status.value: 0 for status in OrderStatus}
    rows = await Order.select(Order.status, Count(alias="n")).group_by(Order.status)
    for row in rows:
        counts[row["status"]] = row["n"]
    return counts


async def _dashboard(request: Request) -> HTMLResponse:
    now = datetime.datetime.now()  # noqa: DTZ005 - Timestamp columns are naive
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week = today - datetime.timedelta(days=today.weekday())
    month = today.replace(day=1)

    product_count = await Product.count()
    category_count = await Category.count()
    status_counts = await _order_status_counts()
    order_count = sum(status_counts.values())
    orders_today = await Order.count().where(Order.created_at >= today)

    sales_today = await _sales_since(today)
    sales_week = await _sales_since(week)
    sales_month = await _sales_since(month)
    sales_total = await _sales_since(None)

    inventory_rows = await Inventory.select(
        Inventory.product.name.as_alias("product_name"),
        Inventory.quantity_on_hand,
        Inventory.quantity_reserved,
        Inventory.reorder_level,
    )
    total_on_hand = sum(row["quantity_on_hand"] for row in inventory_rows)
    total_reserved = sum(row["quantity_reserved"] for row in inventory_rows)
    out_of_stock = [
        row
        for row in inventory_rows
        if row["quantity_on_hand"] - row["quantity_reserved"] <= 0
    ]
    # Same definition as the API's low-stock filter: on hand at/below reorder.
    low_stock = sorted(
        (
            row
            for row in inventory_rows
            if row["reorder_level"] > 0
            and row["quantity_on_hand"] <= row["reorder_level"]
        ),
        key=lambda row: row["quantity_on_hand"],
    )

    recent_orders = (
        await Order.select(
            Order.id, Order.user_id, Order.status, Order.total_amount, Order.created_at
        )
        .order_by(Order.created_at, ascending=False)
        .limit(10)
    )
    recent_movements = (
        await InventoryTransaction.select(
            InventoryTransaction.created_at,
            InventoryTransaction.type,
            InventoryTransaction.quantity,
            InventoryTransaction.inventory.product.name.as_alias("product_name"),
            InventoryTransaction.note,
        )
        .order_by(InventoryTransaction.created_at, ascending=False)
        .limit(10)
    )

    def card(label: str, value: str, hint: str = "") -> str:
        hint_html = f'<div class="hint">{hint}</div>' if hint else ""
        return (
            f'<div class="card"><div class="label">{label}</div>'
            f'<div class="value">{value}</div>{hint_html}</div>'
        )

    status_rows = "".join(
        f"<tr><td>{name}</td><td class='num'>{count}</td></tr>"
        for name, count in status_counts.items()
    )
    low_stock_rows = (
        "".join(
            f"<tr><td>{row['product_name']}</td>"
            f"<td class='num'>{row['quantity_on_hand']}</td>"
            f"<td class='num'>{row['reorder_level']}</td></tr>"
            for row in low_stock
        )
        or "<tr><td colspan='3'>Nothing below its reorder level.</td></tr>"
    )
    order_rows = (
        "".join(
            f"<tr><td class='mono'>{str(row['id'])[:8]}</td>"
            f"<td class='mono'>{row['user_id']}</td>"
            f"<td class='num'>{row['total_amount']:,.2f}</td>"
            f"<td>{row['status']}</td>"
            f"<td>{row['created_at']:%d %b %H:%M}</td></tr>"
            for row in recent_orders
        )
        or "<tr><td colspan='5'>No orders yet.</td></tr>"
    )
    movement_rows = (
        "".join(
            f"<tr><td>{row['created_at']:%d %b %H:%M}</td>"
            f"<td>{row['type']}</td>"
            f"<td class='num'>{row['quantity']:+d}</td>"
            f"<td>{row['product_name']}</td>"
            f"<td>{row['note'] or ''}</td></tr>"
            for row in recent_movements
        )
        or "<tr><td colspan='5'>No stock movements yet.</td></tr>"
    )

    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dashboard - vshop admin</title>
<style>
  body {{ font-family: system-ui, sans-serif; margin: 0; padding: 24px;
          background: #f4f5f7; color: #1f2733; }}
  h1 {{ font-size: 20px; margin: 0 0 4px; }}
  h2 {{ font-size: 14px; text-transform: uppercase; color: #5a6472;
        margin: 28px 0 10px; }}
  a.back {{ font-size: 13px; color: #2c5aa0; text-decoration: none; }}
  .cards {{ display: grid; gap: 12px;
            grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); }}
  .card {{ background: #fff; border: 1px solid #e1e5ea; border-radius: 6px;
           padding: 14px 16px; }}
  .card .label {{ font-size: 12px; color: #5a6472; }}
  .card .value {{ font-size: 24px; font-weight: 600; margin-top: 2px; }}
  .card .hint {{ font-size: 12px; color: #8a94a1; margin-top: 2px; }}
  .columns {{ display: grid; gap: 20px;
              grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }}
  table {{ width: 100%; border-collapse: collapse; background: #fff;
           border: 1px solid #e1e5ea; border-radius: 6px; overflow: hidden;
           font-size: 13px; }}
  th, td {{ text-align: left; padding: 7px 10px;
            border-bottom: 1px solid #eef0f3; }}
  th {{ background: #fafbfc; color: #5a6472; font-weight: 600; }}
  tr:last-child td {{ border-bottom: none; }}
  td.num {{ text-align: right; font-variant-numeric: tabular-nums; }}
  td.mono {{ font-family: ui-monospace, monospace; font-size: 12px; }}
</style>
</head>
<body>
<a class="back" href="../#/">&larr; Back to admin</a>
<h1>Dashboard</h1>

<h2>Overview</h2>
<div class="cards">
  {card("Products", str(product_count), f"{category_count} categories")}
  {card("Orders", str(order_count), f"{orders_today} today")}
  {card("Pending orders", str(status_counts[OrderStatus.PENDING]))}
  {card("Units on hand", f"{total_on_hand:,}", f"{total_reserved:,} reserved")}
  {card("Low stock", str(len(low_stock)), f"{len(out_of_stock)} out of stock")}
</div>

<h2>Sales (paid, shipped and delivered orders)</h2>
<div class="cards">
  {card("Today", sales_today)}
  {card("This week", sales_week)}
  {card("This month", sales_month)}
  {card("All time", sales_total)}
</div>

<div class="columns">
  <div>
    <h2>Orders by status</h2>
    <table><tr><th>Status</th><th class="num">Orders</th></tr>{status_rows}</table>
  </div>
  <div>
    <h2>Low stock (at or below reorder level)</h2>
    <table><tr><th>Product</th><th class="num">On hand</th>
    <th class="num">Reorder at</th></tr>{low_stock_rows}</table>
  </div>
</div>

<h2>Recent orders</h2>
<table><tr><th>Order</th><th>Customer</th><th class="num">Total</th>
<th>Status</th><th>Created</th></tr>{order_rows}</table>

<h2>Recent stock movements</h2>
<table><tr><th>Date</th><th>Type</th><th class="num">Qty</th><th>Product</th>
<th>Note</th></tr>{movement_rows}</table>
</body>
</html>"""
    return HTMLResponse(html)


def _build_dashboard_app() -> AuthenticationMiddleware:
    """The dashboard behind the same admin-only session auth as /console/api."""
    dashboard_app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    dashboard_app.add_api_route("/", _dashboard, methods=["GET"])
    return AuthenticationMiddleware(
        dashboard_app,
        backend=SessionsAuthBackend(admin_only=True),
        on_error=handle_auth_exception,
    )


###############################################################################


def build_admin():
    admin = create_admin(
        tables=ADMIN_TABLES,
        forms=ADMIN_FORMS,
        site_name="vshop admin",
        sidebar_links={"Dashboard": "/console/dashboard/"},
        # In production this enforces HTTPS-only cookies and rate-limits
        # logins.
        production=get_settings().is_production,
    )
    admin.mount("/dashboard", _build_dashboard_app())
    return admin


ADMIN_APP = build_admin()
