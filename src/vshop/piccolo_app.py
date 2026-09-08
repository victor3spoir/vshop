"""
Import all of the Tables subclasses in your app here, and register them with
the APP_CONFIG.
"""

import os

from piccolo.conf.apps import AppConfig, table_finder, get_package
from piccolo.table import Table
from piccolo_admin.endpoints import TableConfig, create_admin

from vshop.tables import PRODUCT_IMAGE_STORAGE, Product

CURRENT_DIRECTORY = os.path.dirname(os.path.abspath(__file__))


APP_CONFIG = AppConfig(
    app_name="vshop",
    migrations_folder_path=os.path.join(CURRENT_DIRECTORY, "piccolo_migrations"),
    table_classes=table_finder(
        modules=[".tables"],
        package=get_package(__name__),
        exclude_imported=True,
    ),
    migration_dependencies=[],
    commands=[],
)


admin_tables: list[type[Table] | TableConfig] = []
for table in APP_CONFIG.table_classes:
    if table == Product:
        # 2. Wrap Product inside TableConfig with the media storage rule
        admin_tables.append(
            TableConfig(table_class=Product, media_storage=[PRODUCT_IMAGE_STORAGE])
        )
    else:
        admin_tables.append(table)


ADMIN_APP = create_admin(
    tables=admin_tables,  # 3. Pass the newly built list here
    page_size=15,
    production=False,
)
