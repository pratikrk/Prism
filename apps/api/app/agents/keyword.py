from __future__ import annotations

from typing import ClassVar, Literal

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
    intent: Literal["informational", "commercial", "transactional", "navigational"] | None = None
    funnel_stage: Literal["TOF", "MOF", "BOF", "NAV"] | None = None
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

## Step 5 — Assign priority_score
priority_score ∈ [0, 1]:
  weight = (intent_alignment_match × 0.4) + (estimated_monthly_traffic / max_traffic_in_set × 0.4) + ((1 - min(difficulty, 100) / 100) × 0.2)
  where intent_alignment_match = 1.0 if keyword matches dominant intent, 0.5 if secondary, 0.1 if deprioritised.

## Step 6 — Build the keyword portfolio
If traffic_target is provided (shown in user prompt):
  - Sort qualifying keywords by estimated_monthly_traffic descending
  - Greedily select keywords until cumulative estimated_monthly_traffic ≥ traffic_target
  - Minimum 8 keywords, maximum 20
  - Diversify: include at least 2 different intent types where available
If no traffic_target: return top 20 by priority_score.

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
            if inp.plan.traffic_target is not None
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
