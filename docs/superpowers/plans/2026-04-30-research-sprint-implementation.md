# Research Sprint + Strategy Brief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 4 research agents real, add a synthesis agent that produces a Strategy Brief, and introduce Gate-1 (brief review + shareable link).

**Architecture:** 4 real Celery chord tasks (keyword already live, 3 new) → finalize_task fires synthesis_task → synthesis writes `strategy_briefs` row → sprint transitions `awaiting_gate1`. New `/briefs` and `/share` routers handle Gate-1 approval and public sharing. Thread endpoint gains `section` and `brief` item types. `@prism/types` is updated first — both frontend and backend sessions implement against it.

**Tech Stack:** Python 3.12 · FastAPI · Celery 5 · SQLAlchemy async · Alembic · Anthropic SDK · DataForSEO · Next.js 16 · @prism/types · Vitest

**Spec:** `docs/superpowers/specs/2026-04-30-research-sprint-design.md`

---

## File Structure

### New files
- `apps/api/alembic/versions/0004_strategy_briefs.py` — migration
- `apps/api/app/models/strategy_brief.py` — StrategyBrief ORM model
- `apps/api/app/agents/competitor.py` — CompetitorAgent
- `apps/api/app/agents/content_audit.py` — ContentAuditAgent
- `apps/api/app/agents/llm_visibility.py` — LLMVisibilityAgent
- `apps/api/app/agents/synthesis.py` — SynthesisAgent
- `apps/api/app/routes/briefs.py` — POST /briefs/{id}/approve, POST /briefs/{id}/refine
- `apps/api/app/routes/share.py` — GET /share/{token} (public, no auth)
- `apps/api/tests/unit/test_competitor_agent.py`
- `apps/api/tests/unit/test_content_audit_agent.py`
- `apps/api/tests/unit/test_llm_visibility_agent.py`
- `apps/api/tests/unit/test_synthesis_task.py`
- `apps/api/tests/unit/test_brief_routes.py`
- `apps/api/tests/integration/test_research_sprint.py`

### Modified files
- `packages/types/src/index.ts` — add awaiting_gate1, research result types, StrategyBrief, ThreadItem variants
- `apps/api/app/models/__init__.py` — export StrategyBrief
- `apps/api/app/core/jobs.py` — add awaiting_gate1 to _ALLOWED
- `apps/api/app/integrations/dataforseo.py` — add domain_competitors, domain_rank_overview, ranked_keywords methods
- `apps/api/app/workers/tasks.py` — replace 3 stub runners with real agents; update finalize_task to fire synthesis; add synthesis_task
- `apps/api/app/routes/workspaces.py` — update thread endpoint with section + brief items
- `apps/api/app/main.py` — register briefs + share routers
- `apps/api/tests/unit/test_transition.py` — add awaiting_gate1 tests

---

## Task 1: Update @prism/types — shared contract first

**Files:**
- Modify: `packages/types/src/index.ts`

Both the backend and frontend prototype session implement against these types. Update this before any other task.

- [ ] **Step 1: Replace packages/types/src/index.ts**

```typescript
// packages/types/src/index.ts

export type JobType =
  | 'orchestrator'
  | 'sprint'
  | 'keyword'
  | 'competitor'
  | 'content_audit'
  | 'llm_visibility'
  | 'synthesis';

export type JobStatus =
  | 'pending'
  | 'running'
  | 'awaiting_gate0'
  | 'awaiting_gate1'
  | 'complete'
  | 'complete_with_errors'
  | 'failed';

export type PlanStatus = 'draft' | 'approved' | 'superseded';
export type BriefStatus = 'draft' | 'approved';

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

// ── Research result types ─────────────────────────────────────────────────

export interface KeywordRow {
  term: string;
  volume: number | null;
  difficulty: number | null;
  priority_score: number;
}

export interface KeywordResult {
  keywords: KeywordRow[];
}

export interface GapKeyword {
  term: string;
  volume: int;
  kd: int;
  competitor: string;
  competitor_position: int;
}

export interface CompetitorSummary {
  domain: string;
  estimated_traffic: number;
  ranking_keywords: number;
  overlap_keywords: number;
}

export interface CompetitorResult {
  competitors: CompetitorSummary[];
  gap_keywords: GapKeyword[];
  quick_wins: GapKeyword[];
}

export interface AuditPage {
  url: string;
  title: string | null;
  top_keyword: string | null;
  position: number | null;
}

export interface ContentAuditResult {
  pages_found: number;
  ranking_pages: AuditPage[];
  missing_topics: string[];
  summary: string;
}

export interface LLMVisibilityResult {
  queries_tested: string[];
  brand_mentioned: boolean;
  mention_count: number;
  competitor_mentions: Record<string, number>;
  sample_response: string;
  note: string;
}

// ── Strategy Brief ────────────────────────────────────────────────────────

export interface ContentCluster {
  name: string;
  hub_page: string;
  spoke_pages: string[];
  target_keywords: string[];
  priority: number;
}

export interface Recommendation {
  title: string;
  rationale: string;
  estimated_impact: string;
  priority: number;
}

export interface StrategyBrief {
  id: string;
  workspace_id: string;
  plan_id: string;
  sprint_job_id: string;
  clusters: ContentCluster[];
  executive_summary: Recommendation[];
  share_token: string | null;
  status: BriefStatus;
  approved_at: string | null;
  created_at: string;
}

// ── Thread items ──────────────────────────────────────────────────────────

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

export interface ThreadResearchSectionItem {
  type: 'section';
  section_type: 'keyword' | 'competitor' | 'content_audit' | 'llm_visibility';
  job_id: string;
  job_status: JobStatus;
  result: KeywordResult | CompetitorResult | ContentAuditResult | LLMVisibilityResult | null;
}

export interface ThreadBriefItem {
  type: 'brief';
  brief_id: string;
  sprint_job_id: string;
  job_status: JobStatus;
  clusters: ContentCluster[];
  executive_summary: Recommendation[];
  share_token: string | null;
  brief_status: BriefStatus;
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

export type ThreadItem =
  | ThreadGoalItem
  | ThreadPlanItem
  | ThreadResearchSectionItem
  | ThreadBriefItem
  | ThreadJobsItem
  | ThreadErrorItem;
```

- [ ] **Step 2: Fix type errors — replace `int` with `number` in GapKeyword**

The TypeScript type used `int` (a Python type). Fix:

```typescript
export interface GapKeyword {
  term: string;
  volume: number;
  kd: number;
  competitor: string;
  competitor_position: number;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/types && pnpm tsc --noEmit 2>&1
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): research results, StrategyBrief, ThreadItem variants, awaiting_gate1"
```

---

## Task 2: DB migration + StrategyBrief model

**Files:**
- Create: `apps/api/alembic/versions/0004_strategy_briefs.py`
- Create: `apps/api/app/models/strategy_brief.py`
- Modify: `apps/api/app/models/__init__.py`

- [ ] **Step 1: Create migration file**

```python
# apps/api/alembic/versions/0004_strategy_briefs.py
"""add strategy_briefs table

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-30
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "strategy_briefs",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "plan_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("plans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sprint_job_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("clusters", sa.dialects.postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column(
            "executive_summary",
            sa.dialects.postgresql.JSONB(),
            nullable=False,
            server_default="[]",
        ),
        sa.Column("share_token", sa.Text(), nullable=False, unique=True),
        sa.Column("status", sa.String(), nullable=False, server_default="draft"),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_strategy_briefs_workspace_id", "strategy_briefs", ["workspace_id"])
    op.create_index("ix_strategy_briefs_share_token", "strategy_briefs", ["share_token"])


def downgrade() -> None:
    op.drop_index("ix_strategy_briefs_share_token", "strategy_briefs")
    op.drop_index("ix_strategy_briefs_workspace_id", "strategy_briefs")
    op.drop_table("strategy_briefs")
```

- [ ] **Step 2: Create StrategyBrief SQLAlchemy model**

```python
# apps/api/app/models/strategy_brief.py
from __future__ import annotations

import uuid

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ._base import Base, TimestampMixin


class StrategyBrief(Base, TimestampMixin):
    __tablename__ = "strategy_briefs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plans.id", ondelete="CASCADE"), nullable=False
    )
    sprint_job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    clusters: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    executive_summary: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    share_token: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="draft")
    approved_at: Mapped[uuid.UUID | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

- [ ] **Step 3: Export from models/__init__.py**

```python
# apps/api/app/models/__init__.py
from ._base import Base
from .job import Job
from .plan import Plan
from .strategy_brief import StrategyBrief
from .user import Organization, OrganizationMembership, User
from .workspace import Workspace

