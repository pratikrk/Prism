from __future__ import annotations

from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException, Query, status
from jwt import PyJWKClient

from app.core.config import settings


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    return PyJWKClient(settings.clerk_jwks_url, cache_keys=True)


class ClerkPrincipal:
    def __init__(self, user_id: str, org_id: str | None = None):
        self.user_id = user_id
        self.org_id = org_id


async def current_user(
    authorization: str | None = Header(default=None, alias="Authorization"),
    t: str | None = Query(default=None),
) -> ClerkPrincipal:
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
    elif t:
        token = t
    else:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"invalid token: {exc}")
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "no subject in token")
    org = claims.get("org_id")
    return ClerkPrincipal(user_id=sub, org_id=org)
