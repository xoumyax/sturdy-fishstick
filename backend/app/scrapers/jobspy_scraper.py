"""Real LinkedIn job listings via python-jobspy (no login, no API credits),
plus LinkedIn hiring-post discovery via Serper (budget-capped).

jobspy scrapes LinkedIn's public job search; it returns direct
linkedin.com/jobs/view/ URLs with title/company/location. It's synchronous
(pandas under the hood) so callers get an async wrapper that runs it in a
thread.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from .base import RawJob
from .serper import _detect_country

logger = logging.getLogger(__name__)


def _fetch_listings_sync(search_term: str, location: str, results_wanted: int,
                         hours_old: int) -> list[RawJob]:
    try:
        from jobspy import scrape_jobs
    except ImportError:
        logger.warning("python-jobspy not installed — run: pip install python-jobspy")
        return []

    try:
        df = scrape_jobs(
            site_name=["linkedin"],
            search_term=search_term,
            location=location,
            results_wanted=results_wanted,
            hours_old=hours_old,
            linkedin_fetch_description=True,  # ~1s/job extra, gives real descriptions
        )
    except Exception as e:
        logger.warning("jobspy scrape failed for %r: %s", search_term, e)
        return []

    jobs: list[RawJob] = []
    for _, row in df.iterrows():
        url = str(row.get("job_url") or "")
        title = str(row.get("title") or "")
        if not url or not title:
            continue
        loc = row.get("location")
        loc = str(loc) if loc is not None and str(loc) != "nan" else None
        desc = row.get("description")
        desc = str(desc)[:3000] if desc is not None and str(desc) != "nan" else None
        posted = row.get("date_posted")
        try:
            date_posted = datetime.fromisoformat(str(posted)) if posted and str(posted) != "nan" else None
        except Exception:
            date_posted = None
        jobs.append(RawJob(
            title=title,
            company=str(row.get("company") or "") or None,
            location=loc,
            url=url,
            description=desc,
            source="linkedin",
            date_posted=date_posted,
            country=_detect_country(loc) or _detect_country(location),
            raw_data={"via": "jobspy", "search_term": search_term},
        ))
    return jobs


async def fetch_linkedin_listings(search_terms: list[str], location: str = "United States",
                                  results_per_term: int = 10, hours_old: int = 336) -> list[RawJob]:
    """Fetch real LinkedIn listings for each search term (runs in a thread)."""
    all_jobs: list[RawJob] = []
    seen: set[str] = set()
    for term in search_terms:
        batch = await asyncio.to_thread(_fetch_listings_sync, term, location, results_per_term, hours_old)
        for j in batch:
            if j.url not in seen:
                seen.add(j.url)
                all_jobs.append(j)
        logger.info("jobspy: %r → %d listings", term, len(batch))
    return all_jobs


async def fetch_linkedin_posts(queries: list[str], serper_api_key: str,
                               daily_cap: int = 10) -> list[RawJob]:
    """Find LinkedIn *posts* where people announce openings, via Serper
    site-search. Costs 1 Serper credit per query (budget-capped)."""
    if not serper_api_key or not queries:
        return []
    import httpx

    from ..serper_budget import try_spend
    from .serper import SERPER_URL

    posts: list[RawJob] = []
    headers = {"X-API-KEY": serper_api_key, "Content-Type": "application/json"}
    async with httpx.AsyncClient() as client:
        for q in queries:
            if not try_spend(daily_cap):
                logger.warning("Serper cap reached — skipping remaining post queries")
                break
            payload = {"q": f"site:linkedin.com/posts {q}", "gl": "us", "hl": "en",
                       "num": 10, "tbs": "qdr:w"}
            try:
                resp = await client.post(SERPER_URL, json=payload, headers=headers, timeout=15)
                resp.raise_for_status()
            except Exception as e:
                logger.warning("Serper posts search failed for %r: %s", q, e)
                continue
            for item in resp.json().get("organic", []):
                url = item.get("link", "")
                if "linkedin.com/posts" not in url:
                    continue
                title = item.get("title", "").removesuffix(" | LinkedIn").strip()
                posts.append(RawJob(
                    title=title or "LinkedIn hiring post",
                    company=None,
                    location=None,
                    url=url,
                    description=item.get("snippet"),
                    source="linkedin",
                    date_posted=None,
                    country=None,
                    raw_data={"via": "serper_posts", "query": q},
                ))
            await asyncio.sleep(1)
    return posts
