from __future__ import annotations

import uuid
from datetime import datetime

import pydantic
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.models import StrategyBrief

router = APIRouter(prefix="/share", tags=["share"])


class PublicBriefOut(pydantic.BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    plan_id: uuid.UUID
    clusters: list
    executive_summary: list
    status: str
    created_at: datetime

    model_config = pydantic.ConfigDict(from_attributes=True)


@router.get("/{token}", response_model=PublicBriefOut)
async def get_shared_brief(
    token: str,
    session: AsyncSession = Depends(get_session),
) -> StrategyBrief:
    result = await session.execute(
        select(StrategyBrief).where(StrategyBrief.share_token == token)
    )
    brief = result.scalar_one_or_none()
    if brief is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "brief not found")
    return brief
