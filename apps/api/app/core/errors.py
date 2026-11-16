from __future__ import annotations

import asyncio
from enum import StrEnum
from typing import Any

import anthropic
import httpx
import pydantic


class ErrorKind(StrEnum):
    RATE_LIMIT = "rate_limit"
    TIMEOUT = "timeout"
    EXTERNAL_ERROR = "external_error"
    INVALID_OUTPUT = "invalid_output"
    INVALID_INPUT = "invalid_input"
    BUG = "bug"


_RETRYABLE = {
    ErrorKind.RATE_LIMIT,
    ErrorKind.TIMEOUT,
    ErrorKind.EXTERNAL_ERROR,
    ErrorKind.INVALID_OUTPUT,
}


class JobError(pydantic.BaseModel):
    kind: ErrorKind
    message: str
    retryable: bool
    provider: str | None = None
    trace_id: str | None = None

    def to_json(self) -> dict[str, Any]:
        return self.model_dump(mode="json")


def classify(exc: BaseException, *, provider: str | None = None) -> JobError:
    kind = _classify_kind(exc)
    return JobError(
        kind=kind,
        message=str(exc) or type(exc).__name__,
        retryable=kind in _RETRYABLE,
        provider=provider,
    )


def _classify_kind(exc: BaseException) -> ErrorKind:
    if isinstance(exc, anthropic.RateLimitError):
        return ErrorKind.RATE_LIMIT
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status == 429:
            return ErrorKind.RATE_LIMIT
        if 500 <= status < 600:
            return ErrorKind.EXTERNAL_ERROR
        return ErrorKind.EXTERNAL_ERROR
    if isinstance(exc, (httpx.TimeoutException, asyncio.TimeoutError)):
        return ErrorKind.TIMEOUT
    if isinstance(exc, (anthropic.APITimeoutError, anthropic.APIConnectionError)):
        return ErrorKind.TIMEOUT
    if isinstance(exc, pydantic.ValidationError):
        return ErrorKind.INVALID_OUTPUT
    if isinstance(exc, ValueError):
        return ErrorKind.INVALID_INPUT
    return ErrorKind.BUG
