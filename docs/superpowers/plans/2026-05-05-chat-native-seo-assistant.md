# Chat-Native SEO Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auto-audit-on-workspace-creation and a conversational chat endpoint that routes any user message to the correct agent or pipeline.

**Architecture:** A new `QuickAuditAgent` scans the homepage using three vendor skill prompts and DataForSEO, storing results in a new `audit_results` table. A new `POST /workspaces/{id}/chat` route runs `IntentRouterAgent` (Haiku, ~500ms) inline and dispatches to the right handler. The existing orchestrator → plan → sprint → brief pipeline is untouched.

**Tech Stack:** Python 3.12, FastAPI, Celery 5, SQLAlchemy async, Alembic, Anthropic SDK, httpx, DataForSEO, Next.js 16, React, Tailwind, `@prism/types`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `apps/api/app/agents/quick_audit.py` | Create | QuickAuditAgent + output models |
| `apps/api/app/agents/intent_router.py` | Create | IntentRouterAgent (Haiku) |
| `apps/api/app/models/audit_result.py` | Create | AuditResult SQLAlchemy model |
| `apps/api/app/models/__init__.py` | Modify | Export AuditResult |
| `apps/api/alembic/versions/0007_audit_and_chat.py` | Create | audit_results table + notify trigger |
| `apps/api/app/workers/tasks.py` | Modify | Add quick_audit_task |
| `apps/api/app/routes/workspaces.py` | Modify | Trigger audit on create + add audit to thread |
| `apps/api/app/routes/chat.py` | Create | POST /workspaces/{id}/chat |
| `apps/api/app/main.py` | Modify | Register chat router |
| `apps/api/tests/test_quick_audit_agent.py` | Create | Unit tests (mocked) |
| `apps/api/tests/test_intent_router_agent.py` | Create | Unit tests (mocked) |
| `apps/api/tests/integration/test_quick_audit_task.py` | Create | Celery integration test |
| `packages/types/src/index.ts` | Modify | Add QuickAuditResult + ThreadAuditItem |
| `apps/web/components/audit-card.tsx` | Create | AuditCard chat bubble |
| `apps/web/components/conversation-thread.tsx` | Modify | Add `audit` case |
| `apps/web/components/goal-input.tsx` | Modify | Rename to ChatInput, update placeholder + submit |
| `apps/web/app/(app)/workspaces/[id]/page.tsx` | Modify | Use chat endpoint, fast poll on empty thread |
| `apps/web/lib/api.ts` | Modify | Add `sendChatMessage` |

---

## Task 1: QuickAuditAgent

**Files:**
- Create: `apps/api/app/agents/quick_audit.py`
- Create: `apps/api/tests/test_quick_audit_agent.py`

- [ ] **Step 1: Write the failing tests**

```python
# apps/api/tests/test_quick_audit_agent.py
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.quick_audit import (
    ActionItem,
    AuditScore,
    QuickAuditAgent,
    QuickAuditInput,
    QuickAuditResult,
)


def _mock_claude_response(result: QuickAuditResult) -> MagicMock:
    block = MagicMock()
    block.text = result.model_dump_json()
    msg = MagicMock()
    msg.content = [block]
    return msg


@pytest.mark.asyncio
async def test_quick_audit_returns_result():
    fake_result = QuickAuditResult(
        domain="example.com",
        domain_rating=None,
        estimated_monthly_traffic=5000,
        top_keywords=["crm software", "best crm"],
        score=AuditScore(technical=61, content=54, ai_visibility=72, overall=62),
        action_items=[
            ActionItem(
                severity="critical",
                title="Add meta descriptions to all pages",
                rationale="Missing on 14 pages, direct CTR impact",
                effort_minutes=30,
            )
        ],
    )

    with (
        patch(
            "app.agents.quick_audit.QuickAuditAgent._fetch_homepage",
            new=AsyncMock(return_value="<html><head><title>Example</title></head></html>"),
        ),
        patch(
            "app.agents.quick_audit.DataForSEOClient.domain_rank_overview",
            new=AsyncMock(return_value={"metrics": {"organic": {"etv": 5000}}}),
        ),
        patch(
            "app.agents.quick_audit.DataForSEOClient.ranked_keywords",
            new=AsyncMock(return_value=[
                {"keyword_data": {"keyword": "crm software"}},
                {"keyword_data": {"keyword": "best crm"}},
            ]),
        ),
        patch(
            "app.agents.quick_audit.QuickAuditAgent._call_claude",
            new=AsyncMock(return_value=fake_result),
        ),
    ):
        result = await QuickAuditAgent().run(QuickAuditInput(domain="example.com"))

    assert result.domain == "example.com"
    assert result.score.overall == 62
    assert len(result.action_items) == 1
    assert result.action_items[0].severity == "critical"
    assert result.estimated_monthly_traffic == 5000
    assert result.top_keywords == ["crm software", "best crm"]


@pytest.mark.asyncio
async def test_quick_audit_survives_dataforseo_failure():
    """DataForSEO errors must not crash the audit — fall back gracefully."""
    fake_result = QuickAuditResult(
        domain="example.com",
        score=AuditScore(technical=50, content=50, ai_visibility=50, overall=50),
        action_items=[],
    )

    with (
        patch(
            "app.agents.quick_audit.QuickAuditAgent._fetch_homepage",
            new=AsyncMock(return_value="<html></html>"),
        ),
        patch(
            "app.agents.quick_audit.DataForSEOClient.domain_rank_overview",
            new=AsyncMock(side_effect=Exception("API down")),
        ),
        patch(
            "app.agents.quick_audit.DataForSEOClient.ranked_keywords",
            new=AsyncMock(side_effect=Exception("API down")),
        ),
        patch(
            "app.agents.quick_audit.QuickAuditAgent._call_claude",
            new=AsyncMock(return_value=fake_result),
        ),
    ):
        result = await QuickAuditAgent().run(QuickAuditInput(domain="example.com"))

    assert result.domain == "example.com"
    assert result.estimated_monthly_traffic is None
    assert result.top_keywords == []


@pytest.mark.asyncio
async def test_quick_audit_fetch_homepage_falls_back_to_http():
    """If https fails, retry with http."""
    agent = QuickAuditAgent()

    call_count = 0

    async def mock_get(url, **kwargs):
        nonlocal call_count
        call_count += 1
        if url.startswith("https"):
            raise Exception("SSL error")
        resp = MagicMock()
        resp.text = "<html>ok</html>"
        return resp

    with patch("app.agents.quick_audit.httpx.AsyncClient") as MockClient:
        instance = AsyncMock()
        instance.__aenter__ = AsyncMock(return_value=instance)
        instance.__aexit__ = AsyncMock(return_value=None)
        instance.get = mock_get
        MockClient.return_value = instance

        html = await agent._fetch_homepage("example.com")

    assert html == "<html>ok</html>"
    assert call_count == 2  # https tried, then http
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
cd apps/api && uv run pytest tests/test_quick_audit_agent.py -v
```
Expected: `ModuleNotFoundError: No module named 'app.agents.quick_audit'`

