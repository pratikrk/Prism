from __future__ import annotations

from typing import ClassVar

import pydantic

from app.agents.base import BaseAgent
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
