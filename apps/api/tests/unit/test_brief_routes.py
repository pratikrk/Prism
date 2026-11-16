from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.clerk import ClerkPrincipal, current_user
from app.core.db import get_session
from app.main import app


@pytest.fixture
def fake_principal():
    return ClerkPrincipal(user_id="user_test")


@pytest.fixture
def override_auth(fake_principal):
    app.dependency_overrides[current_user] = lambda: fake_principal
    yield
    app.dependency_overrides.pop(current_user, None)
    app.dependency_overrides.pop(get_session, None)


def _make_session(objects_by_id: dict) -> AsyncMock:
    mock_session = AsyncMock()

    async def fake_get(model, pk):
        return objects_by_id.get(str(pk))

    mock_session.get = AsyncMock(side_effect=fake_get)
    mock_session.commit = AsyncMock()

    async def override_session():
        yield mock_session

    app.dependency_overrides[get_session] = override_session
    return mock_session


@pytest.mark.asyncio
async def test_approve_brief_sets_approved(override_auth):
    brief_id = uuid.uuid4()
    sprint_id = uuid.uuid4()
    ws_id = uuid.uuid4()

    fake_brief = MagicMock()
    fake_brief.id = brief_id
    fake_brief.status = "draft"
    fake_brief.workspace_id = ws_id
    fake_brief.sprint_job_id = sprint_id
    fake_brief.share_token = str(uuid.uuid4())

    fake_sprint = MagicMock()
    fake_sprint.status = "awaiting_gate1"
    fake_sprint.id = sprint_id

    fake_ws = MagicMock()
    fake_ws.user_id = "user_test"

    _make_session({
        str(brief_id): fake_brief,
        str(sprint_id): fake_sprint,
        str(ws_id): fake_ws,
    })

    with patch("app.routes.briefs.transition", new_callable=AsyncMock):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post(
                f"/briefs/{brief_id}/approve",
                headers={"Authorization": "Bearer fake"},
            )

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "approved"
    assert "share_token" in data


@pytest.mark.asyncio
async def test_approve_brief_404_on_wrong_user(override_auth):
    brief_id = uuid.uuid4()
    ws_id = uuid.uuid4()

    fake_brief = MagicMock()
    fake_brief.id = brief_id
    fake_brief.status = "draft"
    fake_brief.workspace_id = ws_id

    fake_ws = MagicMock()
    fake_ws.user_id = "other_user"   # different user

    _make_session({str(brief_id): fake_brief, str(ws_id): fake_ws})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            f"/briefs/{brief_id}/approve",
            headers={"Authorization": "Bearer fake"},
        )

    assert res.status_code == 404


@pytest.mark.asyncio
async def test_approve_already_approved_returns_409(override_auth):
    brief_id = uuid.uuid4()
    ws_id = uuid.uuid4()

    fake_brief = MagicMock()
    fake_brief.id = brief_id
    fake_brief.status = "approved"   # already approved
    fake_brief.workspace_id = ws_id

    fake_ws = MagicMock()
    fake_ws.user_id = "user_test"

    _make_session({str(brief_id): fake_brief, str(ws_id): fake_ws})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            f"/briefs/{brief_id}/approve",
            headers={"Authorization": "Bearer fake"},
        )

    assert res.status_code == 409
