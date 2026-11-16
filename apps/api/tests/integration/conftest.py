"""Integration test fixtures: sync SQLAlchemy session, real Celery worker."""
from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from celery.contrib.testing.worker import start_worker
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import User, Workspace
from app.workers.celery_app import celery_app


@pytest.fixture(scope="session")
def _sync_engine():
    url = settings.database_url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
    return create_engine(url, future=True)


@pytest.fixture
def db_session_sync(_sync_engine):
    with Session(_sync_engine) as s:
        yield s


@pytest.fixture
def sample_workspace_sync(db_session_sync):
    u = User(id=f"user_{uuid.uuid4().hex[:8]}", email=f"{uuid.uuid4().hex[:6]}@x.test", name="T")
    db_session_sync.add(u)
    db_session_sync.flush()
    w = Workspace(user_id=u.id, name="w", domain="x.test")
    db_session_sync.add(w)
    db_session_sync.commit()
    return w


@pytest.fixture(scope="session")
def celery_worker():
    with start_worker(celery_app, perform_ping_check=False, loglevel="info"):
        yield


@pytest_asyncio.fixture(autouse=True, loop_scope="session")
async def reset_app_engine_pool():
    """Dispose the app's SQLAlchemy pool before each test.

    asyncio.to_thread tasks create connections in thread-local event loops
    (via asyncio.run). Those loops close after the task, leaving stale asyncpg
    connections in the pool. Disposing (without closing) before the next test
    ensures the session-loop-based tests get fresh connections.
    """
    from app.core.db import _engine as app_engine
    await app_engine.dispose(close=False)
    yield