__all__ = [
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

- [ ] **Step 4: Run migration**

```bash
cd apps/api && uv run alembic upgrade head 2>&1 | tail -5
```

Expected: `Running upgrade 0003 -> 0004, add strategy_briefs table`

- [ ] **Step 5: Verify import**

```bash
cd apps/api && uv run python -c "from app.models import StrategyBrief; print('ok')"
```

Expected: `ok`

- [ ] **Step 6: Commit**

```bash
git add apps/api/alembic/versions/0004_strategy_briefs.py apps/api/app/models/strategy_brief.py apps/api/app/models/__init__.py
git commit -m "feat(api): migration 0004 — strategy_briefs table + StrategyBrief model"
```

---

## Task 3: Add awaiting_gate1 to transition table + tests

**Files:**
- Modify: `apps/api/app/core/jobs.py`
- Modify: `apps/api/tests/unit/test_transition.py`

- [ ] **Step 1: Write failing tests**

Append to `apps/api/tests/unit/test_transition.py`:

```python
@pytest.mark.asyncio
async def test_running_to_awaiting_gate1(db_session, sample_job):
    job = await sample_job(status="running", type="sprint")
    result = await transition(db_session, job, "awaiting_gate1")
    assert result.status == "awaiting_gate1"


@pytest.mark.asyncio
async def test_awaiting_gate1_to_complete(db_session, sample_job):
    job = await sample_job(status="awaiting_gate1", type="sprint")
    result = await transition(db_session, job, "complete")
    assert result.status == "complete"


@pytest.mark.asyncio
async def test_awaiting_gate1_illegal_on_non_sprint(db_session, sample_job):
    job = await sample_job(status="running", type="keyword")
    with pytest.raises(IllegalTransition):
        await transition(db_session, job, "awaiting_gate1")
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/api && uv run pytest tests/unit/test_transition.py::test_running_to_awaiting_gate1 -x -q 2>&1 | tail -5
```

Expected: FAIL — `awaiting_gate1` not in `_ALLOWED`

- [ ] **Step 3: Update jobs.py**

```python
# apps/api/app/core/jobs.py — replace _ALLOWED and update transition guard

_ALLOWED: dict[str, set[str]] = {
    "pending": {"running"},
    "running": {"complete", "failed", "complete_with_errors", "awaiting_gate0", "awaiting_gate1"},
    "awaiting_gate0": {"complete"},
    "awaiting_gate1": {"complete"},
    "complete": set(),
    "failed": {"running"},
    "complete_with_errors": set(),
}
```

Also update the guard for sprint-only statuses (find the existing `complete_with_errors` guard and extend it):

```python
    if new_status in {"complete_with_errors", "awaiting_gate1"} and job.type != "sprint":
        raise IllegalTransition(
            f"{job.type} job {job.id}: {new_status} is only valid for sprint jobs"
        )
```

- [ ] **Step 4: Run all transition tests**

```bash
cd apps/api && uv run pytest tests/unit/test_transition.py -q 2>&1 | tail -5
```

Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/core/jobs.py apps/api/tests/unit/test_transition.py
git commit -m "feat(api): add awaiting_gate1 to transition table (sprint jobs only)"
```

---

## Task 4: DataForSEO client — add three new methods

**Files:**
- Modify: `apps/api/app/integrations/dataforseo.py`

- [ ] **Step 1: Add three new methods to DataForSEOClient**

Append after the `keywords_for_keywords` method (before `_post`):

```python
    async def domain_competitors(self, domain: str) -> list[dict]:
        """Return competitor domains and their keyword overlap with `domain`."""
        payload = [{"target": domain, "language_code": "en", "location_code": 2840}]
        data = await self._post(
            "/v3/dataforseo_labs/google/competitors_domain/live", payload
        )
        return _extract_result(data)

    async def domain_rank_overview(self, domain: str) -> dict:
        """Return organic traffic metrics for `domain`."""
        payload = [{"target": domain, "language_code": "en", "location_code": 2840}]
        data = await self._post(
            "/v3/dataforseo_labs/google/domain_rank_overview/live", payload
        )
        rows = _extract_result(data)
        return rows[0] if rows else {}

    async def ranked_keywords(self, domain: str, limit: int = 100) -> list[dict]:
        """Return keywords `domain` ranks for, with URLs and positions."""
        payload = [
            {
                "target": domain,
                "language_code": "en",
                "location_code": 2840,
                "limit": limit,
                "filters": ["ranked_serp_element.serp_item.rank_group", "<=", 20],
            }
        ]
        data = await self._post(
            "/v3/dataforseo_labs/google/ranked_keywords/live", payload
        )
        return _extract_result(data)
```

- [ ] **Step 2: Verify import**

```bash
cd apps/api && uv run python -c "from app.integrations.dataforseo import DataForSEOClient; print(dir(DataForSEOClient()))" 2>&1 | grep -E "domain_competitors|ranked_keywords"
```

Expected: both method names appear

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/integrations/dataforseo.py
git commit -m "feat(api): DataForSEO client — domain_competitors, domain_rank_overview, ranked_keywords"
```

---

## Task 5: CompetitorAgent (TDD)

**Files:**
- Create: `apps/api/app/agents/competitor.py`
- Create: `apps/api/tests/unit/test_competitor_agent.py`

- [ ] **Step 1: Write failing test**

```python
# apps/api/tests/unit/test_competitor_agent.py
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.agents.competitor import CompetitorAgent, CompetitorInput


@pytest.mark.asyncio
async def test_competitor_agent_returns_gap_keywords():
    """Agent extracts gap keywords from mocked DataForSEO + Claude."""
    mock_competitors = [
        {
            "target": "greenhouse.io",
            "metrics": {"organic": {"etv": 50000, "keywords_count": 300}},
            "intersections": 20,
        }
    ]
    mock_ranked = [
        {
            "keyword_data": {"keyword": "ats for startups", "search_volume": 1200, "keyword_difficulty": 28},
            "ranked_serp_element": {"serp_item": {"url": "https://greenhouse.io/blog/ats", "title": "ATS Guide", "rank_group": 2}},
        }
    ]
    mock_my_ranked: list = []

    fake_result = {
        "competitors": [
            {"domain": "greenhouse.io", "estimated_traffic": 50000, "ranking_keywords": 300, "overlap_keywords": 20}
        ],
        "gap_keywords": [
            {"term": "ats for startups", "volume": 1200, "kd": 28, "competitor": "greenhouse.io", "competitor_position": 2}
        ],
        "quick_wins": [
            {"term": "ats for startups", "volume": 1200, "kd": 28, "competitor": "greenhouse.io", "competitor_position": 2}
        ],
    }

    with (
        patch("app.agents.competitor.DataForSEOClient") as MockDFS,
        patch.object(CompetitorAgent, "_call_claude", new_callable=AsyncMock) as mock_claude,
    ):
        dfs = MockDFS.return_value
        dfs.domain_competitors = AsyncMock(return_value=mock_competitors)
        dfs.ranked_keywords = AsyncMock(side_effect=[mock_ranked, mock_my_ranked])
        dfs.domain_rank_overview = AsyncMock(return_value={})

        from app.agents.competitor import CompetitorResult
        mock_claude.return_value = CompetitorResult(**fake_result)

        agent = CompetitorAgent(dataforseo=dfs)
        inp = CompetitorInput(
            domain="whitecarrot.io",
            competitors=["greenhouse.io"],
            intent="drive organic signups",
        )
        result = await agent.run(inp)

    assert len(result.gap_keywords) == 1
    assert result.gap_keywords[0].term == "ats for startups"
    assert len(result.quick_wins) == 1


@pytest.mark.asyncio
async def test_competitor_agent_empty_competitors():
    """Empty DataForSEO competitor response still returns valid result."""
    with (
        patch("app.agents.competitor.DataForSEOClient") as MockDFS,
        patch.object(CompetitorAgent, "_call_claude", new_callable=AsyncMock) as mock_claude,
    ):
        dfs = MockDFS.return_value
        dfs.domain_competitors = AsyncMock(return_value=[])
        dfs.ranked_keywords = AsyncMock(return_value=[])
        dfs.domain_rank_overview = AsyncMock(return_value={})

        from app.agents.competitor import CompetitorResult
        mock_claude.return_value = CompetitorResult(competitors=[], gap_keywords=[], quick_wins=[])

        agent = CompetitorAgent(dataforseo=dfs)
        inp = CompetitorInput(domain="new-site.io", competitors=[], intent="grow traffic")
        result = await agent.run(inp)

    assert result.competitors == []
    assert result.gap_keywords == []
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/api && uv run pytest tests/unit/test_competitor_agent.py -x -q 2>&1 | tail -5
```

Expected: FAIL — module not found

- [ ] **Step 3: Create CompetitorAgent**

```python
# apps/api/app/agents/competitor.py
from __future__ import annotations

from typing import ClassVar

import pydantic

from app.agents.base import BaseAgent
from app.agents.orchestrator import Plan
from app.integrations.dataforseo import DataForSEOClient


class CompetitorInput(pydantic.BaseModel):
    domain: str
    competitors: list[str]
    intent: str


class GapKeyword(pydantic.BaseModel):
    term: str
    volume: int
    kd: int
    competitor: str
    competitor_position: int


class CompetitorSummary(pydantic.BaseModel):
    domain: str
    estimated_traffic: int
    ranking_keywords: int
    overlap_keywords: int


class CompetitorResult(pydantic.BaseModel):
    competitors: list[CompetitorSummary]
    gap_keywords: list[GapKeyword]
    quick_wins: list[GapKeyword]   # subset: kd<35, vol>200


_CORE_PROMPT = """\
You are the Prism competitor gap analysis agent. You receive:
  - The user's domain and its ranked keywords (or empty list if none)
  - Each competitor domain's top keywords from DataForSEO

Identify:
1. `competitors`: summary of each competitor (use the provided metrics)
2. `gap_keywords`: keywords a competitor ranks for (position <=20) that the user does NOT rank for
3. `quick_wins`: subset of gap_keywords where kd<35 AND volume>200

Return JSON only matching the schema exactly.
"""


class CompetitorAgent(BaseAgent[CompetitorInput, CompetitorResult]):
    CORE_PROMPT: ClassVar[str] = _CORE_PROMPT
    BACKING_SKILL: ClassVar[str | None] = None
    RESPONSE_MODEL = CompetitorResult

    def __init__(self, dataforseo: DataForSEOClient | None = None) -> None:
        super().__init__()
        self._dfs = dataforseo or DataForSEOClient()

    def user_prompt(self, inp: CompetitorInput) -> str:
        raise NotImplementedError("overridden in run()")

    async def run(self, inp: CompetitorInput) -> CompetitorResult:
        competitor_data = await self._dfs.domain_competitors(inp.domain)
        my_ranked = await self._dfs.ranked_keywords(inp.domain, limit=200)

        comp_ranked: list[dict] = []
        for comp_domain in inp.competitors[:3]:
            rows = await self._dfs.ranked_keywords(comp_domain, limit=200)
            comp_ranked.append({"domain": comp_domain, "keywords": rows})

        user = (
            f"User domain: {inp.domain}\n"
            f"Intent: {inp.intent}\n\n"
            f"User ranked keywords (top 200):\n"
            + _fmt_ranked(my_ranked)
            + "\n\nCompetitor data from DataForSEO:\n"
            + _fmt_competitor_data(competitor_data, inp.competitors)
            + "\n\nCompetitor ranked keywords:\n"
            + "\n".join(
                f"\n{c['domain']}:\n" + _fmt_ranked(c["keywords"]) for c in comp_ranked
            )
        )
        return await self._call_claude(self.system_prompt(), user)


def _fmt_ranked(rows: list[dict]) -> str:
    if not rows:
        return "(none)"
    lines = []
    for r in rows[:50]:
        kd = r.get("keyword_data", {})
        se = r.get("ranked_serp_element", {}).get("serp_item", {})
        lines.append(
            f"- {kd.get('keyword','')} vol={kd.get('search_volume',0)} "
            f"kd={kd.get('keyword_difficulty',0)} pos={se.get('rank_group',0)}"
        )
    return "\n".join(lines)


def _fmt_competitor_data(rows: list[dict], requested: list[str]) -> str:
    if not rows:
        return "(no competitor data)"
    lines = []
    for r in rows:
        m = r.get("metrics", {}).get("organic", {})
        lines.append(
            f"- {r.get('target','')} traffic={m.get('etv',0)} "
            f"keywords={m.get('keywords_count',0)} overlap={r.get('intersections',0)}"
        )
    return "\n".join(lines)
```

- [ ] **Step 4: Run tests**

```bash
cd apps/api && uv run pytest tests/unit/test_competitor_agent.py -q 2>&1 | tail -5
```

Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/agents/competitor.py apps/api/tests/unit/test_competitor_agent.py
git commit -m "feat(api): CompetitorAgent — gap keywords + quick wins"
```

---

## Task 6: ContentAuditAgent (TDD)

**Files:**
- Create: `apps/api/app/agents/content_audit.py`
- Create: `apps/api/tests/unit/test_content_audit_agent.py`

- [ ] **Step 1: Write failing test**

```python
# apps/api/tests/unit/test_content_audit_agent.py
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.agents.content_audit import ContentAuditAgent, ContentAuditInput


@pytest.mark.asyncio
async def test_content_audit_identifies_ranking_pages():
    mock_ranked = [
        {
            "keyword_data": {"keyword": "ats software", "search_volume": 5000, "keyword_difficulty": 45},
            "ranked_serp_element": {
                "serp_item": {
                    "url": "https://whitecarrot.io/features",
                    "title": "Features",
                    "rank_group": 5,
                }
            },
        },
    ]

    fake_result = {
        "pages_found": 1,
        "ranking_pages": [
            {"url": "https://whitecarrot.io/features", "title": "Features", "top_keyword": "ats software", "position": 5}
        ],
        "missing_topics": ["TOFU blog content", "comparison pages"],
        "summary": "Site has 1 ranking page but no blog or comparison content targeting TOFU keywords.",
    }

    with (
        patch("app.agents.content_audit.DataForSEOClient") as MockDFS,
        patch.object(ContentAuditAgent, "_call_claude", new_callable=AsyncMock) as mock_claude,
    ):
        dfs = MockDFS.return_value
        dfs.ranked_keywords = AsyncMock(return_value=mock_ranked)

        from app.agents.content_audit import ContentAuditResult
        mock_claude.return_value = ContentAuditResult(**fake_result)

        agent = ContentAuditAgent(dataforseo=dfs)
        result = await agent.run(ContentAuditInput(domain="whitecarrot.io", intent="drive signups"))

    assert result.pages_found == 1
    assert len(result.ranking_pages) == 1
    assert result.ranking_pages[0].url == "https://whitecarrot.io/features"
    assert len(result.missing_topics) == 2


@pytest.mark.asyncio
async def test_content_audit_no_rankings():
    with (
        patch("app.agents.content_audit.DataForSEOClient") as MockDFS,
        patch.object(ContentAuditAgent, "_call_claude", new_callable=AsyncMock) as mock_claude,
    ):
        dfs = MockDFS.return_value
        dfs.ranked_keywords = AsyncMock(return_value=[])

        from app.agents.content_audit import ContentAuditResult
        mock_claude.return_value = ContentAuditResult(
            pages_found=0,
            ranking_pages=[],
            missing_topics=["all topics"],
            summary="No pages rank for any keywords yet.",
        )

        agent = ContentAuditAgent(dataforseo=dfs)
        result = await agent.run(ContentAuditInput(domain="brand-new.io", intent="grow"))

    assert result.pages_found == 0
    assert result.ranking_pages == []
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/api && uv run pytest tests/unit/test_content_audit_agent.py -x -q 2>&1 | tail -5
```

Expected: FAIL — module not found

- [ ] **Step 3: Create ContentAuditAgent**

```python
# apps/api/app/agents/content_audit.py
from __future__ import annotations

from typing import ClassVar

import pydantic

from app.agents.base import BaseAgent
from app.integrations.dataforseo import DataForSEOClient


class ContentAuditInput(pydantic.BaseModel):
    domain: str
    intent: str


class AuditPage(pydantic.BaseModel):
    url: str
    title: str | None
    top_keyword: str | None
    position: int | None


class ContentAuditResult(pydantic.BaseModel):
    pages_found: int
    ranking_pages: list[AuditPage]
    missing_topics: list[str]
    summary: str


_CORE_PROMPT = """\
You are the Prism content audit agent. You receive:
  - The user's domain and intent
  - A list of keywords the domain currently ranks for (from DataForSEO), with URLs and positions

Produce:
1. `pages_found`: count of unique ranking URLs
2. `ranking_pages`: list of pages that rank (deduplicated by URL, keep top keyword per page)
3. `missing_topics`: 3–6 topic areas with no coverage relevant to the intent
4. `summary`: 2–3 sentence summary of the content gap

Return JSON only matching the schema exactly.
"""


class ContentAuditAgent(BaseAgent[ContentAuditInput, ContentAuditResult]):
    CORE_PROMPT: ClassVar[str] = _CORE_PROMPT
    BACKING_SKILL: ClassVar[str | None] = None
    RESPONSE_MODEL = ContentAuditResult

    def __init__(self, dataforseo: DataForSEOClient | None = None) -> None:
        super().__init__()
        self._dfs = dataforseo or DataForSEOClient()

    def user_prompt(self, inp: ContentAuditInput) -> str:
        raise NotImplementedError("overridden in run()")

    async def run(self, inp: ContentAuditInput) -> ContentAuditResult:
        ranked = await self._dfs.ranked_keywords(inp.domain, limit=100)
        user = (
            f"Domain: {inp.domain}\nIntent: {inp.intent}\n\n"
            f"Currently ranking keywords ({len(ranked)} found):\n"
            + _fmt_ranked_for_audit(ranked)
        )
        return await self._call_claude(self.system_prompt(), user)


def _fmt_ranked_for_audit(rows: list[dict]) -> str:
    if not rows:
        return "(domain ranks for no keywords)"
    lines = []
    for r in rows[:100]:
        kd = r.get("keyword_data", {})
        se = r.get("ranked_serp_element", {}).get("serp_item", {})
        lines.append(
            f"- kw='{kd.get('keyword','')}' url='{se.get('url','')}' "
            f"title='{se.get('title','')}' pos={se.get('rank_group',0)}"
        )
    return "\n".join(lines)
```

- [ ] **Step 4: Run tests**

```bash
cd apps/api && uv run pytest tests/unit/test_content_audit_agent.py -q 2>&1 | tail -5
```

Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/agents/content_audit.py apps/api/tests/unit/test_content_audit_agent.py
git commit -m "feat(api): ContentAuditAgent — ranked keywords + gap analysis"
```

---

## Task 7: LLMVisibilityAgent (TDD)

**Files:**
- Create: `apps/api/app/agents/llm_visibility.py`
- Create: `apps/api/tests/unit/test_llm_visibility_agent.py`

- [ ] **Step 1: Write failing test**

```python
# apps/api/tests/unit/test_llm_visibility_agent.py
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.agents.llm_visibility import LLMVisibilityAgent, LLMVisibilityInput


@pytest.mark.asyncio
async def test_brand_not_mentioned_sets_flag_false():
    fake_result = {
        "queries_tested": ["best ats for startups", "recruiting software for small teams"],
        "brand_mentioned": False,
        "mention_count": 0,
        "competitor_mentions": {"greenhouse.io": 2, "ashby.com": 1},
        "sample_response": "For startups I recommend Greenhouse or Ashby...",
        "note": "Based on Claude training data. Results reflect model knowledge, not live web search.",
    }

    with patch.object(LLMVisibilityAgent, "_call_claude", new_callable=AsyncMock) as mock_claude:
        from app.agents.llm_visibility import LLMVisibilityResult
        mock_claude.return_value = LLMVisibilityResult(**fake_result)

        agent = LLMVisibilityAgent()
        result = await agent.run(
            LLMVisibilityInput(
                domain="whitecarrot.io",
                intent="drive signups for ATS",
                competitors=["greenhouse.io", "ashby.com"],
            )
        )

    assert result.brand_mentioned is False
    assert result.mention_count == 0
    assert result.competitor_mentions["greenhouse.io"] == 2


@pytest.mark.asyncio
async def test_brand_mentioned_sets_flag_true():
    fake_result = {
        "queries_tested": ["best ats for startups"],
        "brand_mentioned": True,
        "mention_count": 1,
        "competitor_mentions": {"greenhouse.io": 1},
        "sample_response": "Whitecarrot is a great option...",
        "note": "Based on Claude training data.",
    }

    with patch.object(LLMVisibilityAgent, "_call_claude", new_callable=AsyncMock) as mock_claude:
        from app.agents.llm_visibility import LLMVisibilityResult
        mock_claude.return_value = LLMVisibilityResult(**fake_result)

        agent = LLMVisibilityAgent()
        result = await agent.run(
            LLMVisibilityInput(domain="whitecarrot.io", intent="ats", competitors=[])
        )

    assert result.brand_mentioned is True
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/api && uv run pytest tests/unit/test_llm_visibility_agent.py -x -q 2>&1 | tail -5
```

Expected: FAIL — module not found

- [ ] **Step 3: Create LLMVisibilityAgent**

```python
# apps/api/app/agents/llm_visibility.py
from __future__ import annotations

from datetime import date
from typing import ClassVar

import pydantic

from app.agents.base import BaseAgent


class LLMVisibilityInput(pydantic.BaseModel):
    domain: str
    intent: str
    competitors: list[str]


class LLMVisibilityResult(pydantic.BaseModel):
    queries_tested: list[str]
    brand_mentioned: bool
    mention_count: int
    competitor_mentions: dict[str, int]
    sample_response: str
    note: str


_CORE_PROMPT = """\
You are the Prism LLM visibility agent. Your job is to simulate what an AI assistant
(like yourself) would say when asked questions related to the user's product category,
and check whether the user's brand is mentioned.

You receive:
  - The user's domain (brand)
  - Their intent (product category / use case)
  - Their competitor domains

Steps:
1. Generate 5 realistic user queries someone might ask an AI about this category
   (e.g. "best ATS for a 50-person startup", "recruiting software comparison")
2. For each query, answer as an AI assistant would — recommend tools honestly
3. Check if the user's domain/brand appears in any of your answers
4. Count how many times each competitor appears across all answers
5. Pick the most informative query+answer as `sample_response`

Return JSON matching the schema. Set `brand_mentioned=true` only if the user's
domain or obvious brand name appears in at least one answer.

Always include this exact text in `note`:
"Based on Claude training data. Results reflect model knowledge, not live web search."
"""


class LLMVisibilityAgent(BaseAgent[LLMVisibilityInput, LLMVisibilityResult]):
    CORE_PROMPT: ClassVar[str] = _CORE_PROMPT
    BACKING_SKILL: ClassVar[str | None] = None
    RESPONSE_MODEL = LLMVisibilityResult

    def user_prompt(self, inp: LLMVisibilityInput) -> str:
        return (
            f"User's domain: {inp.domain}\n"
            f"Intent / product category: {inp.intent}\n"
            f"Known competitors: {', '.join(inp.competitors) or 'none provided'}\n\n"
            "Run the 5-query visibility check as described."
        )
```

- [ ] **Step 4: Run tests**

```bash
cd apps/api && uv run pytest tests/unit/test_llm_visibility_agent.py -q 2>&1 | tail -5
```

Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/agents/llm_visibility.py apps/api/tests/unit/test_llm_visibility_agent.py
git commit -m "feat(api): LLMVisibilityAgent — Claude probing for brand mention"
```

---

## Task 8: SynthesisAgent (TDD)

**Files:**
- Create: `apps/api/app/agents/synthesis.py`
- Create: `apps/api/tests/unit/test_synthesis_task.py` (partial — task wrapper tests added in Task 9)

- [ ] **Step 1: Write failing test for the agent**

```python
# apps/api/tests/unit/test_synthesis_task.py
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.agents.synthesis import SynthesisAgent, SynthesisInput


@pytest.mark.asyncio
async def test_synthesis_agent_returns_clusters_and_summary():
    fake_result = {
        "clusters": [
            {
                "name": "ATS Basics",
                "hub_page": "What is an ATS?",
                "spoke_pages": ["ATS for startups", "How to choose an ATS"],
                "target_keywords": ["ats software", "applicant tracking"],
                "priority": 1,
            }
        ],
        "executive_summary": [
            {
                "title": "Build 3 TOFU hub pages",
                "rationale": "Zero blog content targeting high-volume TOFU keywords",
                "estimated_impact": "800 organic/mo in 90 days",
                "priority": 1,
            }
        ],
    }

    with patch.object(SynthesisAgent, "_call_claude", new_callable=AsyncMock) as mock_claude:
        from app.agents.synthesis import SynthesisResult
        mock_claude.return_value = SynthesisResult(**fake_result)

        agent = SynthesisAgent()
        result = await agent.run(
            SynthesisInput(
                plan_id="plan-1",
                domain="whitecarrot.io",
                intent="drive signups",
                keyword_result={"keywords": []},
                competitor_result={"competitors": [], "gap_keywords": [], "quick_wins": []},
                content_audit_result={"pages_found": 0, "ranking_pages": [], "missing_topics": [], "summary": ""},
                llm_visibility_result={"queries_tested": [], "brand_mentioned": False, "mention_count": 0, "competitor_mentions": {}, "sample_response": "", "note": ""},
            )
        )

    assert len(result.clusters) == 1
    assert result.clusters[0].name == "ATS Basics"
    assert len(result.executive_summary) == 1
    assert result.executive_summary[0].priority == 1
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/api && uv run pytest tests/unit/test_synthesis_task.py::test_synthesis_agent_returns_clusters_and_summary -x -q 2>&1 | tail -5
```

Expected: FAIL — module not found

- [ ] **Step 3: Create SynthesisAgent**

```python
# apps/api/app/agents/synthesis.py
from __future__ import annotations

import json
from typing import ClassVar

import pydantic

from app.agents.base import BaseAgent


class SynthesisInput(pydantic.BaseModel):
    plan_id: str
    domain: str
    intent: str
    keyword_result: dict
    competitor_result: dict
    content_audit_result: dict
    llm_visibility_result: dict


class ContentCluster(pydantic.BaseModel):
    name: str
    hub_page: str
    spoke_pages: list[str]
    target_keywords: list[str]
    priority: int


class Recommendation(pydantic.BaseModel):
    title: str
    rationale: str
    estimated_impact: str
    priority: int


class SynthesisResult(pydantic.BaseModel):
    clusters: list[ContentCluster]
    executive_summary: list[Recommendation]


_CORE_PROMPT = """\
You are the Prism strategy synthesis agent. You receive the complete research output
from 4 specialist agents:
  - Keyword Intelligence: ranked keywords with volume, difficulty, priority scores
  - Competitor Gap: gap keywords, quick wins vs competitors
  - Content Audit: existing pages, ranking status, missing topic areas
  - LLM Visibility: brand mention status in AI-generated answers

Produce:
1. `clusters`: 3–6 topic clusters. Each cluster has a hub page concept, 3–5 spoke pages,
   top 3 target keywords, and a priority rank (1 = highest).
   Base clusters on keyword themes + gap analysis. Prioritise low-competition, high-volume clusters.

2. `executive_summary`: 3–5 prioritised action recommendations. Each has a short title,
   rationale (why this is the highest-leverage action), and estimated impact (quantified if possible).
   Cross-reference all 4 research inputs — the best recommendations emerge from the intersections.

Return JSON only matching the schema. No prose outside the JSON.
"""


class SynthesisAgent(BaseAgent[SynthesisInput, SynthesisResult]):
    CORE_PROMPT: ClassVar[str] = _CORE_PROMPT
    BACKING_SKILL: ClassVar[str | None] = None
    RESPONSE_MODEL = SynthesisResult

    def user_prompt(self, inp: SynthesisInput) -> str:
        return (
            f"Domain: {inp.domain}\nIntent: {inp.intent}\n\n"
            f"=== KEYWORD INTELLIGENCE ===\n{json.dumps(inp.keyword_result, indent=2)}\n\n"
            f"=== COMPETITOR GAP ===\n{json.dumps(inp.competitor_result, indent=2)}\n\n"
            f"=== CONTENT AUDIT ===\n{json.dumps(inp.content_audit_result, indent=2)}\n\n"
            f"=== LLM VISIBILITY ===\n{json.dumps(inp.llm_visibility_result, indent=2)}\n\n"
            "Synthesise the above into clusters and executive_summary."
        )
```

- [ ] **Step 4: Run test**

```bash
cd apps/api && uv run pytest tests/unit/test_synthesis_task.py::test_synthesis_agent_returns_clusters_and_summary -q 2>&1 | tail -5
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/agents/synthesis.py apps/api/tests/unit/test_synthesis_task.py
git commit -m "feat(api): SynthesisAgent — clusters + executive summary"
```

---

## Task 9: Wire up tasks.py — real agents + synthesis_task + updated finalize

**Files:**
- Modify: `apps/api/app/workers/tasks.py`
- Modify: `apps/api/tests/unit/test_synthesis_task.py` (add task contract tests)

- [ ] **Step 1: Add synthesis task contract test**

Append to `apps/api/tests/unit/test_synthesis_task.py`:

```python
@pytest.mark.asyncio
async def test_synthesis_task_writes_brief_and_transitions_sprint(db_session, sample_workspace):
    """synthesis_task must write a strategy_briefs row and transition sprint to awaiting_gate1."""
    from unittest.mock import AsyncMock, MagicMock, patch
    from app.workers.tasks import synthesis_task
    from app.models import Job, StrategyBrief
    import uuid
    from sqlalchemy import select

    # Create a sprint job
    sprint = Job(
        workspace_id=sample_workspace.id,
        type="sprint",
        status="running",
        input={"plan_id": str(uuid.uuid4())},
    )
    db_session.add(sprint)
    await db_session.flush()
    sprint_id = str(sprint.id)

    fake_synthesis = MagicMock()
    fake_synthesis.clusters = []
    fake_synthesis.executive_summary = []

    with (
        patch("app.workers.tasks.SynthesisAgent") as MockAgent,
        patch("app.workers.tasks._get_child_results", new_callable=AsyncMock) as mock_results,
    ):
        MockAgent.return_value.run = AsyncMock(return_value=fake_synthesis)
        mock_results.return_value = {
            "keyword": {}, "competitor": {}, "content_audit": {}, "llm_visibility": {}
        }
        result = synthesis_task(sprint_id)

    assert result["ok"] is True
    assert "brief_id" in result

    await db_session.refresh(sprint)
    assert sprint.status == "awaiting_gate1"

    r = await db_session.execute(
        select(StrategyBrief).where(StrategyBrief.sprint_job_id == sprint.id)
    )
    brief = r.scalar_one()
    assert brief.status == "draft"
    assert brief.share_token is not None


@pytest.mark.asyncio
async def test_synthesis_task_contract_never_raises(db_session, sample_workspace):
    """synthesis_task must return {ok: False} on exception, never raise."""
    from app.workers.tasks import synthesis_task
    from app.models import Job
    import uuid

    sprint = Job(
        workspace_id=sample_workspace.id,
        type="sprint",
        status="running",
        input={"plan_id": str(uuid.uuid4())},
    )
    db_session.add(sprint)
    await db_session.flush()

    with patch("app.workers.tasks.SynthesisAgent") as MockAgent:
        MockAgent.return_value.run = AsyncMock(side_effect=RuntimeError("synthesis boom"))
        result = synthesis_task(str(sprint.id))

    assert result["ok"] is False
    assert "error" in result
```

- [ ] **Step 2: Run new tests to confirm they fail**

```bash
cd apps/api && uv run pytest tests/unit/test_synthesis_task.py::test_synthesis_task_writes_brief_and_transitions_sprint -x -q 2>&1 | tail -5
```

Expected: FAIL — `synthesis_task` does not exist yet

- [ ] **Step 3: Replace tasks.py with updated version**

```python
# apps/api/app/workers/tasks.py
"""Celery tasks implementing the chord pipeline.

CONTRACT: every child task in the chord MUST ALWAYS RETURN a dict and never
raise past the task boundary. A raised exception would leave the chord stuck
forever. We catch `Exception` deliberately — bugs are still captured by Sentry
via `sentry_sdk.capture_exception`.
"""
from __future__ import annotations

import asyncio
import uuid
from typing import Any

import sentry_sdk
from celery import chord, group
from celery.result import AsyncResult
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.competitor import CompetitorAgent, CompetitorInput
from app.agents.content_audit import ContentAuditAgent, ContentAuditInput
from app.agents.keyword import KeywordAgent, KeywordInput
from app.agents.llm_visibility import LLMVisibilityAgent, LLMVisibilityInput
from app.agents.orchestrator import OrchestratorAgent, OrchestratorInput, Plan
from app.agents.synthesis import SynthesisAgent, SynthesisInput
from app.core.config import settings
from app.core.db import SessionLocal
from app.core.errors import classify
from app.core.jobs import transition
from app.models import Job, Plan as PlanModel, StrategyBrief, Workspace
from app.workers.celery_app import celery_app


def _run(coro):
    return asyncio.run(coro)


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


def _dispatch_chord(plan_id: str, sprint_job_id: str) -> AsyncResult:
    header = group(
        keyword_task.s(plan_id, sprint_job_id),
        competitor_task.s(plan_id, sprint_job_id),
        content_audit_task.s(plan_id, sprint_job_id),
        llm_visibility_task.s(plan_id, sprint_job_id),
    )
    callback = finalize_task.s(sprint_job_id)
    error_callback = finalize_error_task.s(sprint_job_id)
    return chord(header, body=callback).on_error(error_callback).apply_async()


def _child_body(agent_type: str, runner):
    async def _run_wrapper(plan_id: str, sprint_job_id: str) -> dict:
        async with SessionLocal() as session:
            child = Job(
                workspace_id=await _workspace_id_of_sprint(session, sprint_job_id),
                parent_job_id=uuid.UUID(sprint_job_id),
                type=agent_type,
                status="pending",
                input={"plan_id": plan_id},
            )
            session.add(child)
            await session.flush()
            child_id = str(child.id)
            await transition(session, child, "running")
            await session.commit()

            try:
                plan_row = await session.get(PlanModel, uuid.UUID(plan_id))
                assert plan_row is not None
                plan = Plan(
                    intent=plan_row.intent,
                    domain=plan_row.domain,
                    competitors=list(plan_row.competitors),
                    timeline_weeks=plan_row.timeline_weeks,
                    sprint_order=list(plan_row.sprint_order),
                )
                result = await runner(plan)
                await transition(session, child, "complete", result=_to_json(result))
                await session.commit()
                return {"child_job_id": child_id, "type": agent_type, "ok": True}
            except Exception as exc:
                err = classify(exc, provider=agent_type)
                sentry_sdk.capture_exception(exc)
                await transition(session, child, "failed", error=err)
                await session.commit()
                return {
                    "child_job_id": child_id,
                    "type": agent_type,
                    "ok": False,
                    "error": err.to_json(),
                }

    return _run_wrapper


async def _keyword_runner(plan: Plan):
    return await KeywordAgent().run(KeywordInput(plan=plan))


async def _competitor_runner(plan: Plan):
    return await CompetitorAgent().run(
        CompetitorInput(domain=plan.domain, competitors=plan.competitors, intent=plan.intent)
    )


async def _content_audit_runner(plan: Plan):
    return await ContentAuditAgent().run(
        ContentAuditInput(domain=plan.domain, intent=plan.intent)
    )


async def _llm_visibility_runner(plan: Plan):
    return await LLMVisibilityAgent().run(
        LLMVisibilityInput(
            domain=plan.domain, intent=plan.intent, competitors=plan.competitors
        )
    )


@celery_app.task(bind=True, name="agents.keyword")
def keyword_task(self, plan_id: str, sprint_job_id: str) -> dict:
    return _run(_child_body("keyword", _keyword_runner)(plan_id, sprint_job_id))


@celery_app.task(bind=True, name="agents.competitor")
def competitor_task(self, plan_id: str, sprint_job_id: str) -> dict:
    return _run(_child_body("competitor", _competitor_runner)(plan_id, sprint_job_id))


@celery_app.task(bind=True, name="agents.content_audit")
def content_audit_task(self, plan_id: str, sprint_job_id: str) -> dict:
    return _run(_child_body("content_audit", _content_audit_runner)(plan_id, sprint_job_id))


@celery_app.task(bind=True, name="agents.llm_visibility")
def llm_visibility_task(self, plan_id: str, sprint_job_id: str) -> dict:
    return _run(_child_body("llm_visibility", _llm_visibility_runner)(plan_id, sprint_job_id))


@celery_app.task(name="agents.finalize")
def finalize_task(child_results: list[dict], sprint_job_id: str) -> dict:
    async def _body() -> dict:
        async with SessionLocal() as session:
            sprint = await session.get(Job, uuid.UUID(sprint_job_id))
            if sprint is None or sprint.status != "running":
                return {"ok": False, "reason": "sprint missing or not running"}
            all_ok = all(r.get("ok") for r in child_results)
            if not all_ok:
                await transition(
                    session,
                    sprint,
                    "complete_with_errors",
                    result={"children": child_results, "errors": True},
                )
                await session.commit()
                return {"ok": False, "status": "complete_with_errors"}
            # All children ok — fire synthesis, leave sprint running
            await session.commit()
        synthesis_task.delay(sprint_job_id)
        return {"ok": True, "status": "synthesis_dispatched"}

    try:
        return _run(_body())
    except Exception as exc:
        sentry_sdk.capture_exception(exc)
        return {"ok": False, "reason": f"finalize bug: {exc!r}"}


@celery_app.task(name="agents.synthesis")
def synthesis_task(sprint_job_id: str) -> dict:
    async def _body() -> dict:
        async with SessionLocal() as session:
            sprint = await session.get(Job, uuid.UUID(sprint_job_id))
            if sprint is None:
                return {"ok": False, "reason": "sprint not found"}

            plan_id_str = sprint.input.get("plan_id")
            if not plan_id_str:
                return {"ok": False, "reason": "sprint has no plan_id in input"}

            plan_row = await session.get(PlanModel, uuid.UUID(plan_id_str))
            if plan_row is None:
                return {"ok": False, "reason": "plan not found"}

            try:
                child_results = await _get_child_results(session, sprint.id)
                result = await SynthesisAgent().run(
                    SynthesisInput(
                        plan_id=plan_id_str,
                        domain=plan_row.domain,
                        intent=plan_row.intent,
                        keyword_result=child_results.get("keyword", {}),
                        competitor_result=child_results.get("competitor", {}),
                        content_audit_result=child_results.get("content_audit", {}),
                        llm_visibility_result=child_results.get("llm_visibility", {}),
                    )
                )
            except Exception as exc:
                err = classify(exc, provider="claude")
                sentry_sdk.capture_exception(exc)
                return {"ok": False, "error": err.to_json()}

            brief = StrategyBrief(
                workspace_id=sprint.workspace_id,
                plan_id=uuid.UUID(plan_id_str),
                sprint_job_id=sprint.id,
                clusters=_to_json(result)["clusters"],
                executive_summary=_to_json(result)["executive_summary"],
                share_token=str(uuid.uuid4()),
                status="draft",
            )
            session.add(brief)
            await session.flush()
            brief_id = str(brief.id)

            await transition(
                session, sprint, "awaiting_gate1", result={"brief_id": brief_id}
            )
            await session.commit()
            return {"ok": True, "brief_id": brief_id}

    try:
        return _run(_body())
    except Exception as exc:
        sentry_sdk.capture_exception(exc)
        return {"ok": False, "reason": f"synthesis bug: {exc!r}"}


@celery_app.task(name="agents.finalize_error")
def finalize_error_task(request_context: Any, sprint_job_id: str) -> dict:
    async def _body() -> dict:
        async with SessionLocal() as session:
            sprint = await session.get(Job, uuid.UUID(sprint_job_id))
            if sprint is None or sprint.status != "running":
                return {"ok": False, "reason": "sprint missing or not running"}
            await transition(
                session,
                sprint,
                "complete_with_errors",
                result={"error_callback_fired": True, "context": str(request_context)[:500]},
            )
            await session.commit()
            return {"ok": True, "status": "complete_with_errors"}

    try:
        return _run(_body())
    except Exception as exc:
        sentry_sdk.capture_exception(exc)
        return {"ok": False, "reason": "finalize_error bug"}


async def _get_child_results(session: AsyncSession, sprint_id: uuid.UUID) -> dict[str, dict]:
    """Load each child job's result dict, keyed by job type."""
    result = await session.execute(
        select(Job).where(Job.parent_job_id == sprint_id)
    )
    children = result.scalars().all()
    return {
        child.type: child.result or {}
        for child in children
        if child.status == "complete"
    }


async def _load_job(session: AsyncSession, job_id: str) -> Job:
    job = await session.get(Job, uuid.UUID(job_id))
    if job is None:
        raise RuntimeError(f"job {job_id} not found")
    return job


async def _workspace_id_of_sprint(session: AsyncSession, sprint_job_id: str) -> uuid.UUID:
    row = await session.execute(
        select(Job.workspace_id).where(Job.id == uuid.UUID(sprint_job_id))
    )
    workspace_id = row.scalar_one()
    assert isinstance(workspace_id, uuid.UUID)
    return workspace_id


def _to_json(obj: Any) -> dict:
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="json")
    return dict(obj) if isinstance(obj, dict) else {"value": str(obj)}
