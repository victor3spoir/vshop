"""Order usecases & db operations: checkout, status transitions, stock handling."""

import datetime
import decimal
import uuid

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


async def list_orders(order_status: str | None = None) -> list[dict]:
    query = Order.select().order_by(Order.created_at, ascending=False)
    if order_status:
        query = query.where(Order.status == order_status)
    orders = await query
    return [await _attach_items(order) for order in orders]


async def get_order(order_id: uuid.UUID) -> dict | None:
    order = await Order.select().where(Order.id == order_id).first()
    if not order:
        return None
    return await _attach_items(order)


async def create_order(data: OrderCreate) -> dict:
    """Checkout: validate stock, snapshot prices, decrement stock atomically."""
    async with Order._meta.db.transaction():
        total = decimal.Decimal(0)
        items: list[OrderItem] = []
        for item in data.items:
            product = await Product.objects().get(Product.id == item.product_id)
            if not product:
                raise OrderError(f"product {item.product_id} not found")
            if product.stock < item.quantity:
                raise OrderError(
                    f"insufficient stock for '{product.name}': "
                    f"{product.stock} available, {item.quantity} requested"
                )
            price = await _current_price(item.product_id)
            if price is None:
                raise OrderError(f"product '{product.name}' has no active price")

            product.stock -= item.quantity
            await product.save([Product.stock])
            total += price * item.quantity
            items.append(
                OrderItem(
                    product=item.product_id,
                    quantity=item.quantity,
                    price_at_purchase=price,
                )
            )

        order = Order(status=OrderStatus.PENDING, total_amount=total)
        await order.save()
        for order_item in items:
            order_item.order = order.id
            await order_item.save()

    return await get_order(order.id)


async def update_status(order_id: uuid.UUID, new_status: OrderStatus) -> dict | None:
    async with Order._meta.db.transaction():
        order = await Order.objects().get(Order.id == order_id)
        if not order:
            return None
        if new_status not in ALLOWED_TRANSITIONS.get(order.status, set()):
            raise OrderError(f"cannot transition from '{order.status}' to '{new_status}'")
        if new_status == OrderStatus.CANCELLED:
            await _restore_stock(order_id)
        order.status = new_status
        await order.save([Order.status])
    return await get_order(order_id)


async def _restore_stock(order_id: uuid.UUID) -> None:
    items = await OrderItem.select().where(OrderItem.order == order_id)
    for item in items:
        await Product.update(
            {Product.stock: Product.stock + item["quantity"]}
        ).where(Product.id == item["product"])
