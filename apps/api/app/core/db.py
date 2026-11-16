# apps/api/app/core/db.py
"""Async SQLAlchemy engine and session factory for Neon direct endpoint."""
from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

_db_url = settings.database_url.replace(
    "postgresql://", "postgresql+asyncpg://", 1
).replace(
    "postgres://", "postgresql+asyncpg://", 1
)

_engine: AsyncEngine = create_async_engine(
    _db_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=5,
    # asyncpg default statement cache is fine on Neon's direct endpoint.
)
SessionLocal = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)


def get_engine() -> AsyncEngine:
    return _engine


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
