"""Central app configuration via pydantic-settings.

Values come from (highest precedence first): environment variables,
the .env file next to this module, then the defaults below.
"""

from enum import StrEnum
from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(StrEnum):
    DEVELOPMENT = "development"
    PRODUCTION = "production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Environment. Defaults to production so a missing/misconfigured
    # deployment never accidentally exposes dev features.
    python_env: Environment = Environment.PRODUCTION

    @field_validator("python_env", mode="before")
    @classmethod
    def _default_env_when_unset(cls, value: object) -> object:
        # Unset, empty, or unknown values all mean production.
        if isinstance(value, str):
            value = value.strip().lower()
        return value if value in set(Environment) else Environment.PRODUCTION

    # App metadata
    app_title: str = "vshop"
    app_description: str = "Simple ecommerce API"
    app_version: str = "0.1.0"

    # Database
    db_host: str = "localhost"
    db_port: int = 35432
    db_name: str = "postgres"
    db_user: str = "postgres"
    db_password: SecretStr = SecretStr("postgres")

    # Redis cache and rate limiting
    redis_url: SecretStr
    redis_prefix: str = "vshop"
    catalog_cache_ttl: int = 60
    private_cache_ttl: int = 15
    api_rate_limit: str = "120/minute"
    api_write_rate_limit: str = "30/minute"
    redis_rate_limit_fail_closed: bool = True

    # S3 object storage (rustfs locally; any S3-compatible service in prod)
    s3_endpoint_url: str = "http://localhost:9000"
    s3_region: str = "us-east-1"
    s3_access_key: str = "admin"
    s3_secret_key: SecretStr = SecretStr("admin")
    s3_media_bucket: str = "vshop-media"

    # Auth: JWTs are issued by the better-auth frontend (jwt plugin) and
    # verified here against its public JWKS endpoint.
    auth_issuer: str = "http://localhost:3000"
    auth_audience: str = "http://localhost:3000"
    auth_jwks_url: str = "http://localhost:3000/api/auth/jwks"

    @property
    def is_production(self) -> bool:
        return self.python_env == Environment.PRODUCTION

    @property
    def docs_url(self) -> str | None:
        # FastAPI disables an endpoint when its url is None.
        return None if self.is_production else "/docs"

    @property
    def redoc_url(self) -> str | None:
        return None if self.is_production else "/redoc"

    @property
    def openapi_url(self) -> str | None:
        return None if self.is_production else "/openapi.json"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
