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
