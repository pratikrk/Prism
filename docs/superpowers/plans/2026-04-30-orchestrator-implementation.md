# Orchestrator Gate-0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Gate-0 plan review to the Prism pipeline — orchestrator stops at `awaiting_gate0` after producing a Plan; user reviews, edits, refines (re-plan with feedback), and approves before the research chord fires. The workspace page becomes a chat-style conversation thread.

**Architecture:** Backend adds a new `awaiting_gate0` job status, four plan columns, and four new API endpoints (`PATCH /plans/{id}`, `POST /plans/{id}/approve`, `POST /plans/{id}/refine`, `GET /workspaces/{id}/thread`). Frontend replaces the current workspace detail page with a `ConversationThread` showing `GoalBubble` → `PlanCard` → optional `ConfirmCard` + `JobBoardInThread` exchanges.

**Tech Stack:** Python 3.12 · FastAPI · Celery · SQLAlchemy async · Alembic · Next.js 16 · React · Tailwind · shadcn/ui · SWR · Vitest · @prism/types

**Spec:** `docs/superpowers/specs/2026-04-29-orchestrator-design.md`

---

## File Structure

### New files
- `apps/api/alembic/versions/0003_orchestrator_gate0.py` — migration for new plan columns
- `apps/api/app/routes/plans.py` — PATCH, approve, refine, thread endpoints
- `apps/api/tests/unit/test_plan_routes.py` — unit tests for plan endpoints
- `apps/api/tests/integration/test_gate0_flow.py` — integration tests
- `apps/web/components/goal-bubble.tsx` — user goal/refinement bubble
- `apps/web/components/plan-card.tsx` — AI plan response card with inline edit
- `apps/web/components/confirm-card.tsx` — approval confirmation
- `apps/web/components/conversation-thread.tsx` — full thread renderer
- `apps/web/tests/goal-bubble.test.tsx`
- `apps/web/tests/plan-card.test.tsx`
- `apps/web/tests/confirm-card.test.tsx`
- `apps/web/tests/conversation-thread.test.tsx`

### Modified files
- `apps/api/app/models/plan.py` — add version, feedback, plan_status, parent_plan_id
- `apps/api/app/core/jobs.py` — add awaiting_gate0 to transition table
- `apps/api/app/workers/tasks.py` — orchestrator stops at awaiting_gate0; refine support
- `apps/api/app/main.py` — register plans router
- `apps/api/tests/unit/test_transition.py` — new awaiting_gate0 transition tests
- `packages/types/src/index.ts` — add awaiting_gate0, Plan fields, ThreadItem types
- `apps/web/lib/api.ts` — add approvePlan, refinePlan, patchPlan, getThread
- `apps/web/app/(app)/workspaces/[id]/page.tsx` — replace with ConversationThread

---

## Task 1: DB migration — add Gate-0 columns to plans

**Files:**
- Create: `apps/api/alembic/versions/0003_orchestrator_gate0.py`

- [ ] **Step 1: Create the migration file**

```python
# apps/api/alembic/versions/0003_orchestrator_gate0.py
"""orchestrator gate0 plan columns

Revision ID: 0003
Revises: 0001
Create Date: 2026-04-30
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("plans", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("plans", sa.Column("feedback", sa.Text(), nullable=True))
    op.add_column(
        "plans",
        sa.Column("plan_status", sa.String(), nullable=False, server_default="draft"),
    )
    op.add_column(
        "plans",
        sa.Column(
            "parent_plan_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("plans.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("plans", "parent_plan_id")
    op.drop_column("plans", "plan_status")
    op.drop_column("plans", "feedback")
    op.drop_column("plans", "version")
```

- [ ] **Step 2: Run the migration**

```bash
cd apps/api && uv run alembic upgrade head
```

Expected output ends with: `Running upgrade 0001 -> 0003, orchestrator gate0 plan columns`

- [ ] **Step 3: Commit**

```bash
git add apps/api/alembic/versions/0003_orchestrator_gate0.py
git commit -m "feat(api): migration 0003 — Gate-0 plan columns"
```

---

## Task 2: Update Plan SQLAlchemy model

**Files:**
- Modify: `apps/api/app/models/plan.py`

- [ ] **Step 1: Replace plan.py with updated model**

```python
# apps/api/app/models/plan.py
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ._base import Base, TimestampMixin


class Plan(Base, TimestampMixin):
    __tablename__ = "plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    intent: Mapped[str] = mapped_column(String, nullable=False)
    domain: Mapped[str] = mapped_column(String, nullable=False)
    competitors: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    timeline_weeks: Mapped[int] = mapped_column(Integer, nullable=False)
    sprint_order: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    plan_status: Mapped[str] = mapped_column(String, nullable=False, default="draft")
    parent_plan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("plans.id", ondelete="SET NULL"),
        nullable=True,
    )
```

- [ ] **Step 2: Verify import still works**

```bash
cd apps/api && uv run python -c "from app.models.plan import Plan; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/models/plan.py
git commit -m "feat(api): Plan model — version, feedback, plan_status, parent_plan_id"
```

---

## Task 3: Update transition table + unit tests for awaiting_gate0

**Files:**
- Modify: `apps/api/app/core/jobs.py`
- Modify: `apps/api/tests/unit/test_transition.py`

- [ ] **Step 1: Write failing tests first**

Add to `tests/unit/test_transition.py` (append after existing tests):

```python
@pytest.mark.asyncio
async def test_running_to_awaiting_gate0(db_session, sample_job):
    job = await sample_job(status="running", type="orchestrator")
    result = await transition(db_session, job, "awaiting_gate0")
    assert result.status == "awaiting_gate0"


@pytest.mark.asyncio
async def test_awaiting_gate0_to_complete(db_session, sample_job):
    job = await sample_job(status="awaiting_gate0", type="orchestrator")
    result = await transition(db_session, job, "complete")
    assert result.status == "complete"


@pytest.mark.asyncio
async def test_awaiting_gate0_illegal_to_running(db_session, sample_job):
    job = await sample_job(status="awaiting_gate0", type="orchestrator")
    with pytest.raises(IllegalTransition):
        await transition(db_session, job, "running")
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/api && uv run pytest tests/unit/test_transition.py -x -q 2>&1 | tail -10
```

Expected: `ERRORS` — `awaiting_gate0` not in `_ALLOWED`

- [ ] **Step 3: Update jobs.py transition table**

```python
# apps/api/app/core/jobs.py  — replace _ALLOWED dict only
_ALLOWED: dict[str, set[str]] = {
    "pending": {"running"},
    "running": {"complete", "failed", "complete_with_errors", "awaiting_gate0"},
    "awaiting_gate0": {"complete"},
    "complete": set(),
    "failed": {"running"},
    "complete_with_errors": set(),
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd apps/api && uv run pytest tests/unit/test_transition.py -q 2>&1 | tail -5
```

