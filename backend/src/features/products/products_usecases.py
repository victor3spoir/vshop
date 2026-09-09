"""Product usecases & db operations (read-only: management lives in /console)."""

import datetime
import uuid

from fastapi_pagination import Page

from pagination import paginate_select
from vshop.tables import Inventory, Product, ProductPrice


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


async def _attach_stock(rows: list[dict]) -> list[dict]:
    """Expose sellable quantity (on hand minus reserved) as 'stock'."""
    for row in rows:
        inventory = (
            await Inventory.select(
                Inventory.quantity_on_hand, Inventory.quantity_reserved
            )
            .where(Inventory.product == row["id"])
            .first()
        )
        row["stock"] = (
            inventory["quantity_on_hand"] - inventory["quantity_reserved"]
            if inventory
            else 0
        )
    return rows


_PRODUCT_COLUMNS = (
    Product.id,
    Product.name,
    Product.description,
    Product.image,
    Product.created_at,
    Product.updated_at,
    Product.category.id.as_alias("category_id"),
    # Joined via the FK: the category's name instead of its id.
    Product.category.name.as_alias("category"),
)


async def _enrich(rows) -> list[dict]:
    """Page transformer: resolve price and stock for the current page only."""
    return await _attach_stock(await _attach_current_price(list(rows)))


async def list_products(category_id: uuid.UUID | None = None) -> Page[dict]:
    query = Product.select(*_PRODUCT_COLUMNS).order_by(Product.name)
    count_query = Product.count()
    if category_id:
        query = query.where(Product.category == category_id)
        count_query = count_query.where(Product.category == category_id)
    return await paginate_select(query, count_query, transformer=_enrich)


async def get_product(product_id: uuid.UUID) -> dict | None:
    row = (
        await Product.select(*_PRODUCT_COLUMNS).where(Product.id == product_id).first()
    )
    if not row:
        return None
    return (await _attach_stock(await _attach_current_price([row])))[0]
