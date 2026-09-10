"""Admin table defaults and business-operation guardrails, without a database."""

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from piccolo_admin.endpoints import TableConfig

from vshop.admin import ADMIN_APP, ADMIN_TABLES
from vshop.tables import (
    PRODUCT_IMAGE_STORAGE,
    CartItem,
    Inventory,
    InventoryTransaction,
    Order,
    OrderItem,
    Product,
)


@pytest.mark.parametrize(
    "config", ADMIN_TABLES, ids=lambda config: config.table_class.__name__
)
def test_table_schema_uses_piccolo_display_defaults(config):
    defaults = TableConfig(config.table_class)
    # Exercise the schema endpoint in isolation; authentication is tested below.
    api = next(route.app for route in ADMIN_APP.routes if route.path == "/api")
    with TestClient(api.app) as client:
        response = client.get(f"/tables/{config.table_class._meta.tablename}/schema/")
    assert response.status_code == 200
    schema = response.json()
    extra = schema["extra"]
    assert extra["visible_column_names"] == list(defaults.get_visible_column_names())
    assert extra["visible_filter_names"] == list(defaults.get_visible_filter_names())
    assert extra["link_column_name"] == defaults.get_link_column()._meta.name
    assert extra["order_by"] == [
        dict(item.to_dict()) for item in defaults.get_order_by()
    ]
    assert set(extra["visible_column_names"]) == (
        schema["properties"].keys() | {extra["primary_key_name"]}
    )


@pytest.mark.parametrize("table", [Order, OrderItem, Inventory, InventoryTransaction])
@pytest.mark.parametrize(
    "operation",
    ["post_single", "put_single", "patch_single", "delete_single", "delete_all"],
)
def test_protected_tables_still_reject_direct_writes(table, operation):
    config = next(config for config in ADMIN_TABLES if config.table_class is table)
    validators = getattr(config.validators, operation)
    assert validators
    for validator in validators:
        with pytest.raises(HTTPException) as error:
            validator(None, None)
        assert error.value.status_code == 405


def test_cart_only_allows_individual_removal():
    config = next(config for config in ADMIN_TABLES if config.table_class is CartItem)
    assert not config.validators.delete_single
    for operation in ("post_single", "put_single", "patch_single", "delete_all"):
        validators = getattr(config.validators, operation)
        assert validators
        with pytest.raises(HTTPException) as error:
            validators[0](None, None)
        assert error.value.status_code == 405


def test_product_image_storage_is_preserved():
    config = next(config for config in ADMIN_TABLES if config.table_class is Product)
    assert config.media_storage == [PRODUCT_IMAGE_STORAGE]


@pytest.mark.parametrize("path", ["/api/tables/product/schema/", "/dashboard/"])
def test_admin_data_requires_authentication(path):
    with TestClient(ADMIN_APP) as client:
        response = client.get(path)
    assert response.status_code == 401
