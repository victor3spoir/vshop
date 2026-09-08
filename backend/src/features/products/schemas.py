import decimal
import uuid

from piccolo_api.crud.serializers import create_pydantic_model

from vshop.tables import Product

_ProductOut = create_pydantic_model(
    Product,
    include_default_columns=True,
    exclude_columns=(Product.category,),
    model_name="_ProductOut",
)


class ProductOut(_ProductOut):
    category: str | None = None
    category_id: uuid.UUID | None = None
    current_price: decimal.Decimal | None = None