```

- [ ] **Step 4: Run all synthesis tests**

```bash
cd apps/api && uv run pytest tests/unit/test_synthesis_task.py -q 2>&1 | tail -5
```

Expected: 3 passed

- [ ] **Step 5: Run full unit suite to check no regressions**

```bash
cd apps/api && uv run pytest tests/unit/ -q 2>&1 | tail -10
```

Expected: all previously passing tests still pass

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/workers/tasks.py apps/api/tests/unit/test_synthesis_task.py
git commit -m "feat(api): wire real agents + synthesis_task; finalize fires synthesis on success"
```

---

## Task 10: Briefs router — approve + refine

**Files:**
- Create: `apps/api/app/routes/briefs.py`
- Create: `apps/api/tests/unit/test_brief_routes.py`

- [ ] **Step 1: Write failing unit tests**

```python
# apps/api/tests/unit/test_brief_routes.py
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

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

    with patch("app.routes.briefs.get_session") as mock_dep:
        mock_session = AsyncMock()
        mock_session.get = AsyncMock(side_effect=lambda m, pk: {
            str(brief_id): fake_brief,
            str(sprint_id): fake_sprint,
            str(ws_id): fake_ws,
        }.get(str(pk)))
        mock_session.commit = AsyncMock()
        mock_dep.return_value = mock_session

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

    with patch("app.routes.briefs.get_session") as mock_dep:
        mock_session = AsyncMock()
        mock_session.get = AsyncMock(side_effect=lambda m, pk: {
            str(brief_id): fake_brief,
            str(ws_id): fake_ws,
        }.get(str(pk)))
        mock_dep.return_value = mock_session

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

    with patch("app.routes.briefs.get_session") as mock_dep:
        mock_session = AsyncMock()
        mock_session.get = AsyncMock(side_effect=lambda m, pk: {
            str(brief_id): fake_brief,
            str(ws_id): fake_ws,
        }.get(str(pk)))
        mock_dep.return_value = mock_session

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post(
                f"/briefs/{brief_id}/approve",
                headers={"Authorization": "Bearer fake"},
            )

    assert res.status_code == 409
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/api && uv run pytest tests/unit/test_brief_routes.py -x -q 2>&1 | tail -5
```

