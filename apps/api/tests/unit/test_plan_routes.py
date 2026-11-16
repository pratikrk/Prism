from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.auth.clerk import current_user, ClerkPrincipal
from app.core.db import get_session


@pytest.fixture
def fake_principal():
    return ClerkPrincipal(user_id="user_test")


@pytest.fixture
def override_auth(fake_principal):
    app.dependency_overrides[current_user] = lambda: fake_principal
    yield
    app.dependency_overrides.pop(current_user, None)
    app.dependency_overrides.pop(get_session, None)


def _make_plan(plan_status="draft"):
    plan = MagicMock()
    plan.id = uuid.uuid4()
    plan.plan_status = plan_status
    plan.workspace_id = uuid.uuid4()
    plan.job_id = uuid.uuid4()
    plan.intent = "grow signups"
    plan.domain = "example.io"
    plan.competitors = ["a.com"]
    plan.timeline_weeks = 12
    plan.sprint_order = ["keyword"]
    plan.version = 1
    plan.feedback = None
    plan.parent_plan_id = None
    return plan


def _make_workspace(user_id="user_test"):
    ws = MagicMock()
    ws.user_id = user_id
    return ws


@pytest.mark.asyncio
async def test_patch_plan_updates_fields(override_auth):
    """PATCH /plans/{id} updates intent, competitors, timeline_weeks."""
    fake_plan = _make_plan()
    mock_workspace = _make_workspace()

    async def fake_session_get(model, pk):
        if hasattr(model, "__tablename__") and model.__tablename__ == "plans":
            return fake_plan
        return mock_workspace

    mock_session = AsyncMock()
    mock_session.get = AsyncMock(side_effect=fake_session_get)
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()

    async def override_session():
        yield mock_session

    app.dependency_overrides[get_session] = override_session

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.patch(
            f"/plans/{fake_plan.id}",
            json={"intent": "updated intent", "timeline_weeks": 16},
            headers={"Authorization": "Bearer fake"},
        )

    assert res.status_code == 200


@pytest.mark.asyncio
async def test_patch_plan_rejects_non_draft(override_auth):
    """PATCH on an approved plan returns 409."""
    fake_plan = _make_plan(plan_status="approved")
    mock_workspace = _make_workspace()

    async def fake_session_get(model, pk):
        if hasattr(model, "__tablename__") and model.__tablename__ == "plans":
            return fake_plan
        return mock_workspace

    mock_session = AsyncMock()
    mock_session.get = AsyncMock(side_effect=fake_session_get)

    async def override_session():
        yield mock_session

    app.dependency_overrides[get_session] = override_session

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.patch(
            f"/plans/{fake_plan.id}",
            json={"timeline_weeks": 8},
            headers={"Authorization": "Bearer fake"},
        )

    assert res.status_code == 409


@pytest.mark.asyncio
async def test_patch_plan_validates_timeline(override_auth):
    """timeline_weeks outside 1-52 returns 422."""
    plan_id = uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.patch(
            f"/plans/{plan_id}",
            json={"timeline_weeks": 0},
            headers={"Authorization": "Bearer fake"},
        )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_patch_plan_validates_competitors_max(override_auth):
    """More than 10 competitors returns 422."""
    plan_id = uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.patch(
            f"/plans/{plan_id}",
            json={"competitors": [f"site{i}.com" for i in range(11)]},
            headers={"Authorization": "Bearer fake"},
        )
    assert res.status_code == 422
