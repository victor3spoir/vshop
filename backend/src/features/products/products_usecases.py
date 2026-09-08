"""Product usecases & db operations (read-only: management lives in /console)."""

import datetime
import uuid

from vshop.tables import Product, ProductPrice


async def _attach_current_price(rows: list[dict]) -> list[dict]:
    """Resolve the currently valid price for each product row."""
    # Naive datetime on purpose: Timestamp columns are timezone-naive.
    now = datetime.datetime.now()  # noqa: DTZ005
    for row in rows:
        price = (
            await ProductPrice.select(ProductPrice.price)
            .where(
                (ProductPrice.product == row["id"])
                & (ProductPrice.valid_from <= now)
                & ((ProductPrice.valid_to.is_null()) | (ProductPrice.valid_to > now))
            )
            .order_by(ProductPrice.valid_from, ascending=False)
            .first()
        )
        row["current_price"] = price["price"] if price else None
    return rows


_PRODUCT_COLUMNS = (
    Product.id,
    Product.name,
    Product.description,
    Product.stock,
    Product.image,
    Product.created_at,
    Product.updated_at,
    Product.category.id.as_alias("category_id"),
    # Joined via the FK: the category's name instead of its id.
    Product.category.name.as_alias("category"),
)


async def list_products(category_id: uuid.UUID | None = None) -> list[dict]:
    query = Product.select(*_PRODUCT_COLUMNS).order_by(Product.name)
    if category_id:
        query = query.where(Product.category == category_id)
    return await _attach_current_price(await query)


async def get_product(product_id: uuid.UUID) -> dict | None:
    row = (
        await Product.select(*_PRODUCT_COLUMNS).where(Product.id == product_id).first()
    )
    if not row:
        return None
    return (await _attach_current_price([row]))[0]