Expected: errors — `/briefs/` route does not exist

- [ ] **Step 3: Create briefs.py router**

```python
# apps/api/app/routes/briefs.py
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

    # Store feedback on sprint input and re-queue synthesis
    sprint.input = {**sprint.input, "synthesis_feedback": body.feedback}
    await transition(session, sprint, "running")

    # Reset brief to draft (synthesis will overwrite)
    brief.status = "draft"
    await session.commit()

    synthesis_task.delay(str(sprint.id))
    return {"ok": True, "sprint_job_id": str(sprint.id)}
```

- [ ] **Step 4: Register briefs router in main.py**

```python
# apps/api/app/main.py
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.sentry import init_sentry
from app.routes import briefs, health, jobs, plans, webhooks, workspaces

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
app.include_router(plans.router)
app.include_router(briefs.router)
app.include_router(webhooks.router)
```

- [ ] **Step 5: Run unit tests**

```bash
cd apps/api && uv run pytest tests/unit/test_brief_routes.py -q 2>&1 | tail -10
```

Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/routes/briefs.py apps/api/app/main.py apps/api/tests/unit/test_brief_routes.py
git commit -m "feat(api): briefs router — approve + refine endpoints"
```

---

## Task 11: Share router — public brief endpoint

**Files:**
- Create: `apps/api/app/routes/share.py`

- [ ] **Step 1: Create share.py router**

```python
# apps/api/app/routes/share.py
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
```

- [ ] **Step 2: Register share router in main.py**

Add `from app.routes import share` to imports and `app.include_router(share.router)` after `briefs.router`:

```python
# apps/api/app/main.py
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.sentry import init_sentry
from app.routes import briefs, health, jobs, plans, share, webhooks, workspaces

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
app.include_router(plans.router)
app.include_router(briefs.router)
app.include_router(share.router)
app.include_router(webhooks.router)
```

- [ ] **Step 3: Verify routes registered**

```bash
cd apps/api && uv run python -c "
from app.main import app
paths = [r.path for r in app.routes]
assert '/share/{token}' in paths, paths
print('share route ok')
"
```

Expected: `share route ok`

- [ ] **Step 4: Commit**

```bash
git add apps/api/app/routes/share.py apps/api/app/main.py
git commit -m "feat(api): GET /share/{token} — public brief endpoint, no auth"
```

---

## Task 12: Update thread endpoint with section + brief items

**Files:**
- Modify: `apps/api/app/routes/workspaces.py`

- [ ] **Step 1: Read the end of the file to find the thread endpoint**

The thread endpoint is in `apps/api/app/routes/workspaces.py` starting around line 100. Replace the entire thread section (everything after the existing workspace CRUD routes) with the updated version below.

- [ ] **Step 2: Replace the thread section in workspaces.py**

Find the `# ── Thread endpoint` comment block and replace everything from it to the end of the file:

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


