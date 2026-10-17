"""JWT authentication dependencies.

Tokens are issued by the better-auth frontend (jwt plugin, EdDSA/Ed25519)
and verified here against its public JWKS. PyJWKClient caches keys and
refetches on unknown kid, which covers key rotation.
"""

import dataclasses
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, status
from jwt import PyJWKClient

from settings import get_settings

_BEARER_PREFIX = "bearer "


@dataclasses.dataclass(frozen=True, slots=True)
class AuthUser:
    """Identity extracted from a verified token."""

    id: str
    email: str | None
    role: str | None

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    # Module-level cache: one JWKS client (and its key cache) per process.
    return PyJWKClient(get_settings().auth_jwks_url, cache_keys=True, lifespan=300)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _decode(token: str) -> dict:
    settings = get_settings()
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["EdDSA"],
            issuer=settings.auth_issuer,
            audience=settings.auth_audience,
            options={"require": ["exp", "sub", "iss", "aud"]},
        )
    except jwt.PyJWTError as error:
        raise _unauthorized("invalid or expired token") from error


async def get_current_user(request: Request) -> AuthUser:
    """Require a valid bearer token; return the authenticated identity."""
    authorization = request.headers.get("authorization", "")
    if not authorization.lower().startswith(_BEARER_PREFIX):
        raise _unauthorized("missing bearer token")

    claims = _decode(authorization[len(_BEARER_PREFIX) :].strip())
    if claims.get("banned"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "account is banned")
    return AuthUser(
        id=claims["sub"],
        email=claims.get("email"),
        role=claims.get("role"),
    )


CurrentUser = Annotated[AuthUser, Depends(get_current_user)]


async def get_admin_user(user: CurrentUser) -> AuthUser:
    """Require the authenticated user to have the admin role."""
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "admin role required")
    return user


AdminUser = Annotated[AuthUser, Depends(get_admin_user)]
