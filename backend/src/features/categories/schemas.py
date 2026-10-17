from piccolo_api.crud.serializers import create_pydantic_model

from vshop.tables import Category

CategoryOut = create_pydantic_model(
    Category,
    include_default_columns=True,
    model_name="CategoryOut",
)
