from piccolo.conf.apps import AppRegistry
from piccolo.engine.postgres import PostgresEngine

from settings import get_settings

settings = get_settings()

DB = PostgresEngine(
    config={
        "database": settings.db_name,
        "user": settings.db_user,
        "password": settings.db_password.get_secret_value(),
        "host": settings.db_host,
        "port": settings.db_port,
    }
)


# A list of paths to piccolo apps
# e.g. ['blog.piccolo_app']
APP_REGISTRY = AppRegistry(
    apps=[
        "vshop.piccolo_app",
        "piccolo_admin.piccolo_app",
        "piccolo.apps.user.piccolo_app",
    ]
)