Expected: all pass (no errors/failures)

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/core/jobs.py apps/api/tests/unit/test_transition.py
git commit -m "feat(api): add awaiting_gate0 to job transition table"
```

---

## Task 4: Update orchestrator_task for Gate-0

**Files:**
- Modify: `apps/api/app/workers/tasks.py`
- Modify: `apps/api/tests/unit/test_task_contract.py` (add Gate-0 test)

- [ ] **Step 1: Write failing test**

Add to `tests/unit/test_task_contract.py`:

```python
@pytest.mark.asyncio
async def test_orchestrator_stops_at_awaiting_gate0(db_session, sample_workspace):
    """orchestrator_task must NOT dispatch chord — stops at awaiting_gate0."""
    from unittest.mock import AsyncMock, MagicMock, patch
    from app.workers.tasks import orchestrator_task
    from app.models import Job
    import uuid

    job = Job(
        workspace_id=sample_workspace.id,
        type="orchestrator",
        status="pending",
        input={"goal": "50k signups in 6 months"},
    )
    db_session.add(job)
    await db_session.flush()
    job_id = str(job.id)

    fake_plan = MagicMock()
    fake_plan.intent = "grow signups"
    fake_plan.domain = sample_workspace.domain
    fake_plan.competitors = ["greenhouse.io"]
    fake_plan.timeline_weeks = 24
    fake_plan.sprint_order = ["keyword", "competitor", "content_audit", "llm_visibility"]

    with (
        patch("app.workers.tasks.OrchestratorAgent") as MockAgent,
        patch("app.workers.tasks._dispatch_chord") as mock_dispatch,
    ):
        MockAgent.return_value.run = AsyncMock(return_value=fake_plan)
        result = orchestrator_task(job_id)

    assert result["ok"] is True
    assert "plan_id" in result
    mock_dispatch.assert_not_called()

    await db_session.refresh(job)
    assert job.status == "awaiting_gate0"
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/api && uv run pytest tests/unit/test_task_contract.py::test_orchestrator_stops_at_awaiting_gate0 -x -q 2>&1 | tail -10
```

Expected: FAIL — `mock_dispatch.assert_not_called()` fails (chord is currently called)

- [ ] **Step 3: Update orchestrator_task in tasks.py**

Replace the `orchestrator_task` function (lines 40–91):

```python
@celery_app.task(bind=True, name="agents.orchestrator")
def orchestrator_task(self, job_id: str) -> dict:
    async def _body() -> dict:
        async with SessionLocal() as session:
            job = await _load_job(session, job_id)
            workspace = await session.get(Workspace, job.workspace_id)
            assert workspace is not None
            await transition(session, job, "running")
            await session.commit()

            try:
                goal = job.input.get("goal", "")
                feedback = job.input.get("feedback")
                full_goal = f"{goal}\n\nFeedback: {feedback}" if feedback else goal
                plan = await OrchestratorAgent().run(
                    OrchestratorInput(goal=full_goal, domain=workspace.domain)
                )
            except Exception as exc:
                err = classify(exc, provider="claude")
                sentry_sdk.capture_exception(exc)
                await transition(session, job, "failed", error=err)
                await session.commit()
                return {"ok": False, "error": err.to_json()}

            parent_plan_id_str = job.input.get("parent_plan_id")
            version = 1
            if parent_plan_id_str:
                parent = await session.get(PlanModel, uuid.UUID(parent_plan_id_str))
                if parent is not None:
                    version = parent.version + 1

            plan_row = PlanModel(
                job_id=job.id,
                workspace_id=job.workspace_id,
                intent=plan.intent,
                domain=plan.domain,
                competitors=plan.competitors,
                timeline_weeks=plan.timeline_weeks,
                sprint_order=plan.sprint_order,
                version=version,
                feedback=feedback,
                plan_status="draft",
                parent_plan_id=uuid.UUID(parent_plan_id_str) if parent_plan_id_str else None,
            )
            session.add(plan_row)
            await session.flush()
            await transition(
                session, job, "awaiting_gate0", result={"plan_id": str(plan_row.id)}
            )
            await session.commit()
            return {"ok": True, "plan_id": str(plan_row.id)}

    return _run(_body())
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd apps/api && uv run pytest tests/unit/test_task_contract.py::test_orchestrator_stops_at_awaiting_gate0 -x -q 2>&1 | tail -5
```

Expected: PASS

- [ ] **Step 5: Run all unit tests to check nothing regressed**

```bash
cd apps/api && uv run pytest tests/unit/ -q --ignore=tests/unit/test_transition.py --ignore=tests/unit/test_task_contract.py 2>&1 | tail -10
```

Expected: all pass (DB-dependent tests will error without postgres — that's fine)

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/workers/tasks.py apps/api/tests/unit/test_task_contract.py
git commit -m "feat(api): orchestrator stops at awaiting_gate0 (Gate-0)"
```

---

## Task 5: Create plans router (PATCH, approve, refine)

**Files:**
- Create: `apps/api/app/routes/plans.py`
- Create: `apps/api/tests/unit/test_plan_routes.py`

- [ ] **Step 1: Write failing unit tests**

```python
# apps/api/tests/unit/test_plan_routes.py
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
def fake_principal():
    from app.auth.clerk import ClerkPrincipal
    return ClerkPrincipal(user_id="user_test")


@pytest.fixture
def override_auth(fake_principal):
    from app.auth.clerk import current_user
    app.dependency_overrides[current_user] = lambda: fake_principal
    yield
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_patch_plan_updates_fields(override_auth):
    """PATCH /plans/{id} updates intent, competitors, timeline_weeks."""
    plan_id = uuid.uuid4()
    fake_plan = MagicMock()
    fake_plan.id = plan_id
    fake_plan.plan_status = "draft"
    fake_plan.workspace_id = uuid.uuid4()
    fake_plan.job_id = uuid.uuid4()
    fake_plan.intent = "grow signups"
    fake_plan.domain = "example.io"
    fake_plan.competitors = ["a.com"]
    fake_plan.timeline_weeks = 12
    fake_plan.sprint_order = ["keyword"]
    fake_plan.version = 1
    fake_plan.feedback = None
    fake_plan.parent_plan_id = None

    mock_workspace = MagicMock()
    mock_workspace.user_id = "user_test"

    async def fake_get(model, pk):
        if model.__tablename__ == "plans":
            return fake_plan
        if model.__tablename__ == "workspaces":
            return mock_workspace
        return None

    with patch("app.routes.plans.get_session") as mock_session_dep:
        mock_session = AsyncMock()
        mock_session.get = AsyncMock(side_effect=lambda m, pk: (
            fake_plan if hasattr(m, '__tablename__') and m.__tablename__ == "plans"
            else mock_workspace
        ))
        mock_session.commit = AsyncMock()
        mock_session.refresh = AsyncMock()
        mock_session_dep.return_value = mock_session

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.patch(
                f"/plans/{plan_id}",
                json={"intent": "updated intent", "timeline_weeks": 16},
                headers={"Authorization": "Bearer fake"},
            )

    assert res.status_code == 200


@pytest.mark.asyncio
async def test_patch_plan_rejects_non_draft(override_auth):
    """PATCH on an approved plan returns 409."""
    plan_id = uuid.uuid4()
    fake_plan = MagicMock()
    fake_plan.plan_status = "approved"
    fake_plan.workspace_id = uuid.uuid4()

    mock_workspace = MagicMock()
    mock_workspace.user_id = "user_test"

    with patch("app.routes.plans.get_session") as mock_session_dep:
        mock_session = AsyncMock()
        mock_session.get = AsyncMock(side_effect=lambda m, pk: (
            fake_plan if hasattr(m, '__tablename__') and m.__tablename__ == "plans"
            else mock_workspace
        ))
        mock_session_dep.return_value = mock_session

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.patch(
                f"/plans/{plan_id}",
                json={"timeline_weeks": 8},
                headers={"Authorization": "Bearer fake"},
            )

    assert res.status_code == 409


@pytest.mark.asyncio
async def test_patch_plan_validates_timeline(override_auth):
    """timeline_weeks outside 1–52 returns 422."""
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/api && uv run pytest tests/unit/test_plan_routes.py -x -q 2>&1 | tail -10
```

