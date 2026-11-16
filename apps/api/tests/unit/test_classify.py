# apps/api/tests/unit/test_classify.py
import asyncio

import anthropic
import httpx
import pydantic
import pytest

from app.core.errors import ErrorKind, classify

_REQ = httpx.Request("GET", "https://api.anthropic.com/v1/messages")


@pytest.mark.parametrize(
    "exc,expected_kind,expected_retryable",
    [
        (anthropic.RateLimitError("rl", response=httpx.Response(429, request=_REQ), body=None), ErrorKind.RATE_LIMIT, True),
        (httpx.HTTPStatusError("429", request=None, response=httpx.Response(429)), ErrorKind.RATE_LIMIT, True),
        (httpx.HTTPStatusError("503", request=None, response=httpx.Response(503)), ErrorKind.EXTERNAL_ERROR, True),
        (httpx.TimeoutException("slow"), ErrorKind.TIMEOUT, True),
        (asyncio.TimeoutError(), ErrorKind.TIMEOUT, True),
        (pydantic.ValidationError.from_exception_data("X", []), ErrorKind.INVALID_OUTPUT, True),
        (ValueError("bad input"), ErrorKind.INVALID_INPUT, False),
        (RuntimeError("???"), ErrorKind.BUG, False),
    ],
)
def test_classify(exc, expected_kind, expected_retryable):
    err = classify(exc, provider="test")
    assert err.kind == expected_kind
    assert err.retryable is expected_retryable
    assert err.provider == "test"
    assert err.message
