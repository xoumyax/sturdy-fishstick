"""Free academic PhD-position boards — no API keys, no Serper credits.

Currently: FindAPhD.com and jobs.ac.uk. Both are plain-HTML search pages
parsed with BeautifulSoup (installed as a jobspy dependency). Keywords come
from the phd_profile config.
"""
from __future__ import annotations

import asyncio
import logging
import re

import httpx

from .base import RawJob
from .serper import _detect_country

logger = logging.getLogger(__name__)

_UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}


async def _get(url: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as c:
            r = await c.get(url, headers=_UA)
            if r.status_code != 200:
                logger.warning("PhD board %s → HTTP %s", url, r.status_code)
                return None
            return r.text
    except Exception as e:
        logger.warning("PhD board fetch failed (%s): %s", url, e)
        return None


# Note: FindAPhD, academicpositions.com, and scholarshipdb.net all sit behind
# Cloudflare bot challenges (verified 2026-07-04) — not scrapeable without
# evasion tactics we don't want. EURAXESS (EU public portal) + jobs.ac.uk are
# open and cover much of the same ground.


async def fetch_euraxess(keyword: str, max_results: int = 20) -> list[RawJob]:
    """Scrape EURAXESS (EU research job portal) search results."""
    from bs4 import BeautifulSoup
    html = await _get(
        f"https://euraxess.ec.europa.eu/jobs/search?keywords={keyword.replace(' ', '%20')}"
    )
    if not html:
        return []
    soup = BeautifulSoup(html, "html.parser")

    jobs: list[RawJob] = []
    seen: set[str] = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not re.fullmatch(r"(?:https?://euraxess\.ec\.europa\.eu)?/jobs/\d+", href.split("?")[0]):
            continue
        title = a.get_text(" ", strip=True)
        if len(title) < 15:
            continue
        url = href if href.startswith("http") else f"https://euraxess.ec.europa.eu{href}"
        url = url.split("?")[0]
        if url in seen:
            continue
        seen.add(url)
        card = a.find_parent("article") or a.find_parent("div")
        card_text = card.get_text(" ", strip=True)[:400] if card else ""
        jobs.append(RawJob(
            title=title[:200],
            company=None,
            location=None,
            url=url,
            description=card_text or None,
            source="phd",
            date_posted=None,
            country=_detect_country(card_text) or "Europe",
            raw_data={"board": "euraxess", "keyword": keyword},
        ))
        if len(jobs) >= max_results:
            break
    return jobs


async def fetch_jobsacuk(keyword: str, max_results: int = 20) -> list[RawJob]:
    """Scrape jobs.ac.uk (UK academic jobs incl. PhD studentships)."""
    from bs4 import BeautifulSoup
    html = await _get(
        f"https://www.jobs.ac.uk/search/?keywords={keyword.replace(' ', '+')}"
        "&activeFacet=phdFacet&phdFacet%5B0%5D=true&sortOrder=dateposted"
    )
    if not html:
        return []
    soup = BeautifulSoup(html, "html.parser")

    jobs: list[RawJob] = []
    seen: set[str] = set()
    for a in soup.select('a[href^="/job/"]'):
        href = a.get("href") or ""
        title = a.get_text(" ", strip=True)
        if not href or len(title) < 15:
            continue
        url = f"https://www.jobs.ac.uk{href.split('#')[0]}"
        if url in seen:
            continue
        seen.add(url)
        card = a.find_parent("div")
        card_text = card.get_text(" ", strip=True)[:400] if card else ""
        jobs.append(RawJob(
            title=title[:200],
            company=None,
            location=None,
            url=url,
            description=card_text or None,
            source="phd",
            date_posted=None,
            country="United Kingdom",
            raw_data={"board": "jobsacuk", "keyword": keyword},
        ))
        if len(jobs) >= max_results:
            break
    return jobs


_PHD_TITLE_WORDS = ("phd", "doctoral", "doctorate", "dphil", "studentship")


async def crawl_phd_boards(keywords: list[str], max_per_board: int = 20) -> list[RawJob]:
    """Fetch from all boards for each keyword; dedupe by URL. Completely free.

    Both boards' keyword params are unreliable in server-rendered HTML, so we
    keep only doctoral-titled results here and let the LLM scorer judge
    topical relevance against the phd_profile.
    """
    all_jobs: list[RawJob] = []
    seen: set[str] = set()
    for kw in keywords[:3]:
        for fetcher in (fetch_euraxess, fetch_jobsacuk):
            batch = await fetcher(kw, max_per_board)
            kept = 0
            for j in batch:
                if j.url in seen:
                    continue
                if not any(w in j.title.lower() for w in _PHD_TITLE_WORDS):
                    continue
                seen.add(j.url)
                all_jobs.append(j)
                kept += 1
            logger.info("PhD board %s %r → %d results, %d PhD-titled kept",
                        fetcher.__name__, kw, len(batch), kept)
            await asyncio.sleep(1)
    return all_jobs
