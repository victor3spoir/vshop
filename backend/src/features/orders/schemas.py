import uuid
from enum import StrEnum

from piccolo_api.crud.serializers import create_pydantic_model
from pydantic import BaseModel, Field

from vshop.tables import Order, OrderItem


class OrderStatus(StrEnum):
    PENDING = "pending"
    PAID = "paid"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class OrderItemIn(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(gt=0)


class OrderCreate(BaseModel):
    items: list[OrderItemIn] = Field(min_length=1)


OrderItemOut = create_pydantic_model(
    OrderItem,
    include_default_columns=True,
    exclude_columns=(OrderItem.order,),
    model_name="OrderItemOut",
)

_OrderOut = create_pydantic_model(
    Order,
    include_default_columns=True,
    model_name="_OrderOut",
)


class OrderOut(_OrderOut):
    items: list[OrderItemOut] = Field(default_factory=list)
