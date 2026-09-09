import uuid

from fastapi import APIRouter, HTTPException, status
from fastapi_pagination import Page

from redis_support import API_RATE_LIMIT, CATALOG_CACHE

from . import categories_usecases as usecases
from .schemas import CategoryOut

# Public: catalog browsing. Category management happens in /console.
category_router = APIRouter(
    prefix="/categories",
    tags=["categories"],
    dependencies=[API_RATE_LIMIT],
)


@category_router.get(
    "/", response_model=Page[CategoryOut], dependencies=[CATALOG_CACHE]
)
async def list_categories():
    return await usecases.list_categories()


@category_router.get(
    "/{category_id}", response_model=CategoryOut, dependencies=[CATALOG_CACHE]
)
async def get_category(category_id: uuid.UUID):
    category = await usecases.get_category(category_id)
    if not category:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "category not found")
    return category