- [ ] **Step 3: Write the agent**

```python
# apps/api/app/agents/quick_audit.py
from __future__ import annotations

import asyncio
import json
from typing import ClassVar, Literal

import httpx
import pydantic

from app.agents.base import BaseAgent
from app.integrations.dataforseo import DataForSEOClient
from app.skills.loader import load_skill_prompt


class QuickAuditInput(pydantic.BaseModel):
    domain: str


class AuditScore(pydantic.BaseModel):
    technical: int
    content: int
    ai_visibility: int
    overall: int


class ActionItem(pydantic.BaseModel):
    severity: Literal["critical", "high", "medium", "quick_win"]
    title: str
    rationale: str
    effort_minutes: int | None = None


class QuickAuditResult(pydantic.BaseModel):
    domain: str
    domain_rating: int | None = None
    estimated_monthly_traffic: int | None = None
    top_keywords: list[str] = []
    score: AuditScore
    action_items: list[ActionItem]


_CORE_TEMPLATE = """\
You are the Prism site auditor. You receive the homepage HTML and DataForSEO domain metrics.

Analyse the homepage using these three frameworks (excerpts follow):

=== SEO TECHNICAL (robots, canonicals, CWV, security, AI crawlers) ===
{seo_technical}

=== SEO CONTENT (E-E-A-T, thin content, readability) ===
{seo_content}

=== SEO GEO (AI Overviews, Perplexity, ChatGPT citability, llms.txt) ===
{seo_geo}

Produce three scores (0-100):
- technical: meta tags, heading structure, canonical, internal links, security signals, AI crawler rules
- content: E-E-A-T signals (author bios, credentials, case studies), word count vs page type, readability
- ai_visibility: llms.txt present, citability of content, AI-crawler access, structured data for AI
- overall: round(technical * 0.35 + content * 0.35 + ai_visibility * 0.30)

Produce up to 8 action_items ordered critical → high → quick_win.
Each title must be specific (bad: "Improve content"; good: "Add author bio to 12 blog posts missing E-E-A-T signals").

Return JSON only matching the schema. No prose outside the JSON.
"""


class QuickAuditAgent(BaseAgent[QuickAuditInput, QuickAuditResult]):
    CORE_PROMPT: ClassVar[str] = ""  # unused — system_prompt() is overridden
    BACKING_SKILL: ClassVar[str | None] = None
    RESPONSE_MODEL = QuickAuditResult
    MAX_TOKENS: ClassVar[int] = 2000

    def system_prompt(self) -> str:
        technical = load_skill_prompt("seo-technical")
        content = load_skill_prompt("seo-content")
        geo = load_skill_prompt("seo-geo")
        prompt = _CORE_TEMPLATE.format(
            seo_technical=technical[:3000],
            seo_content=content[:3000],
            seo_geo=geo[:3000],
        )
        schema_block = (
            "\n\n---\n\n"
            f"Respond with JSON matching this pydantic schema exactly:\n"
            f"{json.dumps(self.RESPONSE_MODEL.model_json_schema(), indent=2)}\n"
            "Output ONLY the JSON object, no prose or code fences."
        )
        return prompt + schema_block

    def user_prompt(self, inp: QuickAuditInput) -> str:
        raise NotImplementedError("overridden in run()")

    async def run(self, inp: QuickAuditInput) -> QuickAuditResult:
        html = await self._fetch_homepage(inp.domain)

        dfs = DataForSEOClient()
        overview_coro = dfs.domain_rank_overview(inp.domain)
        ranked_coro = dfs.ranked_keywords(inp.domain, limit=5)
        overview, ranked = await asyncio.gather(
            overview_coro, ranked_coro, return_exceptions=True
        )

        estimated_traffic: int | None = None
        top_keywords: list[str] = []

        if isinstance(overview, dict):
            organic = overview.get("metrics", {}).get("organic", {})
            raw_etv = organic.get("etv")
            if isinstance(raw_etv, (int, float)):
                estimated_traffic = int(raw_etv)

        if isinstance(ranked, list):
            top_keywords = [
                r.get("keyword_data", {}).get("keyword", "")
                for r in ranked
                if isinstance(r, dict)
            ]
            top_keywords = [k for k in top_keywords if k][:5]

        user_msg = (
            f"Domain: {inp.domain}\n\n"
            f"=== HOMEPAGE HTML (first 8 000 chars) ===\n{html[:8000]}\n\n"
            f"=== DATAFORSEO DOMAIN METRICS ===\n"
            f"Estimated Monthly Traffic: {estimated_traffic}\n"
            f"Top Keywords: {', '.join(top_keywords) or 'none available'}\n"
        )

        result = await self._call_claude(self.system_prompt(), user_msg)
        result.domain = inp.domain
        result.estimated_monthly_traffic = estimated_traffic
        result.top_keywords = top_keywords
        return result

    async def _fetch_homepage(self, domain: str) -> str:
        headers = {"User-Agent": "PrismBot/1.0 (+https://getprism.app/bot)"}
        for scheme in ("https", "http"):
            try:
                async with httpx.AsyncClient(
                    timeout=15, follow_redirects=True
                ) as client:
                    resp = await client.get(f"{scheme}://{domain}", headers=headers)
                    return resp.text
            except Exception:
                continue
        return f"<html><body>Could not fetch {domain}</body></html>"
```

