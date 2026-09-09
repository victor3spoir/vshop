import uuid

from fastapi import APIRouter, HTTPException, status
from fastapi_pagination import Page

from features.auth.deps import AdminUser
from redis_support import (
    API_RATE_LIMIT,
    CART_EVICTION,
    CATALOG_EVICTION,
    INVENTORY_CACHE,
    INVENTORY_EVICTION,
    WRITE_RATE_LIMIT,
)

from . import inventory_usecases as usecases
from .inventory_service import InventoryError
from .schemas import (
    AdjustStockIn,
    InventoryOut,
    ReceiveStockIn,
    ReorderLevelIn,
    TransactionOut,
)

# Stock administration is admin-only; the shop reads availability
# through the product endpoints.
inventory_router = APIRouter(
    prefix="/inventory", tags=["inventory"], dependencies=[API_RATE_LIMIT]
)


@inventory_router.get(
    "/", response_model=Page[InventoryOut], dependencies=[INVENTORY_CACHE]
)
async def list_inventory(_: AdminUser, low_stock: bool = False):
    return await usecases.list_inventory(low_stock_only=low_stock)


@inventory_router.get(
    "/{product_id}", response_model=InventoryOut, dependencies=[INVENTORY_CACHE]
)
async def get_inventory(product_id: uuid.UUID, _: AdminUser):
    inventory = await usecases.get_inventory(product_id)
    if not inventory:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "inventory not found")
    return inventory


@inventory_router.get(
    "/{product_id}/transactions",
    response_model=Page[TransactionOut],
    dependencies=[INVENTORY_CACHE],
)
async def list_transactions(product_id: uuid.UUID, _: AdminUser):
    transactions = await usecases.list_transactions(product_id)
    if transactions is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "inventory not found")
    return transactions


@inventory_router.post(
    "/{product_id}/receive",
    response_model=InventoryOut,
    dependencies=[
        WRITE_RATE_LIMIT,
        INVENTORY_EVICTION,
        CATALOG_EVICTION,
        CART_EVICTION,
    ],
)
async def receive_stock(product_id: uuid.UUID, data: ReceiveStockIn, _: AdminUser):
    try:
        return await usecases.receive_stock(
            product_id, data.quantity, data.type, data.note
        )
    except InventoryError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from error


@inventory_router.post(
    "/{product_id}/adjust",
    response_model=InventoryOut,
    dependencies=[
        WRITE_RATE_LIMIT,
        INVENTORY_EVICTION,
        CATALOG_EVICTION,
        CART_EVICTION,
    ],
)
async def adjust_stock(product_id: uuid.UUID, data: AdjustStockIn, _: AdminUser):
    try:
        return await usecases.adjust_stock(product_id, data.quantity, data.note)
    except InventoryError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from error


@inventory_router.put(
    "/{product_id}/reorder-level",
    response_model=InventoryOut,
    dependencies=[WRITE_RATE_LIMIT, INVENTORY_EVICTION],
)
async def set_reorder_level(product_id: uuid.UUID, data: ReorderLevelIn, _: AdminUser):
    return await usecases.set_reorder_level(product_id, data.reorder_level)
