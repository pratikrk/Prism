from __future__ import annotations

from pathlib import Path
from typing import ClassVar

import pydantic

from app.agents.base import BaseAgent

_PROMPT_FILE = Path(__file__).parent / "prompts" / "orchestrator.md"


class OrchestratorInput(pydantic.BaseModel):
    goal: str
    domain: str


class Plan(pydantic.BaseModel):
    intent: str
    domain: str
    competitors: list[str]
    timeline_weeks: int = pydantic.Field(gt=0, le=260)
    sprint_order: list[str]

    @pydantic.field_validator("sprint_order")
    @classmethod
    def _validate_order(cls, v: list[str]) -> list[str]:
        expected = {"keyword", "competitor", "content_audit", "llm_visibility"}
        if set(v) != expected:
            raise ValueError("sprint_order must contain exactly the 4 research types")
        return v


class OrchestratorAgent(BaseAgent[OrchestratorInput, Plan]):
    CORE_PROMPT: ClassVar[str] = _PROMPT_FILE.read_text(encoding="utf-8")
    BACKING_SKILL: ClassVar[str | None] = None
    RESPONSE_MODEL = Plan

    def user_prompt(self, inp: OrchestratorInput) -> str:
        return f"Domain: {inp.domain}\nGoal: {inp.goal}"
