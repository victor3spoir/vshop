"""Seed the database with fake categories and products for testing.

Product images are generated locally and uploaded to S3 (rustfs).

Usage (from src/):
    uv run python -m scripts.seed              # default: 6 categories, 30 products
    uv run python -m scripts.seed --products 100
    uv run python -m scripts.seed --fresh      # wipe existing catalog data first
"""

import argparse
import asyncio
import decimal
import io
import random

import boto3
from botocore.exceptions import ClientError
from faker import Faker
from piccolo.engine import engine_finder
from PIL import Image, ImageDraw

from settings import get_settings
from vshop.tables import (
    PRODUCT_IMAGE_STORAGE,
    Category,
    Order,
    OrderItem,
    Product,
    ProductPrice,
)

fake = Faker()

CATEGORY_POOL = [
    "Electronics",
    "Books",
    "Clothing",
    "Home & Kitchen",
    "Sports & Outdoors",
    "Toys & Games",
    "Beauty",
    "Groceries",
    "Office Supplies",
    "Garden",
]


def slugify(name: str) -> str:
    return name.lower().replace("&", "and").replace(" ", "-").replace("--", "-")


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


def fake_product_image(name: str) -> io.BytesIO:
    """A simple 400x400 placeholder: random background, product initials."""
    background = tuple(random.randint(40, 200) for _ in range(3))
    image = Image.new("RGB", (400, 400), background)
    draw = ImageDraw.Draw(image)
    initials = "".join(word[0].upper() for word in name.split()[:3]) or "?"
    draw.text((200, 200), initials, fill="white", anchor="mm", font_size=120)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=80)
    buffer.seek(0)
    return buffer


async def upload_product_image(name: str) -> str:
    """Generate and upload an image; returns the stored file key."""
    return await PRODUCT_IMAGE_STORAGE.store_file(
        file_name=f"{slugify(name)[:40]}.jpg",
        file=fake_product_image(name),
    )


async def wipe() -> None:
    """Remove all catalog and order data (order matters for FKs)."""
    await OrderItem.delete(force=True)
    await Order.delete(force=True)
    await ProductPrice.delete(force=True)
    await Product.delete(force=True)
    await Category.delete(force=True)
    print("existing data wiped")


async def seed_categories(count: int) -> list[Category]:
    names = random.sample(CATEGORY_POOL, k=min(count, len(CATEGORY_POOL)))
    categories: list[Category] = []
    for name in names:
        slug = slugify(name)
        existing = await Category.objects().get(Category.slug == slug)
        if existing:
            categories.append(existing)
            continue
        category = Category(name=name, slug=slug)
        await category.save()
        categories.append(category)
    print(f"{len(categories)} categories ready")
    return categories


async def seed_products(count: int, categories: list[Category]) -> None:
    for _ in range(count):
        name = fake.unique.catch_phrase()[:200]
        product = Product(
            name=name,
            description=fake.paragraph(nb_sentences=3),
            stock=random.randint(0, 250),
            category=random.choice(categories).id,
            image=await upload_product_image(name),
        )
        await product.save()

        price = decimal.Decimal(random.randrange(199, 99999)) / 100
        await ProductPrice(
            product=product.id,
            price=price,
            price_type="regular",
            valid_to=None,
        ).save()

        # ~30% of products also get a discount price
        if random.random() < 0.3:
            await ProductPrice(
                product=product.id,
                price=(price * decimal.Decimal("0.8")).quantize(
                    decimal.Decimal("0.01")
                ),
                price_type="discount",
                valid_to=None,
            ).save()
    print(f"{count} products created with prices and images")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Seed vshop with fake data")
    parser.add_argument("--categories", type=int, default=6)
    parser.add_argument("--products", type=int, default=30)
    parser.add_argument("--fresh", action="store_true", help="wipe existing data first")
    args = parser.parse_args()

    engine = engine_finder()
    if not engine:
        raise RuntimeError("db engine not found")
    await engine.start_connection_pool()
    try:
        if args.fresh:
            await wipe()
        ensure_bucket()
        categories = await seed_categories(args.categories)
        await seed_products(args.products, categories)
    finally:
        await engine.close_connection_pool()


if __name__ == "__main__":
    asyncio.run(main())
