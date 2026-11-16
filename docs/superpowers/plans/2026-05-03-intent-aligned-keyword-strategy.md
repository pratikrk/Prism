# Intent-Aligned Keyword Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the entire research pipeline—keyword selection, synthesis recommendations, content clusters—driven by the user's actual search intent and traffic target, so a user asking for "50k organic visitors/month in 12 weeks" gets a keyword portfolio selected to hit that number using a KD-aware strategy, with every downstream recommendation aligned to that intent.

**Architecture:** Add `traffic_target` (monthly visits) as a structured field on the Plan pydantic model and DB row. The orchestrator extracts it from the user's goal text. The keyword agent receives `traffic_target` + `timeline_weeks`, applies KD thresholds (short ≤8 wks → KD≤30, medium 9–20 wks → KD≤50, long >20 wks → KD≤70), classifies each keyword with ICTN labels (`informational`/`commercial`/`transactional`/`navigational`) + funnel stage (`TOF`/`MOF`/`BOF`), filters branded terms, and selects the portfolio whose cumulative `estimated_monthly_traffic` (volume × CTR-at-realistic-rank) covers the target. The synthesis agent uses the target to report portfolio coverage and aligns phase ordering with intent type.

**Tech Stack:** Python 3.12, Pydantic v2, SQLAlchemy 2.x async, Alembic, Celery, Anthropic SDK (claude-sonnet-4-6)

---

## Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `apps/api/app/agents/prompts/orchestrator.md` | Modify | Add `traffic_target` extraction rule |
| `apps/api/app/agents/orchestrator.py` | Modify | Add `traffic_target: int \| None` to Plan pydantic |
| `apps/api/app/models/plan.py` | Modify | Add `traffic_target` SQLAlchemy column |
| `apps/api/alembic/versions/0005_plan_traffic_target.py` | Create | DB migration |
| `apps/api/app/agents/keyword.py` | Modify | ICTN labels, funnel_stage, estimated_monthly_traffic, new prompt |
| `apps/api/app/agents/synthesis.py` | Modify | traffic_target in SynthesisInput, intent-aligned prompt |
| `apps/api/app/workers/tasks.py` | Modify | Wire traffic_target through Plan reconstruction + SynthesisInput |
| `apps/api/tests/unit/test_keyword_intent.py` | Create | Tests for ICTN, KD strategy, traffic portfolio logic |
| `apps/api/tests/unit/test_synthesis_task.py` | Modify | Add traffic_target to SynthesisInput in existing tests |
| `apps/api/tests/unit/test_task_contract.py` | Modify | Add traffic_target=None to fake_plan mocks |
| `apps/api/app/agents/prompts/orchestrator.md` | Modify | Add feasibility detection rules (Task 7) |
| `apps/api/app/agents/orchestrator.py` | Modify | Add `feasibility_note: str \| None` to Plan pydantic (Task 7) |
| `apps/api/app/models/plan.py` | Modify | Add `feasibility_note` column (Task 7) |
| `apps/api/alembic/versions/0006_plan_feasibility_note.py` | Create | DB migration for feasibility_note (Task 7) |
| `apps/api/app/routes/workspaces.py` | Modify | Expose feasibility_note in _PlanOut (Task 7) |
| `packages/types/src/index.ts` | Modify | Add feasibility_note to Plan type (Task 7) |
| `apps/web/components/plan-card.tsx` | Modify | Show feasibility warning banner (Task 7) |

---

## Task 1: Add `traffic_target` to Plan pydantic + orchestrator prompt

**Files:**
- Modify: `apps/api/app/agents/orchestrator.py`
- Modify: `apps/api/app/agents/prompts/orchestrator.md`

- [ ] **Step 1: Write the failing test**

```python
# In apps/api/tests/unit/test_orchestrator_plan.py (new file)
from app.agents.orchestrator import Plan

def test_plan_accepts_traffic_target():
    p = Plan(
        intent="reach 50k monthly visitors",
        domain="example.com",
        competitors=["comp.com"],
        timeline_weeks=12,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
        traffic_target=50000,
    )
    assert p.traffic_target == 50000

def test_plan_traffic_target_defaults_to_none():
    p = Plan(
        intent="grow organic traffic",
        domain="example.com",
        competitors=[],
        timeline_weeks=12,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
    )
    assert p.traffic_target is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && uv run pytest tests/unit/test_orchestrator_plan.py -v
```
Expected: FAIL — `Plan` has no `traffic_target` field.

- [ ] **Step 3: Add `traffic_target` to Plan pydantic model**

In `apps/api/app/agents/orchestrator.py`, change:

```python
class Plan(pydantic.BaseModel):
    intent: str
    domain: str
    competitors: list[str]
    timeline_weeks: int = pydantic.Field(gt=0, le=260)
    sprint_order: list[str]
    traffic_target: int | None = None  # monthly organic visits goal; null if not stated
```

- [ ] **Step 4: Add `traffic_target` extraction rule to orchestrator prompt**

In `apps/api/app/agents/prompts/orchestrator.md`, add after the `timeline_weeks` bullet:

```markdown
- `traffic_target`: integer monthly organic visits the user wants to reach (e.g. "50k/month" → 50000; "ten thousand monthly visitors" → 10000; "double our traffic" → null). Null if no specific number is stated.
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && uv run pytest tests/unit/test_orchestrator_plan.py -v
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/agents/orchestrator.py apps/api/app/agents/prompts/orchestrator.md apps/api/tests/unit/test_orchestrator_plan.py
git commit -m "feat(agents): add traffic_target to Plan pydantic model and orchestrator prompt"
```

