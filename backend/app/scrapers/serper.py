from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

import httpx
from dateutil import parser as dateutil_parser

from .base import BaseScraper, RawJob

logger = logging.getLogger(__name__)

SERPER_URL = "https://google.serper.dev/search"
TIME_FILTER_MAP = {"week": "qdr:w", "month": "qdr:m", "3months": "qdr:m3"}

_AGGREGATE_PATTERNS = (
    "linkedin.com/jobs/search",
    "glassdoor.com/Job/",
    "indeed.com/jobs",
    "facebook.com/groups",
    "reddit.com/r/",
    "/search?",
    "/jobs?",
)

# Country keyword → canonical country name (order matters: longer/specific phrases first)
_COUNTRY_KEYWORDS: list[tuple[str, str]] = [
    # United States
    ("united states", "United States"), (" usa", "United States"), (", ca ", "United States"),
    (", ny", "United States"), (", tx", "United States"), (", wa", "United States"),
    (", ma", "United States"), (", il", "United States"), (", co", "United States"),
    (", fl", "United States"), (", ga", "United States"), (", pa", "United States"),
    (", nc", "United States"), (", oh", "United States"), (", mi", "United States"),
    ("san francisco", "United States"), ("new york", "United States"), ("seattle", "United States"),
    ("austin", "United States"), ("boston", "United States"), ("chicago", "United States"),
    ("los angeles", "United States"), ("san jose", "United States"), ("menlo park", "United States"),
    ("mountain view", "United States"), ("palo alto", "United States"), ("redmond", "United States"),
    ("cupertino", "United States"), ("sunnyvale", "United States"), ("atlanta", "United States"),
    # India
    ("india", "India"), ("bangalore", "India"), ("bengaluru", "India"), ("mumbai", "India"),
    ("hyderabad", "India"), ("new delhi", "India"), ("delhi", "India"), ("chennai", "India"),
    ("pune", "India"), ("kolkata", "India"), ("gurgaon", "India"), ("noida", "India"),
    # Taiwan
    ("taiwan", "Taiwan"), ("taipei", "Taiwan"), ("hsinchu", "Taiwan"), ("taichung", "Taiwan"),
    ("tainan", "Taiwan"), ("kaohsiung", "Taiwan"),
    # Germany
    ("germany", "Germany"), ("berlin", "Germany"), ("munich", "Germany"), ("münchen", "Germany"),
    ("hamburg", "Germany"), ("frankfurt", "Germany"), ("cologne", "Germany"), ("düsseldorf", "Germany"),
    ("stuttgart", "Germany"), ("dresden", "Germany"),
    # Canada
    ("canada", "Canada"), ("toronto", "Canada"), ("vancouver", "Canada"), ("montreal", "Canada"),
    ("calgary", "Canada"), ("ottawa", "Canada"), ("edmonton", "Canada"), ("waterloo, on", "Canada"),
    # United Kingdom
    ("united kingdom", "United Kingdom"), ("london", "United Kingdom"), (" uk,", "United Kingdom"),
    ("manchester", "United Kingdom"), ("edinburgh", "United Kingdom"), ("cambridge, uk", "United Kingdom"),
    ("oxford", "United Kingdom"), ("bristol", "United Kingdom"), ("glasgow", "United Kingdom"),
    # Remote
    ("remote", "Remote"), ("work from home", "Remote"), ("anywhere", "Remote"),
    # Other countries
    ("singapore", "Singapore"), ("japan", "Japan"), ("tokyo", "Japan"), ("osaka", "Japan"),
    ("australia", "Australia"), ("sydney", "Australia"), ("melbourne", "Australia"),
    ("france", "France"), ("paris", "France"), ("netherlands", "Netherlands"), ("amsterdam", "Netherlands"),
    ("sweden", "Sweden"), ("stockholm", "Sweden"), ("switzerland", "Switzerland"), ("zurich", "Switzerland"),
    ("south korea", "South Korea"), ("seoul", "South Korea"), ("china", "China"), ("beijing", "China"),
    ("shanghai", "China"), ("hong kong", "Hong Kong"),
]


def _detect_country(location: Optional[str]) -> Optional[str]:
    if not location:
        return None
    low = location.lower()
    for keyword, country in _COUNTRY_KEYWORDS:
        if keyword in low:
            return country
    return None


def _is_aggregate_url(url: str) -> bool:
    return any(p in url for p in _AGGREGATE_PATTERNS)


def _parse_date(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    raw = raw.strip()
    try:
        return dateutil_parser.parse(raw)
    except Exception:
        pass
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
            logger.warning("Serper %s for query %r", e.response.status_code, query)
            return []
        except httpx.RequestError as e:
            logger.warning("Serper request failed for %r: %s", query, e)
            return []

        data = resp.json()
        jobs: list[RawJob] = []

        for item in data.get("jobs", []):
            url = item.get("applyLink") or item.get("shareLink") or ""
            if not url or _is_aggregate_url(url):
                continue
            loc = item.get("location")
            jobs.append(RawJob(
                title=item.get("title", ""),
                company=item.get("companyName"),
                location=loc,
                url=url,
                description=item.get("description"),
                source="google_jobs",
                date_posted=_parse_date(item.get("detectedExtensions", {}).get("postedAt")),
                raw_data=item,
                country=_detect_country(loc),
            ))

        for item in data.get("organic", [])[:5]:
            url = item.get("link", "")
            if not url or _is_aggregate_url(url):
                continue
            loc = item.get("location")
            jobs.append(RawJob(
                title=item.get("title", ""),
                company=None,
                location=loc,
                url=url,
                description=item.get("snippet"),
                source="google_jobs",
                date_posted=_parse_date(item.get("date")),
                raw_data=item,
                country=_detect_country(loc),
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
            logger.warning("Serper LinkedIn failed for %r: %s", query, e)
            return []

        data = resp.json()
        jobs: list[RawJob] = []
        for item in data.get("organic", []):
            url = item.get("link", "")
            if "linkedin.com/jobs/view/" not in url:
                continue
            loc = item.get("location")
            jobs.append(RawJob(
                title=item.get("title", ""),
                company=None,
                location=loc,
                url=url,
                description=item.get("snippet"),
                source="linkedin",
                date_posted=_parse_date(item.get("date")),
                raw_data=item,
                country=_detect_country(loc),
            ))
        return jobs

    async def fetch(self, queries: list[str], max_results: int) -> list[RawJob]:
        results: list[RawJob] = []
        async with httpx.AsyncClient() as client:
            for query in queries:
                jobs = await self._fetch_google_jobs(client, query, max_results)
                results.extend(jobs)
                await asyncio.sleep(1)
        return results

    async def fetch_linkedin(self, queries: list[str], max_results: int) -> list[RawJob]:
        results: list[RawJob] = []
        async with httpx.AsyncClient() as client:
            for query in queries[:3]:
                jobs = await self._fetch_linkedin(client, query, min(max_results, 10))
                results.extend(jobs)
                await asyncio.sleep(1)
        return results


def build_queries(
    positions: list[str],
    expertise: list[str],
    locations: list[str],
    extra_keywords: list[str],
) -> list[str]:
    queries: list[str] = []
    for pos in positions:
        for skill in expertise[:3]:
            queries.append(f"{pos} {skill}")
    for pos in positions:
        for loc in locations:
            queries.append(f"{pos} {loc}")
    for kw in extra_keywords:
        queries.append(f"{positions[0]} {kw}")
    seen: set[str] = set()
    deduped: list[str] = []
    for q in queries:
        if q not in seen:
            seen.add(q)
            deduped.append(q)
    return deduped
