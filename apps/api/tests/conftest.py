from __future__ import annotations

import os
import uuid
from collections.abc import AsyncIterator
from typing import Any

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get("TEST_DATABASE_URL", "postgresql+asyncpg://prism:prism@localhost:5432/prism_test"),
)
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test")
os.environ.setdefault("DATAFORSEO_LOGIN", "x")
os.environ.setdefault("DATAFORSEO_PASSWORD", "x")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")
os.environ.setdefault("CELERY_BROKER_URL", "redis://localhost:6379/14")
os.environ.setdefault("CELERY_RESULT_BACKEND", "redis://localhost:6379/13")
os.environ.setdefault("CLERK_JWKS_URL", "https://example/.well-known/jwks.json")

from app.core.config import settings  # noqa: E402
from app.models import Base, Job, User, Workspace  # noqa: E402


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def _engine():
    engine = create_async_engine(settings.database_url, poolclass=None)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(loop_scope="session")
async def db_session(_engine) -> AsyncIterator[AsyncSession]:
    conn = await _engine.connect()
    trans = await conn.begin()
    Session = async_sessionmaker(bind=conn, expire_on_commit=False, class_=AsyncSession)
    session = Session()
    try:
        yield session
    finally:
        await session.close()
        await trans.rollback()
        await conn.close()


@pytest_asyncio.fixture(loop_scope="session")
async def sample_user(db_session: AsyncSession) -> User:
    u = User(id=f"user_{uuid.uuid4().hex[:8]}", email=f"{uuid.uuid4().hex[:8]}@x.test", name="T")
    db_session.add(u)
    await db_session.flush()
    return u


@pytest_asyncio.fixture(loop_scope="session")
async def sample_workspace(db_session: AsyncSession, sample_user: User) -> Workspace:
    w = Workspace(user_id=sample_user.id, name="w", domain="example.test")
    db_session.add(w)
    await db_session.flush()
    return w


@pytest.fixture
def sample_job(db_session: AsyncSession, sample_workspace: Workspace):
    async def _make(status: str = "pending", type: str = "orchestrator", **extra: Any) -> Job:
        j = Job(
            workspace_id=sample_workspace.id,
            type=type,
            status=status,
            input=extra.pop("input", {}),
            **extra,
        )
        db_session.add(j)
        await db_session.flush()
        return j

    async def _sync_factory(**kw: Any) -> Job:
        return await _make(**kw)

    return _sync_factory
