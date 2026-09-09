from fastapi import APIRouter, HTTPException, status

from features.auth.deps import CurrentUser
from redis_support import (
    API_RATE_LIMIT,
    CART_CACHE,
    CART_EVICTION,
    WRITE_RATE_LIMIT,
)

from . import cart_usecases as usecases
from .cart_usecases import CartError
from .schemas import CartItemSet, CartOut

# The cart is always scoped to the authenticated user; there is no admin view.
cart_router = APIRouter(prefix="/cart", tags=["cart"], dependencies=[API_RATE_LIMIT])


@cart_router.get(
    "/",
    response_model=CartOut,
    dependencies=[CART_CACHE],
)
async def get_cart(user: CurrentUser):
    return await usecases.get_cart(user.id)


@cart_router.put(
    "/items",
    response_model=CartOut,
    dependencies=[WRITE_RATE_LIMIT, CART_EVICTION],
)
async def set_item(data: CartItemSet, user: CurrentUser):
    """Set a product's quantity in the cart (0 removes the line)."""
    try:
        return await usecases.set_item(user.id, data.product_id, data.quantity)
    except CartError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from error


@cart_router.delete(
    "/",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[WRITE_RATE_LIMIT, CART_EVICTION],
)
async def clear_cart(user: CurrentUser):
    await usecases.clear(user.id)