---

## Task 2: Add `traffic_target` to SQLAlchemy Plan model + DB migration

**Files:**
- Modify: `apps/api/app/models/plan.py`
- Create: `apps/api/alembic/versions/0005_plan_traffic_target.py`

- [ ] **Step 1: Add column to SQLAlchemy model**

In `apps/api/app/models/plan.py`, add after `parent_plan_id`:

```python
traffic_target: Mapped[int | None] = mapped_column(Integer, nullable=True)
```

The full models/plan.py should look like:

```python
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
    traffic_target: Mapped[int | None] = mapped_column(Integer, nullable=True)
```

- [ ] **Step 2: Create the Alembic migration**

Create `apps/api/alembic/versions/0005_plan_traffic_target.py`:

```python
"""add traffic_target to plans

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-03
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("plans", sa.Column("traffic_target", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("plans", "traffic_target")
```

- [ ] **Step 3: Run migration against Neon dev DB**

```bash
cd apps/api && uv run alembic upgrade head
```
Expected: `Running upgrade 0004 -> 0005, add traffic_target to plans`

- [ ] **Step 4: Commit**

```bash
git add apps/api/app/models/plan.py apps/api/alembic/versions/0005_plan_traffic_target.py
git commit -m "feat(db): add traffic_target column to plans table"
```

---

## Task 3: Update keyword agent — ICTN labels, KD-by-timeline, traffic portfolio

**Files:**
- Modify: `apps/api/app/agents/keyword.py`
- Create: `apps/api/tests/unit/test_keyword_intent.py`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/tests/unit/test_keyword_intent.py`:

```python
"""Unit tests for KeywordAgent intent alignment, KD thresholds, and traffic portfolio."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.agents.keyword import KeywordAgent, KeywordInput, KeywordResult, RankedKeyword
from app.agents.orchestrator import Plan


def _plan(intent: str, timeline_weeks: int = 12, traffic_target: int | None = None) -> Plan:
    return Plan(
        intent=intent,
        domain="example.com",
        competitors=["comp.com"],
        timeline_weeks=timeline_weeks,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
        traffic_target=traffic_target,
    )


def _result(keywords: list[dict]) -> KeywordResult:
    return KeywordResult(keywords=[RankedKeyword(**k) for k in keywords])


def _base_kw(**overrides) -> dict:
    return {
        "term": "seo tips",
        "volume": 5000,
        "priority_score": 0.8,
        "intent": "informational",
        "funnel_stage": "TOF",
        "estimated_monthly_traffic": 250,
        **overrides,
    }


@pytest.mark.asyncio
async def test_short_timeline_emits_kd30_threshold():
    """≤8 week timeline → 'max KD 30' must appear in the Claude user prompt."""
    agent = KeywordAgent()
    with (
        patch.object(agent, "_dfs") as mock_dfs,
        patch.object(KeywordAgent, "_call_claude", new_callable=AsyncMock) as mock_claude,
    ):
        mock_dfs.keywords_for_keywords = AsyncMock(return_value=[])
        mock_dfs.bulk_keyword_difficulty = AsyncMock(return_value={})
        mock_claude.return_value = _result([_base_kw()])

        await agent.run(KeywordInput(plan=_plan("grow fast", timeline_weeks=6)))

        _, user_arg = mock_claude.call_args[0]
        assert "max KD 30" in user_arg


@pytest.mark.asyncio
async def test_medium_timeline_emits_kd50_threshold():
    """9–20 week timeline → 'max KD 50' must appear in the Claude user prompt."""
    agent = KeywordAgent()
    with (
        patch.object(agent, "_dfs") as mock_dfs,
        patch.object(KeywordAgent, "_call_claude", new_callable=AsyncMock) as mock_claude,
    ):
        mock_dfs.keywords_for_keywords = AsyncMock(return_value=[])
        mock_dfs.bulk_keyword_difficulty = AsyncMock(return_value={})
        mock_claude.return_value = _result([_base_kw()])

        await agent.run(KeywordInput(plan=_plan("build authority", timeline_weeks=12)))

        _, user_arg = mock_claude.call_args[0]
        assert "max KD 50" in user_arg


@pytest.mark.asyncio
async def test_long_timeline_emits_kd70_threshold():
    """>20 week timeline → 'max KD 70' must appear in the Claude user prompt."""
    agent = KeywordAgent()
    with (
        patch.object(agent, "_dfs") as mock_dfs,
        patch.object(KeywordAgent, "_call_claude", new_callable=AsyncMock) as mock_claude,
    ):
        mock_dfs.keywords_for_keywords = AsyncMock(return_value=[])
        mock_dfs.bulk_keyword_difficulty = AsyncMock(return_value={})
        mock_claude.return_value = _result([_base_kw()])

        await agent.run(KeywordInput(plan=_plan("become the authority", timeline_weeks=26)))

        _, user_arg = mock_claude.call_args[0]
        assert "max KD 70" in user_arg


@pytest.mark.asyncio
async def test_traffic_target_appears_in_user_prompt():
    """traffic_target value must be passed in the Claude user prompt."""
    agent = KeywordAgent()
    with (
        patch.object(agent, "_dfs") as mock_dfs,
        patch.object(KeywordAgent, "_call_claude", new_callable=AsyncMock) as mock_claude,
    ):
        mock_dfs.keywords_for_keywords = AsyncMock(return_value=[])
        mock_dfs.bulk_keyword_difficulty = AsyncMock(return_value={})
        mock_claude.return_value = _result([_base_kw()])

        await agent.run(KeywordInput(plan=_plan("get 50k visits", traffic_target=50000)))

        _, user_arg = mock_claude.call_args[0]
        assert "50000" in user_arg


def test_ranked_keyword_accepts_ictn_and_funnel_stage():
    """RankedKeyword must accept all four ICTN values and TOF/MOF/BOF/NAV funnel stages."""
    for ictn, funnel in [
        ("informational", "TOF"),
        ("commercial", "MOF"),
        ("transactional", "BOF"),
        ("navigational", "NAV"),
    ]:
        kw = RankedKeyword(
            term="test keyword",
            volume=1000,
            priority_score=0.5,
            intent=ictn,
            funnel_stage=funnel,
            estimated_monthly_traffic=50,
        )
        assert kw.intent == ictn
        assert kw.funnel_stage == funnel
        assert kw.estimated_monthly_traffic == 50
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && uv run pytest tests/unit/test_keyword_intent.py -v
```
Expected: FAIL — `RankedKeyword` has no `funnel_stage` or `estimated_monthly_traffic`.

- [ ] **Step 3: Update `RankedKeyword` and `_CORE_PROMPT` in keyword.py**

Replace the full `apps/api/app/agents/keyword.py` with:

```python
from __future__ import annotations

from typing import ClassVar

import pydantic

from app.agents.base import BaseAgent
from app.agents.orchestrator import Plan
from app.integrations.dataforseo import DataForSEOClient


class KeywordInput(pydantic.BaseModel):
    plan: Plan


class RankedKeyword(pydantic.BaseModel):
    term: str
    volume: int | None = None
    difficulty: int | None = None
    cpc: float | None = None
    intent: str | None = None        # 'informational' | 'commercial' | 'transactional' | 'navigational'
    funnel_stage: str | None = None  # 'TOF' | 'MOF' | 'BOF' | 'NAV'
    trend: list[int] | None = None   # last 12 months of search volume, oldest first
    top_competitor: str | None = None
    priority_score: float
    estimated_monthly_traffic: int | None = None  # volume × CTR at achievable rank


class KeywordResult(pydantic.BaseModel):
    keywords: list[RankedKeyword]


_CORE_PROMPT = """\
You are the Prism keyword research agent. You receive:
  - a Plan (intent, domain, competitors, timeline_weeks, traffic_target)
  - raw keyword rows from DataForSEO with volume, cpc, kd, and competition data
  - KD strategy context (max KD threshold for this timeline)
  - a traffic target context (monthly visits goal or none)

