import decimal
import uuid

from pydantic import BaseModel, Field


class CartItemSet(BaseModel):
    """Set the quantity for a product; 0 removes the line."""

    product_id: uuid.UUID
    quantity: int = Field(ge=0)


class CartItemOut(BaseModel):
    product_id: uuid.UUID
    name: str
    image: str | None
    stock: int
    quantity: int
    unit_price: decimal.Decimal | None


class CartOut(BaseModel):
    items: list[CartItemOut]
    total: decimal.Decimal
