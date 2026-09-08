import uuid

from fastapi import APIRouter, HTTPException, status

from features.auth.deps import CurrentUser
from features.cart import cart_usecases

from . import orders_usecases as usecases
from .orders_usecases import OrderError
from .schemas import OrderCreate, OrderItemIn, OrderOut, OrderStatus

# Client actions, scoped to the authenticated user (admins see everything).
# Order administration happens in /console.
order_router = APIRouter(prefix="/orders", tags=["orders"])


def _scope(user) -> str | None:
    """Admins operate across all orders; customers only on their own."""
    return None if user.is_admin else user.id


@order_router.get("/", response_model=list[OrderOut])
async def list_orders(user: CurrentUser, order_status: OrderStatus | None = None):
    return await usecases.list_orders(_scope(user), order_status)


@order_router.get("/{order_id}", response_model=OrderOut)
async def get_order(order_id: uuid.UUID, user: CurrentUser):
    order = await usecases.get_order(order_id, _scope(user))
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "order not found")
    return order


@order_router.post("/", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(data: OrderCreate, user: CurrentUser):
    try:
        return await usecases.create_order(data, user.id)
    except OrderError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from error


@order_router.post(
    "/checkout", response_model=OrderOut, status_code=status.HTTP_201_CREATED
)
async def checkout(user: CurrentUser):
    """Create an order from the user's server-side cart, then clear the cart."""
    cart = await cart_usecases.get_cart(user.id)
    if not cart["items"]:
        raise HTTPException(status.HTTP_409_CONFLICT, "cart is empty")
    data = OrderCreate(
        items=[
            OrderItemIn(product_id=item["product_id"], quantity=item["quantity"])
            for item in cart["items"]
        ]
    )
    try:
        order = await usecases.create_order(data, user.id)
    except OrderError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from error
    await cart_usecases.clear(user.id)
    return order


@order_router.post("/{order_id}/cancel", response_model=OrderOut)
async def cancel_order(order_id: uuid.UUID, user: CurrentUser):
    """Cancel a pending or paid order; restores stock."""
    try:
        order = await usecases.update_status(
            order_id, OrderStatus.CANCELLED, _scope(user)
        )
    except OrderError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from error
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "order not found")
    return order
