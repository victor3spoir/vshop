"""Unit: request/response schema validation for client order operations."""

import uuid

import pytest
from pydantic import ValidationError

from features.orders.schemas import OrderCreate, OrderItemIn, OrderStatus


class TestOrderItemIn:
    def test_valid_item(self):
        item = OrderItemIn(product_id=uuid.uuid4(), quantity=2)
        assert item.quantity == 2

    def test_zero_quantity_rejected(self):
        with pytest.raises(ValidationError):
            OrderItemIn(product_id=uuid.uuid4(), quantity=0)

    def test_negative_quantity_rejected(self):
        with pytest.raises(ValidationError):
            OrderItemIn(product_id=uuid.uuid4(), quantity=-1)

    def test_invalid_product_id_rejected(self):
        with pytest.raises(ValidationError):
            OrderItemIn(product_id="not-a-uuid", quantity=1)


class TestOrderCreate:
    def test_valid_order(self):
        order = OrderCreate(items=[{"product_id": str(uuid.uuid4()), "quantity": 1}])
        assert len(order.items) == 1

    def test_empty_items_rejected(self):
        with pytest.raises(ValidationError):
            OrderCreate(items=[])


class TestOrderStatus:
    def test_known_statuses(self):
        assert OrderStatus("pending") is OrderStatus.PENDING
        assert OrderStatus("cancelled") is OrderStatus.CANCELLED

    def test_unknown_status_rejected(self):
        with pytest.raises(ValueError, match="refunded"):
            OrderStatus("refunded")
