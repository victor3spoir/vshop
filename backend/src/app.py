from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.responses import RedirectResponse
from fastapi.routing import Mount
from piccolo.engine import engine_finder

from features.categories.route import category_router
from features.orders.route import order_router
from features.products.route import product_router
from settings import get_settings
from vshop.piccolo_app import ADMIN_APP
from vshop.tables import PRODUCT_IMAGE_STORAGE

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = engine_finder()
    if not engine:
        raise Exception("db engine not found")
    await engine.start_connection_pool()
    yield
    await engine.close_connection_pool()


app = FastAPI(
    title=settings.app_title,
    description=settings.app_description,
    version=settings.app_version,
    docs_url=settings.docs_url,
    redoc_url=settings.redoc_url,
    openapi_url=settings.openapi_url,
    routes=[
        Mount("/console", ADMIN_APP),
    ],
    lifespan=lifespan,
)

app.include_router(category_router, prefix="/api")
app.include_router(product_router, prefix="/api")
app.include_router(order_router, prefix="/api")


@app.get("/static/{file_key:path}", include_in_schema=False)
async def media(file_key: str):
    """Media now lives in S3 (rustfs); redirect to a signed, expiring URL."""
    # Signing is local: unknown keys simply 404 at the object store.
    url = await PRODUCT_IMAGE_STORAGE.generate_file_url(file_key, root_url="")
    return RedirectResponse(url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