Expected: errors — `/plans/{id}` route does not exist yet

- [ ] **Step 3: Create plans.py router**

```python
# apps/api/app/routes/plans.py
from __future__ import annotations

import uuid
from typing import Annotated

import pydantic
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import ClerkPrincipal, current_user
from app.core.db import get_session
from app.core.jobs import transition
from app.models import Job, Plan as PlanModel, User, Workspace
from app.workers.tasks import _dispatch_chord, orchestrator_task

router = APIRouter(prefix="/plans", tags=["plans"])


class PlanOut(pydantic.BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    workspace_id: uuid.UUID
    intent: str
    domain: str
    competitors: list[str]
    timeline_weeks: int
    sprint_order: list[str]
    version: int
    feedback: str | None
    plan_status: str
    parent_plan_id: uuid.UUID | None

    model_config = pydantic.ConfigDict(from_attributes=True)


class JobOut(pydantic.BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    parent_job_id: uuid.UUID | None
    type: str
    status: str
    input: dict
    result: dict | None
    error: dict | None

    model_config = pydantic.ConfigDict(from_attributes=True)


class PlanPatchIn(pydantic.BaseModel):
    intent: str | None = None
    competitors: Annotated[list[str] | None, pydantic.Field(None, max_length=10)] = None
    timeline_weeks: Annotated[int | None, pydantic.Field(None, ge=1, le=52)] = None


class PlanRefineIn(pydantic.BaseModel):
    feedback: str = pydantic.Field(min_length=1, max_length=2000)


async def _load_plan(
    session: AsyncSession, principal: ClerkPrincipal, plan_id: uuid.UUID
) -> PlanModel:
    plan = await session.get(PlanModel, plan_id)
    if plan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "plan not found")
    ws = await session.get(Workspace, plan.workspace_id)
    if ws is None or ws.user_id != principal.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "plan not found")
    return plan


async def _assert_no_active_orchestrator(
    session: AsyncSession, workspace_id: uuid.UUID
) -> None:
    active = await session.execute(
        select(Job).where(
            Job.workspace_id == workspace_id,
            Job.type == "orchestrator",
            Job.status.in_(("pending", "running")),
        )
    )
    if active.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "another orchestrator is in-flight")


@router.patch("/{plan_id}", response_model=PlanOut)
async def patch_plan(
    plan_id: uuid.UUID,
    body: PlanPatchIn,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> PlanModel:
    plan = await _load_plan(session, principal, plan_id)
    if plan.plan_status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, "only draft plans can be edited")
    if body.intent is not None:
        plan.intent = body.intent
    if body.competitors is not None:
        plan.competitors = body.competitors
    if body.timeline_weeks is not None:
        plan.timeline_weeks = body.timeline_weeks
    await session.commit()
    await session.refresh(plan)
    return plan


@router.post("/{plan_id}/approve", response_model=JobOut)
async def approve_plan(
    plan_id: uuid.UUID,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Job:
    plan = await _load_plan(session, principal, plan_id)
    if plan.plan_status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, "plan is not in draft state")

    orch_job = await session.get(Job, plan.job_id)
    if orch_job is None or orch_job.status != "awaiting_gate0":
        raise HTTPException(status.HTTP_409_CONFLICT, "orchestrator is not awaiting gate-0")

    await _assert_no_active_orchestrator(session, plan.workspace_id)

    await transition(session, orch_job, "complete")
    plan.plan_status = "approved"

    sprint = Job(
        workspace_id=plan.workspace_id,
        parent_job_id=orch_job.id,
        type="sprint",
        status="running",
        input={"plan_id": str(plan.id)},
    )
    session.add(sprint)
    await session.flush()
    await session.commit()

    _dispatch_chord(str(plan.id), str(sprint.id))
    return sprint


@router.post("/{plan_id}/refine", response_model=JobOut)
async def refine_plan(
    plan_id: uuid.UUID,
    body: PlanRefineIn,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> Job:
    plan = await _load_plan(session, principal, plan_id)
    if plan.plan_status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, "plan is not in draft state")

    await _assert_no_active_orchestrator(session, plan.workspace_id)

    orch_job = await session.get(Job, plan.job_id)
    original_goal = orch_job.input.get("goal", "") if orch_job else ""

    plan.plan_status = "superseded"
    if orch_job and orch_job.status == "awaiting_gate0":
        await transition(session, orch_job, "complete")

    new_job = Job(
        workspace_id=plan.workspace_id,
        type="orchestrator",
        status="pending",
        input={
            "goal": original_goal,
            "feedback": body.feedback,
            "parent_plan_id": str(plan.id),
        },
    )
    session.add(new_job)
    await session.commit()
    await session.refresh(new_job)

    orchestrator_task.delay(str(new_job.id))
    return new_job
```

- [ ] **Step 4: Register plans router in main.py**

```python
# apps/api/app/main.py
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.sentry import init_sentry
from app.routes import health, jobs, webhooks, workspaces
from app.routes import plans  # new

init_sentry()

app = FastAPI(title="Prism API", version="0.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(health.router)
app.include_router(workspaces.router)
app.include_router(jobs.router)
app.include_router(plans.router)   # new
app.include_router(webhooks.router)
```

- [ ] **Step 5: Run the unit tests**

```bash
cd apps/api && uv run pytest tests/unit/test_plan_routes.py -q 2>&1 | tail -10
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/routes/plans.py apps/api/app/main.py apps/api/tests/unit/test_plan_routes.py
git commit -m "feat(api): plans router — PATCH, approve, refine endpoints"
```

---

## Task 6: Thread endpoint on workspaces router

**Files:**
- Modify: `apps/api/app/routes/workspaces.py`

