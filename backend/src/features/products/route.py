import uuid

from fastapi import APIRouter, HTTPException, status

from . import products_usecases as usecases
from .schemas import ProductOut

# Public: catalog browsing. Product & price management happens in /console.
product_router = APIRouter(prefix="/products", tags=["products"])


@product_router.get("/", response_model=list[ProductOut])
async def list_products(category_id: uuid.UUID | None = None):
    return await usecases.list_products(category_id)


@product_router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: uuid.UUID):
    product = await usecases.get_product(product_id)
    if not product:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "product not found")
    return product
