"""Inventory usecases: admin-facing reads and stock operations.

Thin orchestration over the inventory service; each write runs in its own
transaction so counters and ledger rows always move together.
"""

import uuid

from fastapi_pagination import Page

from pagination import paginate_select
from vshop.tables import Inventory, InventoryTransaction

from . import inventory_service as service

_INVENTORY_COLUMNS = (
    Inventory.id,
    Inventory.product.id.as_alias("product_id"),
    Inventory.product.name.as_alias("product_name"),
    Inventory.quantity_on_hand,
    Inventory.quantity_reserved,
    Inventory.reorder_level,
    Inventory.created_at,
    Inventory.updated_at,
)


def _with_availability(row: dict) -> dict:
    row["quantity_available"] = row["quantity_on_hand"] - row["quantity_reserved"]
    return row


def _with_availability_page(rows) -> list[dict]:
    return [_with_availability(row) for row in rows]


async def list_inventory(low_stock_only: bool = False) -> Page[dict]:
    query = Inventory.select(*_INVENTORY_COLUMNS).order_by(Inventory.product.name)
    count_query = Inventory.count()
    if low_stock_only:
        query = query.where(Inventory.quantity_on_hand <= Inventory.reorder_level)
        count_query = count_query.where(
            Inventory.quantity_on_hand <= Inventory.reorder_level
        )
    return await paginate_select(
        query, count_query, transformer=_with_availability_page
    )


async def get_inventory(product_id: uuid.UUID) -> dict | None:
    row = (
        await Inventory.select(*_INVENTORY_COLUMNS)
        .where(Inventory.product == product_id)
        .first()
    )
    return _with_availability(row) if row else None


async def list_transactions(product_id: uuid.UUID) -> Page[dict] | None:
    """The movement ledger for one product, newest first."""
    inventory = (
        await Inventory.select(Inventory.id)
        .where(Inventory.product == product_id)
        .first()
    )
    if inventory is None:
        return None
    return await paginate_select(
        InventoryTransaction.select(
            InventoryTransaction.id,
            InventoryTransaction.inventory.as_alias("inventory_id"),
            InventoryTransaction.type,
            InventoryTransaction.quantity,
            InventoryTransaction.reference_type,
            InventoryTransaction.reference_id,
            InventoryTransaction.note,
            InventoryTransaction.created_at,
        )
        .where(InventoryTransaction.inventory == inventory["id"])
        .order_by(InventoryTransaction.created_at, ascending=False),
        InventoryTransaction.count().where(
            InventoryTransaction.inventory == inventory["id"]
        ),
    )


async def receive_stock(
    product_id: uuid.UUID, quantity: int, transaction_type, note: str | None
) -> dict:
    async with Inventory._meta.db.transaction():
        await service.receive_stock(product_id, quantity, transaction_type, note=note)
    return await get_inventory(product_id)


async def adjust_stock(product_id: uuid.UUID, quantity: int, note: str | None) -> dict:
    async with Inventory._meta.db.transaction():
        await service.adjust(product_id, quantity, note=note)
    return await get_inventory(product_id)


async def record_damage(product_id: uuid.UUID, quantity: int, note: str | None) -> dict:
    async with Inventory._meta.db.transaction():
        await service.record_damage(product_id, quantity, note=note)
    return await get_inventory(product_id)


async def process_return(
    product_id: uuid.UUID, quantity: int, note: str | None
) -> dict:
    async with Inventory._meta.db.transaction():
        await service.process_return(product_id, quantity, note=note)
    return await get_inventory(product_id)


async def set_reorder_level(product_id: uuid.UUID, reorder_level: int) -> dict | None:
    inventory = await service.get_or_create(product_id)
    inventory.reorder_level = reorder_level
    await inventory.save([Inventory.reorder_level])
    return await get_inventory(product_id)