## Step 1 — Determine intent alignment
Read the Plan `intent` string to identify the dominant objective:
- "traffic", "visits", "organic", "readers", "audience", "blog", "content" → dominant = INFORMATIONAL
- "signups", "conversions", "leads", "sales", "buy", "pricing", "trial", "demo" → dominant = TRANSACTIONAL + COMMERCIAL
- "brand", "recognition", "awareness", "[brand name] queries" → include NAVIGATIONAL
- Default if unclear: mix of INFORMATIONAL + COMMERCIAL, exclude NAVIGATIONAL

## Step 2 — Classify each keyword
Assign:
- `intent`: exactly one of "informational" | "commercial" | "transactional" | "navigational"
  - informational: how-to, what-is, guide, tutorial, list, ideas, tips, examples, definition
  - commercial: best, vs, review, compare, top, alternative, tool, software, platform
  - transactional: buy, pricing, download, signup, free trial, get started, hire, book, order
  - navigational: queries containing the domain's brand name or a competitor brand name verbatim
- `funnel_stage`: derived automatically from intent
  - informational → "TOF"
  - commercial → "MOF"
  - transactional → "BOF"
  - navigational → "NAV"

## Step 3 — Apply KD threshold and filter
The user prompt tells you the max KD for this timeline. Exclude keywords above that threshold
unless fewer than 5 qualifying keywords exist (in that case include the lowest-KD available).

Deprioritise (set priority_score < 0.3) for:
- Navigational keywords (containing brand names) unless dominant intent is NAVIGATIONAL
- Keywords clearly outside the dominant intent type

## Step 4 — Estimate monthly traffic contribution
For each keyword, compute `estimated_monthly_traffic`:
- kd ≤ 30: assume rank 3–5 → CTR = 10% → round(volume × 0.10)
- kd 31–50: assume rank 5–8 → CTR = 5% → round(volume × 0.05)
- kd 51–70: assume rank 8–15 → CTR = 2% → round(volume × 0.02)
- kd null or > 70: CTR = 1% → round(volume × 0.01)
If volume is null, set estimated_monthly_traffic = null.

## Step 5 — Build the keyword portfolio
If traffic_target is provided (shown in user prompt):
  - Sort qualifying keywords by estimated_monthly_traffic descending
  - Greedily select keywords until cumulative estimated_monthly_traffic ≥ traffic_target
  - Minimum 8 keywords, maximum 20
  - Diversify: include at least 2 different intent types where available
If no traffic_target: return top 20 by priority_score.

