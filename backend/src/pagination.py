"""Piccolo-aware pagination built on fastapi-pagination's public API.

The bundled fastapi_pagination.ext.piccolo extension deep-copies the query
to derive its count query; deepcopy breaks Piccolo's UNDEFINED sentinel
(identity-based), so any paginated query with a where clause raises
"values is undefined". Instead we take an explicit count query and use
Piccolo's native limit/offset, staying on the library's public surface.
"""

from typing import Any

from fastapi_pagination import Page
from fastapi_pagination.api import apply_items_transformer, create_page
from fastapi_pagination.types import AsyncItemsTransformer
from fastapi_pagination.utils import verify_params
from piccolo.query.methods.count import Count
from piccolo.query.methods.select import Select


async def paginate_select(
    query: Select,
    count_query: Count,
    transformer: AsyncItemsTransformer | None = None,
) -> Page[dict[str, Any]]:
    """Paginate a Piccolo Select using the request's page/size params.

    Both queries must share the same where clauses so the total matches
    the items. The transformer runs on the current page only.
    """
    params, raw = verify_params(None, "limit-offset")
    total = await count_query
    if raw.limit is not None:
        query = query.limit(raw.limit)
    if raw.offset is not None:
        query = query.offset(raw.offset)
    items: list[dict[str, Any]] = await query
    if transformer is not None:
        items = await apply_items_transformer(items, transformer, async_=True)
    return create_page(items, total=total, params=params)
