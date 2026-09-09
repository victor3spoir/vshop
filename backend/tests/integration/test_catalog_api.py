"""Integration: public catalog browsing against real Postgres."""

import pytest

pytestmark = pytest.mark.integration


class TestCategories:
    async def test_list(self, client, catalog):
        response = await client.get("/api/categories/")
        assert response.status_code == 200
        body = response.json()["items"]
        assert len(body) == 1
        assert body[0]["name"] == "Electronics"
        assert body[0]["slug"] == "electronics"

    async def test_detail(self, client, catalog):
        category_id = str(catalog["category"].id)
        response = await client.get(f"/api/categories/{category_id}")
        assert response.status_code == 200
        assert response.json()["id"] == category_id

    async def test_unknown_id_is_404(self, client, catalog):
        response = await client.get(
            "/api/categories/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code == 404


class TestProducts:
    async def test_list_resolves_category_name_and_price(self, client, catalog):
        response = await client.get("/api/products/")
        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 3
        by_name = {item["name"]: item for item in body["items"]}
        assert len(by_name) == 3

        laptop = by_name["Laptop"]
        assert laptop["category"] == "Electronics"
        assert laptop["category_id"] == str(catalog["category"].id)
        assert laptop["current_price"] == "999.99"

        # No category and no price must serialize as null, not error.
        ghost = by_name["Ghost"]
        assert ghost["category"] is None
        assert ghost["current_price"] is None

    async def test_filter_by_category(self, client, catalog):
        category_id = str(catalog["category"].id)
        response = await client.get(f"/api/products/?category_id={category_id}")
        names = {item["name"] for item in response.json()["items"]}
        assert names == {"Laptop", "Mouse"}

    async def test_pagination_envelope_and_page_size(self, client, catalog):
        response = await client.get("/api/products/?page=2&size=2")
        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 3
        assert body["page"] == 2
        assert body["size"] == 2
        assert body["pages"] == 2
        assert len(body["items"]) == 1

    async def test_detail(self, client, catalog):
        response = await client.get(f"/api/products/{catalog['laptop'].id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Laptop"

    async def test_unknown_id_is_404(self, client, catalog):
        response = await client.get(
            "/api/products/00000000-0000-0000-0000-000000000000"
        )
        assert response.status_code == 404

    async def test_products_are_read_only_over_api(self, client, catalog):
        response = await client.post("/api/products/", json={"name": "hack"})
        assert response.status_code == 405
