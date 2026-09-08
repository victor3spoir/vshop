import datetime
import decimal
import os  # 1. Import datetime if needed for advanced defaults

from piccolo.columns import UUID, ForeignKey, Integer, Numeric, Text, Timestamp, Varchar
from piccolo.columns.defaults.timestamp import TimestampNow  # 2. Import TimestampNow
from piccolo.table import Table
from piccolo_api.media.local import LocalMediaStorage

from consts import MEDIA_ROOT


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
    stock = Integer(default=0)
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


PRODUCT_IMAGE_STORAGE = LocalMediaStorage(
    column=Product.image,
    media_path=os.path.join(MEDIA_ROOT.as_posix(), "products"),
    allowed_extensions=["jpg", "jpeg", "png", "webp"],
)
