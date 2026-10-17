# vshop

A simple e-commerce REST API built with [FastAPI](https://fastapi.tiangolo.com/) and [Piccolo ORM](https://piccolo-orm.com/), backed by PostgreSQL. It ships with a product catalog, orders with line items and price snapshots, a built-in admin console, and a database seeder for local development.

## Features

- **Catalog**: categories and products with price history (`ProductPrice` snapshots)
- **Orders**: order creation with line items, status tracking, and cancellation
- **Admin console**: [Piccolo Admin](https://piccolo-orm.com/ecosystem/) mounted at `/console`
- **Interactive docs**: OpenAPI/Swagger UI out of the box
- **Typed settings**: environment-driven configuration via `pydantic-settings`
- **Seeding**: import realistic products and images from DummyJSON

## Tech stack

| Component  | Choice                          |
| ---------- | ------------------------------- |
| Language   | Python 3.14+                    |
| Web        | FastAPI                         |
| ORM        | Piccolo (async, PostgreSQL)     |
| Database   | PostgreSQL 18                   |
| Settings   | pydantic-settings               |
| Tooling    | uv, ruff, pytest                |

## Project layout

```text
src/
  app.py                 # FastAPI application and router wiring
  settings.py            # typed settings loaded from env / .env
  piccolo_conf.py        # Piccolo engine configuration
  vshop/                 # Piccolo app: tables and migrations
  features/
    categories/          # category endpoints, schemas, usecases
    products/            # product endpoints, schemas, usecases
    orders/              # order endpoints, schemas, usecases
  scripts/
    seed.py              # database seeder
```

## Getting started

### Prerequisites

- [uv](https://docs.astral.sh/uv/)
- Docker (for PostgreSQL) or a local PostgreSQL instance

### 1. Install dependencies

```bash
uv sync
```

### 2. Start the database

```bash
docker compose up -d
```

This starts PostgreSQL 18 on port `35432`, Redis 8 on port `36379`, and
RustFS object storage on ports `9000` and `9001` (see `compose.yml`). Redis
requires `REDIS_PASSWORD` from the root `.env` file and includes a
password-authenticated health check.
Set the same password in `backend/src/.env` as part of `REDIS_URL`.

### 3. Configure the environment

```bash
cp src/.env.example src/.env
```

The defaults match the Docker Compose database. Any variable can also be set directly in the environment, which takes precedence over `.env`.

### 4. Run migrations

```bash
cd src
uv run piccolo migrations forwards all
```

### 5. Seed sample data (optional)

```bash
uv run seed                 # complete DummyJSON catalog
uv run --products 50   # import the first 50 products
uv run --fresh         # wipe data, then import all
```

The seeder maps DummyJSON into vshop's existing category, product, price, and
inventory tables. Product thumbnails are downloaded into the configured S3
media bucket, so the storefront does not depend on remote image hotlinks.

API GET responses are cached in Redis. Catalog entries use a 60-second TTL;
authenticated cart, order, and inventory responses use private, identity-scoped
15-second entries. Successful writes invalidate all affected cache groups. Every
API route is limited to 120 requests per minute per client, with an additional
30 requests per minute limit on write operations. These values are configurable
through the settings documented in `backend/src/.env.example`.

### 6. Run the server

```bash
uv run fastapi dev app.py
```

- API docs: http://localhost:8000/docs
- Admin console: http://localhost:8000/console

## API overview

All endpoints are served under the `/api` prefix.

| Method | Path                        | Description                        |
| ------ | --------------------------- | ---------------------------------- |
| GET    | `/api/categories/`          | List categories                    |
| GET    | `/api/categories/{id}`      | Get a category                     |
| GET    | `/api/products/`            | List products (filter by category) |
| GET    | `/api/products/{id}`        | Get a product                      |
| GET    | `/api/orders/`              | List orders (filter by status)     |
| GET    | `/api/orders/{id}`          | Get an order                       |
| POST   | `/api/orders/`              | Create an order                    |
| POST   | `/api/orders/{id}/cancel`   | Cancel an order                    |

## Development

```bash
uv run ruff check .    # lint
uv run ruff format .   # format
uv run pytest          # tests
```

## License

This project is licensed under the [MIT License](LICENSE).
