"""Backfill inventory from product.stock, then drop the column.

Raw operations run before column drops inside a migration, so the data is
copied while product.stock still exists. Every backfilled position gets a
PURCHASE ledger row so the transaction log sums to the on-hand quantity.
"""

from piccolo.apps.migrations.auto.migration_manager import MigrationManager
from piccolo.engine import engine_finder

ID = "2026-09-09T09:10:00:000000"
VERSION = "1.36.0"
DESCRIPTION = "backfill inventory from product.stock, drop product.stock"


async def _backfill():
    engine = engine_finder()
    await engine.run_ddl(
        """
        INSERT INTO inventory (id, product, quantity_on_hand)
        SELECT gen_random_uuid(), p.id, p.stock
        FROM product p
        WHERE NOT EXISTS (
            SELECT 1 FROM inventory i WHERE i.product = p.id
        )
        """
    )
    await engine.run_ddl(
        """
        INSERT INTO inventory_transaction
            (id, inventory, type, quantity, note)
        SELECT gen_random_uuid(), i.id, 'PURCHASE', i.quantity_on_hand,
               'opening balance migrated from product.stock'
        FROM inventory i
        WHERE i.quantity_on_hand > 0
          AND NOT EXISTS (
            SELECT 1 FROM inventory_transaction t WHERE t.inventory = i.id
          )
        """
    )


async def forwards():
    manager = MigrationManager(
        migration_id=ID, app_name="vshop", description=DESCRIPTION
    )

    manager.add_raw(_backfill)

    manager.drop_column(
        table_class_name="Product",
        tablename="product",
        column_name="stock",
        db_column_name="stock",
        schema=None,
    )

    return manager
