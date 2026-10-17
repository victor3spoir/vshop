"""Shared Redis cache and rate-limit dependencies for API routes."""

import hashlib
import os

from fastapi import Depends, Request
from redis_fastapi import cache, cache_evict, default_key_builder, rate_limit

from features.auth.deps import AdminUser, CurrentUser
from settings import get_settings

settings = get_settings()
os.environ.setdefault("REDIS_URL", settings.redis_url.get_secret_value())
os.environ.setdefault("REDIS_PREFIX", settings.redis_prefix)
os.environ.setdefault(
    "REDIS_RATE_LIMIT_FAIL_CLOSED",
    str(settings.redis_rate_limit_fail_closed).lower(),
)

CATALOG_CACHE_GROUP = "catalog"
CART_CACHE_GROUP = "cart"
ORDER_CACHE_GROUP = "orders"
INVENTORY_CACHE_GROUP = "inventory"

API_RATE_LIMIT = Depends(
    rate_limit(
        settings.api_rate_limit,
        scope="api",
        fail_closed=settings.redis_rate_limit_fail_closed,
    )
)
WRITE_RATE_LIMIT = Depends(
    rate_limit(
        settings.api_write_rate_limit,
        fail_closed=settings.redis_rate_limit_fail_closed,
    )
)

CATALOG_CACHE = Depends(
    cache(ttl=settings.catalog_cache_ttl, eviction_group=CATALOG_CACHE_GROUP)
)


def private_cache_key(
    request: Request,
    eviction_group: str = "",
    prefix: str = "",
) -> str:
    """Scope private cached responses to the presented bearer token."""
    authorization = request.headers.get("authorization", "anonymous")
    identity = hashlib.sha256(authorization.encode()).hexdigest()[:24]
    base = default_key_builder(request, eviction_group=eviction_group, prefix=prefix)
    return f"{base}:identity={identity}"


def authenticated_cache(ttl: int, eviction_group: str):
    cache_dependency = cache(
        ttl=ttl,
        eviction_group=eviction_group,
        key_builder=private_cache_key,
        private=True,
    )

    async def dependency(
        _: CurrentUser,
        __: None = Depends(cache_dependency),
    ) -> None:
        return None

    return Depends(dependency)


def admin_cache(ttl: int, eviction_group: str):
    cache_dependency = cache(
        ttl=ttl,
        eviction_group=eviction_group,
        key_builder=private_cache_key,
        private=True,
    )

    async def dependency(
        _: AdminUser,
        __: None = Depends(cache_dependency),
    ) -> None:
        return None

    return Depends(dependency)


def evict_group(group: str):
    return Depends(cache_evict(eviction_group=group))


CART_CACHE = authenticated_cache(settings.private_cache_ttl, CART_CACHE_GROUP)
ORDER_CACHE = authenticated_cache(settings.private_cache_ttl, ORDER_CACHE_GROUP)
INVENTORY_CACHE = admin_cache(settings.private_cache_ttl, INVENTORY_CACHE_GROUP)

CART_EVICTION = evict_group(CART_CACHE_GROUP)
ORDER_EVICTION = evict_group(ORDER_CACHE_GROUP)
INVENTORY_EVICTION = evict_group(INVENTORY_CACHE_GROUP)
CATALOG_EVICTION = evict_group(CATALOG_CACHE_GROUP)
