from __future__ import annotations

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
