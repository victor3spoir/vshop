"""Cart usecases: a persistent per-user cart (one row per user+product)."""

import decimal
import uuid

from features.orders.orders_usecases import _current_price
from vshop.tables import CartItem, Product


class CartError(Exception):
    """Domain error raised by cart usecases."""


async def get_cart(user_id: str) -> dict:
    """Cart lines joined with product info and current prices."""
    rows = await (
        CartItem.select(
            CartItem.quantity,
            CartItem.product.id.as_alias("product_id"),
            CartItem.product.name.as_alias("name"),
            CartItem.product.image.as_alias("image"),
            CartItem.product.stock.as_alias("stock"),
        )
        .where(CartItem.user_id == user_id)
        .order_by(CartItem.created_at)
    )

    items = []
    total = decimal.Decimal(0)
    for row in rows:
        price = await _current_price(row["product_id"])
        items.append({**row, "unit_price": price})
        if price is not None:
            total += price * row["quantity"]
    return {"items": items, "total": total}


async def set_item(user_id: str, product_id: uuid.UUID, quantity: int) -> dict:
    """Upsert one cart line; quantity 0 removes it. Returns the fresh cart."""
    product = await Product.objects().get(Product.id == product_id)
    if not product:
        raise CartError("product not found")
    if quantity > product.stock:
        raise CartError(
            f"insufficient stock for '{product.name}': "
            f"{product.stock} available, {quantity} requested"
        )

    existing = (
        await CartItem.objects()
        .where((CartItem.user_id == user_id) & (CartItem.product == product_id))
        .first()
    )
    if quantity == 0:
        if existing:
            await existing.remove()
    elif existing:
        existing.quantity = quantity
        await existing.save([CartItem.quantity])
    else:
        await CartItem(user_id=user_id, product=product_id, quantity=quantity).save()

    return await get_cart(user_id)


async def clear(user_id: str) -> None:
    await CartItem.delete().where(CartItem.user_id == user_id)