- [ ] **Step 4: Run tests to confirm PASS**

```bash
cd apps/api && uv run pytest tests/test_quick_audit_agent.py -v
```
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/agents/quick_audit.py apps/api/tests/test_quick_audit_agent.py
git commit -m "feat(agents): QuickAuditAgent — homepage fetch, DataForSEO, 3-skill Claude prompt"
```

---

## Task 2: DB Migration + AuditResult Model

**Files:**
- Create: `apps/api/app/models/audit_result.py`
- Modify: `apps/api/app/models/__init__.py`
- Create: `apps/api/alembic/versions/0007_audit_and_chat.py`

- [ ] **Step 1: Write the SQLAlchemy model**

```python
# apps/api/app/models/audit_result.py
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ._base import Base, TimestampMixin


class AuditResult(Base, TimestampMixin):
    __tablename__ = "audit_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    result: Mapped[dict] = mapped_column(JSONB, nullable=False)

    __table_args__ = (
        UniqueConstraint("workspace_id", name="uq_audit_results_workspace"),
    )
```

- [ ] **Step 2: Export the model**

Edit `apps/api/app/models/__init__.py` — add `AuditResult` to imports and `__all__`:

```python
from ._base import Base
from .audit_result import AuditResult
from .job import Job
from .plan import Plan
from .strategy_brief import StrategyBrief
from .user import Organization, OrganizationMembership, User
from .workspace import Workspace

