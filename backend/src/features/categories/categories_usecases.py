"""Category usecases & db operations (read-only: management lives in /console)."""

import uuid

from fastapi_pagination import Page

from pagination import paginate_select
from vshop.tables import Category


async def list_categories() -> Page[dict]:
    return await paginate_select(
        Category.select().order_by(Category.name), Category.count()
    )


async def get_category(category_id: uuid.UUID) -> dict | None:
    return await Category.select().where(Category.id == category_id).first()
