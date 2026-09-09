"""Inventory service: the single writer for stock levels.

Every mutation locks the inventory row (SELECT ... FOR UPDATE), applies the
counter change and appends a signed InventoryTransaction ledger row, so the
ledger always sums to the current position:

    +100 PURCHASE, -5 SALE, -2 DAMAGE, +1 RETURN  =>  on_hand 94

Callers (usecases) are expected to run these functions inside a database
transaction; Piccolo nests transactions transparently, so standalone calls
are still atomic.
"""

import uuid

from vshop.tables import Inventory, InventoryTransaction

from .schemas import TransactionType


class InventoryError(Exception):
    """Domain error raised by the inventory service."""


async def get_or_create(product_id: uuid.UUID) -> Inventory:
    """The inventory row for a product, created empty when missing."""
    inventory = await Inventory.objects().where(Inventory.product == product_id).first()
    if inventory is None:
        inventory = Inventory(product=product_id)
        await inventory.save()
    return inventory


async def _locked(product_id: uuid.UUID) -> Inventory:
    """Lock the row against concurrent writers for this transaction."""
    inventory = (
        await Inventory.objects()
        .where(Inventory.product == product_id)
        .lock_rows()
        .first()
    )
    if inventory is None:
        # First movement for this product: create, then lock.
        await get_or_create(product_id)
        inventory = (
            await Inventory.objects()
            .where(Inventory.product == product_id)
            .lock_rows()
            .first()
        )
    return inventory


async def _record(
    inventory: Inventory,
    transaction_type: TransactionType,
    quantity: int,
    reference_type: str | None,
    reference_id: str | None,
    note: str | None,
) -> None:
    await InventoryTransaction(
        inventory=inventory.id,
        type=transaction_type,
        quantity=quantity,
        reference_type=reference_type,
        reference_id=reference_id,
        note=note,
    ).save()


def available(inventory: Inventory) -> int:
    return inventory.quantity_on_hand - inventory.quantity_reserved


async def get_availability(product_id: uuid.UUID) -> int:
    """Sellable quantity (on hand minus reserved); 0 when untracked."""
    row = (
        await Inventory.select(Inventory.quantity_on_hand, Inventory.quantity_reserved)
        .where(Inventory.product == product_id)
        .first()
    )
    if row is None:
        return 0
    return row["quantity_on_hand"] - row["quantity_reserved"]


async def receive_stock(
    product_id: uuid.UUID,
    quantity: int,
    transaction_type: TransactionType = TransactionType.PURCHASE,
    reference_type: str | None = None,
    reference_id: str | None = None,
    note: str | None = None,
) -> Inventory:
    """Goods in (PURCHASE / TRANSFER_IN): increases on-hand."""
    if quantity <= 0:
        raise InventoryError("received quantity must be positive")
    if transaction_type not in (
        TransactionType.PURCHASE,
        TransactionType.TRANSFER_IN,
    ):
        raise InventoryError(f"'{transaction_type}' is not a goods-in type")
    inventory = await _locked(product_id)
    inventory.quantity_on_hand += quantity
    await inventory.save([Inventory.quantity_on_hand])
    await _record(
        inventory, transaction_type, quantity, reference_type, reference_id, note
    )
    return inventory


async def reserve(
    product_id: uuid.UUID,
    quantity: int,
    reference_type: str | None = None,
    reference_id: str | None = None,
    note: str | None = None,
) -> Inventory:
    """Hold stock for a pending order; fails when availability is short."""
    if quantity <= 0:
        raise InventoryError("reserved quantity must be positive")
    inventory = await _locked(product_id)
    if available(inventory) < quantity:
        raise InventoryError(
            f"insufficient stock: {available(inventory)} available, "
            f"{quantity} requested"
        )
    inventory.quantity_reserved += quantity
    await inventory.save([Inventory.quantity_reserved])
    await _record(
        inventory,
        TransactionType.RESERVATION,
        quantity,
        reference_type,
        reference_id,
        note,
    )
    return inventory


