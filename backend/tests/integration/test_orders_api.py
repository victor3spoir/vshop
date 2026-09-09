"""Integration: checkout and order lifecycle against real Postgres.

These cover the money paths: stock reservation, price snapshots, total
computation, transactional rollback, and reservation release on cancel.
"""

import pytest

from vshop.tables import Inventory

pytestmark = pytest.mark.integration


async def stock_of(product) -> int:
    """Sellable quantity: on hand minus reserved."""
    row = (
        await Inventory.select(Inventory.quantity_on_hand, Inventory.quantity_reserved)
        .where(Inventory.product == product.id)
        .first()
    )
    return row["quantity_on_hand"] - row["quantity_reserved"]


async def on_hand_of(product) -> int:
    row = (
        await Inventory.select(Inventory.quantity_on_hand)
        .where(Inventory.product == product.id)
        .first()
    )
    return row["quantity_on_hand"]


class TestCheckout:
    async def test_order_snapshots_price_and_reserves_stock(self, client, catalog):
        laptop = catalog["laptop"]
        response = await client.post(
            "/api/orders/",
            json={"items": [{"product_id": str(laptop.id), "quantity": 2}]},
        )
        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "pending"
        assert body["total_amount"] == "1999.98"
        assert body["items"][0]["price_at_purchase"] == "999.99"
        assert await stock_of(laptop) == 8
        # Reservation only: goods have not left the warehouse yet.
        assert await on_hand_of(laptop) == 10

    async def test_multi_item_total(self, client, catalog):
        response = await client.post(
            "/api/orders/",
            json={
                "items": [
                    {"product_id": str(catalog["laptop"].id), "quantity": 1},
                    {"product_id": str(catalog["mouse"].id), "quantity": 2},
                ]
            },
        )
        assert response.status_code == 201
        # 999.99 + 2 * 19.90
        assert response.json()["total_amount"] == "1039.79"

    async def test_insufficient_stock_is_409(self, client, catalog):
        response = await client.post(
            "/api/orders/",
            json={"items": [{"product_id": str(catalog["mouse"].id), "quantity": 99}]},
        )
        assert response.status_code == 409
        assert "insufficient stock" in response.json()["detail"]

    async def test_failed_order_rolls_back_all_stock(self, client, catalog):
        """First item is in stock, second is not: nothing may be decremented."""
        response = await client.post(
            "/api/orders/",
            json={
                "items": [
                    {"product_id": str(catalog["laptop"].id), "quantity": 1},
                    {"product_id": str(catalog["mouse"].id), "quantity": 99},
                ]
            },
        )
        assert response.status_code == 409
        assert await stock_of(catalog["laptop"]) == 10
        assert await stock_of(catalog["mouse"]) == 3

    async def test_unpriced_product_is_409(self, client, catalog):
        response = await client.post(
            "/api/orders/",
            json={
                "items": [{"product_id": str(catalog["unpriced"].id), "quantity": 1}]
            },
        )
        assert response.status_code == 409
        assert "no active price" in response.json()["detail"]

    async def test_unknown_product_is_409(self, client, catalog):
        response = await client.post(
            "/api/orders/",
            json={
                "items": [
                    {
                        "product_id": "00000000-0000-0000-0000-000000000000",
                        "quantity": 1,
                    }
                ]
            },
        )
        assert response.status_code == 409

    async def test_empty_cart_is_422(self, client, catalog):
        response = await client.post("/api/orders/", json={"items": []})
        assert response.status_code == 422


class TestOrderLifecycle:
    async def make_order(self, client, catalog, quantity=2):
        response = await client.post(
            "/api/orders/",
            json={
                "items": [
                    {"product_id": str(catalog["laptop"].id), "quantity": quantity}
                ]
            },
        )
        assert response.status_code == 201
        return response.json()

    async def test_list_and_detail(self, client, catalog):
        order = await self.make_order(client, catalog)
        listed = (await client.get("/api/orders/")).json()
        assert listed["total"] == 1
        assert [item["id"] for item in listed["items"]] == [order["id"]]
        detail = (await client.get(f"/api/orders/{order['id']}")).json()
        assert detail["items"][0]["quantity"] == 2

    async def test_cancel_releases_reservation(self, client, catalog):
        order = await self.make_order(client, catalog, quantity=3)
        assert await stock_of(catalog["laptop"]) == 7

        response = await client.post(f"/api/orders/{order['id']}/cancel")
        assert response.status_code == 200
        assert response.json()["status"] == "cancelled"
        assert await stock_of(catalog["laptop"]) == 10
        assert await on_hand_of(catalog["laptop"]) == 10

    async def test_cancel_twice_is_409(self, client, catalog):
        order = await self.make_order(client, catalog)
        await client.post(f"/api/orders/{order['id']}/cancel")
        response = await client.post(f"/api/orders/{order['id']}/cancel")
        assert response.status_code == 409

    async def test_cancel_unknown_order_is_404(self, client, catalog):
        response = await client.post(
            "/api/orders/00000000-0000-0000-0000-000000000000/cancel"
        )
        assert response.status_code == 404
