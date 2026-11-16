from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import ClassVar, Generic, TypeVar

import anthropic
import pydantic
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.claude_limiter import claude_slot
from app.core.config import settings
from app.skills.loader import load_skill_prompt

TInput = TypeVar("TInput")
TOutput = TypeVar("TOutput", bound=pydantic.BaseModel)

_DEFAULT_MODEL = "claude-sonnet-4-6"
_INVALID_OUTPUT_RETRIES = 1


def _is_rate_limit(exc: BaseException) -> bool:
    return isinstance(exc, anthropic.RateLimitError)


def _rate_limit_wait(retry_state: object) -> float:
    """Use the Retry-After header from Anthropic's 429 if present."""
    exc = getattr(retry_state, "outcome", None)
    exc = exc.exception() if exc else None
    if isinstance(exc, anthropic.RateLimitError):
        headers = getattr(getattr(exc, "response", None), "headers", {}) or {}
        ra = headers.get("retry-after") or headers.get("Retry-After")
        if ra:
            try:
                return float(ra) + 2  # +2s buffer
            except (ValueError, TypeError):
                pass
    # Fallback: exponential backoff starting at 20s
    attempt = getattr(retry_state, "attempt_number", 1)
    return min(20 * (2 ** (attempt - 1)), 90)


class BaseAgent(ABC, Generic[TInput, TOutput]):
    CORE_PROMPT: ClassVar[str] = ""
    BACKING_SKILL: ClassVar[str | None] = None
    RESPONSE_MODEL: ClassVar[type[pydantic.BaseModel]]
    MODEL: ClassVar[str] = _DEFAULT_MODEL
    MAX_TOKENS: ClassVar[int] = 2048

    def __init__(self) -> None:
        self._client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key.get_secret_value(),
            timeout=settings.claude_timeout,
            max_retries=0,  # tenacity handles retries with proper backoff
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

        @retry(
            retry=retry_if_exception_type(anthropic.RateLimitError),
            wait=_rate_limit_wait,
            stop=stop_after_attempt(6),
            reraise=True,
        )
        async def _create():
            return await self._client.messages.create(
                model=self.MODEL,
                max_tokens=self.MAX_TOKENS,
                system=system,
                messages=[{"role": "user", "content": u}],
            )

        async with claude_slot(settings.redis_url, max_concurrent=2):
            resp = await _create()
        raw = "".join(block.text for block in resp.content if getattr(block, "text", None))
        # Strip markdown code fences Claude sometimes adds despite instructions
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1]  # drop ```json line
            text = text.rsplit("```", 1)[0]  # drop closing ```
        text = text.strip()
        try:
            return self.RESPONSE_MODEL.model_validate_json(text)  # type: ignore[return-value]
        except pydantic.ValidationError:
            if _attempt >= _INVALID_OUTPUT_RETRIES:
                raise
            return await self._call_claude(system, user, _attempt + 1, _last_bad=text)