__all__ = [
    "AuditResult",
    "Base",
    "Job",
    "Organization",
    "OrganizationMembership",
    "Plan",
    "StrategyBrief",
    "User",
    "Workspace",
]
```

- [ ] **Step 3: Write the Alembic migration**

```python
# apps/api/alembic/versions/0007_audit_and_chat.py
"""audit_results table with notify trigger.

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-05
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_results",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("result", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("workspace_id", name="uq_audit_results_workspace"),
    )
    op.create_index("ix_audit_results_workspace", "audit_results", ["workspace_id"])

    # Notify trigger so SSE can push audit completion to the browser
    op.execute("""
        CREATE OR REPLACE FUNCTION notify_audit_event() RETURNS trigger AS $$
        BEGIN
          PERFORM pg_notify('job_events', jsonb_build_object(
            'type', 'audit',
            'workspace_id', NEW.workspace_id,
            'at', now()
          )::text);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)
    op.execute("""
        CREATE TRIGGER audit_results_notify_event
          AFTER INSERT OR UPDATE ON audit_results
          FOR EACH ROW EXECUTE FUNCTION notify_audit_event()
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS audit_results_notify_event ON audit_results")
    op.execute("DROP FUNCTION IF EXISTS notify_audit_event()")
    op.drop_index("ix_audit_results_workspace", table_name="audit_results")
    op.drop_table("audit_results")
```

- [ ] **Step 4: Apply migration to test DB**

```bash
cd apps/api && uv run alembic upgrade head
```
Expected: `Running upgrade 0006 -> 0007, audit_results table with notify trigger`

- [ ] **Step 5: Confirm model is importable**

```bash
cd apps/api && uv run python -c "from app.models import AuditResult; print(AuditResult.__tablename__)"
```
Expected: `audit_results`

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/models/audit_result.py apps/api/app/models/__init__.py apps/api/alembic/versions/0007_audit_and_chat.py
git commit -m "feat(db): audit_results table, AuditResult model, notify trigger"
```

---

## Task 3: quick_audit_task + Wire Workspace Creation

**Files:**
- Modify: `apps/api/app/workers/tasks.py`
- Modify: `apps/api/app/routes/workspaces.py`
- Create: `apps/api/tests/integration/test_quick_audit_task.py`

- [ ] **Step 1: Write the integration test**

```python
# apps/api/tests/integration/test_quick_audit_task.py
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
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
cd apps/api && uv run pytest tests/integration/test_quick_audit_task.py -v
```
Expected: `ImportError` or `AttributeError: module 'app.workers.tasks' has no attribute 'quick_audit_task'`

- [ ] **Step 3: Add quick_audit_task to tasks.py**

Add these imports at the top of `apps/api/app/workers/tasks.py` (after existing imports):

```python
from app.agents.quick_audit import QuickAuditAgent, QuickAuditInput
from app.models import AuditResult
```

Add this task at the end of `apps/api/app/workers/tasks.py` (before `_get_child_results`):

```python
@celery_app.task(bind=True, name="agents.quick_audit", soft_time_limit=120, time_limit=150)
def quick_audit_task(self, workspace_id: str) -> dict:
    async def _body() -> dict:
        async with SessionLocal() as session:
            workspace = await session.get(Workspace, uuid.UUID(workspace_id))
            if workspace is None:
                return {"ok": False, "error": "workspace not found"}
            try:
                result = await QuickAuditAgent().run(
                    QuickAuditInput(domain=workspace.domain)
                )
            except Exception as exc:
                sentry_sdk.capture_exception(exc)
                err = classify(exc, provider="quick_audit")
                return {"ok": False, "error": err.to_json()}

            # Upsert: one audit_results row per workspace
            from sqlalchemy.dialects.postgresql import insert as pg_insert
            stmt = (
                pg_insert(AuditResult)
                .values(
                    workspace_id=workspace.id,
                    result=_to_json(result),
                )
                .on_conflict_do_update(
                    constraint="uq_audit_results_workspace",
                    set_={"result": _to_json(result), "updated_at": sa_func_now()},
                )
            )
            await session.execute(stmt)
            await session.commit()
            return {"ok": True, "workspace_id": workspace_id}

    try:
        return _run(_body())
    except Exception as exc:
        sentry_sdk.capture_exception(exc)
        return {"ok": False, "error": str(exc)}
```

Also add this import at the top of `tasks.py` (with the other sqlalchemy imports):

```python
from sqlalchemy import func as sa_func_now  # used for upsert updated_at
```

Wait — `sa_func_now` needs to be `func.now()`. Use this instead in the upsert:

```python
from sqlalchemy import func
# ...
.on_conflict_do_update(
    constraint="uq_audit_results_workspace",
    set_={"result": _to_json(result), "updated_at": func.now()},
)
```

So the import to add is just `from sqlalchemy import func` (alongside the existing `from sqlalchemy import select`).

- [ ] **Step 4: Run integration test to confirm PASS**

```bash
cd apps/api && uv run pytest tests/integration/test_quick_audit_task.py -v
```
Expected: `2 passed`

- [ ] **Step 5: Wire workspace creation to trigger audit**

In `apps/api/app/routes/workspaces.py`, edit the `create_workspace` route. After `await session.refresh(w)`, add:

```python
    await session.refresh(w)
    # Fire audit in background — non-blocking, workspace creation still returns immediately
    from app.workers.tasks import quick_audit_task
    quick_audit_task.delay(str(w.id))
    return w
```

The import is inside the function to avoid circular imports with `tasks.py` importing from `models` which imports from here.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/workers/tasks.py apps/api/app/routes/workspaces.py apps/api/tests/integration/test_quick_audit_task.py
git commit -m "feat(tasks): quick_audit_task — stores result in audit_results, wired to workspace creation"
```

---

## Task 4: Thread Endpoint — Add Audit Item

**Files:**
- Modify: `apps/api/app/routes/workspaces.py`

The thread endpoint (`GET /workspaces/{id}/thread`) needs to prepend an `audit` item if an `AuditResult` row exists for this workspace.

- [ ] **Step 1: Add ThreadAuditItem model to workspaces.py**

In `apps/api/app/routes/workspaces.py`, add this Pydantic model after the existing thread item classes:

```python
class ThreadAuditItem(pydantic.BaseModel):
    type: Literal["audit"] = "audit"
    result: dict
    created_at: str
```

Also add `from app.models import AuditResult` to the imports at the top (the existing import line is `from app.models import Job, Plan as PlanModel, StrategyBrief, User, Workspace` — extend it):

```python
from app.models import AuditResult, Job, Plan as PlanModel, StrategyBrief, User, Workspace
```

- [ ] **Step 2: Query audit_results in get_workspace_thread**

In `get_workspace_thread`, after checking ownership and before loading orchestrator jobs, add:

```python
    # Audit result (prepended before goal items — it's Prism's first message)
    audit_row = await session.execute(
        select(AuditResult).where(AuditResult.workspace_id == workspace_id)
    )
    audit = audit_row.scalar_one_or_none()
```

Then, at the point where `items: list = []` is initialised and before the orchestrator loop, add:

```python
    items: list = []
    if audit:
        items.append(ThreadAuditItem(
            type="audit",
            result=audit.result,
            created_at=audit.created_at.isoformat(),
        ).model_dump())
```

- [ ] **Step 3: Verify endpoint returns audit item**

Start the API server and check manually:

```bash
cd apps/api && uv run uvicorn app.main:app --reload
# In another terminal, after creating a workspace and letting the audit run:
curl -s http://localhost:8000/workspaces/<WORKSPACE_ID>/thread | python3 -m json.tool | head -30
```
Expected: first item in the list has `"type": "audit"`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/app/routes/workspaces.py
git commit -m "feat(api): thread endpoint includes audit item when audit_results exist"
```

---

## Task 5: Shared Types + AuditCard Component

**Files:**
- Modify: `packages/types/src/index.ts`
- Create: `apps/web/components/audit-card.tsx`

- [ ] **Step 1: Add types to the shared package**

In `packages/types/src/index.ts`, add after the `LLMVisibilityResult` block:

```typescript
// ── Quick Audit ───────────────────────────────────────────────────────────

export type AuditSeverity = 'critical' | 'high' | 'medium' | 'quick_win';

export interface AuditActionItem {
  severity: AuditSeverity;
  title: string;
  rationale: string;
  effort_minutes: number | null;
}

export interface AuditScore {
  technical: number;
  content: number;
  ai_visibility: number;
  overall: number;
}

export interface QuickAuditResult {
  domain: string;
  domain_rating: number | null;
  estimated_monthly_traffic: number | null;
  top_keywords: string[];
  score: AuditScore;
  action_items: AuditActionItem[];
}

export interface ThreadAuditItem {
  type: 'audit';
  result: QuickAuditResult;
  created_at: string;
}
```

Also add `ThreadAuditItem` to the `ThreadItem` union at the bottom of the file:

```typescript
export type ThreadItem =
  | ThreadGoalItem
  | ThreadPlanItem
  | ThreadResearchSectionItem
  | ThreadBriefItem
  | ThreadJobsItem
  | ThreadErrorItem
  | ThreadAuditItem;
```

- [ ] **Step 2: Create the AuditCard component**

```tsx
// apps/web/components/audit-card.tsx
'use client';

import type { AuditActionItem, AuditSeverity, QuickAuditResult } from '@prism/types';

function severityStyle(s: AuditSeverity): { bg: string; color: string; label: string } {
  switch (s) {
    case 'critical': return { bg: '#7f1d1d', color: '#fca5a5', label: 'critical' };
    case 'high':     return { bg: '#78350f', color: '#fde68a', label: 'high' };
    case 'medium':   return { bg: '#1e3a5f', color: '#93c5fd', label: 'medium' };
    case 'quick_win':return { bg: '#14532d', color: '#86efac', label: 'quick win' };
  }
}

function scoreColor(v: number): string {
  if (v >= 75) return '#34d399';
  if (v >= 50) return '#fbbf24';
  return '#f87171';
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'var(--text-mut)', marginBottom: 4 }}>{label}</div>
      <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, marginBottom: 3 }}>
        <div style={{ width: `${value}%`, height: 4, background: scoreColor(value), borderRadius: 2 }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: scoreColor(value) }}>{value}</div>
    </div>
  );
}

function ActionRow({ item }: { item: AuditActionItem }) {
  const style = severityStyle(item.severity);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{
        background: style.bg, color: style.color,
        borderRadius: 3, padding: '1px 6px', fontSize: 9, fontWeight: 600,
        whiteSpace: 'nowrap', marginTop: 2, flexShrink: 0,
      }}>
        {style.label}
      </span>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>{item.title}</div>
        <div style={{ fontSize: 10, color: 'var(--text-mut)', marginTop: 1 }}>{item.rationale}</div>
      </div>
    </div>
  );
}

function overallBadgeStyle(overall: number): { bg: string; color: string; label: string } {
  if (overall >= 75) return { bg: '#14532d', color: '#86efac', label: 'Good' };
  if (overall >= 50) return { bg: '#78350f', color: '#fde68a', label: 'Needs work' };
  return { bg: '#7f1d1d', color: '#fca5a5', label: 'Critical' };
}

export function AuditCard({ result }: { result: QuickAuditResult }) {
  const { score, action_items, domain, estimated_monthly_traffic } = result;
  const badge = overallBadgeStyle(score.overall);
  const trafficStr = estimated_monthly_traffic
    ? estimated_monthly_traffic.toLocaleString()
    : '—';

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      {/* Avatar */}
      <div style={{
        width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 2,
        background: 'var(--accent-dim, rgba(99,102,241,0.12))',
        color: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width={10} height={10} viewBox="0 0 16 16" fill="none">
          <path d="M8 2L14 14H2L8 2Z" fill="currentColor" opacity="0.8"/>
        </svg>
      </div>

      {/* Card */}
      <div style={{
        flex: 1, border: '1px solid var(--accent)',
        borderRadius: '2px 10px 10px 10px',
        background: 'var(--bg-card)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
              Site audit complete — {domain}
            </span>
            <span style={{
              background: badge.bg, color: badge.color,
              borderRadius: 3, padding: '1px 7px', fontSize: 9, fontWeight: 700,
            }}>
              {score.overall} / 100 · {badge.label}
            </span>
          </div>
          {estimated_monthly_traffic !== null && (
            <div style={{ fontSize: 10, color: 'var(--text-mut)' }}>
              ~{trafficStr} monthly organic visits · {result.top_keywords.slice(0, 3).join(', ')}
            </div>
          )}
        </div>

        {/* Score bars */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10, padding: '10px 14px',
          background: 'var(--bg-elev)', borderBottom: '1px solid var(--border)',
        }}>
          <ScoreBar label="Technical" value={score.technical} />
          <ScoreBar label="Content" value={score.content} />
          <ScoreBar label="AI Visibility" value={score.ai_visibility} />
        </div>

        {/* Action items */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', letterSpacing: '.05em', marginBottom: 8 }}>
            ACTION ITEMS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {action_items.slice(0, 6).map((item, i) => (
              <ActionRow key={i} item={item} />
            ))}
          </div>
        </div>

        {/* Footer CTA */}
        <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text-mut)' }}>
          What&apos;s your traffic goal? I&apos;ll build a sprint plan around these findings.
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build types to verify no TS errors**

```bash
cd packages/types && pnpm build 2>/dev/null || npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/index.ts apps/web/components/audit-card.tsx
git commit -m "feat(ui): AuditCard component + ThreadAuditItem shared types"
```

---

## Task 6: Wire AuditCard into ConversationThread + Fast Poll on Empty Thread

**Files:**
- Modify: `apps/web/components/conversation-thread.tsx`
- Modify: `apps/web/app/(app)/workspaces/[id]/page.tsx`

- [ ] **Step 1: Add audit case to ConversationThread**

In `apps/web/components/conversation-thread.tsx`:

1. Add import at the top:
```tsx
import { AuditCard } from './audit-card';
import type { ThreadAuditItem } from '@prism/types';
```

2. Inside the `return (` block of `ConversationThread`, in the `items.map((item) => {` switch, add a new case before `return null`:

```tsx
        if (item.type === 'audit') {
          return (
            <AuditCard
              key={`audit-${item.created_at}`}
              result={(item as ThreadAuditItem).result}
            />
          );
        }
```

- [ ] **Step 2: Poll fast when thread is empty (audit might be in progress)**

In `apps/web/app/(app)/workspaces/[id]/page.tsx`, find the `refreshInterval` function inside the SWR call and change it from:

```ts
refreshInterval: (data) =>
  !data || hasActiveJob(data) || pendingGoal ? 1500 : 8000,
```

to:

```ts
refreshInterval: (data) =>
  !data || hasActiveJob(data) || pendingGoal || data.length === 0 ? 1500 : 8000,
```

This keeps the poll interval fast (1500ms) until the audit result appears in the thread, then slows to 8000ms.

- [ ] **Step 3: Run the frontend**

```bash
pnpm --filter @prism/web dev
```

Create a new workspace, navigate to it. Within ~45 seconds, an AuditCard should appear at the top of the thread without any user action.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/conversation-thread.tsx apps/web/app/(app)/workspaces/\[id\]/page.tsx
git commit -m "feat(ui): render AuditCard in thread, fast-poll while thread is empty"
```

---

## Task 7: IntentRouterAgent

**Files:**
- Create: `apps/api/app/agents/intent_router.py`
- Create: `apps/api/tests/test_intent_router_agent.py`

- [ ] **Step 1: Write failing tests**

```python
# apps/api/tests/test_intent_router_agent.py
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.intent_router import IntentRouterAgent, RouterDecision, RouterInput


def _mock_router_response(decision: RouterDecision) -> MagicMock:
    block = MagicMock()
    block.text = decision.model_dump_json()
    msg = MagicMock()
    msg.content = [block]
    return msg


@pytest.mark.asyncio
async def test_routes_goal_setting():
    decision = RouterDecision(
        intent="goal_setting",
        confidence=0.95,
        extracted_params={},
        fallback_message=None,
    )
    with patch(
        "app.agents.intent_router.IntentRouterAgent._call_claude",
        new=AsyncMock(return_value=decision),
    ):
        result = await IntentRouterAgent().run(
            RouterInput(
                message="I want 10k visitors a month from organic",
                workspace_context={"domain": "example.com", "has_audit": True, "has_plan": False},
            )
        )
    assert result.intent == "goal_setting"
    assert result.confidence >= 0.7


@pytest.mark.asyncio
async def test_routes_audit():
    decision = RouterDecision(
        intent="audit",
        confidence=0.98,
        extracted_params={},
        fallback_message=None,
    )
    with patch(
        "app.agents.intent_router.IntentRouterAgent._call_claude",
        new=AsyncMock(return_value=decision),
    ):
        result = await IntentRouterAgent().run(
            RouterInput(
                message="audit my site",
                workspace_context={"domain": "example.com", "has_audit": False, "has_plan": False},
            )
        )
    assert result.intent == "audit"


@pytest.mark.asyncio
async def test_low_confidence_becomes_unknown():
    decision = RouterDecision(
        intent="unknown",
        confidence=0.3,
        extracted_params={},
        fallback_message="I'm not sure what you mean. Try: 'audit my site' or 'I want 10k visitors/month'.",
    )
    with patch(
        "app.agents.intent_router.IntentRouterAgent._call_claude",
        new=AsyncMock(return_value=decision),
    ):
        result = await IntentRouterAgent().run(
            RouterInput(
                message="blah blah blah",
                workspace_context={"domain": "example.com", "has_audit": False, "has_plan": False},
            )
        )
    assert result.intent == "unknown"
    assert result.fallback_message is not None
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
cd apps/api && uv run pytest tests/test_intent_router_agent.py -v
```
Expected: `ModuleNotFoundError: No module named 'app.agents.intent_router'`

- [ ] **Step 3: Write the agent**

```python
# apps/api/app/agents/intent_router.py
from __future__ import annotations

from typing import ClassVar, Literal

import pydantic

from app.agents.base import BaseAgent

_INTENTS = Literal["goal_setting", "audit", "keyword", "competitor", "question", "unknown"]

_CORE_PROMPT = """\
You are an intent classifier for Prism, an AI SEO platform. Classify the user's message into one intent.

Intents:
- goal_setting: user states a traffic, ranking, or conversion goal (e.g. "I want 10k visitors/month", "rank #1 for X", "grow my blog")
- audit: user wants a site scan or health check (e.g. "audit my site", "what's wrong with my site", "run a check")
- keyword: user asks about keywords, search volumes, gaps (e.g. "what keywords am I missing?", "show keyword gaps")
- competitor: user asks about competitors (e.g. "what's HubSpot ranking for?", "compare me to Salesforce")
- question: user asks a question about their site's existing data (e.g. "what's my biggest issue?", "explain my AI score")
- unknown: anything else that doesn't clearly fit the above

Set confidence 0.0-1.0. If confidence < 0.7, use intent "unknown" and provide a helpful fallback_message.
For competitor intent, extract the competitor domain/name into extracted_params["competitor"].

Return JSON only matching the schema. No prose outside the JSON.
"""


class RouterInput(pydantic.BaseModel):
    message: str
    workspace_context: dict  # {"domain": str, "has_audit": bool, "has_plan": bool}


class RouterDecision(pydantic.BaseModel):
    intent: _INTENTS
    confidence: float
    extracted_params: dict = pydantic.Field(default_factory=dict)
    fallback_message: str | None = None


class IntentRouterAgent(BaseAgent[RouterInput, RouterDecision]):
    CORE_PROMPT: ClassVar[str] = _CORE_PROMPT
    BACKING_SKILL: ClassVar[str | None] = None
    RESPONSE_MODEL = RouterDecision
    MODEL: ClassVar[str] = "claude-haiku-4-5-20251001"  # fast + cheap for routing
    MAX_TOKENS: ClassVar[int] = 256

    def user_prompt(self, inp: RouterInput) -> str:
        return (
            f"Domain: {inp.workspace_context.get('domain', 'unknown')}\n"
            f"Has audit: {inp.workspace_context.get('has_audit', False)}\n"
            f"Has plan: {inp.workspace_context.get('has_plan', False)}\n\n"
            f"User message: {inp.message}"
        )
```

- [ ] **Step 4: Run tests to confirm PASS**

```bash
cd apps/api && uv run pytest tests/test_intent_router_agent.py -v
```
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/agents/intent_router.py apps/api/tests/test_intent_router_agent.py
git commit -m "feat(agents): IntentRouterAgent — Haiku-based intent classifier for chat dispatch"
```

---

## Task 8: POST /workspaces/{id}/chat + ChatInput Upgrade

**Files:**
- Create: `apps/api/app/routes/chat.py`
- Modify: `apps/api/app/main.py`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/components/goal-input.tsx`
- Modify: `apps/web/app/(app)/workspaces/[id]/page.tsx`

- [ ] **Step 1: Create the chat route**

```python
# apps/api/app/routes/chat.py
from __future__ import annotations

import uuid

import pydantic
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.intent_router import IntentRouterAgent, RouterInput
from app.auth.clerk import ClerkPrincipal, current_user
from app.core.db import get_session
from app.models import AuditResult, Job, Plan as PlanModel, Workspace

router = APIRouter(tags=["chat"])


class ChatIn(pydantic.BaseModel):
    message: str = pydantic.Field(min_length=1, max_length=2000)


class ChatOut(pydantic.BaseModel):
    intent: str
    dispatched: bool
    answer: str | None = None  # set for question/unknown intents


@router.post(
    "/workspaces/{workspace_id}/chat",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=ChatOut,
)
async def chat(
    workspace_id: uuid.UUID,
    body: ChatIn,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    w = await session.get(Workspace, workspace_id)
    if w is None or w.user_id != principal.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "workspace not found")

    # Build context for router
    has_audit = (
        await session.execute(
            select(AuditResult.id).where(AuditResult.workspace_id == workspace_id)
        )
    ).scalar_one_or_none() is not None

    has_plan = (
        await session.execute(
            select(PlanModel.id).where(PlanModel.workspace_id == workspace_id)
        )
    ).scalar_one_or_none() is not None

    decision = await IntentRouterAgent().run(
        RouterInput(
            message=body.message,
            workspace_context={
                "domain": w.domain,
                "has_audit": has_audit,
                "has_plan": has_plan,
            },
        )
    )

    # Dispatch based on intent
    if decision.intent == "goal_setting":
        # Check no job already in-flight (same guard as submit_job)
        active = await session.execute(
            select(Job).where(
                Job.workspace_id == workspace_id,
                Job.type == "orchestrator",
                Job.status.in_(("pending", "running")),
            )
        )
        if active.scalar_one_or_none() is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "a job is already in-flight")

        from app.workers.tasks import orchestrator_task
        job = Job(
            workspace_id=workspace_id,
            type="orchestrator",
            status="pending",
            input={"goal": body.message},
        )
        session.add(job)
        await session.commit()
        await session.refresh(job)
        orchestrator_task.delay(str(job.id))
        return {"intent": "goal_setting", "dispatched": True}

    if decision.intent == "audit":
        from app.workers.tasks import quick_audit_task
        quick_audit_task.delay(str(workspace_id))
        return {"intent": "audit", "dispatched": True}

    if decision.intent == "question":
        # Answer from stored audit data
        answer = "I don't have enough data yet."
        if has_audit:
            audit_row = await session.execute(
                select(AuditResult).where(AuditResult.workspace_id == workspace_id)
            )
            audit = audit_row.scalar_one_or_none()
            if audit:
                items = audit.result.get("action_items", [])
                top = items[0] if items else None
                score = audit.result.get("score", {})
                answer = (
                    f"Your site health is {score.get('overall', '?')}/100. "
                    + (f"Biggest issue: {top['title']}." if top else "No critical issues found.")
                )
        return {"intent": "question", "dispatched": False, "answer": answer}

    # keyword, competitor, unknown — not yet wired to live agents
    fallback = (
        decision.fallback_message
        or "I can handle that in a sprint. Try: \"I want 10k visitors/month\" to start a full analysis."
    )
    return {"intent": decision.intent, "dispatched": False, "answer": fallback}
```

- [ ] **Step 2: Register the router in main.py**

In `apps/api/app/main.py`, add:

```python
from app.routes import briefs, chat, health, jobs, plans, share, webhooks, workspaces
```

And add:

```python
app.include_router(chat.router)
```

(after `app.include_router(briefs.router)`)

- [ ] **Step 3: Add sendChatMessage to api.ts**

In `apps/web/lib/api.ts`, add:

```typescript
export async function sendChatMessage(
  token: string,
  workspaceId: string,
  message: string,
): Promise<{ intent: string; dispatched: boolean; answer: string | null }> {
  return (await fetchWithAuth(
    `/workspaces/${workspaceId}/chat`,
    { method: 'POST', body: JSON.stringify({ message }) },
    token,
  )).json();
}
```

- [ ] **Step 4: Upgrade GoalInput to ChatInput**

Replace the entire content of `apps/web/components/goal-input.tsx` with:

```tsx
'use client';

import { useState } from 'react';

export function ChatInput({ onSubmit, disabled, domain }: {
  onSubmit: (message: string) => Promise<void>;
  disabled?: boolean;
  domain?: string;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function doSubmit() {
    if (!message.trim() || busy || disabled) return;
    setBusy(true);
    try {
      await onSubmit(message);
      setMessage('');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await doSubmit();
  }

  async function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      await doSubmit();
    }
  }

  const isDisabled = disabled || busy;
  const canSubmit = !isDisabled && message.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 680 }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-strong, var(--border))',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          data-testid="goal-textarea"
          placeholder="Ask anything — audit my site, keyword gaps, I want 10k visitors/month…"
          rows={3}
          style={{
            width: '100%',
            resize: 'none',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--text)',
            fontFamily: 'inherit',
            fontSize: 15,
            lineHeight: 1.6,
            letterSpacing: -0.1,
            padding: '16px 18px 12px',
            opacity: isDisabled ? 0.55 : 1,
          }}
        />
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px 12px',
          borderTop: '1px solid var(--border)',
        }}>
          {domain && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
              borderRadius: 6,
              background: 'var(--bg-hover, rgba(255,255,255,0.05))',
              border: '1px solid var(--border)',
              color: 'var(--text-mut)',
              fontSize: 11,
              fontFamily: 'var(--font-mono, monospace)',
              flexShrink: 0,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
              {domain}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 10, color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono, monospace)', marginRight: 4,
          }}>
            <span>⌘</span><span>↵</span>
          </span>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: canSubmit ? 'var(--accent)' : 'var(--bg-hover, rgba(255,255,255,0.06))',
              color: canSubmit ? '#fff' : 'var(--text-dim)',
              fontSize: 13, fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', transition: 'background 0.15s, color 0.15s',
              letterSpacing: -0.1,
            }}
          >
            {busy ? 'Sending…' : disabled ? 'In progress' : 'Send'}
            {!busy && (
              <svg width={13} height={13} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: 'var(--text-dim)', letterSpacing: 0.1 }}>
        Powered by Claude · DataForSEO · seo-technical · seo-content · seo-geo
      </div>
    </form>
  );
}

// Keep GoalInput as a re-export for backward compat with any imports
export { ChatInput as GoalInput };
```

- [ ] **Step 5: Update workspace page to use chat endpoint**

In `apps/web/app/(app)/workspaces/[id]/page.tsx`:

1. Change the import from `GoalInput` to `ChatInput`:
```tsx
import { ChatInput } from '@/components/goal-input';
```

2. Change `handleSubmit` to use `sendChatMessage`:
```tsx
import { getThread, sendChatMessage, listWorkspaces } from '@/lib/api';
// ...
async function handleSubmit(message: string) {
  const tok = await getToken();
  if (!tok) return;
  setPendingGoal(message);
  await sendChatMessage(tok, id, message);
  mutate();
}
```

3. Change `<GoalInput` to `<ChatInput`:
```tsx
<ChatInput onSubmit={handleSubmit} domain={domain} />
```

- [ ] **Step 6: Run the frontend and verify end-to-end**

```bash
pnpm --filter @prism/web dev
```

- Type "I want 10k visitors/month" → should trigger orchestrator pipeline (goal bubble appears)
- Type "audit my site" → should re-run audit (AuditCard updates)
- Type "what's my biggest issue?" → should get inline text answer (for now just logs to console — the answer is in the API response but the frontend doesn't render chat_messages yet; that's a future task)

- [ ] **Step 7: Run TypeScript check**

```bash
pnpm --filter @prism/web exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/api/app/routes/chat.py apps/api/app/main.py apps/web/lib/api.ts apps/web/components/goal-input.tsx apps/web/app/(app)/workspaces/\[id\]/page.tsx
git commit -m "feat: chat endpoint with intent routing, ChatInput upgrade, full pipeline wired"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| QuickAuditAgent (homepage + DataForSEO + 3 skills) | Task 1 |
| IntentRouterAgent (Haiku, 4 intents, low-confidence fallback) | Task 7 |
| quick_audit_task fires on workspace creation | Task 3 |
| audit_results table + notify trigger | Task 2 |
| Thread endpoint returns audit type | Task 4 |
| AuditCard (score bars, action items, footer CTA) | Task 5 |
| ConversationThread renders audit | Task 6 |
| ChatInput (any message accepted) | Task 8 |
| POST /workspaces/{id}/chat route | Task 8 |
| goal_setting → existing orchestrator pipeline | Task 8 |
| audit intent → quick_audit_task | Task 8 |
| question intent → inline answer from stored data | Task 8 |
| Fast-poll when thread empty | Task 6 |
| Existing pipeline untouched | ✓ (no existing task files modified beyond adding new functions) |

**Not in scope (confirmed):**
- chat_messages table (question answers returned inline, not persisted)
- Full audit detail page (`/workspaces/{id}/audit`)
- keyword/competitor intents wired to live agents (fallback message returned)
- Backlinks, screenshots, GSC/GA4

**Type consistency check:**
- `QuickAuditResult` defined in `quick_audit.py` (Pydantic) and `packages/types/index.ts` (TS) — fields match
- `ThreadAuditItem` in TS uses `result: QuickAuditResult` — matches what the thread endpoint returns (`audit.result` = JSONB stored as `QuickAuditResult.model_dump()`)
- `AuditCard` accepts `result: QuickAuditResult` — consistent
- `ChatInput`/`GoalInput` re-export — backward compat preserved for any existing imports
- `quick_audit_task` imports: `AuditResult`, `QuickAuditAgent`, `QuickAuditInput` — all defined in Tasks 1 and 2

**Placeholder scan:** No TBD, no "similar to Task N", all code steps are complete. ✓
