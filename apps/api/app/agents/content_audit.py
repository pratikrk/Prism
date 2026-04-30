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
