"""Order usecases & db operations: checkout, status transitions, stock handling."""

import datetime
import decimal
import uuid

from fastapi_pagination import Page

from features.inventory import inventory_service
from features.inventory.inventory_service import InventoryError
from pagination import paginate_select
from vshop.tables import Order, OrderItem, Product, ProductPrice

from .schemas import OrderCreate, OrderStatus

# Allowed status transitions for a simple order lifecycle.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    OrderStatus.PENDING: {OrderStatus.PAID, OrderStatus.CANCELLED},
    OrderStatus.PAID: {OrderStatus.SHIPPED, OrderStatus.CANCELLED},
    OrderStatus.SHIPPED: {OrderStatus.DELIVERED},
    OrderStatus.DELIVERED: set(),
    OrderStatus.CANCELLED: set(),
}


class OrderError(Exception):
    """Domain error raised by order usecases."""


async def _current_price(product_id: uuid.UUID) -> decimal.Decimal | None:
    # Naive datetime on purpose: Timestamp columns are timezone-naive.
    now = datetime.datetime.now()  # noqa: DTZ005
    row = (
        await ProductPrice.select(ProductPrice.price)
        .where(
            (ProductPrice.product == product_id)
            & (ProductPrice.valid_from <= now)
            & ((ProductPrice.valid_to.is_null()) | (ProductPrice.valid_to > now))
        )
        .order_by(ProductPrice.valid_from, ascending=False)
        .first()
    )
    return row["price"] if row else None


async def _attach_items(order: dict) -> dict:
    order["items"] = await OrderItem.select().where(OrderItem.order == order["id"])
    return order


async def _attach_items_to_page(orders) -> list[dict]:
    """Page transformer: load items for the current page of orders only."""
    return [await _attach_items(order) for order in orders]


async def list_orders(
    user_id: str | None = None,
    order_status: str | None = None,
) -> Page[dict]:
    """List orders; pass user_id to scope to one customer (None = all, admin)."""
    query = Order.select().order_by(Order.created_at, ascending=False)
    count_query = Order.count()
    if user_id:
        query = query.where(Order.user_id == user_id)
        count_query = count_query.where(Order.user_id == user_id)
    if order_status:
        query = query.where(Order.status == order_status)
        count_query = count_query.where(Order.status == order_status)
    return await paginate_select(query, count_query, transformer=_attach_items_to_page)


async def get_order(order_id: uuid.UUID, user_id: str | None = None) -> dict | None:
    """Get one order; pass user_id to enforce ownership (None = any, admin)."""
    query = Order.select().where(Order.id == order_id)
    if user_id:
        query = query.where(Order.user_id == user_id)
    order = await query.first()
    if not order:
        return None
    return await _attach_items(order)


async def create_order(data: OrderCreate, user_id: str) -> dict:
    """Checkout: reserve stock, snapshot prices; all-or-nothing."""
    async with Order._meta.db.transaction():
        total = decimal.Decimal(0)
        items: list[OrderItem] = []
        order = Order(user_id=user_id, status=OrderStatus.PENDING)
        await order.save()
        for item in data.items:
            product = await Product.objects().get(Product.id == item.product_id)
            if not product:
                raise OrderError(f"product {item.product_id} not found")
            price = await _current_price(item.product_id)
            if price is None:
                raise OrderError(f"product '{product.name}' has no active price")

            try:
                await inventory_service.reserve(
                    item.product_id,
                    item.quantity,
                    reference_type="order",
                    reference_id=str(order.id),
                )
            except InventoryError as error:
                raise OrderError(f"'{product.name}': {error}") from error
            total += price * item.quantity
            items.append(
                OrderItem(
                    order=order.id,
                    product=item.product_id,
                    quantity=item.quantity,
                    price_at_purchase=price,
                )
            )

        order.total_amount = total
        await order.save([Order.total_amount])
        for order_item in items:
            await order_item.save()

    return await get_order(order.id)


async def update_status(
    order_id: uuid.UUID,
    new_status: OrderStatus,
    user_id: str | None = None,
) -> dict | None:
    """Transition an order; pass user_id to enforce ownership (None = any, admin)."""
    async with Order._meta.db.transaction():
        query = Order.objects().where(Order.id == order_id)
        if user_id:
            query = query.where(Order.user_id == user_id)
        order = await query.first()
        if not order:
            return None
        if new_status not in ALLOWED_TRANSITIONS.get(order.status, set()):
            raise OrderError(
                f"cannot transition from '{order.status}' to '{new_status}'"
            )
        try:
            if new_status == OrderStatus.PAID:
                # Reservations become actual sales: goods leave on-hand.
                await _apply_to_items(order_id, inventory_service.commit_sale)
            elif new_status == OrderStatus.CANCELLED:
                if order.status == OrderStatus.PENDING:
                    # Only reserved so far: free the hold.
                    await _apply_to_items(order_id, inventory_service.release)
                else:
                    # Already sold (paid): goods come back as a return.
                    await _apply_to_items(order_id, inventory_service.process_return)
        except InventoryError as error:
            raise OrderError(str(error)) from error
        order.status = new_status
        await order.save([Order.status])
    return await get_order(order_id)


async def _apply_to_items(order_id: uuid.UUID, operation) -> None:
    """Run one inventory operation for every item of an order."""
    items = await OrderItem.select().where(OrderItem.order == order_id)
    for item in items:
        await operation(
            item["product"],
            item["quantity"],
            reference_type="order",
            reference_id=str(order_id),
        )
