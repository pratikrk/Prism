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
            if inp.traffic_target is not None
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
