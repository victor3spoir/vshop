import datetime
import decimal
import pathlib

from piccolo.columns import UUID, ForeignKey, Integer, Numeric, Text, Timestamp, Varchar
from piccolo.columns.defaults.timestamp import TimestampNow  # 2. Import TimestampNow
from piccolo.table import Table
from piccolo_api.media.s3 import S3MediaStorage

from settings import get_settings


class Category(Table):
    id = UUID(primary_key=True)
    name = Varchar(length=100, unique=True)
    slug = Varchar(length=100, unique=True)
    # Timestamps
    created_at = Timestamp(default=TimestampNow())
    # 2. auto_update executes the function every time the row is saved
    updated_at = Timestamp(default=TimestampNow(), auto_update=datetime.datetime.now)


class Product(Table):
    id = UUID(primary_key=True)
    name = Varchar(length=200)
    description = Text(null=True)
    image = Varchar(null=True)
    category = ForeignKey(references=Category, null=True)
    # Timestamps
    created_at = Timestamp(default=TimestampNow())
    # 2. auto_update executes the function every time the row is saved
    updated_at = Timestamp(default=TimestampNow(), auto_update=datetime.datetime.now)


class ProductPrice(Table):
    id = UUID(primary_key=True)
    product = ForeignKey(references=Product)
    price = Numeric(digits=(10, 2))
    price_type = Varchar(length=30, default="regular")

    # 3. Use TimestampNow() for the creation default
    valid_from = Timestamp(default=TimestampNow())
    valid_to = Timestamp(null=True)
    # Timestamps
    created_at = Timestamp(default=TimestampNow())
    # 2. auto_update executes the function every time the row is saved
    updated_at = Timestamp(default=TimestampNow(), auto_update=datetime.datetime.now)


class Order(Table):
    id = UUID(primary_key=True)
    # 4. Use TimestampNow() for creation time

    # Optional: If you want an updated_at column that changes every save, use auto_update
    # updated_at = Timestamp(null=True, auto_update=datetime.datetime.now)

    # better-auth user id (frontend.user table lives in another schema, so a
    # plain indexed varchar instead of a cross-schema FK).
    user_id = Varchar(length=64, index=True)
    status = Varchar(length=50, default="pending")
    total_amount = Numeric(digits=(10, 2), default=decimal.Decimal("0.0"))
    # Timestamps
    created_at = Timestamp(default=TimestampNow())
    # 2. auto_update executes the function every time the row is saved
    updated_at = Timestamp(
        default=TimestampNow(),
        auto_update=datetime.datetime.now,
    )


class OrderItem(Table):
    id = UUID(primary_key=True)
    order = ForeignKey(references=Order)
    product = ForeignKey(references=Product)
    quantity = Integer(default=1)
    price_at_purchase = Numeric(digits=(10, 2))
    # Timestamps
    created_at = Timestamp(default=TimestampNow())
    # 2. auto_update executes the function every time the row is saved
    updated_at = Timestamp(default=TimestampNow(), auto_update=datetime.datetime.now)


class CartItem(Table):
    """Server-side cart: one row per (user, product)."""

    id = UUID(primary_key=True)
    user_id = Varchar(length=64, index=True)
    product = ForeignKey(references=Product)
    quantity = Integer(default=1)
    # Timestamps
    created_at = Timestamp(default=TimestampNow())
    updated_at = Timestamp(default=TimestampNow(), auto_update=datetime.datetime.now)


class Inventory(Table):
    """Stock position per product; quantities only change through the
    inventory service, which records a ledger row for every movement."""

    id = UUID(primary_key=True)
    product = ForeignKey(references=Product, unique=True)
    quantity_on_hand = Integer(default=0)
    quantity_reserved = Integer(default=0)
    reorder_level = Integer(default=0)
    # Timestamps
    created_at = Timestamp(default=TimestampNow())
    updated_at = Timestamp(default=TimestampNow(), auto_update=datetime.datetime.now)


class InventoryTransaction(Table):
    """Append-only movement ledger: signed quantity per transaction type
    (e.g. +100 PURCHASE, -5 SALE, -2 DAMAGE, +1 RETURN)."""

    id = UUID(primary_key=True)
    inventory = ForeignKey(references=Inventory)
    type = Varchar(length=20, index=True)
    quantity = Integer()
    reference_type = Varchar(length=30, null=True)
    reference_id = Varchar(length=64, null=True)
    note = Text(null=True)
    created_at = Timestamp(default=TimestampNow())


_settings = get_settings()


class PortableS3MediaStorage(S3MediaStorage):
    """S3MediaStorage builds keys with pathlib.Path, which uses backslashes
    on Windows. Force POSIX separators so keys are identical on every OS."""

    def _prepend_folder_name(self, file_key: str) -> str:
        if self.folder_name:
            return pathlib.PurePosixPath(self.folder_name, file_key).as_posix()
        return file_key


PRODUCT_IMAGE_STORAGE = PortableS3MediaStorage(
    column=Product.image,
    bucket_name=_settings.s3_media_bucket,
    folder_name="products",
    connection_kwargs={
        "endpoint_url": _settings.s3_endpoint_url,
        "region_name": _settings.s3_region,
        "aws_access_key_id": _settings.s3_access_key,
        "aws_secret_access_key": _settings.s3_secret_key.get_secret_value(),
    },
    allowed_extensions=["jpg", "jpeg", "png", "webp"],
)