class ThreadResearchSectionItem(pydantic.BaseModel):
    type: Literal["section"] = "section"
    section_type: str    # keyword | competitor | content_audit | llm_visibility
    job_id: uuid.UUID
    job_status: str
    result: dict | None


class _BriefOut(pydantic.BaseModel):
    id: uuid.UUID
    sprint_job_id: uuid.UUID
    clusters: list
    executive_summary: list
    share_token: str | None
    status: str
    model_config = pydantic.ConfigDict(from_attributes=True)


class ThreadBriefItem(pydantic.BaseModel):
    type: Literal["brief"] = "brief"
    brief_id: uuid.UUID
    sprint_job_id: uuid.UUID
    job_status: str
    clusters: list
    executive_summary: list
    share_token: str | None
    brief_status: str


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


@router.get("/{workspace_id}/thread", response_model=list[Any])
async def get_workspace_thread(
    workspace_id: uuid.UUID,
    principal: ClerkPrincipal = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list:
    w = await session.get(Workspace, workspace_id)
    if w is None or w.user_id != principal.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "workspace not found")

    # Load all orchestrator jobs for this workspace ordered by time
    result = await session.execute(
        select(Job)
        .where(Job.workspace_id == workspace_id, Job.type == "orchestrator")
        .order_by(Job.created_at)
    )
    orch_jobs = list(result.scalars())
    if not orch_jobs:
        return []

    orch_ids = [j.id for j in orch_jobs]

    # Plans keyed by orchestrator job id
    result = await session.execute(
        select(PlanModel).where(PlanModel.job_id.in_(orch_ids))
    )
    plan_by_job: dict[uuid.UUID, PlanModel] = {p.job_id: p for p in result.scalars()}

    # Sprint jobs keyed by parent (orchestrator) id
    result = await session.execute(
        select(Job).where(Job.parent_job_id.in_(orch_ids), Job.type == "sprint")
    )
    sprint_by_parent: dict[uuid.UUID, Job] = {s.parent_job_id: s for s in result.scalars()}

    sprint_ids = [s.id for s in sprint_by_parent.values()]

    # Child agent jobs keyed by sprint id
    children_by_sprint: dict[uuid.UUID, list[Job]] = {}
    if sprint_ids:
        result = await session.execute(
            select(Job).where(Job.parent_job_id.in_(sprint_ids)).order_by(Job.created_at)
        )
        for child in result.scalars():
            children_by_sprint.setdefault(child.parent_job_id, []).append(child)

    # Strategy briefs keyed by sprint job id
    brief_by_sprint: dict[uuid.UUID, StrategyBrief] = {}
    if sprint_ids:
        result = await session.execute(
            select(StrategyBrief).where(StrategyBrief.sprint_job_id.in_(sprint_ids))
        )
        for brief in result.scalars():
            brief_by_sprint[brief.sprint_job_id] = brief

    items: list = []
    for orch in orch_jobs:
        # Goal bubble
        items.append(ThreadGoalItem(
            type="goal",
            job_id=orch.id,
            goal=orch.input.get("goal", ""),
            feedback=orch.input.get("feedback"),
            job_status=orch.status,
            created_at=orch.created_at.isoformat(),
        ).model_dump())

        # Plan card or error
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

        # Research section cards (one per child agent, ordered by created_at)
        sprint = sprint_by_parent.get(orch.id)
        if sprint:
            children = children_by_sprint.get(sprint.id, [])
            _SECTION_TYPES = {"keyword", "competitor", "content_audit", "llm_visibility"}
            for child in children:
                if child.type in _SECTION_TYPES:
                    items.append(ThreadResearchSectionItem(
                        type="section",
                        section_type=child.type,
                        job_id=child.id,
                        job_status=child.status,
                        result=child.result,
                    ).model_dump())

            # Brief card (after synthesis)
            brief = brief_by_sprint.get(sprint.id)
            if brief:
                # Only surface share_token after approval
                share_token = brief.share_token if brief.status == "approved" else None
                items.append(ThreadBriefItem(
                    type="brief",
                    brief_id=brief.id,
                    sprint_job_id=sprint.id,
                    job_status=sprint.status,
                    clusters=brief.clusters,
                    executive_summary=brief.executive_summary,
                    share_token=share_token,
                    brief_status=brief.status,
                ).model_dump())

    return items