async def release(
    product_id: uuid.UUID,
    quantity: int,
    reference_type: str | None = None,
    reference_id: str | None = None,
    note: str | None = None,
) -> Inventory:
    """Undo a reservation (e.g. pending order cancelled)."""
    if quantity <= 0:
        raise InventoryError("released quantity must be positive")
    inventory = await _locked(product_id)
    if inventory.quantity_reserved < quantity:
        raise InventoryError(
            f"cannot release {quantity}: only {inventory.quantity_reserved} reserved"
        )
    inventory.quantity_reserved -= quantity
    await inventory.save([Inventory.quantity_reserved])
    await _record(
        inventory,
        TransactionType.RELEASE,
        -quantity,
        reference_type,
        reference_id,
        note,
    )
    return inventory


async def commit_sale(
    product_id: uuid.UUID,
    quantity: int,
    reference_type: str | None = None,
    reference_id: str | None = None,
    note: str | None = None,
) -> Inventory:
    """Convert a reservation into a sale: goods leave the warehouse."""
    if quantity <= 0:
        raise InventoryError("sold quantity must be positive")
    inventory = await _locked(product_id)
    if inventory.quantity_reserved < quantity:
        raise InventoryError(
            f"cannot sell {quantity}: only {inventory.quantity_reserved} reserved"
        )
    inventory.quantity_on_hand -= quantity
    inventory.quantity_reserved -= quantity
    await inventory.save([Inventory.quantity_on_hand, Inventory.quantity_reserved])
    await _record(
        inventory,
        TransactionType.SALE,
        -quantity,
        reference_type,
        reference_id,
        note,
    )
    return inventory


async def process_return(
    product_id: uuid.UUID,
    quantity: int,
    reference_type: str | None = None,
    reference_id: str | None = None,
    note: str | None = None,
) -> Inventory:
    """Customer return: goods come back on hand."""
    if quantity <= 0:
        raise InventoryError("returned quantity must be positive")
    inventory = await _locked(product_id)
    inventory.quantity_on_hand += quantity
    await inventory.save([Inventory.quantity_on_hand])
    await _record(
        inventory,
        TransactionType.RETURN,
        quantity,
        reference_type,
        reference_id,
        note,
    )
    return inventory


async def record_damage(
    product_id: uuid.UUID,
    quantity: int,
    reference_type: str | None = None,
    reference_id: str | None = None,
    note: str | None = None,
) -> Inventory:
    """Write off damaged goods."""
    if quantity <= 0:
        raise InventoryError("damaged quantity must be positive")
    inventory = await _locked(product_id)
    if inventory.quantity_on_hand < quantity:
        raise InventoryError(
            f"cannot write off {quantity}: only {inventory.quantity_on_hand} on hand"
        )
    inventory.quantity_on_hand -= quantity
    await inventory.save([Inventory.quantity_on_hand])
    await _record(
        inventory,
        TransactionType.DAMAGE,
        -quantity,
        reference_type,
        reference_id,
        note,
    )
    return inventory


async def adjust(
    product_id: uuid.UUID,
    quantity: int,
    note: str | None = None,
) -> Inventory:
    """Manual signed correction (stocktake); may not break reservations."""
    if quantity == 0:
        raise InventoryError("adjustment quantity cannot be zero")
    inventory = await _locked(product_id)
    new_on_hand = inventory.quantity_on_hand + quantity
    if new_on_hand < inventory.quantity_reserved:
        raise InventoryError(
            f"adjustment would drop on-hand below the "
            f"{inventory.quantity_reserved} reserved"
        )
    inventory.quantity_on_hand = new_on_hand
    await inventory.save([Inventory.quantity_on_hand])
    await _record(inventory, TransactionType.ADJUSTMENT, quantity, None, None, note)
    return inventory


async def transfer_out(
    product_id: uuid.UUID,
    quantity: int,
    reference_type: str | None = None,
    reference_id: str | None = None,
    note: str | None = None,
) -> Inventory:
    """Goods out to another location; may not break reservations."""
    if quantity <= 0:
        raise InventoryError("transferred quantity must be positive")
    inventory = await _locked(product_id)
    if available(inventory) < quantity:
        raise InventoryError(
            f"cannot transfer {quantity}: only {available(inventory)} available"
        )
    inventory.quantity_on_hand -= quantity
    await inventory.save([Inventory.quantity_on_hand])
    await _record(
        inventory,
        TransactionType.TRANSFER_OUT,
        -quantity,
        reference_type,
        reference_id,
        note,
    )
    return inventory
