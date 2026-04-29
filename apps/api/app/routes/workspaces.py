from __future__ import annotations

import uuid

import pydantic
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import ClerkPrincipal, current_user
from app.core.db import get_session
from app.models import User, Workspace

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


class WorkspaceIn(pydantic.BaseModel):
    name: str
    domain: str


class WorkspaceOut(pydantic.BaseModel):
    id: uuid.UUID
    name: str
    domain: str
    user_id: str
    org_id: str | None

    model_config = pydantic.ConfigDict(from_attributes=True)


async def _ensure_user(session: AsyncSession, principal: ClerkPrincipal) -> None:
    """Upsert user row from JWT claims. Webhook keeps it up-to-date in prod;
    this covers local dev where Clerk can't POST to localhost."""
    stmt = (
        pg_insert(User)
        .values(id=principal.user_id, email=f"{principal.user_id}@clerk.local", name="")
        .on_conflict_do_nothing(index_elements=["id"])
    )
    await session.execute(stmt)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=WorkspaceOut)
async def create_workspace(
    body: WorkspaceIn,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Workspace:
    await _ensure_user(session, principal)
    w = Workspace(
        user_id=principal.user_id,
        org_id=principal.org_id,
        name=body.name,
        domain=body.domain.strip().lower(),
    )
    session.add(w)
    await session.commit()
    await session.refresh(w)
    return w


@router.get("", response_model=list[WorkspaceOut])
async def list_workspaces(
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[Workspace]:
    result = await session.execute(select(Workspace).where(Workspace.user_id == principal.user_id))
    return list(result.scalars().all())


@router.get("/{workspace_id}", response_model=WorkspaceOut)
async def get_workspace(
    workspace_id: uuid.UUID,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Workspace:
    w = await session.get(Workspace, workspace_id)
    if w is None or w.user_id != principal.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "workspace not found")
    return w
