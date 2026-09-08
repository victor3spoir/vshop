import uuid

from fastapi import APIRouter, HTTPException, status

from . import orders_usecases as usecases
from .orders_usecases import OrderError
from .schemas import OrderCreate, OrderOut, OrderStatus

# Client actions. Order administration happens in /console.
# Auth comes later; routes are anonymous for now.
order_router = APIRouter(prefix="/orders", tags=["orders"])


@order_router.get("/", response_model=list[OrderOut])
async def list_orders(order_status: OrderStatus | None = None):
    return await usecases.list_orders(order_status)


@order_router.get("/{order_id}", response_model=OrderOut)
async def get_order(order_id: uuid.UUID):
    order = await usecases.get_order(order_id)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "order not found")
    return order


@order_router.post("/", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(data: OrderCreate):
    try:
        return await usecases.create_order(data)
    except OrderError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from error


@order_router.post("/{order_id}/cancel", response_model=OrderOut)
async def cancel_order(order_id: uuid.UUID):
    """Cancel a pending or paid order; restores stock."""
    try:
        order = await usecases.update_status(order_id, OrderStatus.CANCELLED)
    except OrderError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from error
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "order not found")
    return order
