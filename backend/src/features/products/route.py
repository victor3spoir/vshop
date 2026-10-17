import uuid

from fastapi import APIRouter, HTTPException, status
from fastapi_pagination import Page

from redis_support import API_RATE_LIMIT, CATALOG_CACHE

from . import products_usecases as usecases
from .schemas import ProductOut

# Public: catalog browsing. Product & price management happens in /console.
product_router = APIRouter(
    prefix="/products",
    tags=["products"],
    dependencies=[API_RATE_LIMIT],
)


@product_router.get("/", response_model=Page[ProductOut], dependencies=[CATALOG_CACHE])
async def list_products(category_id: uuid.UUID | None = None):
    return await usecases.list_products(category_id)


@product_router.get(
    "/{product_id}", response_model=ProductOut, dependencies=[CATALOG_CACHE]
)
async def get_product(product_id: uuid.UUID):
    product = await usecases.get_product(product_id)
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "product not found")
    return product