## Step 6 — Assign priority_score
priority_score ∈ [0, 1]:
  weight = (intent_alignment_match × 0.4) + (estimated_monthly_traffic / max_traffic_in_set × 0.4) + ((1 - min(kd, 100) / 100) × 0.2)
  where intent_alignment_match = 1.0 if keyword matches dominant intent, 0.5 if secondary, 0.1 if deprioritised.

For each keyword also provide:
- `term`: the keyword string
- `volume`: monthly search volume
- `difficulty`: KD integer (from kd data; null if unavailable)
- `cpc`: cost-per-click USD
- `trend`: array of 12 monthly volumes, oldest first (copy from raw data)
- `top_competitor`: single most relevant competitor domain from Plan that ranks for this keyword (null if none)

Output JSON only — no prose.
"""


class KeywordAgent(BaseAgent[KeywordInput, KeywordResult]):
    CORE_PROMPT: ClassVar[str] = _CORE_PROMPT
    BACKING_SKILL: ClassVar[str | None] = "seo-dataforseo"
    RESPONSE_MODEL = KeywordResult
    MAX_TOKENS: ClassVar[int] = 4000

    def __init__(self, dataforseo: DataForSEOClient | None = None) -> None:
        super().__init__()
        self._dfs = dataforseo or DataForSEOClient()

    def user_prompt(self, inp: KeywordInput) -> str:
        raise NotImplementedError("user_prompt not used; KeywordAgent overrides run")

    async def run(self, inp: KeywordInput) -> KeywordResult:
        seeds = _derive_seeds(inp.plan)
        rows = await self._dfs.keywords_for_keywords(seeds)
        terms = [r.keyword for r in rows]

        kd_map: dict[str, int] = {}
        try:
            kd_map = await self._dfs.bulk_keyword_difficulty(terms)
        except Exception:
            pass

        tw = inp.plan.timeline_weeks
        if tw <= 8:
            kd_label = "max KD 30 (short timeline — low-difficulty quick wins only)"
        elif tw <= 20:
            kd_label = "max KD 50 (medium timeline)"
        else:
            kd_label = "max KD 70 (long timeline — can target competitive keywords)"

        traffic_ctx = (
            f"traffic_target={inp.plan.traffic_target} monthly organic visits — select a keyword portfolio "
            "whose cumulative estimated_monthly_traffic covers this target"
            if inp.plan.traffic_target
            else "no specific traffic target — return top 20 by priority_score"
        )

        user = (
            f"Plan:\n{inp.plan.model_dump_json(indent=2)}\n\n"
            f"KD strategy: timeline={tw} weeks → {kd_label}\n"
            f"Traffic context: {traffic_ctx}\n\n"
            f"Raw keywords ({len(rows)} rows):\n"
            + "\n".join(
                f"- {r.keyword} | vol={r.search_volume}"
                + (f" | kd={kd_map.get(r.keyword)}" if kd_map.get(r.keyword) is not None else " | kd=null")
                + (f" | cpc=${r.cpc:.2f}" if r.cpc is not None else "")
                + (f" | comp_idx={r.competition_index}" if r.competition_index is not None else "")
                + (f" | trend={r.trend_volumes()}" if r.monthly_searches else "")
                for r in rows
            )
        )
        system = self.system_prompt()
        result = await self._call_claude(system, user)
        for kw in result.keywords:
            if kw.difficulty is None and kw.term in kd_map:
                kw.difficulty = kd_map[kw.term]
        return result


def _derive_seeds(plan: Plan) -> list[str]:
    base = [plan.domain.split(".")[0]]
    base.extend(c.split(".")[0] for c in plan.competitors[:3])
    base.append(plan.intent.split()[0] if plan.intent else "")
    return [s for s in {s.lower() for s in base} if s][:4]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && uv run pytest tests/unit/test_keyword_intent.py -v
```
Expected: All 5 tests PASS.

- [ ] **Step 5: Run the full unit test suite to check for regressions**

```bash
cd apps/api && uv run pytest tests/unit/ -v
```
Expected: All pass. If `test_task_contract.py` or `test_synthesis_task.py` fail, proceed to Task 5 first.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/agents/keyword.py apps/api/tests/unit/test_keyword_intent.py
git commit -m "feat(agents): keyword agent — ICTN labels, KD-by-timeline, traffic portfolio selection"
```

---

## Task 4: Update synthesis agent — traffic_target + intent-aligned phases

**Files:**
- Modify: `apps/api/app/agents/synthesis.py`

- [ ] **Step 1: Write the failing test**

Add to `apps/api/tests/unit/test_synthesis_task.py` (add this test after the existing ones):

```python
@pytest.mark.asyncio
async def test_synthesis_input_accepts_traffic_target():
    """SynthesisInput must accept traffic_target and pass it into the user prompt."""
    with patch.object(SynthesisAgent, "_call_claude", new_callable=AsyncMock) as mock_claude:
        from app.agents.synthesis import SynthesisResult, ContentCluster, Recommendation
        mock_claude.return_value = SynthesisResult(
            clusters=[ContentCluster(name="c", hub_page="h", spoke_pages=[], target_keywords=[], priority=1)],
            executive_summary=[Recommendation(title="t", rationale="r", estimated_impact="500/mo", priority=1)],
        )

        agent = SynthesisAgent()
        await agent.run(
            SynthesisInput(
                plan_id="plan-1",
                domain="example.com",
                intent="get 50k organic visitors",
                traffic_target=50000,
                keyword_result={"keywords": []},
                competitor_result={"competitors": [], "gap_keywords": [], "quick_wins": []},
                content_audit_result={"pages_found": 0, "ranking_pages": [], "missing_topics": [], "summary": ""},
                llm_visibility_result={"queries_tested": [], "brand_mentioned": False, "mention_count": 0, "competitor_mentions": {}},
            )
        )

        _, user_arg = mock_claude.call_args[0]
        assert "50000" in user_arg
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/api && uv run pytest tests/unit/test_synthesis_task.py::test_synthesis_input_accepts_traffic_target -v
```
Expected: FAIL — `SynthesisInput` has no `traffic_target` field.

- [ ] **Step 3: Update `synthesis.py`**

Replace `apps/api/app/agents/synthesis.py` with:

```python
from __future__ import annotations

import json
from typing import ClassVar

import pydantic

from app.agents.base import BaseAgent


class SynthesisInput(pydantic.BaseModel):
    plan_id: str
    domain: str
    intent: str
    traffic_target: int | None = None  # monthly organic visits goal; null if not stated
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
    phase: str | None = None        # 'bofu' | 'mofu' | 'tofu'
    action_type: str | None = None  # 'Create' | 'Fix' | 'Publish' | 'Monitor'


class SynthesisResult(pydantic.BaseModel):
    clusters: list[ContentCluster]
    executive_summary: list[Recommendation]


_CORE_PROMPT = """\
You are the Prism strategy synthesis agent. You receive the complete research output
from 4 specialist agents:
  - Keyword Intelligence: ranked keywords with volume, difficulty, estimated_monthly_traffic,
    intent (informational/commercial/transactional/navigational), funnel_stage (TOF/MOF/BOF/NAV)
  - Competitor Gap: gap keywords, quick wins vs competitors
  - Content Audit: existing pages, ranking status, missing topic areas
  - LLM Visibility: brand mention status in AI-generated answers

