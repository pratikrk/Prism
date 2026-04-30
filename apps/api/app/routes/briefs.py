from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pydantic
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import ClerkPrincipal, current_user
from app.core.db import get_session
from app.core.jobs import transition
from app.models import Job, StrategyBrief, Workspace
from app.workers.tasks import synthesis_task

router = APIRouter(prefix="/briefs", tags=["briefs"])


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
