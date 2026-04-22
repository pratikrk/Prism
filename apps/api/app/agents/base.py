from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import ClassVar, Generic, TypeVar

import anthropic
import pydantic

from app.core.config import settings
from app.skills.loader import load_skill_prompt

TInput = TypeVar("TInput")
TOutput = TypeVar("TOutput", bound=pydantic.BaseModel)

_DEFAULT_MODEL = "claude-sonnet-4-6"
_INVALID_OUTPUT_RETRIES = 1


class BaseAgent(ABC, Generic[TInput, TOutput]):
    CORE_PROMPT: ClassVar[str] = ""
    BACKING_SKILL: ClassVar[str | None] = None
    RESPONSE_MODEL: ClassVar[type[pydantic.BaseModel]]
    MODEL: ClassVar[str] = _DEFAULT_MODEL

    def __init__(self) -> None:
        self._client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key.get_secret_value(),
            timeout=settings.claude_timeout,
            max_retries=3,
        )

    @abstractmethod
    def user_prompt(self, inp: TInput) -> str: ...

    def system_prompt(self) -> str:
        parts = [self.CORE_PROMPT.strip()]
        if self.BACKING_SKILL:
            parts.append("\n---\n\n" + load_skill_prompt(self.BACKING_SKILL))
        parts.append(
            "\n\n---\n\n"
            f"Respond with JSON matching this pydantic schema exactly:\n"
            f"{json.dumps(self.RESPONSE_MODEL.model_json_schema(), indent=2)}\n"
            "Output ONLY the JSON object, no prose or code fences."
        )
        return "".join(parts)

    async def run(self, inp: TInput) -> TOutput:
        user = self.user_prompt(inp)
        system = self.system_prompt()
        return await self._call_claude(system, user)

    async def _call_claude(
        self, system: str, user: str, _attempt: int = 0, _last_bad: str | None = None
    ) -> TOutput:
        u = user if _last_bad is None else (
            f"{user}\n\n---\nPrior attempt failed schema validation:\n{_last_bad}\n"
            "Return valid JSON matching the schema, ONLY the JSON object."
        )
        resp = await self._client.messages.create(
            model=self.MODEL,
            max_tokens=2048,
            system=system,
            messages=[{"role": "user", "content": u}],
        )
        text = "".join(block.text for block in resp.content if getattr(block, "text", None))
        try:
            return self.RESPONSE_MODEL.model_validate_json(text)  # type: ignore[return-value]
        except pydantic.ValidationError:
            if _attempt >= _INVALID_OUTPUT_RETRIES:
                raise
            return await self._call_claude(system, user, _attempt + 1, _last_bad=text)
