from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Optional

import httpx
from dateutil import parser as dateutil_parser

from .base import BaseScraper, RawJob

logger = logging.getLogger(__name__)

SERPER_URL = "https://google.serper.dev/search"
TIME_FILTER_MAP = {"week": "qdr:w", "month": "qdr:m", "3months": "qdr:m3"}


def _parse_date(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    raw = raw.strip()
    try:
        return dateutil_parser.parse(raw)
    except Exception:
        pass
    # Handle relative strings like "3 days ago", "2 weeks ago"
    low = raw.lower()
    now = datetime.utcnow()
    try:
        if "hour" in low:
            n = int("".join(filter(str.isdigit, low)) or "1")
            return now - timedelta(hours=n)
        if "day" in low:
            n = int("".join(filter(str.isdigit, low)) or "1")
            return now - timedelta(days=n)
        if "week" in low:
            n = int("".join(filter(str.isdigit, low)) or "1")
            return now - timedelta(weeks=n)
        if "month" in low:
            n = int("".join(filter(str.isdigit, low)) or "1")
            return now - timedelta(days=n * 30)
    except Exception:
        pass
    return None


_AGGREGATE_PATTERNS = (
    "linkedin.com/jobs/search",
    "linkedin.com/jobs/pytorch-jobs",
    "glassdoor.com/Job/",
    "indeed.com/jobs",
    "facebook.com/groups",
    "reddit.com/r/",
    "/search?",
    "/jobs?",
)


def _is_aggregate_url(url: str) -> bool:
    return any(p in url for p in _AGGREGATE_PATTERNS)


class SerperScraper(BaseScraper):
    def __init__(self, api_key: str, time_filter: str = "month"):
        self._api_key = api_key
        self._tbs = TIME_FILTER_MAP.get(time_filter, "qdr:m")

    async def _fetch_google_jobs(self, client: httpx.AsyncClient, query: str, num: int) -> list[RawJob]:
        payload = {"q": query, "gl": "us", "hl": "en", "num": num, "tbs": self._tbs}
        headers = {"X-API-KEY": self._api_key, "Content-Type": "application/json"}
        try:
            resp = await client.post(SERPER_URL, json=payload, headers=headers, timeout=15)
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.warning("Serper returned %s for query %r: %s", e.response.status_code, query, e.response.text)
            return []
        except httpx.RequestError as e:
            logger.warning("Serper request failed for query %r: %s", query, e)
            return []

        data = resp.json()
        jobs: list[RawJob] = []

        # Google Jobs structured results
        for item in data.get("jobs", []):
            url = item.get("applyLink") or item.get("shareLink") or ""
            if not url:
                continue
            jobs.append(RawJob(
                title=item.get("title", ""),
                company=item.get("companyName"),
                location=item.get("location"),
                url=url,
                description=item.get("description"),
                source="google_jobs",
                date_posted=_parse_date(item.get("detectedExtensions", {}).get("postedAt")),
                raw_data=item,
            ))

        # Organic results as fallback (when no jobs block)
        for item in data.get("organic", [])[:5]:
            url = item.get("link", "")
            if not url or _is_aggregate_url(url):
                continue
            jobs.append(RawJob(
                title=item.get("title", ""),
                company=None,
                location=None,
                url=url,
                description=item.get("snippet"),
                source="google_jobs",
                date_posted=_parse_date(item.get("date")),
                raw_data=item,
            ))

        return jobs

    async def _fetch_linkedin(self, client: httpx.AsyncClient, query: str, num: int) -> list[RawJob]:
        linkedin_query = f"site:linkedin.com/jobs {query}"
        payload = {"q": linkedin_query, "gl": "us", "hl": "en", "num": num}
        headers = {"X-API-KEY": self._api_key, "Content-Type": "application/json"}
        try:
            resp = await client.post(SERPER_URL, json=payload, headers=headers, timeout=15)
            resp.raise_for_status()
        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            logger.warning("Serper LinkedIn request failed for %r: %s", query, e)
            return []

        data = resp.json()
        jobs: list[RawJob] = []
        for item in data.get("organic", []):
            url = item.get("link", "")
            if "linkedin.com/jobs/view/" not in url:
                continue
            jobs.append(RawJob(
                title=item.get("title", ""),
                company=None,
                location=None,
                url=url,
                description=item.get("snippet"),
                source="linkedin",
                date_posted=_parse_date(item.get("date")),
                raw_data=item,
            ))
        return jobs

    async def fetch(self, queries: list[str], max_results: int) -> list[RawJob]:
        results: list[RawJob] = []
        async with httpx.AsyncClient() as client:
            for query in queries:
                jobs = await self._fetch_google_jobs(client, query, max_results)
                results.extend(jobs)
                await asyncio.sleep(1)  # 1 req/sec rate limit
        return results

    async def fetch_linkedin(self, queries: list[str], max_results: int) -> list[RawJob]:
        results: list[RawJob] = []
        # Use fewer queries for LinkedIn to save API credits
        async with httpx.AsyncClient() as client:
            for query in queries[:3]:
                jobs = await self._fetch_linkedin(client, query, min(max_results, 10))
                results.extend(jobs)
                await asyncio.sleep(1)
        return results


def build_queries(positions: list[str], expertise: list[str], location: str, extra_keywords: list[str]) -> list[str]:
    queries: list[str] = []
    for pos in positions:
        for skill in expertise[:3]:
            queries.append(f"{pos} {skill}")
    for pos in positions:
        queries.append(f"{pos} {location}")
    for kw in extra_keywords:
        queries.append(f"{positions[0]} {kw}")
    # Deduplicate while preserving order
    seen: set[str] = set()
    deduped: list[str] = []
    for q in queries:
        if q not in seen:
            seen.add(q)
            deduped.append(q)
    return deduped
