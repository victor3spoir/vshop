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

from vshop.tables import Category, Order, OrderItem, Product, ProductPrice

TABLES: list[type[Table]] = [Category, Product, ProductPrice, Order, OrderItem]


@pytest.fixture(scope="session")
def pg_container():
    with PostgresContainer("postgres:18-alpine") as container:
        yield container


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


@pytest.fixture
async def client(clean_db, test_engine, monkeypatch):
    from httpx import ASGITransport, AsyncClient

    import app as app_module

    # The app lifespan calls engine_finder() (piccolo_conf DB) to open a
    # pool against the dev database; bypass it and use the container engine.
    monkeypatch.setattr(app_module, "engine_finder", lambda: test_engine)

    async with AsyncClient(
        transport=ASGITransport(app=app_module.app), base_url="http://testserver"
    ) as http_client:
        yield http_client


@pytest.fixture
async def catalog(clean_db):
    """A small known catalog: one category, two priced products."""
    category = Category(name="Electronics", slug="electronics")
    await category.save()

    laptop = Product(name="Laptop", description="A laptop", stock=10, category=category.id)
    await laptop.save()
    await ProductPrice(product=laptop.id, price=decimal.Decimal("999.99"), valid_to=None).save()

    mouse = Product(name="Mouse", description="A mouse", stock=3, category=category.id)
    await mouse.save()
    await ProductPrice(product=mouse.id, price=decimal.Decimal("19.90"), valid_to=None).save()

    unpriced = Product(name="Ghost", description="No price", stock=5, category=None)
    await unpriced.save()

    return {"category": category, "laptop": laptop, "mouse": mouse, "unpriced": unpriced}
