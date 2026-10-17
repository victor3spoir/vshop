"""Integration: Redis-backed caching and API rate limiting."""

import pytest

pytestmark = pytest.mark.integration


async def test_catalog_response_is_cached(client, catalog):
    first = await client.get("/api/products/")
    second = await client.get("/api/products/")

    assert first.status_code == 200
    assert first.headers["x-redis-cache"] == "MISS"
    assert second.status_code == 200
    assert second.headers["x-redis-cache"] == "HIT"
    assert second.headers["x-ratelimit-limit"] == "120"


async def test_cart_write_invalidates_private_cache(catalog, client):
    first = await client.get("/api/cart/")
    cached = await client.get("/api/cart/")
    updated = await client.put(
        "/api/cart/items",
        json={"product_id": str(catalog["laptop"].id), "quantity": 2},
    )
    refreshed = await client.get("/api/cart/")

    assert first.headers["x-redis-cache"] == "MISS"
    assert cached.headers["x-redis-cache"] == "HIT"
    assert updated.status_code == 200
    assert refreshed.headers["x-redis-cache"] == "MISS"
    assert refreshed.json()["items"][0]["quantity"] == 2


async def test_api_rate_limit_is_enforced(client, catalog):
    responses = [await client.get("/api/categories/") for _ in range(121)]

    assert all(response.status_code == 200 for response in responses[:120])
    assert responses[-1].status_code == 429
    assert responses[-1].headers["retry-after"]
