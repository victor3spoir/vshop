"""Unit: inventory schema validation and transaction-type rules."""

import pytest
from pydantic import ValidationError

from features.inventory.schemas import (
    AdjustStockIn,
    ReceiveStockIn,
    TransactionType,
)


class TestTransactionType:
    def test_all_ledger_types_exist(self):
        assert set(TransactionType) == {
            "PURCHASE",
            "SALE",
            "RETURN",
            "DAMAGE",
            "ADJUSTMENT",
            "RESERVATION",
            "RELEASE",
            "TRANSFER_IN",
            "TRANSFER_OUT",
        }


class TestReceiveStockIn:
    def test_defaults_to_purchase(self):
        data = ReceiveStockIn(quantity=100)
        assert data.type == TransactionType.PURCHASE

    def test_rejects_zero_and_negative(self):
        with pytest.raises(ValidationError):
            ReceiveStockIn(quantity=0)
        with pytest.raises(ValidationError):
            ReceiveStockIn(quantity=-5)


class TestAdjustStockIn:
    def test_accepts_signed_quantities(self):
        assert AdjustStockIn(quantity=-3).quantity == -3
        assert AdjustStockIn(quantity=10).quantity == 10
