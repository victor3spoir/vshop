import uuid

from fastapi import APIRouter, HTTPException, status

from . import categories_usecases as usecases
from .schemas import CategoryOut

# Public: catalog browsing. Category management happens in /console.
category_router = APIRouter(prefix="/categories", tags=["categories"])


@category_router.get("/", response_model=list[CategoryOut])
async def list_categories():
    return await usecases.list_categories()


@category_router.get("/{category_id}", response_model=CategoryOut)
async def get_category(category_id: uuid.UUID):
    category = await usecases.get_category(category_id)
    if not category:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "category not found")
    return category