- [ ] **Step 1: Add thread models and endpoint to workspaces.py**

Append to `apps/api/app/routes/workspaces.py` after the existing imports and routes:

Add to imports:
```python
from typing import Any, Literal
from sqlalchemy import select
from app.models import Plan as PlanModel
```

Add at the end of the file:

```python
# ── Thread endpoint ──────────────────────────────────────────────────────────

class ThreadGoalItem(pydantic.BaseModel):
    type: Literal["goal"] = "goal"
    job_id: uuid.UUID
    goal: str
    feedback: str | None
    job_status: str
    created_at: str


class _PlanOut(pydantic.BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    workspace_id: uuid.UUID
    intent: str
    domain: str
    competitors: list[str]
    timeline_weeks: int
    sprint_order: list[str]
    version: int
    feedback: str | None
    plan_status: str
    parent_plan_id: uuid.UUID | None
    model_config = pydantic.ConfigDict(from_attributes=True)


class _JobOut(pydantic.BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    parent_job_id: uuid.UUID | None
    type: str
    status: str
    input: dict
    result: dict | None
    error: dict | None
    model_config = pydantic.ConfigDict(from_attributes=True)


class ThreadPlanItem(pydantic.BaseModel):
    type: Literal["plan"] = "plan"
    plan: _PlanOut
    job_status: str


class ThreadJobsItem(pydantic.BaseModel):
    type: Literal["jobs"] = "jobs"
    sprint_job_id: uuid.UUID
    sprint_status: str
    children: list[_JobOut]


class ThreadErrorItem(pydantic.BaseModel):
    type: Literal["error"] = "error"
    job_id: uuid.UUID
    error: dict
    created_at: str


ThreadItem = ThreadGoalItem | ThreadPlanItem | ThreadJobsItem | ThreadErrorItem


@router.get("/{workspace_id}/thread", response_model=list[Any])
async def get_workspace_thread(
    workspace_id: uuid.UUID,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    w = await session.get(Workspace, workspace_id)
    if w is None or w.user_id != principal.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "workspace not found")

    result = await session.execute(
        select(Job)
        .where(Job.workspace_id == workspace_id, Job.type == "orchestrator")
        .order_by(Job.created_at)
    )
    orch_jobs = list(result.scalars())
    if not orch_jobs:
        return []

    orch_ids = [j.id for j in orch_jobs]

    result = await session.execute(
        select(PlanModel).where(PlanModel.job_id.in_(orch_ids))
    )
    plan_by_job: dict[uuid.UUID, PlanModel] = {p.job_id: p for p in result.scalars()}

    result = await session.execute(
        select(Job).where(Job.parent_job_id.in_(orch_ids), Job.type == "sprint")
    )
    sprint_by_parent: dict[uuid.UUID, Job] = {s.parent_job_id: s for s in result.scalars()}

    children_by_sprint: dict[uuid.UUID, list[Job]] = {}
    sprint_ids = [s.id for s in sprint_by_parent.values()]
    if sprint_ids:
        result = await session.execute(
            select(Job).where(Job.parent_job_id.in_(sprint_ids))
        )
        for child in result.scalars():
            children_by_sprint.setdefault(child.parent_job_id, []).append(child)

    items: list = []
    for orch in orch_jobs:
        items.append(ThreadGoalItem(
            type="goal",
            job_id=orch.id,
            goal=orch.input.get("goal", ""),
            feedback=orch.input.get("feedback"),
            job_status=orch.status,
            created_at=orch.created_at.isoformat(),
        ).model_dump())

        plan = plan_by_job.get(orch.id)
        if plan:
            items.append(ThreadPlanItem(
                type="plan",
                plan=_PlanOut.model_validate(plan),
                job_status=orch.status,
            ).model_dump())
        elif orch.status == "failed":
            items.append(ThreadErrorItem(
                type="error",
                job_id=orch.id,
                error=orch.error or {},
                created_at=orch.created_at.isoformat(),
            ).model_dump())

        sprint = sprint_by_parent.get(orch.id)
        if sprint:
            children = children_by_sprint.get(sprint.id, [])
            items.append(ThreadJobsItem(
                type="jobs",
                sprint_job_id=sprint.id,
                sprint_status=sprint.status,
                children=[_JobOut.model_validate(c) for c in children],
            ).model_dump())

    return items
```

- [ ] **Step 2: Verify API starts cleanly**

```bash
cd apps/api && uv run python -c "from app.main import app; print('routes:', [r.path for r in app.routes])"
```

