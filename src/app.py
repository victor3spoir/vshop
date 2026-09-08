from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.routing import Mount
from fastapi.staticfiles import StaticFiles
from piccolo.engine import engine_finder

from vshop.piccolo_app import ADMIN_APP
from features.products.route import product_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = engine_finder()
    if not engine:
        raise Exception("db engine not found")
    await engine.start_connection_pool()
    yield
    await engine.close_connection_pool()


app = FastAPI(
    title="vshop",
    description="description...",
    routes=[
        Mount("/console", ADMIN_APP),
        # Mount(MEDIA_ROOT.joinpath("static"), StaticFiles(directory="static")),
        Mount("/static", StaticFiles(directory="static")),
    ],
    lifespan=lifespan,
)

app.include_router(product_router, prefix="/api")


@app.get("/")
def index():
    return None
