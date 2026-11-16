from unittest.mock import AsyncMock, MagicMock

import pydantic
import pytest

from app.agents.base import BaseAgent


class DemoOutput(pydantic.BaseModel):
    name: str
    count: int


class DemoAgent(BaseAgent[str, DemoOutput]):
    CORE_PROMPT = "Core demo prompt."
    BACKING_SKILL = None
    RESPONSE_MODEL = DemoOutput

    def user_prompt(self, inp: str) -> str:
        return inp


@pytest.mark.asyncio
async def test_happy_path_returns_parsed_output():
    agent = DemoAgent()
    agent._client = MagicMock()
    agent._client.messages.create = AsyncMock(
        return_value=_fake_claude_response('{"name":"x","count":1}')
    )
    out = await agent.run("hello")
    assert out == DemoOutput(name="x", count=1)


@pytest.mark.asyncio
async def test_invalid_output_retries_once_then_succeeds():
    agent = DemoAgent()
    agent._client = MagicMock()
    agent._client.messages.create = AsyncMock(
        side_effect=[
            _fake_claude_response("not json"),
            _fake_claude_response('{"name":"x","count":2}'),
        ]
    )
    out = await agent.run("hello")
    assert out.count == 2
    assert agent._client.messages.create.await_count == 2


@pytest.mark.asyncio
async def test_invalid_output_retry_exhausted_raises_validation_error():
    agent = DemoAgent()
    agent._client = MagicMock()
    agent._client.messages.create = AsyncMock(
        return_value=_fake_claude_response("still not json")
    )
    with pytest.raises(pydantic.ValidationError):
        await agent.run("hello")


def _fake_claude_response(text: str):
    m = MagicMock()
    m.content = [MagicMock(text=text)]
    return m
