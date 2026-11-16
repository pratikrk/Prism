from __future__ import annotations

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.orm import Session

from app.agents.quick_audit import ActionItem, AuditScore, QuickAuditResult
from app.models import AuditResult, Workspace, User
from app.workers.tasks import quick_audit_task


def _fake_audit_result(domain: str) -> QuickAuditResult:
    return QuickAuditResult(
        domain=domain,
        estimated_monthly_traffic=1000,
        top_keywords=["kw1"],
        score=AuditScore(technical=70, content=60, ai_visibility=80, overall=70),
        action_items=[
            ActionItem(severity="high", title="Fix something", rationale="because", effort_minutes=30)
        ],
    )


def test_quick_audit_task_stores_result(db_session_sync: Session, sample_workspace_sync: Workspace, celery_worker):
    with (
        patch(
            "app.agents.quick_audit.QuickAuditAgent.run",
            new=AsyncMock(return_value=_fake_audit_result(sample_workspace_sync.domain)),
        ),
    ):
        result = quick_audit_task.delay(str(sample_workspace_sync.id)).get(timeout=30)

    assert result["ok"] is True

    db_session_sync.expire_all()
    from sqlalchemy import select
    row = db_session_sync.execute(
        select(AuditResult).where(AuditResult.workspace_id == sample_workspace_sync.id)
    ).scalar_one_or_none()
    assert row is not None
    assert row.result["domain"] == sample_workspace_sync.domain
    assert row.result["score"]["overall"] == 70


def test_quick_audit_task_survives_agent_exception(db_session_sync: Session, sample_workspace_sync: Workspace, celery_worker):
    """Task must always return a dict — never raise past the boundary."""
    with patch(
        "app.agents.quick_audit.QuickAuditAgent.run",
        new=AsyncMock(side_effect=RuntimeError("agent exploded")),
    ):
        result = quick_audit_task.delay(str(sample_workspace_sync.id)).get(timeout=30)

    assert result["ok"] is False
    assert "error" in result
