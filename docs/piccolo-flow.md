# Flow

## project config

```sh
# create project
uv run piccolo project new
# create app
uv run piccolo app new {name}
```

## Config

```py
DB = PostgresEngine(
    config={
        "database": "postgres",
        "user": "postgres",
        "password": "postgres",
        "host": "localhost",
        "port": 35432,
    }
)

APP_REGISTRY = AppRegistry(apps=["home.piccolo_app", "piccolo_admin.piccolo_app"])
```

```sh
# 1. Automatically generate the migration scripts based on tables.py
piccolo migrations new vshop --auto

# 2. Run the migration to actually create the tables in your database
piccolo migrations forwards vshop all

```

## Integrate admin

Install

```sh
uv add piccolo_admin
```

Create & mount admin as app on route with the api

Create users & sessions migrations

```sh
uv run piccolo migrations forwards user all
uv run piccolo migrations forwards session_auth  all
uv run piccolo usr
```