You also receive `intent` (the user's stated traffic objective) and `traffic_target` (monthly
visits goal; may be null).

## Phase naming — use these exact values for the `phase` field
- "tofu" — Top of Funnel: informational/awareness content
- "mofu" — Middle of Funnel: commercial/comparison content
- "bofu" — Bottom of Funnel: transactional/conversion content

## Intent-driven phase priority
Derive the dominant intent from the `intent` field:
- Mentions "traffic", "visits", "readers", "organic", "blog": lead recommendations with "tofu".
  Include "mofu"/"bofu" only where there are clear quick wins.
- Mentions "signups", "conversions", "leads", "sales", "trial", "demo": lead with "bofu" and "mofu".
  Include "tofu" only if it clearly feeds the conversion funnel.
- Unclear or mixed: balanced spread across all three phases.

Cluster `target_keywords` should also reflect this: prefer keywords matching the dominant intent type.

## Traffic target coverage (include only if traffic_target is provided)
If `traffic_target` is provided:
1. Sum `estimated_monthly_traffic` across all keywords in the keyword_result that have this field.
2. Add one recommendation to `executive_summary`:
   - title: "Traffic coverage: {sum}k/{traffic_target_k} monthly visits"
   - rationale: "The selected keyword portfolio can deliver an estimated {sum} monthly visits against
     a target of {traffic_target}. Gap of {gap} visits should be closed by: [recommend: more
     informational content targeting low-KD keywords / broader competitor gap terms / etc.]"
   - estimated_impact: "{gap} additional monthly visits to reach target"
   - priority: assign appropriately based on gap size (large gap → priority 1 or 2)
   - phase: the phase that closes the gap (usually "tofu" for traffic gaps)
   - action_type: "Create"

Produce:
1. `clusters`: 3–6 topic clusters. Each cluster has a hub page concept, 3–5 spoke pages,
   top 3 target keywords (aligned with dominant intent), and a priority rank (1 = highest).

2. `executive_summary`: 3–5 prioritised action recommendations (plus the traffic coverage rec if applicable).
   Each has:
   - `title`: short action title
   - `rationale`: why this is the highest-leverage action (cross-reference all 4 inputs)
   - `estimated_impact`: quantified if possible (e.g. "500–1,500 visits/month by month 6")
   - `priority`: rank (1 = highest)
   - `phase`: "bofu" | "mofu" | "tofu" — ordered by intent-driven priority above
   - `action_type`: "Create" | "Publish" | "Fix" | "Monitor"

