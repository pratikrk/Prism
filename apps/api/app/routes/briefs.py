from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pydantic
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import ClerkPrincipal, current_user
from app.core.db import get_session
from app.core.jobs import transition
from app.models import Job, StrategyBrief, Workspace
from app.workers.tasks import synthesis_task

router = APIRouter(prefix="/briefs", tags=["briefs"])


class FullBriefOut(pydantic.BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    plan_id: uuid.UUID
    sprint_job_id: uuid.UUID
    clusters: list
    executive_summary: list
    share_token: str | None
    status: str
    approved_at: datetime | None
    created_at: datetime
    keyword_result: dict | None = None
    competitor_result: dict | None = None
    content_audit_result: dict | None = None
    llm_visibility_result: dict | None = None

    model_config = pydantic.ConfigDict(from_attributes=True)


class BriefApproveOut(pydantic.BaseModel):
    id: uuid.UUID
    status: str
    share_token: str
    approved_at: str

    model_config = pydantic.ConfigDict(from_attributes=True)


class BriefRefineIn(pydantic.BaseModel):
    feedback: str = pydantic.Field(min_length=1, max_length=2000)


async def _load_brief(
    session: AsyncSession, principal: ClerkPrincipal, brief_id: uuid.UUID
) -> StrategyBrief:
    brief = await session.get(StrategyBrief, brief_id)
    if brief is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "brief not found")
    ws = await session.get(Workspace, brief.workspace_id)
    if ws is None or ws.user_id != principal.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "brief not found")
    return brief


@router.get("/{brief_id}", response_model=FullBriefOut)
async def get_brief(
    brief_id: uuid.UUID,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    brief = await _load_brief(session, principal, brief_id)
    result = await session.execute(
        select(Job).where(Job.parent_job_id == brief.sprint_job_id, Job.status == "complete")
    )
    child_results: dict[str, dict | None] = {child.type: child.result for child in result.scalars()}
    return {
        "id": brief.id,
        "workspace_id": brief.workspace_id,
        "plan_id": brief.plan_id,
        "sprint_job_id": brief.sprint_job_id,
        "clusters": brief.clusters,
        "executive_summary": brief.executive_summary,
        "share_token": brief.share_token,
        "status": brief.status,
        "approved_at": brief.approved_at,
        "created_at": brief.created_at,
        "keyword_result": child_results.get("keyword"),
        "competitor_result": child_results.get("competitor"),
        "content_audit_result": child_results.get("content_audit"),
        "llm_visibility_result": child_results.get("llm_visibility"),
    }


@router.post("/{brief_id}/approve", response_model=BriefApproveOut)
async def approve_brief(
    brief_id: uuid.UUID,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    brief = await _load_brief(session, principal, brief_id)
    if brief.status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, "brief is not in draft state")

    sprint = await session.get(Job, brief.sprint_job_id)
    if sprint is None or sprint.status != "awaiting_gate1":
        raise HTTPException(status.HTTP_409_CONFLICT, "sprint is not awaiting gate-1")

    now = datetime.now(timezone.utc)
    brief.status = "approved"
    brief.approved_at = now
    await transition(session, sprint, "complete")
    await session.commit()

    return {
        "id": brief.id,
        "status": brief.status,
        "share_token": brief.share_token,
        "approved_at": now.isoformat(),
    }


@router.post("/{brief_id}/refine", status_code=status.HTTP_202_ACCEPTED)
async def refine_brief(
    brief_id: uuid.UUID,
    body: BriefRefineIn,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    brief = await _load_brief(session, principal, brief_id)
    if brief.status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, "brief is not in draft state")

    sprint = await session.get(Job, brief.sprint_job_id)
    if sprint is None or sprint.status != "awaiting_gate1":
        raise HTTPException(status.HTTP_409_CONFLICT, "sprint is not awaiting gate-1")

    sprint.input = {**sprint.input, "synthesis_feedback": body.feedback}
    await transition(session, sprint, "running")

    brief.status = "draft"
    await session.commit()

    synthesis_task.delay(str(sprint.id))
    return {"ok": True, "sprint_job_id": str(sprint.id)}