```

- [ ] **Step 3: Ensure required imports are present at top of workspaces.py**

Make sure `from typing import Any, Literal` and `from app.models import StrategyBrief` are in the imports. Check the current imports block and add what's missing:

```python
from typing import Any, Literal
# ...existing imports...
from app.models import Job, Plan as PlanModel, StrategyBrief, Workspace
```

- [ ] **Step 4: Verify API starts cleanly**

```bash
cd apps/api && uv run python -c "
from app.main import app
paths = [r.path for r in app.routes]
assert '/workspaces/{workspace_id}/thread' in paths
print('thread route ok')
"
```

Expected: `thread route ok`

- [ ] **Step 5: Run full unit test suite**

```bash
cd apps/api && uv run pytest tests/unit/ -q 2>&1 | tail -10
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/routes/workspaces.py
git commit -m "feat(api): thread endpoint — section + brief items replace flat job board"
```

---

## Task 13: Integration tests

**Files:**
- Create: `apps/api/tests/integration/test_research_sprint.py`

- [ ] **Step 1: Ensure docker test profile is running**

```bash
docker compose --profile test up -d
```

Expected: postgres + redis containers running

- [ ] **Step 2: Create integration test file**

```python
# apps/api/tests/integration/test_research_sprint.py
"""Integration tests for the full research sprint → Gate-1 flow.

Requires: docker compose --profile test up -d
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models import Job, Plan as PlanModel, StrategyBrief
from app.workers.tasks import (
    competitor_task,
    content_audit_task,
    finalize_task,
    keyword_task,
    llm_visibility_task,
    synthesis_task,
)


def _fake_plan_obj():
    return MagicMock(
        intent="drive signups",
        domain="whitecarrot.io",
        competitors=["greenhouse.io"],
        timeline_weeks=24,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
    )


@pytest.mark.asyncio
async def test_full_sprint_to_gate1(db_session, sample_workspace):
    """All 4 agents + synthesis → sprint at awaiting_gate1 + brief in DB."""
    # Create orchestrator job + sprint job + plan
    orch_job = Job(
        workspace_id=sample_workspace.id,
        type="orchestrator",
        status="complete",
        input={"goal": "grow signups"},
    )
    db_session.add(orch_job)
    await db_session.flush()

    plan_row = PlanModel(
        job_id=orch_job.id,
        workspace_id=sample_workspace.id,
        intent="drive signups",
        domain=sample_workspace.domain,
        competitors=["greenhouse.io"],
        timeline_weeks=24,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
        plan_status="approved",
    )
    db_session.add(plan_row)
    await db_session.flush()

    sprint = Job(
        workspace_id=sample_workspace.id,
        parent_job_id=orch_job.id,
        type="sprint",
        status="running",
        input={"plan_id": str(plan_row.id)},
    )
    db_session.add(sprint)
    await db_session.flush()
    await db_session.commit()

    sprint_id = str(sprint.id)
    plan_id = str(plan_row.id)

    fake_kw = MagicMock()
    fake_kw.keywords = []
    fake_competitor = MagicMock()
    fake_competitor.competitors = []
    fake_competitor.gap_keywords = []
    fake_competitor.quick_wins = []
    fake_audit = MagicMock()
    fake_audit.pages_found = 0
    fake_audit.ranking_pages = []
    fake_audit.missing_topics = []
    fake_audit.summary = ""
    fake_llm = MagicMock()
    fake_llm.queries_tested = []
    fake_llm.brand_mentioned = False
    fake_llm.mention_count = 0
    fake_llm.competitor_mentions = {}
    fake_llm.sample_response = ""
    fake_llm.note = ""
    fake_synthesis = MagicMock()
    fake_synthesis.clusters = []
    fake_synthesis.executive_summary = []

    with (
        patch("app.workers.tasks.KeywordAgent") as MockKW,
        patch("app.workers.tasks.CompetitorAgent") as MockComp,
        patch("app.workers.tasks.ContentAuditAgent") as MockAudit,
        patch("app.workers.tasks.LLMVisibilityAgent") as MockLLM,
        patch("app.workers.tasks.SynthesisAgent") as MockSynth,
    ):
        MockKW.return_value.run = AsyncMock(return_value=fake_kw)
        MockComp.return_value.run = AsyncMock(return_value=fake_competitor)
        MockAudit.return_value.run = AsyncMock(return_value=fake_audit)
        MockLLM.return_value.run = AsyncMock(return_value=fake_llm)
        MockSynth.return_value.run = AsyncMock(return_value=fake_synthesis)

        r1 = keyword_task(plan_id, sprint_id)
        r2 = competitor_task(plan_id, sprint_id)
        r3 = content_audit_task(plan_id, sprint_id)
        r4 = llm_visibility_task(plan_id, sprint_id)

        assert all(r["ok"] for r in [r1, r2, r3, r4])

        fin = finalize_task([r1, r2, r3, r4], sprint_id)
        assert fin["ok"] is True
        assert fin["status"] == "synthesis_dispatched"

        # finalize fired synthesis — call it directly
        syn = synthesis_task(sprint_id)
        assert syn["ok"] is True
        assert "brief_id" in syn

    await db_session.refresh(sprint)
    assert sprint.status == "awaiting_gate1"

    from sqlalchemy import select
    r = await db_session.execute(
        select(StrategyBrief).where(StrategyBrief.sprint_job_id == sprint.id)
    )
    brief = r.scalar_one()
    assert brief.status == "draft"
    assert brief.share_token is not None


@pytest.mark.asyncio
async def test_gate1_approve_saves_status(db_session, sample_workspace):
    """Approve brief sets status=approved and sprint=complete."""
    from datetime import datetime, timezone
    from httpx import ASGITransport, AsyncClient
    from app.main import app

    # Setup sprint at awaiting_gate1 + brief
    sprint = Job(
        workspace_id=sample_workspace.id,
        type="sprint",
        status="awaiting_gate1",
        input={"plan_id": str(__import__("uuid").uuid4())},
    )
    db_session.add(sprint)
    await db_session.flush()

    # Need a plan for the brief FK
    orch = Job(workspace_id=sample_workspace.id, type="orchestrator", status="complete", input={"goal": "test"})
    db_session.add(orch)
    await db_session.flush()
    plan = PlanModel(
        job_id=orch.id, workspace_id=sample_workspace.id,
        intent="test", domain=sample_workspace.domain,
        competitors=[], timeline_weeks=12, sprint_order=[], plan_status="approved",
    )
    db_session.add(plan)
    await db_session.flush()

    from app.models import StrategyBrief as SB
    brief = SB(
        workspace_id=sample_workspace.id,
        plan_id=plan.id,
        sprint_job_id=sprint.id,
        clusters=[],
        executive_summary=[],
        share_token=str(__import__("uuid").uuid4()),
        status="draft",
    )
    db_session.add(brief)
    await db_session.commit()

    from app.auth.clerk import ClerkPrincipal, current_user
    app.dependency_overrides[current_user] = lambda: ClerkPrincipal(user_id=sample_workspace.user_id)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post(
                f"/briefs/{brief.id}/approve",
                headers={"Authorization": "Bearer fake"},
            )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "approved"
        assert data["share_token"] == brief.share_token

        await db_session.refresh(sprint)
        assert sprint.status == "complete"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_share_endpoint_returns_brief_without_auth(db_session, sample_workspace):
    """GET /share/{token} returns brief without Authorization header."""
    from httpx import ASGITransport, AsyncClient
    from app.main import app

    orch = Job(workspace_id=sample_workspace.id, type="orchestrator", status="complete", input={"goal": "test"})
    db_session.add(orch)
    await db_session.flush()
    plan = PlanModel(
        job_id=orch.id, workspace_id=sample_workspace.id,
        intent="test", domain=sample_workspace.domain,
        competitors=[], timeline_weeks=12, sprint_order=[], plan_status="approved",
    )
    db_session.add(plan)
    sprint = Job(workspace_id=sample_workspace.id, type="sprint", status="complete", input={"plan_id": str(plan.id)})
    db_session.add(sprint)
    await db_session.flush()

    token = "pub-test-token-abc123"
    from app.models import StrategyBrief as SB
    brief = SB(
        workspace_id=sample_workspace.id,
        plan_id=plan.id,
        sprint_job_id=sprint.id,
        clusters=[],
        executive_summary=[],
        share_token=token,
        status="approved",
    )
    db_session.add(brief)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/share/{token}")   # no auth header

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "approved"


@pytest.mark.asyncio
async def test_share_invalid_token_returns_404(db_session):
    from httpx import ASGITransport, AsyncClient
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/share/nonexistent-token-xyz")

    assert res.status_code == 404
```

- [ ] **Step 3: Run integration tests**

```bash
cd apps/api && uv run pytest tests/integration/test_research_sprint.py -v 2>&1 | tail -20
```

Expected: all 4 tests pass

- [ ] **Step 4: Run full test suite**

```bash
cd apps/api && uv run pytest tests/ -q 2>&1 | tail -10
```

Expected: all tests pass (unit + integration)

- [ ] **Step 5: Final TypeScript check**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1
```

Expected: no errors

- [ ] **Step 6: Final commit**

```bash
git add apps/api/tests/integration/test_research_sprint.py
git commit -m "test(api): integration tests — research sprint Gate-1 flow + share endpoint"
```

---

## Self-Review

**Spec coverage check:**
- F1 (4 real agents) → Tasks 5, 6, 7, 9 ✓
- F2 (synthesis_task) → Task 8, 9 ✓
- F3 (progressive reveal via SSE) → Task 12 (thread returns section items ordered by created_at; SSE is existing infrastructure) ✓
- F4 (awaiting_gate1 + ExecutiveSummaryCard) → Tasks 3, 9 ✓
- F5 (Gate-1 actions) → Task 10 (approve + refine) ✓
- F6 (approve saves strategy seed) → Task 10 ✓
- F7 (shareable link) → Task 11 ✓
- F8/F9 (sidebar pages) → Frontend session; not in this plan ✓ (noted as separate session)
- NF2 (synthesis chord contract) → Task 9 (`test_synthesis_task_contract_never_raises`) ✓
- NF3 (LLM via Claude) → Task 7 ✓
- NF4 (DataForSEO on_page → ranked_keywords) → Task 4, 6 ✓
- NF7 (@prism/types first) → Task 1 ✓

**Frontend note:** Tasks 8 (frontend components) and the sidebar pages are implemented in a separate Claude Code session using `apps/web/prototype/prototype.html` as the design reference and `@prism/types` as the type contract. The backend plan is self-contained and deployable independently.