Return JSON only matching the schema. No prose outside the JSON.
"""


class SynthesisAgent(BaseAgent[SynthesisInput, SynthesisResult]):
    CORE_PROMPT: ClassVar[str] = _CORE_PROMPT
    BACKING_SKILL: ClassVar[str | None] = None
    RESPONSE_MODEL = SynthesisResult
    MAX_TOKENS: ClassVar[int] = 2500

    def user_prompt(self, inp: SynthesisInput) -> str:
        traffic_line = (
            f"traffic_target={inp.traffic_target} monthly organic visits\n"
            if inp.traffic_target
            else "traffic_target=not specified\n"
        )
        return (
            f"Domain: {inp.domain}\n"
            f"Intent: {inp.intent}\n"
            f"{traffic_line}\n"
            f"=== KEYWORD INTELLIGENCE ===\n{json.dumps(inp.keyword_result, indent=2)}\n\n"
            f"=== COMPETITOR GAP ===\n{json.dumps(inp.competitor_result, indent=2)}\n\n"
            f"=== CONTENT AUDIT ===\n{json.dumps(inp.content_audit_result, indent=2)}\n\n"
            f"=== LLM VISIBILITY ===\n{json.dumps(inp.llm_visibility_result, indent=2)}\n\n"
            "Synthesise the above into clusters and executive_summary."
        )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && uv run pytest tests/unit/test_synthesis_task.py -v
```
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/agents/synthesis.py apps/api/tests/unit/test_synthesis_task.py
git commit -m "feat(agents): synthesis — traffic_target coverage report, intent-aligned phase ordering"
```

---

## Task 5: Wire `traffic_target` through tasks.py

**Files:**
- Modify: `apps/api/app/workers/tasks.py`

- [ ] **Step 1: Write the failing test**

Add to `apps/api/tests/unit/test_task_contract.py`:

```python
@pytest.mark.asyncio
async def test_child_body_passes_traffic_target_to_plan():
    """Plan reconstructed in _child_body must include traffic_target from the DB row."""
    fake_plan = MagicMock(
        intent="reach 50k visits",
        domain="example.com",
        competitors=[],
        timeline_weeks=12,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
        traffic_target=50000,
    )
    ctx, _ = _mock_session_ctx(fake_plan)

    captured_plan = []

    async def capturing_runner(plan):
        captured_plan.append(plan)
        return {"keywords": []}

    sprint_id = str(uuid.uuid4())
    plan_id = str(uuid.uuid4())

    with (
        patch("app.workers.tasks.SessionLocal", ctx),
        patch("app.workers.tasks._workspace_id_of_sprint", AsyncMock(return_value=uuid.uuid4())),
        patch("app.workers.tasks.transition", AsyncMock()),
    ):
        body = t._child_body("keyword", capturing_runner)
        await body(plan_id, sprint_id)

    assert captured_plan[0].traffic_target == 50000
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/api && uv run pytest tests/unit/test_task_contract.py::test_child_body_passes_traffic_target_to_plan -v
```
Expected: FAIL — `Plan(...)` in `_child_body` doesn't pass `traffic_target`.

- [ ] **Step 3: Update `_child_body` Plan reconstruction in tasks.py**

In `apps/api/app/workers/tasks.py`, in the `_child_body` function, find the Plan(...) construction (around line 133) and add `traffic_target`:

```python
plan = Plan(
    intent=plan_row.intent,
    domain=plan_row.domain,
    competitors=list(plan_row.competitors),
    timeline_weeks=plan_row.timeline_weeks,
    sprint_order=list(plan_row.sprint_order),
    traffic_target=plan_row.traffic_target,
)
```

- [ ] **Step 4: Update `orchestrator_task` PlanModel construction to save traffic_target**

In `orchestrator_task` (around line 77), add `traffic_target=plan.traffic_target` to the `PlanModel(...)` constructor:

```python
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
    traffic_target=plan.traffic_target,
)
```

- [ ] **Step 5: Update `synthesis_task` SynthesisInput to include traffic_target**

In `synthesis_task` (around line 266), add `traffic_target=plan_row.traffic_target` to the `SynthesisInput(...)` constructor:

```python
result = await SynthesisAgent().run(
    SynthesisInput(
        plan_id=plan_id_str,
        domain=plan_row.domain,
        intent=plan_row.intent,
        traffic_target=plan_row.traffic_target,
        keyword_result=_trim_for_synthesis(child_results.get("keyword", {})),
        competitor_result=child_results.get("competitor", {}),
        content_audit_result=child_results.get("content_audit", {}),
        llm_visibility_result=_trim_llm_for_synthesis(child_results.get("llm_visibility", {})),
    )
)
```

- [ ] **Step 6: Update fake_plan mocks in test_task_contract.py to include traffic_target**

In `apps/api/tests/unit/test_task_contract.py`, all existing `MagicMock(intent=..., ...)` fake_plan instances need `traffic_target=None`:

```python
fake_plan = MagicMock(
    intent="x", domain="x.test", competitors=[], timeline_weeks=12,
    sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
    traffic_target=None,
)
```
Apply this to every `fake_plan = MagicMock(...)` in the file.

- [ ] **Step 7: Run the full unit test suite**

```bash
cd apps/api && uv run pytest tests/unit/ -v
```
Expected: All pass.

- [ ] **Step 8: Commit**

```bash
git add apps/api/app/workers/tasks.py apps/api/tests/unit/test_task_contract.py
git commit -m "feat(tasks): wire traffic_target through Plan reconstruction, orchestrator save, and synthesis"
```

---

## Task 6: Integration smoke test + full test run

**Files:** No new files — run existing integration tests.

- [ ] **Step 1: Start test infrastructure**

```bash
docker compose --profile test up -d
```
Expected: postgres (test profile) + redis containers running.

- [ ] **Step 2: Run migrations against test DB**

```bash
cd apps/api && TEST_DATABASE_URL=$(grep TEST_DATABASE_URL .env | cut -d= -f2-) uv run alembic upgrade head
```
Expected: migration 0005 applied.

- [ ] **Step 3: Run full test suite**

```bash
cd apps/api && uv run pytest -v
```
Expected: All unit + integration tests pass. Pay attention to:
- `tests/integration/test_pipeline_happy.py`
- `tests/integration/test_pipeline_child_raises.py`
- `tests/integration/test_pipeline_child_returns_failure.py`
- `tests/unit/test_keyword_intent.py`
- `tests/unit/test_synthesis_task.py`
- `tests/unit/test_task_contract.py`
- `tests/unit/test_orchestrator_plan.py`

- [ ] **Step 4: Final commit if any fixups needed**

```bash
git add -p
git commit -m "fix: address integration test failures from traffic_target wiring"
```

---

## Task 7: Goal feasibility detection + user warning in PlanCard

SEO is a 3-month+ process. If a user states "30k visits in 1 week", the orchestrator detects this and surfaces a clear, empathetic warning in the Gate 0 confirm card before the sprint runs.

**Files:**
- Modify: `apps/api/app/agents/prompts/orchestrator.md`
- Modify: `apps/api/app/agents/orchestrator.py`
- Modify: `apps/api/app/models/plan.py`
- Create: `apps/api/alembic/versions/0006_plan_feasibility_note.py`
- Modify: `apps/api/app/workers/tasks.py` (orchestrator_task saves feasibility_note)
- Modify: `apps/api/app/routes/workspaces.py` (_PlanOut exposes feasibility_note)
- Modify: `packages/types/src/index.ts` (Plan type)
- Modify: `apps/web/components/plan-card.tsx` (warning banner)

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/unit/test_feasibility.py`:

```python
"""Unit tests for orchestrator goal feasibility detection."""
from __future__ import annotations

from app.agents.orchestrator import Plan


def test_plan_accepts_feasibility_note():
    p = Plan(
        intent="get 30k visits in 1 week",
        domain="example.com",
        competitors=[],
        timeline_weeks=1,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
        traffic_target=30000,
        feasibility_note="Organic SEO takes at least 12 weeks to show measurable results. "
                         "We'll plan a foundation sprint now; 30k monthly visits is realistic by week 20.",
    )
    assert p.feasibility_note is not None
    assert "12 weeks" in p.feasibility_note


def test_plan_feasibility_note_defaults_to_none():
    p = Plan(
        intent="grow organic traffic over 6 months",
        domain="example.com",
        competitors=[],
        timeline_weeks=24,
        sprint_order=["keyword", "competitor", "content_audit", "llm_visibility"],
    )
    assert p.feasibility_note is None
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/api && uv run pytest tests/unit/test_feasibility.py -v
```
Expected: FAIL — `Plan` has no `feasibility_note` field.

- [ ] **Step 3: Add `feasibility_note` to Plan pydantic**

In `apps/api/app/agents/orchestrator.py`, add to the `Plan` model (after `traffic_target`):

```python
class Plan(pydantic.BaseModel):
    intent: str
    domain: str
    competitors: list[str]
    timeline_weeks: int = pydantic.Field(gt=0, le=260)
    sprint_order: list[str]
    traffic_target: int | None = None
    feasibility_note: str | None = None  # set when goal timeline is unrealistic for SEO
```

- [ ] **Step 4: Add feasibility rules to orchestrator prompt**

In `apps/api/app/agents/prompts/orchestrator.md`, add after the `traffic_target` bullet:

```markdown
- `feasibility_note`: if the stated goal contains an unrealistic SEO expectation, set this to a
  short empathetic 1–2 sentence note (plain text, no markdown). Otherwise null.
  Apply these rules:
  - SEO takes a minimum of 12 weeks to show measurable organic traffic growth. If timeline_weeks < 12
    AND traffic_target > 1000: set note, e.g. "Organic SEO takes at least 3 months to show results.
    We'll plan a foundation sprint now so you can reach [traffic_target] monthly visits by week 16–20."
  - If traffic_target > timeline_weeks × 500 (e.g. 30 000 target in 8 weeks → 30000 > 4000):
    the target exceeds what SEO can deliver in that window. Set note, e.g. "Reaching [traffic_target]
    monthly visits in [timeline_weeks] weeks is beyond what organic SEO alone can achieve. We'll plan
    for [timeline_weeks × 300] visits by then and build toward the full target over 6 months."
  - If the goal is realistic (timeline ≥ 12 weeks and traffic_target ≤ timeline_weeks × 500): null.
  - If no traffic_target: only flag if timeline_weeks < 4 (impossibly short for any SEO work): null otherwise.
```

- [ ] **Step 5: Run feasibility unit tests**

```bash
cd apps/api && uv run pytest tests/unit/test_feasibility.py -v
```
Expected: PASS.

- [ ] **Step 6: Add `feasibility_note` to SQLAlchemy Plan model**

In `apps/api/app/models/plan.py`, add after `traffic_target`:

```python
feasibility_note: Mapped[str | None] = mapped_column(Text, nullable=True)
```

- [ ] **Step 7: Create the Alembic migration**

Create `apps/api/alembic/versions/0006_plan_feasibility_note.py`:

```python
"""add feasibility_note to plans

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-03
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("plans", sa.Column("feasibility_note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("plans", "feasibility_note")
```

- [ ] **Step 8: Run migration against Neon dev DB**

```bash
cd apps/api && uv run alembic upgrade head
```
Expected: `Running upgrade 0005 -> 0006, add feasibility_note to plans`

- [ ] **Step 9: Save feasibility_note in orchestrator_task**

In `apps/api/app/workers/tasks.py`, in the `orchestrator_task` `PlanModel(...)` constructor, add:

```python
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
    traffic_target=plan.traffic_target,
    feasibility_note=plan.feasibility_note,
)
```

- [ ] **Step 10: Expose feasibility_note in `_PlanOut`**

In `apps/api/app/routes/workspaces.py`, add `feasibility_note` to `_PlanOut`:

```python
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
    traffic_target: int | None = None
    feasibility_note: str | None = None
    model_config = pydantic.ConfigDict(from_attributes=True)
```

- [ ] **Step 11: Add `feasibility_note` and `traffic_target` to shared Plan type**

In `packages/types/src/index.ts`, update the `Plan` interface:

```typescript
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
  traffic_target: number | null;
  feasibility_note: string | null;
}
```

Also update `KeywordRow` to match the new ICTN vocabulary (from Task 3):

```typescript
export interface KeywordRow {
  term: string;
  volume: number | null;
  difficulty: number | null;
  priority_score: number;
  cpc?: number;
  intent?: 'informational' | 'commercial' | 'transactional' | 'navigational';
  funnel_stage?: 'TOF' | 'MOF' | 'BOF' | 'NAV';
  trend?: number[];
  top_competitor?: string;
  estimated_monthly_traffic?: number;
}
```

- [ ] **Step 12: Add feasibility warning banner to PlanCard**

In `apps/web/components/plan-card.tsx`, find the area just before the approve/refine buttons (look for the `canApprove` section or the approve button JSX) and insert the warning banner. Add it as the first child inside the card content area, so it's always visible when present:

```tsx
{plan.feasibility_note && (
  <div style={{
    background: 'var(--warn-dim, #fff8e6)',
    border: '1px solid var(--warn, #d97706)',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 12,
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
  }}>
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1, color: 'var(--warn, #d97706)' }}>
      <path d="M8 1L1 14h14L8 1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M8 6v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="8" cy="12" r="0.6" fill="currentColor"/>
    </svg>
    <span style={{ fontSize: 12, color: 'var(--warn, #d97706)', lineHeight: 1.5 }}>
      <strong>SEO timeline note: </strong>{plan.feasibility_note}
    </span>
  </div>
)}
```

To find where to insert: read `apps/web/components/plan-card.tsx` fully, then place this block inside the returned JSX just before the footer area with the Approve / Refine buttons. The exact parent container depends on the card layout — insert it as the last item in the content section, before the action buttons row.

- [ ] **Step 13: Add CSS variables for warn colours (if not present)**

Check `apps/web/app/globals.css` for `--warn` and `--warn-dim`. If missing, add to both `:root` and `.dark`:

```css
/* in :root */
--warn: #d97706;
--warn-dim: #fff8e6;

