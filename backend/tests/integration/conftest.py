"""Integration fixtures: real Postgres via testcontainers, real app via httpx.

The container starts once per session. The Piccolo engine defined in
piccolo_conf.py is swapped to point at the container before any table
is touched, then migrations run to build the schema.
"""

import asyncio
import decimal

import pytest
from piccolo.engine.postgres import PostgresEngine
from piccolo.table import Table
from testcontainers.community.postgres import PostgresContainer
from testcontainers.community.redis import RedisContainer

from vshop.tables import (
    CartItem,
    Category,
    Inventory,
    InventoryTransaction,
    Order,
    OrderItem,
    Product,
    ProductPrice,
)

TABLES: list[type[Table]] = [
    Category,
    Product,
    ProductPrice,
    Order,
    OrderItem,
    CartItem,
    Inventory,
    InventoryTransaction,
]


@pytest.fixture(scope="session")
def pg_container():
    with PostgresContainer("postgres:18-alpine") as container:
        yield container


@pytest.fixture(scope="session")
def redis_url():
    with RedisContainer("redis:7-alpine") as container:
        host = container.get_container_host_ip()
        port = container.get_exposed_port(container.port)
        yield f"redis://{host}:{port}/0"


@pytest.fixture(scope="session")
def test_engine(pg_container):
    engine = PostgresEngine(
        config={
            "database": pg_container.dbname,
            "user": pg_container.username,
            "password": pg_container.password,
            "host": pg_container.get_container_host_ip(),
            "port": pg_container.get_exposed_port(5432),
        }
    )
    # Point every table at the container instead of the dev database.
    for table in TABLES:
        table._meta.db = engine
    return engine


@pytest.fixture(scope="session")
def apply_schema(test_engine):
    async def _migrate():
        # piccolo_conf's DB is what migrations connect through; the tables
        # already point at the container, so create schema directly.
        for table in TABLES:
            await table.create_table(if_not_exists=True)

    asyncio.run(_migrate())


@pytest.fixture
def clean_db(apply_schema, test_engine):
    async def _truncate():
        for table in reversed(TABLES):
            await table.delete(force=True)

    asyncio.run(_truncate())


_TEST_USER = {"id": "test-user", "email": "test@example.com"}


@pytest.fixture
async def client(clean_db, test_engine, redis_url, monkeypatch):
    from httpx import ASGITransport, AsyncClient
    from redis.asyncio import Redis

    monkeypatch.setenv("REDIS_URL", redis_url)

    redis_client = Redis.from_url(redis_url)
    await redis_client.flushdb()
    await redis_client.aclose()

    import app as app_module
    from features.auth.deps import AuthUser, get_current_user

    # The app lifespan calls engine_finder() (piccolo_conf DB) to open a
    # pool against the dev database; bypass it and use the container engine.
    monkeypatch.setattr(app_module, "engine_finder", lambda: test_engine)

    # Routes require a better-auth JWT; integration tests exercise the
    # order/cart flows, not token verification, so inject a fake admin.
    app_module.app.dependency_overrides[get_current_user] = lambda: AuthUser(
        **_TEST_USER, role="admin"
    )

    async with app_module.app.router.lifespan_context(app_module.app):
        async with AsyncClient(
            transport=ASGITransport(app=app_module.app), base_url="http://testserver"
        ) as http_client:
            yield http_client

    app_module.app.dependency_overrides.clear()


@pytest.fixture
def as_customer():
    """Downgrade the authenticated test identity to a plain customer."""
    import app as app_module
    from features.auth.deps import AuthUser, get_current_user

    app_module.app.dependency_overrides[get_current_user] = lambda: AuthUser(
        **_TEST_USER, role="user"
    )
    yield
    app_module.app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
async def catalog(clean_db):
    """A small known catalog: one category, two priced products."""
    from features.inventory import inventory_service

    category = Category(name="Electronics", slug="electronics")
    await category.save()

    laptop = Product(name="Laptop", description="A laptop", category=category.id)
    await laptop.save()
    await ProductPrice(
        product=laptop.id, price=decimal.Decimal("999.99"), valid_to=None
    ).save()
    await inventory_service.receive_stock(laptop.id, 10, note="test stock")

    mouse = Product(name="Mouse", description="A mouse", category=category.id)
    await mouse.save()
    await ProductPrice(
        product=mouse.id, price=decimal.Decimal("19.90"), valid_to=None
    ).save()
    await inventory_service.receive_stock(mouse.id, 3, note="test stock")

    unpriced = Product(name="Ghost", description="No price", category=None)
    await unpriced.save()
    await inventory_service.receive_stock(unpriced.id, 5, note="test stock")

    return {
        "category": category,
        "laptop": laptop,
        "mouse": mouse,
        "unpriced": unpriced,
    }
