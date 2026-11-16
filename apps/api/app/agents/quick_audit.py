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
