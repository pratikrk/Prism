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
    priority_score: float


class KeywordResult(pydantic.BaseModel):
    keywords: list[RankedKeyword]


_CORE_PROMPT = """\
You are the Prism keyword research agent. You receive:
  - a Plan (intent, domain, competitors, timeline)
  - a list of raw keyword rows from DataForSEO (keyword, search_volume, keyword_difficulty)

Return a re-ranked list of at most 30 keywords as JSON matching the schema.

`priority_score` is a float in [0,1] combining relevance to the Plan's intent,
search volume, difficulty (lower is better), and timeline realism.

Output JSON only.
"""


class KeywordAgent(BaseAgent[KeywordInput, KeywordResult]):
    CORE_PROMPT: ClassVar[str] = _CORE_PROMPT
    BACKING_SKILL: ClassVar[str | None] = "seo-dataforseo"
    RESPONSE_MODEL = KeywordResult

    def __init__(self, dataforseo: DataForSEOClient | None = None) -> None:
        super().__init__()
        self._dfs = dataforseo or DataForSEOClient()

    def user_prompt(self, inp: KeywordInput) -> str:
        raise NotImplementedError("user_prompt not used; KeywordAgent overrides run")

    async def run(self, inp: KeywordInput) -> KeywordResult:
        seeds = _derive_seeds(inp.plan)
        rows = await self._dfs.keywords_for_keywords(seeds)
        user = (
            f"Plan:\n{inp.plan.model_dump_json(indent=2)}\n\n"
            f"Raw keywords:\n" + "\n".join(
                f"- {r.keyword} (v={r.search_volume}, kd={r.keyword_difficulty})" for r in rows
            )
        )
        system = self.system_prompt()
        return await self._call_claude(system, user)


def _derive_seeds(plan: Plan) -> list[str]:
    base = [plan.domain.split(".")[0]]
    base.extend(c.split(".")[0] for c in plan.competitors[:3])
    base.append(plan.intent.split()[0] if plan.intent else "")
    return [s for s in {s.lower() for s in base} if s][:4]
