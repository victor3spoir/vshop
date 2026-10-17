"""Seed vshop with the DummyJSON product catalog.

The source data is adapted to vshop's normalized model: categories, products,
price history, and inventory remain separate. Product thumbnails are downloaded
and stored in the configured S3-compatible media bucket.

Usage (from backend):
    uv run seed              # import the complete catalog
    uv run seed --products 50
    uv run seed --fresh       # wipe existing data first
"""

import argparse
import asyncio
import decimal
import io
import mimetypes
import uuid
from pathlib import PurePosixPath
from typing import Any

import boto3
import httpx
from botocore.exceptions import ClientError
from piccolo.engine import engine_finder

from settings import get_settings
from vshop.tables import (
    PRODUCT_IMAGE_STORAGE,
    CartItem,
    Category,
    Inventory,
    InventoryTransaction,
    Order,
    OrderItem,
    Product,
    ProductPrice,
)

DUMMYJSON_PRODUCTS_URL = "https://dummyjson.com/products"
DUMMYJSON_NAMESPACE = uuid.UUID("268157c4-8b4b-4d27-b8ea-c1a3d84c5362")
MAX_IMAGE_BYTES = 10 * 1024 * 1024


def imported_id(kind: str, source_id: str | int) -> uuid.UUID:
    """Return stable IDs so repeated seeds update instead of duplicating rows."""
    return uuid.uuid5(DUMMYJSON_NAMESPACE, f"{kind}:{source_id}")


def display_category(slug: str) -> str:
    return slug.replace("-", " ").title().replace("And", "&")


def ensure_bucket() -> None:
    """Create the media bucket when it does not exist yet."""
    settings = get_settings()
    client = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key.get_secret_value(),
    )
    try:
        client.head_bucket(Bucket=settings.s3_media_bucket)
    except ClientError:
        client.create_bucket(Bucket=settings.s3_media_bucket)
        print(f"bucket '{settings.s3_media_bucket}' created")


async def wipe() -> None:
    """Remove all catalog and order data in foreign-key-safe order."""
    await InventoryTransaction.delete(force=True)
    await Inventory.delete(force=True)
    await CartItem.delete(force=True)
    await OrderItem.delete(force=True)
    await Order.delete(force=True)
    await ProductPrice.delete(force=True)
    await Product.delete(force=True)
    await Category.delete(force=True)
    print("existing data wiped")


async def fetch_products(
    client: httpx.AsyncClient,
    product_count: int,
) -> list[dict[str, Any]]:
    response = await client.get(
        DUMMYJSON_PRODUCTS_URL,
        params={"limit": product_count, "skip": 0},
    )
    response.raise_for_status()
    products = response.json().get("products")
    if not isinstance(products, list):
        raise TypeError("DummyJSON returned an invalid products payload")
    return products


async def download_image(client: httpx.AsyncClient, url: str) -> io.BytesIO:
    response = await client.get(url)
    response.raise_for_status()
    content_type = response.headers.get("content-type", "").split(";", 1)[0]
    if not content_type.startswith("image/"):
        raise RuntimeError(f"expected an image from {url}, got {content_type!r}")
    if len(response.content) > MAX_IMAGE_BYTES:
        raise RuntimeError(f"image from {url} exceeds {MAX_IMAGE_BYTES} bytes")
    return io.BytesIO(response.content)


async def store_image(
    client: httpx.AsyncClient,
    source_id: int,
    url: str,
) -> str:
    image = await download_image(client, url)
    extension = PurePosixPath(httpx.URL(url).path).suffix.lower()
    if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
        extension = mimetypes.guess_extension("image/webp") or ".webp"
    return await PRODUCT_IMAGE_STORAGE.store_file(
        file_name=f"dummyjson-{source_id}{extension}",
        file=image,
    )


async def upsert_category(slug: str) -> Category:
    category = await Category.objects().get(Category.slug == slug)
    if category:
        return category
    category = Category(
        id=imported_id("category", slug),
        name=display_category(slug),
        slug=slug,
    )
    await category.save()
    return category


async def replace_price(product_id: uuid.UUID, value: Any) -> None:
    price = decimal.Decimal(str(value)).quantize(decimal.Decimal("0.01"))
    await ProductPrice.delete().where(ProductPrice.product == product_id)
    await ProductPrice(
        id=imported_id("price", str(product_id)),
        product=product_id,
        price=price,
        price_type="regular",
        valid_to=None,
    ).save()


async def replace_inventory(product_id: uuid.UUID, stock: int) -> None:
    inventory = await Inventory.objects().where(Inventory.product == product_id).first()
    if inventory is None:
        inventory = Inventory(
            id=imported_id("inventory", str(product_id)),
            product=product_id,
        )
        await inventory.save()
    await InventoryTransaction.delete().where(
        InventoryTransaction.inventory == inventory.id
    )
    inventory.quantity_on_hand = max(stock, 0)
    inventory.quantity_reserved = 0
    inventory.reorder_level = min(max(stock // 5, 5), 25)
    await inventory.save(
        [
            Inventory.quantity_on_hand,
            Inventory.quantity_reserved,
            Inventory.reorder_level,
        ]
    )
    if stock > 0:
        await InventoryTransaction(
            id=imported_id("inventory-opening", str(product_id)),
            inventory=inventory.id,
            type="PURCHASE",
            quantity=stock,
            reference_type="dummyjson",
            reference_id=str(product_id),
            note="opening balance imported from DummyJSON",
        ).save()


async def seed_product(client: httpx.AsyncClient, source: dict[str, Any]) -> None:
    source_id = int(source["id"])
    product_id = imported_id("product", source_id)
    title = str(source["title"])[:200]
    category = await upsert_category(str(source["category"]))
    existing = await Product.objects().get(Product.id == product_id)
    image_key = existing.image if existing else None
    image_url = source.get("thumbnail") or next(iter(source.get("images") or []), None)
    if image_url and not image_key:
        image_key = await store_image(client, source_id, str(image_url))

    if existing:
        existing.name = title
        existing.description = source.get("description")
        existing.category = category.id
        existing.image = image_key
        await existing.save(
            [Product.name, Product.description, Product.category, Product.image]
        )
    else:
        await Product(
            id=product_id,
            name=title,
            description=source.get("description"),
            category=category.id,
            image=image_key,
        ).save()

    await replace_price(product_id, source["price"])
    await replace_inventory(product_id, int(source.get("stock", 0)))


async def main() -> None:
    parser = argparse.ArgumentParser(description="Seed vshop from DummyJSON")
    parser.add_argument(
        "--products",
        "--limit",
        dest="products",
        type=int,
        default=0,
        help="number of products to import; 0 imports the complete catalog",
    )
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="wipe existing catalog, carts, and orders before importing",
    )
    args = parser.parse_args()
    if args.products < 0:
        parser.error("--products must be zero or greater")

    engine = engine_finder()
    if not engine:
        raise RuntimeError("db engine not found")
    await engine.start_connection_pool()
    try:
        if args.fresh:
            await wipe()
        ensure_bucket()
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(30),
            follow_redirects=True,
            headers={"User-Agent": "vshop-dummyjson-seeder/1.0"},
        ) as client:
            products = await fetch_products(client, args.products)
            total = len(products)
            for index, product in enumerate(products, start=1):
                await seed_product(client, product)
                print(f"[{index}/{total}] imported {product['title']}")
        print(f"seeded {total} DummyJSON products with local images")
    finally:
        await engine.close_connection_pool()


def cli() -> None:
    asyncio.run(main())


if __name__ == "__main__":
    cli()