/* in .dark */
--warn: #fbbf24;
--warn-dim: #1c1408;
```

- [ ] **Step 14: Run frontend tests**

```bash
pnpm --filter @prism/web test
```
Expected: All pass. The `confirm-card.test.tsx` should not be affected (ConfirmCard has no props).

- [ ] **Step 15: Commit**

```bash
git add \
  apps/api/app/agents/orchestrator.py \
  apps/api/app/agents/prompts/orchestrator.md \
  apps/api/app/models/plan.py \
  apps/api/alembic/versions/0006_plan_feasibility_note.py \
  apps/api/app/workers/tasks.py \
  apps/api/app/routes/workspaces.py \
  packages/types/src/index.ts \
  apps/web/components/plan-card.tsx \
  apps/api/tests/unit/test_feasibility.py
git commit -m "feat: goal feasibility detection — warn users when SEO timeline is unrealistic"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|-------------|------|
| ICTN labels (informational/commercial/transactional/navigational) | Task 3 — `RankedKeyword.intent` |
| Keep TOF/MOF/BOF alongside ICTN | Task 3 — `RankedKeyword.funnel_stage` |
| Filter/deprioritise branded keywords | Task 3 — keyword prompt Step 3 |
| Strategy adapts to intent from goal | Task 3 — prompt Step 1+3; Task 4 — synthesis prompt |
| Traffic target drives keyword selection | Task 3 — prompt Step 5 + `traffic_target` in user prompt |
| KD thresholds by timeline | Task 3 — prompt Step 3, `kd_label` in run() |
| `estimated_monthly_traffic` per keyword | Task 3 — model field + prompt Step 4 |
| Traffic gap reported in synthesis | Task 4 — synthesis prompt "Traffic target coverage" |
| `traffic_target` persisted to DB | Task 2 — migration; Task 5 — orchestrator_task saves it |
| `traffic_target` flows to all child tasks | Task 5 — `_child_body` Plan reconstruction |
| Synthesis receives `traffic_target` | Task 5 — `synthesis_task` SynthesisInput |
| Unrealistic goals detected + flagged | Task 7 — orchestrator prompt feasibility rules |
| `feasibility_note` persisted to DB | Task 7 — migration 0006, orchestrator_task |
| Warning shown to user before approval | Task 7 — PlanCard warning banner |
| Shared types updated | Task 7 — `packages/types/src/index.ts` |
| All tests updated | Tasks 3, 4, 5, 6, 7 |

**Placeholder scan:** No TBD/TODO/similar patterns in this plan. All code is complete.

**Type consistency:** `traffic_target: int | None` and `feasibility_note: str | None` used consistently across Plan pydantic (orchestrator.py), Plan SQLAlchemy (models/plan.py), _PlanOut (workspaces.py), Plan TypeScript type (index.ts), and tasks.py save/reconstruction.
