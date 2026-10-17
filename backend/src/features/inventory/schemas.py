import datetime
import uuid
from enum import StrEnum

from pydantic import BaseModel, Field


class TransactionType(StrEnum):
    PURCHASE = "PURCHASE"
    SALE = "SALE"
    RETURN = "RETURN"
    DAMAGE = "DAMAGE"
    ADJUSTMENT = "ADJUSTMENT"
    RESERVATION = "RESERVATION"
    RELEASE = "RELEASE"
    TRANSFER_IN = "TRANSFER_IN"
    TRANSFER_OUT = "TRANSFER_OUT"


class InventoryOut(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str | None = None
    quantity_on_hand: int
    quantity_reserved: int
    quantity_available: int
    reorder_level: int
    created_at: datetime.datetime
    updated_at: datetime.datetime


class TransactionOut(BaseModel):
    id: uuid.UUID
    inventory_id: uuid.UUID
    type: TransactionType
    quantity: int
    reference_type: str | None
    reference_id: str | None
    note: str | None
    created_at: datetime.datetime


class ReceiveStockIn(BaseModel):
    """Goods received: increases quantity_on_hand."""

    quantity: int = Field(gt=0)
    type: TransactionType = TransactionType.PURCHASE
    note: str | None = None


class AdjustStockIn(BaseModel):
    """Manual correction: signed delta applied to quantity_on_hand."""

    quantity: int = Field(description="signed delta, e.g. -3 or +10")
    note: str | None = None


class ReorderLevelIn(BaseModel):
    reorder_level: int = Field(ge=0)