Expected: list including `/workspaces/{workspace_id}/thread`

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/routes/workspaces.py
git commit -m "feat(api): GET /workspaces/{id}/thread conversation endpoint"
```

---

## Task 7: Integration tests for Gate-0 full flow

**Files:**
- Create: `apps/api/tests/integration/test_gate0_flow.py`

- [ ] **Step 1: Create the integration test file**

```python
# apps/api/tests/integration/test_gate0_flow.py
"""Integration tests for Gate-0 pipeline flow.

Requires: docker compose --profile test up -d  (postgres + redis)
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models import Job, Plan as PlanModel
from app.workers.tasks import orchestrator_task


@pytest.mark.asyncio
async def test_gate0_orchestrator_stops_without_dispatching_chord(
    db_session, sample_workspace
):
    """Full orchestrator run must stop at awaiting_gate0, not fire chord."""
    job = Job(
        workspace_id=sample_workspace.id,
        type="orchestrator",
        status="pending",
        input={"goal": "grow signups for test.io in 12 weeks"},
    )
    db_session.add(job)
    await db_session.flush()
    job_id = str(job.id)

    fake_plan = MagicMock(
        intent="grow signups",
        domain=sample_workspace.domain,
        competitors=["rival.io"],
        timeline_weeks=12,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
    )

    with (
        patch("app.workers.tasks.OrchestratorAgent") as MockAgent,
        patch("app.workers.tasks._dispatch_chord") as mock_dispatch,
    ):
        MockAgent.return_value.run = AsyncMock(return_value=fake_plan)
        result = orchestrator_task(job_id)

    assert result["ok"] is True
    mock_dispatch.assert_not_called()

    await db_session.refresh(job)
    assert job.status == "awaiting_gate0"

    plan_id = result["plan_id"]
    from sqlalchemy import select
    from app.models import Plan as PlanModel
    r = await db_session.execute(
        select(PlanModel).where(PlanModel.id == plan_id)
    )
    plan = r.scalar_one()
    assert plan.plan_status == "draft"
    assert plan.version == 1


@pytest.mark.asyncio
async def test_gate0_refine_increments_version(db_session, sample_workspace):
    """Refine creates new orchestrator job with version=2, marks v1 superseded."""
    job_v1 = Job(
        workspace_id=sample_workspace.id,
        type="orchestrator",
        status="pending",
        input={"goal": "grow signups"},
    )
    db_session.add(job_v1)
    await db_session.flush()

    fake_plan = MagicMock(
        intent="grow", domain=sample_workspace.domain,
        competitors=[], timeline_weeks=12,
        sprint_order=["keyword"],
    )

    with (
        patch("app.workers.tasks.OrchestratorAgent") as MockAgent,
        patch("app.workers.tasks._dispatch_chord"),
    ):
        MockAgent.return_value.run = AsyncMock(return_value=fake_plan)
        result_v1 = orchestrator_task(str(job_v1.id))

    plan_v1_id = result_v1["plan_id"]

    # Now run a v2 job (simulates refine endpoint creating new job)
    job_v2 = Job(
        workspace_id=sample_workspace.id,
        type="orchestrator",
        status="pending",
        input={
            "goal": "grow signups",
            "feedback": "focus on enterprise",
            "parent_plan_id": plan_v1_id,
        },
    )
    db_session.add(job_v2)
    await db_session.flush()

    with (
        patch("app.workers.tasks.OrchestratorAgent") as MockAgent,
        patch("app.workers.tasks._dispatch_chord"),
    ):
        MockAgent.return_value.run = AsyncMock(return_value=fake_plan)
        result_v2 = orchestrator_task(str(job_v2.id))

    from sqlalchemy import select
    r = await db_session.execute(
        select(PlanModel).where(PlanModel.id == result_v2["plan_id"])
    )
    plan_v2 = r.scalar_one()
    assert plan_v2.version == 2
    assert plan_v2.feedback == "focus on enterprise"
    assert str(plan_v2.parent_plan_id) == plan_v1_id
```

- [ ] **Step 2: Run integration tests (requires postgres)**

```bash
docker compose --profile test up -d postgres redis
cd apps/api && uv run pytest tests/integration/test_gate0_flow.py -v 2>&1 | tail -15
```

Expected: both tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/integration/test_gate0_flow.py
git commit -m "test(api): Gate-0 integration tests — awaiting_gate0 + version increment"
```

---

## Task 8: Update shared types (@prism/types)

**Files:**
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Replace types/src/index.ts**

```typescript
// packages/types/src/index.ts

export type JobType =
  | 'orchestrator'
  | 'sprint'
  | 'keyword'
  | 'competitor'
  | 'content_audit'
  | 'llm_visibility';

export type JobStatus =
  | 'pending'
  | 'running'
  | 'awaiting_gate0'
  | 'complete'
  | 'complete_with_errors'
  | 'failed';

export type PlanStatus = 'draft' | 'approved' | 'superseded';

export type ErrorKind =
  | 'rate_limit'
  | 'timeout'
  | 'external_error'
  | 'invalid_output'
  | 'invalid_input'
  | 'bug';

export interface JobError {
  kind: ErrorKind;
  message: string;
  retryable: boolean;
  provider?: string;
  trace_id?: string;
}

export interface Job {
  id: string;
  workspace_id: string;
  parent_job_id: string | null;
  type: JobType;
  status: JobStatus;
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: JobError | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Plan {
  id: string;
  job_id: string;
  workspace_id: string;
  intent: string;
  domain: string;
  competitors: string[];
  timeline_weeks: number;
  sprint_order: JobType[];
  version: number;
  feedback: string | null;
  plan_status: PlanStatus;
  parent_plan_id: string | null;
}

export interface Workspace {
  id: string;
  user_id: string;
  org_id: string | null;
  name: string;
  domain: string;
}

export interface AgentStatusEvent {
  job_id: string;
  parent_job_id: string | null;
  workspace_id: string;
  type: JobType;
  status: JobStatus;
  at: string;
  error: JobError | null;
}

export type ThreadItem =
  | ThreadGoalItem
  | ThreadPlanItem
  | ThreadJobsItem
  | ThreadErrorItem;

export interface ThreadGoalItem {
  type: 'goal';
  job_id: string;
  goal: string;
  feedback: string | null;
  job_status: JobStatus;
  created_at: string;
}

export interface ThreadPlanItem {
  type: 'plan';
  plan: Plan;
  job_status: JobStatus;
}

export interface ThreadJobsItem {
  type: 'jobs';
  sprint_job_id: string;
  sprint_status: JobStatus;
  children: Job[];
}

export interface ThreadErrorItem {
  type: 'error';
  job_id: string;
  error: JobError;
  created_at: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/types && pnpm tsc --noEmit 2>&1
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): add awaiting_gate0, Plan gate-0 fields, ThreadItem types"
```

---

## Task 9: Update lib/api.ts with new API calls

**Files:**
- Modify: `apps/web/lib/api.ts`

- [ ] **Step 1: Replace lib/api.ts**

```typescript
// apps/web/lib/api.ts
import type { Job, Plan, ThreadItem, Workspace } from '@prism/types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function fetchWithAuth(path: string, init: RequestInit, token: string): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
  });
  if (res.status >= 500) {
    const retry = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
    });
    if (!retry.ok) throw new ApiError(retry.status, await retry.text());
    return retry;
  }
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res;
}

export async function createWorkspace(
  token: string, body: { name: string; domain: string },
): Promise<Workspace> {
  return (await fetchWithAuth('/workspaces', { method: 'POST', body: JSON.stringify(body) }, token)).json();
}

export async function listWorkspaces(token: string): Promise<Workspace[]> {
  return (await fetchWithAuth('/workspaces', { method: 'GET' }, token)).json();
}

export async function submitJob(
  token: string, workspaceId: string, body: { goal: string },
): Promise<Job> {
  return (await fetchWithAuth(
    `/workspaces/${workspaceId}/jobs`,
    { method: 'POST', body: JSON.stringify(body) },
    token,
  )).json();
}

export async function listWorkspaceJobs(token: string, workspaceId: string): Promise<Job[]> {
  return (await fetchWithAuth(`/workspaces/${workspaceId}/jobs`, { method: 'GET' }, token)).json();
}

export async function retryJob(token: string, jobId: string): Promise<Job> {
  return (await fetchWithAuth(`/jobs/${jobId}/retry`, { method: 'POST' }, token)).json();
}

export async function getThread(token: string, workspaceId: string): Promise<ThreadItem[]> {
  return (await fetchWithAuth(`/workspaces/${workspaceId}/thread`, { method: 'GET' }, token)).json();
}

export async function patchPlan(
  token: string,
  planId: string,
  body: { intent?: string; competitors?: string[]; timeline_weeks?: number },
): Promise<Plan> {
  return (await fetchWithAuth(
    `/plans/${planId}`,
    { method: 'PATCH', body: JSON.stringify(body) },
    token,
  )).json();
}

export async function approvePlan(token: string, planId: string): Promise<Job> {
  return (await fetchWithAuth(`/plans/${planId}/approve`, { method: 'POST' }, token)).json();
}

export async function refinePlan(
  token: string,
  planId: string,
  feedback: string,
): Promise<Job> {
  return (await fetchWithAuth(
    `/plans/${planId}/refine`,
    { method: 'POST', body: JSON.stringify({ feedback }) },
    token,
  )).json();
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | grep "lib/api" | head -5
```

Expected: no errors for lib/api.ts

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/api.ts
git commit -m "feat(web): api.ts — getThread, patchPlan, approvePlan, refinePlan"
```

---

## Task 10: GoalBubble component

**Files:**
- Create: `apps/web/components/goal-bubble.tsx`
- Create: `apps/web/tests/goal-bubble.test.tsx`

- [ ] **Step 1: Write failing Vitest test**

```tsx
// apps/web/tests/goal-bubble.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GoalBubble } from '@/components/goal-bubble';

describe('GoalBubble', () => {
  it('renders goal text', () => {
    render(<GoalBubble goal="50k signups in 6 months" feedback={null} createdAt="2026-04-30T10:00:00Z" />);
    expect(screen.getByText('50k signups in 6 months')).toBeTruthy();
  });

  it('renders refinement feedback label when feedback present', () => {
    render(<GoalBubble goal="50k signups" feedback="add lever.co as competitor" createdAt="2026-04-30T10:00:00Z" />);
    expect(screen.getByText(/Refinement/i)).toBeTruthy();
    expect(screen.getByText('add lever.co as competitor')).toBeTruthy();
  });

  it('does not show refinement label when feedback is null', () => {
    render(<GoalBubble goal="grow traffic" feedback={null} createdAt="2026-04-30T10:00:00Z" />);
    expect(screen.queryByText(/Refinement/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/web && pnpm vitest run tests/goal-bubble.test.tsx 2>&1 | tail -10
```

Expected: FAIL — module not found

- [ ] **Step 3: Create the component**

```tsx
// apps/web/components/goal-bubble.tsx
'use client';

interface GoalBubbleProps {
  goal: string;
  feedback: string | null;
  createdAt: string;
}

export function GoalBubble({ goal, feedback, createdAt }: GoalBubbleProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] space-y-1">
        {feedback !== null && (
          <div className="text-xs text-muted-foreground text-right">Refinement</div>
        )}
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-sm">
          {feedback ?? goal}
        </div>
        <div className="text-xs text-muted-foreground text-right">
          {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd apps/web && pnpm vitest run tests/goal-bubble.test.tsx 2>&1 | tail -5
```

Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/goal-bubble.tsx apps/web/tests/goal-bubble.test.tsx
git commit -m "feat(web): GoalBubble component"
```

---

## Task 11: PlanCard component

**Files:**
- Create: `apps/web/components/plan-card.tsx`
- Create: `apps/web/tests/plan-card.test.tsx`

- [ ] **Step 1: Write failing Vitest test**

```tsx
// apps/web/tests/plan-card.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Plan } from '@prism/types';
import { PlanCard } from '@/components/plan-card';

const basePlan: Plan = {
  id: 'plan-1',
  job_id: 'job-1',
  workspace_id: 'ws-1',
  intent: 'drive organic signups',
  domain: 'whitecarrot.io',
  competitors: ['greenhouse.io', 'ashby.com'],
  timeline_weeks: 12,
  sprint_order: ['keyword', 'competitor', 'content_audit', 'llm_visibility'],
  version: 1,
  feedback: null,
  plan_status: 'draft',
  parent_plan_id: null,
};

describe('PlanCard', () => {
  it('renders plan fields', () => {
    render(
      <PlanCard plan={basePlan} jobStatus="awaiting_gate0"
        onEdit={vi.fn()} onRefine={vi.fn()} onApprove={vi.fn()} />,
    );
    expect(screen.getByText('drive organic signups')).toBeTruthy();
    expect(screen.getByText('whitecarrot.io')).toBeTruthy();
    expect(screen.getByText('12 weeks')).toBeTruthy();
  });

  it('approve button is enabled when jobStatus is awaiting_gate0', () => {
    render(
      <PlanCard plan={basePlan} jobStatus="awaiting_gate0"
        onEdit={vi.fn()} onRefine={vi.fn()} onApprove={vi.fn()} />,
    );
    const btn = screen.getByRole('button', { name: /approve/i });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('approve button is disabled when jobStatus is not awaiting_gate0', () => {
    render(
      <PlanCard plan={basePlan} jobStatus="running"
        onEdit={vi.fn()} onRefine={vi.fn()} onApprove={vi.fn()} />,
    );
    const btn = screen.getByRole('button', { name: /approve/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows superseded badge when plan_status is superseded', () => {
    render(
      <PlanCard plan={{ ...basePlan, plan_status: 'superseded' }} jobStatus="complete"
        onEdit={vi.fn()} onRefine={vi.fn()} onApprove={vi.fn()} />,
    );
    expect(screen.getByText(/superseded/i)).toBeTruthy();
  });

  it('calls onApprove when approve clicked', () => {
    const onApprove = vi.fn();
    render(
      <PlanCard plan={basePlan} jobStatus="awaiting_gate0"
        onEdit={vi.fn()} onRefine={vi.fn()} onApprove={onApprove} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    expect(onApprove).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/web && pnpm vitest run tests/plan-card.test.tsx 2>&1 | tail -10
```

Expected: FAIL — module not found

- [ ] **Step 3: Create the component**

```tsx
// apps/web/components/plan-card.tsx
'use client';

import { useState } from 'react';
import type { Plan } from '@prism/types';

interface PlanCardProps {
  plan: Plan;
  jobStatus: string;
  onEdit: (fields: { intent?: string; competitors?: string[]; timeline_weeks?: number }) => Promise<void>;
  onRefine: (feedback: string) => Promise<void>;
  onApprove: () => void;
}

export function PlanCard({ plan, jobStatus, onEdit, onRefine, onApprove }: PlanCardProps) {
  const [refineOpen, setRefineOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [refining, setRefining] = useState(false);
  const [editingTimeline, setEditingTimeline] = useState(false);
  const [timelineVal, setTimelineVal] = useState(String(plan.timeline_weeks));

  const isSuperseded = plan.plan_status === 'superseded';
  const canApprove = jobStatus === 'awaiting_gate0';

  async function submitRefine(e: React.FormEvent) {
    e.preventDefault();
    if (!feedback.trim() || refining) return;
    setRefining(true);
    try {
      await onRefine(feedback.trim());
      setFeedback('');
      setRefineOpen(false);
    } finally {
      setRefining(false);
    }
  }

  async function saveTimeline() {
    const weeks = parseInt(timelineVal, 10);
    if (weeks >= 1 && weeks <= 52) {
      await onEdit({ timeline_weeks: weeks });
    }
    setEditingTimeline(false);
  }

  return (
    <div className={`max-w-[80%] border rounded-2xl rounded-tl-sm p-4 space-y-3 text-sm ${isSuperseded ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Prism Plan v{plan.version}</span>
        {isSuperseded && (
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">superseded</span>
        )}
      </div>

      <div className="space-y-1.5">
        <Row label="Intent">{plan.intent}</Row>
        <Row label="Domain">{plan.domain}</Row>
        <Row label="Competitors">{plan.competitors.join(', ') || '—'}</Row>
        <Row label="Timeline">
          {editingTimeline ? (
            <span className="flex items-center gap-1">
              <input
                type="number" min={1} max={52}
                className="w-16 border rounded px-1 py-0.5 text-xs bg-background"
                value={timelineVal}
                onChange={(e) => setTimelineVal(e.target.value)}
                onBlur={saveTimeline}
                autoFocus
              />
              <span>weeks</span>
            </span>
          ) : (
            <button
              className="underline decoration-dashed text-left"
              onClick={() => !isSuperseded && setEditingTimeline(true)}
            >
              {plan.timeline_weeks} weeks
            </button>
          )}
        </Row>
        <Row label="Sprint order">{plan.sprint_order.join(' → ')}</Row>
      </div>

      {!isSuperseded && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            className="text-xs border rounded px-3 py-1"
            onClick={() => setRefineOpen((o) => !o)}
          >
            Refine…
          </button>
          <button
            className="text-xs border rounded px-3 py-1 bg-primary text-primary-foreground disabled:opacity-40"
            disabled={!canApprove}
            onClick={onApprove}
          >
            Approve →
          </button>
        </div>
      )}

      {refineOpen && !isSuperseded && (
        <form onSubmit={submitRefine} className="space-y-2 pt-1">
          <textarea
            className="w-full border rounded p-2 text-xs bg-background min-h-16"
            placeholder="What should change? e.g. also target lever.co, focus long-tail"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            disabled={refining}
          />
          <button
            type="submit"
            disabled={refining || !feedback.trim()}
            className="text-xs border rounded px-3 py-1 disabled:opacity-40"
          >
            {refining ? 'Re-planning…' : 'Re-plan'}
          </button>
        </form>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <span>{children}</span>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && pnpm vitest run tests/plan-card.test.tsx 2>&1 | tail -5
```

Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/plan-card.tsx apps/web/tests/plan-card.test.tsx
git commit -m "feat(web): PlanCard component with inline edit, refine, approve"
```

---

## Task 12: ConfirmCard component

**Files:**
- Create: `apps/web/components/confirm-card.tsx`
- Create: `apps/web/tests/confirm-card.test.tsx`

- [ ] **Step 1: Write failing Vitest test**

```tsx
// apps/web/tests/confirm-card.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmCard } from '@/components/confirm-card';

describe('ConfirmCard', () => {
  it('shows domain and agent count', () => {
    render(
      <ConfirmCard
        domain="whitecarrot.io"
        agentNames={['keyword', 'competitor', 'content_audit', 'llm_visibility']}
        onConfirm={vi.fn()}
        busy={false}
      />,
    );
    expect(screen.getByText(/whitecarrot\.io/)).toBeTruthy();
    expect(screen.getByText(/4 research agents/i)).toBeTruthy();
  });

  it('calls onConfirm when Start Research clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmCard
        domain="whitecarrot.io"
        agentNames={['keyword']}
        onConfirm={onConfirm}
        busy={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /start research/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('disables button when busy', () => {
    render(
      <ConfirmCard
        domain="whitecarrot.io"
        agentNames={['keyword']}
        onConfirm={vi.fn()}
        busy={true}
      />,
    );
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/web && pnpm vitest run tests/confirm-card.test.tsx 2>&1 | tail -10
```

Expected: FAIL — module not found

- [ ] **Step 3: Create the component**

```tsx
// apps/web/components/confirm-card.tsx
'use client';

interface ConfirmCardProps {
  domain: string;
  agentNames: string[];
  onConfirm: () => Promise<void> | void;
  busy: boolean;
}

export function ConfirmCard({ domain, agentNames, onConfirm, busy }: ConfirmCardProps) {
  return (
    <div className="max-w-[80%] border rounded-2xl rounded-tl-sm p-4 space-y-3 text-sm bg-muted/40">
      <p className="font-medium">
        Starting {agentNames.length} research agents for{' '}
        <span className="font-semibold">{domain}</span>
      </p>
      <ul className="text-xs text-muted-foreground space-y-0.5">
        {agentNames.map((name) => (
          <li key={name}>· {name.replace(/_/g, ' ')}</li>
        ))}
      </ul>
      <button
        className="text-xs border rounded px-3 py-1.5 bg-primary text-primary-foreground disabled:opacity-40"
        onClick={onConfirm}
        disabled={busy}
      >
        {busy ? 'Starting…' : 'Start Research'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && pnpm vitest run tests/confirm-card.test.tsx 2>&1 | tail -5
```

Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/confirm-card.tsx apps/web/tests/confirm-card.test.tsx
git commit -m "feat(web): ConfirmCard component"
```

---

## Task 13: ConversationThread component

**Files:**
- Create: `apps/web/components/conversation-thread.tsx`
- Create: `apps/web/tests/conversation-thread.test.tsx`

- [ ] **Step 1: Write failing Vitest test**

```tsx
// apps/web/tests/conversation-thread.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ThreadItem } from '@prism/types';
import { ConversationThread } from '@/components/conversation-thread';

const goalItem: ThreadItem = {
  type: 'goal',
  job_id: 'job-1',
  goal: '50k organic signups',
  feedback: null,
  job_status: 'awaiting_gate0',
  created_at: '2026-04-30T10:00:00Z',
};

const planItem: ThreadItem = {
  type: 'plan',
  plan: {
    id: 'plan-1',
    job_id: 'job-1',
    workspace_id: 'ws-1',
    intent: 'drive signups',
    domain: 'whitecarrot.io',
    competitors: ['greenhouse.io'],
    timeline_weeks: 12,
    sprint_order: ['keyword', 'competitor', 'content_audit', 'llm_visibility'],
    version: 1,
    feedback: null,
    plan_status: 'draft',
    parent_plan_id: null,
  },
  job_status: 'awaiting_gate0',
};

describe('ConversationThread', () => {
  it('renders goal bubble', () => {
    render(
      <ConversationThread
        items={[goalItem]}
        token="tok"
        workspaceId="ws-1"
        onRefetch={vi.fn()}
      />,
    );
    expect(screen.getByText('50k organic signups')).toBeTruthy();
  });

  it('renders plan card after goal', () => {
    render(
      <ConversationThread
        items={[goalItem, planItem]}
        token="tok"
        workspaceId="ws-1"
        onRefetch={vi.fn()}
      />,
    );
    expect(screen.getByText('drive signups')).toBeTruthy();
    expect(screen.getByRole('button', { name: /approve/i })).toBeTruthy();
  });

  it('renders empty state when no items', () => {
    render(
      <ConversationThread
        items={[]}
        token="tok"
        workspaceId="ws-1"
        onRefetch={vi.fn()}
      />,
    );
    expect(screen.getByText(/submit your first goal/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/web && pnpm vitest run tests/conversation-thread.test.tsx 2>&1 | tail -10
```

Expected: FAIL — module not found

- [ ] **Step 3: Create the component**

```tsx
// apps/web/components/conversation-thread.tsx
'use client';

import { useState } from 'react';
import { mutate } from 'swr';
import type { ThreadItem, ThreadJobsItem } from '@prism/types';
import { GoalBubble } from './goal-bubble';
import { PlanCard } from './plan-card';
import { ConfirmCard } from './confirm-card';
import { JobBoard } from './job-board';
import { useJobEvents } from '@/lib/sse';
import { approvePlan, patchPlan, refinePlan } from '@/lib/api';

interface ConversationThreadProps {
  items: ThreadItem[];
  token: string;
  workspaceId: string;
  onRefetch: () => void;
}

export function ConversationThread({ items, token, workspaceId, onRefetch }: ConversationThreadProps) {
  const [pendingApprove, setPendingApprove] = useState<string | null>(null);
  const [approvingPlanId, setApprovingPlanId] = useState<string | null>(null);

  const activeJobsItem = items.find((i): i is ThreadJobsItem => i.type === 'jobs' && i.sprint_status !== 'complete' && i.sprint_status !== 'complete_with_errors');
  const events = useJobEvents(activeJobsItem?.sprint_job_id ?? null, token);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Submit your first goal below to get started.
      </div>
    );
  }

  async function handleApprove(planId: string) {
    setPendingApprove(planId);
  }

  async function handleConfirm(planId: string) {
    setApprovingPlanId(planId);
    try {
      await approvePlan(token, planId);
      onRefetch();
    } finally {
      setApprovingPlanId(null);
      setPendingApprove(null);
    }
  }

  async function handleRefine(planId: string, feedback: string) {
    await refinePlan(token, planId, feedback);
    onRefetch();
  }

  async function handleEdit(planId: string, fields: { intent?: string; competitors?: string[]; timeline_weeks?: number }) {
    await patchPlan(token, planId, fields);
    onRefetch();
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-4 py-4">
      {items.map((item, idx) => {
        if (item.type === 'goal') {
          return (
            <GoalBubble
              key={`goal-${item.job_id}`}
              goal={item.goal}
              feedback={item.feedback}
              createdAt={item.created_at}
            />
          );
        }

        if (item.type === 'plan') {
          const { plan, job_status } = item;
          const isAwaitingApprove = pendingApprove === plan.id;
          return (
            <div key={`plan-${plan.id}`} className="space-y-3">
              <PlanCard
                plan={plan}
                jobStatus={job_status}
                onEdit={(fields) => handleEdit(plan.id, fields)}
                onRefine={(fb) => handleRefine(plan.id, fb)}
                onApprove={() => handleApprove(plan.id)}
              />
              {isAwaitingApprove && plan.plan_status === 'draft' && (
                <ConfirmCard
                  domain={plan.domain}
                  agentNames={plan.sprint_order}
                  onConfirm={() => handleConfirm(plan.id)}
                  busy={approvingPlanId === plan.id}
                />
              )}
            </div>
          );
        }

        if (item.type === 'jobs') {
          return (
            <div key={`jobs-${item.sprint_job_id}`} className="border rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-3">Research agents running…</p>
              <JobBoard
                initialJobs={item.children}
                events={activeJobsItem?.sprint_job_id === item.sprint_job_id ? events : []}
                onRetry={(jobId) => { mutate(`jobs:${workspaceId}`); }}
              />
            </div>
          );
        }

        if (item.type === 'error') {
          return (
            <div key={`error-${item.job_id}`} className="max-w-[80%] border border-red-300 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
              <p className="font-medium">Orchestrator failed</p>
              <p className="text-xs mt-1">{(item.error as { message?: string }).message ?? 'Unknown error'}</p>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && pnpm vitest run tests/conversation-thread.test.tsx 2>&1 | tail -5
```

Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/conversation-thread.tsx apps/web/tests/conversation-thread.test.tsx
git commit -m "feat(web): ConversationThread component"
```

---

## Task 14: Update workspace detail page

**Files:**
- Modify: `apps/web/app/(app)/workspaces/[id]/page.tsx`

- [ ] **Step 1: Replace workspace [id] page**

```tsx
// apps/web/app/(app)/workspaces/[id]/page.tsx
'use client';

import { useAuth } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { getThread, submitJob } from '@/lib/api';
import { ConversationThread } from '@/components/conversation-thread';
import { GoalInput } from '@/components/goal-input';

function useToken() {
  const { getToken } = useAuth();
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    getToken().then(setT);
    const id = setInterval(() => getToken().then(setT), 60_000);
    return () => clearInterval(id);
  }, [getToken]);
  return t;
}

export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const token = useToken();

  const swrKey = token ? `thread:${id}` : null;
  const { data: items = [], mutate } = useSWR(
    swrKey,
    () => getThread(token!, id),
    { refreshInterval: 5000 },
  );

  async function handleSubmit(goal: string) {
    const tok = await getToken();
    if (!tok) return;
    await submitJob(tok, id, { goal });
    mutate();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <ConversationThread
        items={items}
        token={token ?? ''}
        workspaceId={id}
        onRefetch={() => mutate()}
      />
      <div className="border-t pt-4 mt-4">
        <GoalInput onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Run all Vitest tests**

```bash
cd apps/web && pnpm vitest run 2>&1 | tail -10
```

Expected: all pass (7 existing + 11 new = 18 tests)

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/workspaces/\[id\]/page.tsx
git commit -m "feat(web): workspace page — ConversationThread replaces job board"
```

---

## Task 15: Final verification

- [ ] **Step 1: Run all API unit tests**

```bash
cd apps/api && uv run pytest tests/unit/ -q 2>&1 | tail -10
```

Expected: all non-DB tests pass; DB-dependent tests show connection errors (fine without postgres)

- [ ] **Step 2: Run all web tests**

```bash
cd apps/web && pnpm vitest run 2>&1 | tail -5
```

Expected: all pass

- [ ] **Step 3: Run TypeScript type check**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1
```

Expected: no errors

- [ ] **Step 4: Smoke test the running app**

Ensure API, Celery, and Next.js are running (`make up`). Then:
1. Go to `http://localhost:3000`, sign in
2. Open a workspace
3. Submit a goal → confirm thread shows GoalBubble + PlanCard (status `awaiting_gate0`)
4. Click Approve → ConfirmCard appears → click Start Research → JobBoard appears in thread
5. Submit a second goal → second exchange appears below

- [ ] **Step 5: Commit final state**

```bash
git add -A
git commit -m "feat: Orchestrator Gate-0 sub-project complete

- awaiting_gate0 job status; orchestrator stops after plan
- Plan versioning (version, feedback, plan_status, parent_plan_id)
- PATCH/approve/refine plan endpoints; thread endpoint
- Conversation thread UI: GoalBubble, PlanCard, ConfirmCard, JobBoardInThread
- 11 new Vitest tests; 5 new API unit tests; 2 integration tests"
```
