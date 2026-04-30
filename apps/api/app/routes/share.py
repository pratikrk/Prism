from __future__ import annotations

import pydantic
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.models import StrategyBrief

router = APIRouter(prefix="/share", tags=["share"])


class PublicBriefOut(pydantic.BaseModel):
    id: str
    workspace_id: str
    plan_id: str
    clusters: list
    executive_summary: list
    status: str
    created_at: str

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
