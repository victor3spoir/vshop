"""Category usecases & db operations (read-only: management lives in /console)."""

import uuid

from vshop.tables import Category


async def list_categories() -> list[dict]:
    return await Category.select().order_by(Category.name)


async def get_category(category_id: uuid.UUID) -> dict | None:
    return await Category.select().where(Category.id == category_id).first()
