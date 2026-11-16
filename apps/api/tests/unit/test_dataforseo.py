import asyncio
import json
from pathlib import Path

import httpx
import pytest
import respx

from app.integrations.dataforseo import (
    DataForSEOClient,
    DataForSEOError,
    KeywordRow,
)

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures/dataforseo/keywords_sample.json"


@pytest.mark.asyncio
@respx.mock
async def test_keywords_happy_path(fakeredis_client):
    respx.post("https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live").mock(
        return_value=httpx.Response(200, json=json.loads(FIXTURE.read_text()))
    )
    client = DataForSEOClient(redis=fakeredis_client)
    rows = await client.keywords_for_keywords(["ats"])
    assert len(rows) == 2
    assert isinstance(rows[0], KeywordRow)
    assert rows[0].keyword == "applicant tracking system"


@pytest.mark.asyncio
@respx.mock
async def test_keywords_cached_on_second_call(fakeredis_client):
    route = respx.post(
        "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live"
    ).mock(return_value=httpx.Response(200, json=json.loads(FIXTURE.read_text())))
    client = DataForSEOClient(redis=fakeredis_client)
    await client.keywords_for_keywords(["ats"])
    await client.keywords_for_keywords(["ats"])
    assert route.call_count == 1


@pytest.mark.asyncio
@respx.mock
async def test_keywords_429_retries_then_succeeds(fakeredis_client):
    responses = [
        httpx.Response(429, headers={"Retry-After": "0"}),
        httpx.Response(429, headers={"Retry-After": "0"}),
        httpx.Response(200, json=json.loads(FIXTURE.read_text())),
    ]
    route = respx.post(
        "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live"
    ).mock(side_effect=responses)
    client = DataForSEOClient(redis=fakeredis_client)
    rows = await client.keywords_for_keywords(["ats"])
    assert route.call_count == 3
    assert len(rows) == 2


@pytest.mark.asyncio
@respx.mock
async def test_empty_result_raises_external_error(fakeredis_client):
    respx.post(
        "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live"
    ).mock(return_value=httpx.Response(200, json={"tasks": [{"status_code": 20000, "result": []}]}))
    client = DataForSEOClient(redis=fakeredis_client)
    with pytest.raises(DataForSEOError):
        await client.keywords_for_keywords(["ats"])


@pytest.mark.asyncio
@respx.mock
async def test_semaphore_caps_concurrent_calls(fakeredis_client, monkeypatch):
    current = {"now": 0, "peak": 0}

    async def handler(req: httpx.Request) -> httpx.Response:
        current["now"] += 1
        current["peak"] = max(current["peak"], current["now"])
        await asyncio.sleep(0.02)
        current["now"] -= 1
        return httpx.Response(200, json=json.loads(FIXTURE.read_text()))

    respx.post(
        "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live"
    ).mock(side_effect=handler)
    client = DataForSEOClient(redis=fakeredis_client, concurrency=2)
    await asyncio.gather(*[client.keywords_for_keywords([f"k{i}"]) for i in range(8)])
    assert current["peak"] <= 2


@pytest.fixture
def fakeredis_client():
    import fakeredis.aioredis
    return fakeredis.aioredis.FakeRedis()
