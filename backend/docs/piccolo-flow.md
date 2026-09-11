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

## Auto CRUD API (PiccoloCRUD + FastAPIWrapper)

Piccolo ships a generic CRUD engine (`PiccoloCRUD`, ASGI framework
agnostic) and a FastAPI adapter (`FastAPIWrapper`) that registers it on a
`FastAPI` app or `APIRouter` with full OpenAPI docs. One call per table
replaces hand-written list/get/create/update/delete endpoints.

```py
from fastapi import FastAPI
from piccolo_api.crud.endpoints import PiccoloCRUD
from piccolo_api.fastapi.endpoints import FastAPIWrapper

app = FastAPI()

FastAPIWrapper(
    root_url="/task/",
    fastapi_app=app,
    piccolo_crud=PiccoloCRUD(
        table=Task,
        read_only=False,          # True = only GET is registered
        allow_bulk_delete=False,  # DELETE on the root deletes all matches
        page_size=15,
        exclude_secrets=True,     # omit columns declared with secret=True
        max_joins=0,              # >0 enables __visible_fields across FKs
    ),
)
```

### Generated endpoints

| Method | Path            | Purpose                                   |
| ------ | --------------- | ----------------------------------------- |
| GET    | `/task/`        | list, with filters / ordering / paging    |
| POST   | `/task/`        | create a row                              |
| DELETE | `/task/`        | bulk delete (only if `allow_bulk_delete`) |
| GET    | `/task/{id}/`   | fetch one row                             |
| PUT    | `/task/{id}/`   | replace a row                             |
| PATCH  | `/task/{id}/`   | partial update                            |
| DELETE | `/task/{id}/`   | delete one row                            |
| GET    | `/task/ids/`    | map of id -> readable representation      |
| GET    | `/task/count/`  | row count for the current filters         |
| GET    | `/task/new/`    | template row with default values          |
| GET    | `/task/schema/` | JSON schema of the table                  |

### Query language (GET on the root)

- Filter by column: `/task/?name=foo`
- Operators via `__operator`: `/task/?duration=10&duration__operator=gte`
  (`lt`, `lte`, `gt`, `gte`, `e`, `ne`, `is_null`, `not_null`)
- Match style for text: `/task/?name=foo&name__match=contains`
  (`contains`, `starts`, `ends`, `exact`)
- Ordering: `/task/?__order=-created_at`
- Paging: `/task/?__page=2&__page_size=50`
- Joins (needs `max_joins>0`): `/task/?__visible_fields=name,owner.email`

### vshop integration

vshop does **not** expose a custom headless CRUD API. Raw table access is
served exclusively by the Piccolo Admin console (`create_admin`), which
uses this same `PiccoloCRUD` + `FastAPIWrapper` machinery internally:

- Backend mount: `Mount("/console", ADMIN_APP)` in `backend/src/app.py`.
- Its private JSON API lives under `/console/api/tables/<tablename>/`
  (Swagger at `/console/api/docs/`), session-cookie auth + CSRF.
- Frontend access: the `/admin` area links to the console through the
  same-origin proxy route (`frontend/src/routes/backend.$.ts`), i.e.
  `/backend/console/`. The React admin guard (better-auth role `admin`)
  controls who sees the link; the console then enforces its **own** login
  against Piccolo's `BaseUser` table (`uv run piccolo user create`).

Two auth realms, on purpose: better-auth JWTs protect the domain API
(`/api/*`, including admin-only `/api/inventory/*`); the console is a
break-glass back office with separate credentials. Domain rules (order
state machine, inventory ledger) only run through `/api/*` usecases, so
treat console writes to `order`/`inventory`/`inventory_transaction` as
dangerous - they bypass the service layer.

Console user management:

```sh
cd backend/src
uv run piccolo migrations forwards user
uv run piccolo migrations forwards session_auth
uv run piccolo user create   # interactive: username/email/password, admin flag
```
