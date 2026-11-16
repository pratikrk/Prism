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
