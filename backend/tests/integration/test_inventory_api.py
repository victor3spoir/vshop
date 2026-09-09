"""Integration: the inventory ledger against real Postgres.

Verifies the core invariant: the signed transaction ledger always sums to
quantity_on_hand (e.g. +100 PURCHASE -5 SALE -2 DAMAGE +1 RETURN = 94).
"""

import pytest

from features.inventory import inventory_service
from features.inventory.inventory_service import InventoryError
from features.inventory.schemas import TransactionType
from vshop.tables import Inventory, InventoryTransaction

pytestmark = pytest.mark.integration


async def position(product_id) -> dict:
    return (
        await Inventory.select(Inventory.quantity_on_hand, Inventory.quantity_reserved)
        .where(Inventory.product == product_id)
        .first()
    )


async def ledger_sum(product_id) -> int:
    inventory = (
        await Inventory.select(Inventory.id)
        .where(Inventory.product == product_id)
        .first()
    )
    rows = await InventoryTransaction.select(InventoryTransaction.quantity).where(
        (InventoryTransaction.inventory == inventory["id"])
        & (InventoryTransaction.type != TransactionType.RESERVATION)
        & (InventoryTransaction.type != TransactionType.RELEASE)
    )
    return sum(row["quantity"] for row in rows)


class TestLedgerInvariant:
    async def test_movements_sum_to_on_hand(self, catalog):
        """The spec example: +100 PURCHASE -5 SALE -2 DAMAGE +1 RETURN = 94."""
        product = catalog["unpriced"]  # starts at 5 from the fixture
        await inventory_service.receive_stock(product.id, 100)
        await inventory_service.reserve(product.id, 5)
        await inventory_service.commit_sale(product.id, 5)
        await inventory_service.record_damage(product.id, 2)
        await inventory_service.process_return(product.id, 1)

        current = await position(product.id)
        assert current["quantity_on_hand"] == 5 + 100 - 5 - 2 + 1
        assert current["quantity_reserved"] == 0
        assert await ledger_sum(product.id) == current["quantity_on_hand"]


class TestReservations:
    async def test_reserve_blocks_overselling(self, catalog):
        mouse = catalog["mouse"]  # 3 on hand
        await inventory_service.reserve(mouse.id, 2)
        with pytest.raises(InventoryError, match="insufficient stock"):
            await inventory_service.reserve(mouse.id, 2)

    async def test_release_frees_the_hold(self, catalog):
        mouse = catalog["mouse"]
        await inventory_service.reserve(mouse.id, 3)
        await inventory_service.release(mouse.id, 3)
        current = await position(mouse.id)
        assert current == {"quantity_on_hand": 3, "quantity_reserved": 0}

    async def test_cannot_release_more_than_reserved(self, catalog):
        with pytest.raises(InventoryError, match="only 0 reserved"):
            await inventory_service.release(catalog["mouse"].id, 1)

    async def test_sale_requires_a_reservation(self, catalog):
        with pytest.raises(InventoryError, match="only 0 reserved"):
            await inventory_service.commit_sale(catalog["mouse"].id, 1)


class TestAdjustments:
    async def test_adjustment_cannot_break_reservations(self, catalog):
        mouse = catalog["mouse"]  # 3 on hand
        await inventory_service.reserve(mouse.id, 3)
        with pytest.raises(InventoryError, match="reserved"):
            await inventory_service.adjust(mouse.id, -1)

    async def test_damage_cannot_exceed_on_hand(self, catalog):
        with pytest.raises(InventoryError, match="on hand"):
            await inventory_service.record_damage(catalog["mouse"].id, 99)


class TestOrderFlow:
    async def test_paid_order_converts_reservation_to_sale(self, client, catalog):
        import uuid

        from features.orders import orders_usecases
        from features.orders.schemas import OrderStatus

        laptop = catalog["laptop"]  # 10 on hand
        response = await client.post(
            "/api/orders/",
            json={"items": [{"product_id": str(laptop.id), "quantity": 4}]},
        )
        assert response.status_code == 201
        order_id = uuid.UUID(response.json()["id"])

        current = await position(laptop.id)
        assert current == {"quantity_on_hand": 10, "quantity_reserved": 4}

        await orders_usecases.update_status(order_id, OrderStatus.PAID)
        current = await position(laptop.id)
        assert current == {"quantity_on_hand": 6, "quantity_reserved": 0}
        assert await ledger_sum(laptop.id) == 6
