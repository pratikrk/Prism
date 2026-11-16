from __future__ import annotations

import asyncio
import hashlib
import json
from typing import Any

import httpx
import pydantic
import redis.asyncio as aioredis
from tenacity import (
    AsyncRetrying,
    RetryError,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from app.core.config import settings

_BASE = "https://api.dataforseo.com"
_CACHE_TTL = 24 * 3600


class DataForSEOError(RuntimeError):
    pass


def _competition_str(v: object) -> str | None:
    """Normalise DataForSEO competition field.

    The /keywords_for_keywords endpoint returns 'HIGH'/'MEDIUM'/'LOW'.
    Some endpoint variants return a 0–1 float; we stringify it so the
    model stays a plain str | None.
    """
    if v is None:
        return None
    if isinstance(v, str):
        return v
    try:
        return str(v)
    except Exception:
        return None


class KeywordRow(pydantic.BaseModel):
    keyword: str
    search_volume: int | None = None
    keyword_difficulty: int | None = None
    competition: str | None = None        # 'HIGH' | 'MEDIUM' | 'LOW' from Google Ads
    competition_index: int | None = None  # 0–100 numeric equivalent
    cpc: float | None = None
    low_top_of_page_bid: float | None = None
    high_top_of_page_bid: float | None = None
    monthly_searches: list[dict] | None = None

    @pydantic.field_validator("competition", mode="before")
    @classmethod
    def _normalise_competition(cls, v: object) -> str | None:
        return _competition_str(v)

    def trend_volumes(self, months: int = 12) -> list[int]:
        """Return the last N months of search volumes, oldest first."""
        if not self.monthly_searches:
            return []
        sorted_ms = sorted(
            self.monthly_searches,
            key=lambda x: (x.get("year", 0), x.get("month", 0)),
        )
        return [m.get("search_volume", 0) for m in sorted_ms[-months:]]


class DataForSEOClient:
    def __init__(
        self,
        *,
        redis: aioredis.Redis | None = None,
        concurrency: int | None = None,
    ) -> None:
        self._redis = redis
        self._sem = asyncio.Semaphore(concurrency or settings.dataforseo_concurrency)
        self._auth = httpx.BasicAuth(
            settings.dataforseo_login.get_secret_value(),
            settings.dataforseo_password.get_secret_value(),
        )
        self._timeout = httpx.Timeout(settings.dataforseo_timeout)

    async def keywords_for_keywords(self, seeds: list[str]) -> list[KeywordRow]:
        payload = [{"keywords": seeds, "language_code": "en", "location_code": 2840}]
        data = await self._post(
            "/v3/keywords_data/google_ads/keywords_for_keywords/live", payload
        )
        rows = _extract_result(data)
        if not rows:
            raise DataForSEOError("DataForSEO returned no keyword rows (treated as external error)")
        return [KeywordRow.model_validate(r) for r in rows]

    async def domain_competitors(self, domain: str) -> list[dict]:
        """Return competitor domains and their keyword overlap with `domain`."""
        payload = [{"target": domain, "language_code": "en", "location_code": 2840}]
        data = await self._post(
            "/v3/dataforseo_labs/google/competitors_domain/live", payload
        )
        return _extract_result(data)

    async def domain_rank_overview(self, domain: str) -> dict:
        """Return organic traffic metrics for `domain`."""
        payload = [{"target": domain, "language_code": "en", "location_code": 2840}]
        data = await self._post(
            "/v3/dataforseo_labs/google/domain_rank_overview/live", payload
        )
        rows = _extract_result(data)
        return rows[0] if rows else {}

    async def bulk_keyword_difficulty(self, keywords: list[str]) -> dict[str, int]:
        """Return {keyword: difficulty} for up to 1000 keywords."""
        if not keywords:
            return {}
        payload = [{"keywords": keywords[:1000], "language_code": "en", "location_code": 2840}]
        data = await self._post(
            "/v3/dataforseo_labs/google/bulk_keyword_difficulty/live", payload
        )
        rows = _extract_result(data)
        result: dict[str, int] = {}
        for row in rows:
            for item in row.get("items") or []:
                kw = item.get("keyword")
                kd = item.get("keyword_difficulty")
                if kw and kd is not None:
                    result[kw] = kd
        return result

    async def ranked_keywords(self, domain: str, limit: int = 100) -> list[dict]:
        """Return keywords `domain` ranks for, with URLs and positions."""
        payload = [
            {
                "target": domain,
                "language_code": "en",
                "location_code": 2840,
                "limit": limit,
                "filters": ["ranked_serp_element.serp_item.rank_group", "<=", 20],
            }
        ]
        data = await self._post(
            "/v3/dataforseo_labs/google/ranked_keywords/live", payload
        )
        return _extract_result(data)

    # Hard ceiling on total wall-clock time for a single API call (incl. retries).
    # asyncio.wait_for cancels the coroutine even if the TCP connection stalls and
    # httpx's per-chunk timeout never fires.
    _TOTAL_TIMEOUT_S: int = 90

    async def _post(self, path: str, payload: Any) -> dict:
        cache_key = _cache_key(path, payload)
        if self._redis is not None:
            cached = await self._redis.get(cache_key)
            if cached:
                return json.loads(cached)
        async with self._sem:
            try:
                data = await asyncio.wait_for(
                    self._do_post_with_retry(path, payload),
                    timeout=self._TOTAL_TIMEOUT_S,
                )
            except asyncio.TimeoutError:
                raise DataForSEOError(
                    f"DataForSEO request exceeded total timeout ({self._TOTAL_TIMEOUT_S}s)"
                )
        if self._redis is not None:
            await self._redis.set(cache_key, json.dumps(data), ex=_CACHE_TTL)
        return data

    async def _do_post_with_retry(self, path: str, payload: Any) -> dict:
        try:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(3),
                wait=wait_exponential_jitter(initial=2, max=15),
                retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TimeoutException)),
                reraise=True,
            ):
                with attempt:
                    async with httpx.AsyncClient(
                        base_url=_BASE, auth=self._auth, timeout=self._timeout
                    ) as client:
                        resp = await client.post(path, json=payload)
                        if resp.status_code in (429, 500, 502, 503, 504):
                            resp.raise_for_status()
                        resp.raise_for_status()
                        return resp.json()
        except RetryError as e:
            raise e.last_attempt.exception()  # type: ignore[misc]
        raise DataForSEOError("retry loop terminated unexpectedly")


def _cache_key(path: str, payload: Any) -> str:
    h = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:24]
    return f"dataforseo:{path}:{h}"


def _extract_result(data: dict) -> list[dict]:
    try:
        return data["tasks"][0]["result"] or []
    except (KeyError, IndexError, TypeError):
        return []
