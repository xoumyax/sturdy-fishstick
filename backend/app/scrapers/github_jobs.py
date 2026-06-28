"""
Scraper for the speedyapply/2026-SWE-College-Jobs GitHub repo.
Parses the README markdown tables and returns RawJob entries.
Runs on every search pipeline call — free, no API key needed.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Optional

import httpx

from .base import RawJob
from .serper import _detect_country

logger = logging.getLogger(__name__)

README_URL = "https://raw.githubusercontent.com/speedyapply/2026-SWE-College-Jobs/main/README.md"

_ROW_RE = re.compile(r"^\|(.+)\|$")
# HTML anchor href extractor
_HREF_RE = re.compile(r'href="([^"]+)"')
# Extract text from <strong> or plain text (strips all HTML tags)
_TAG_RE = re.compile(r"<[^>]+>")
# Age string: digits followed by d/w/mo
_AGE_RE = re.compile(r"(\d+)(d|w|mo)$")


def _href(cell: str) -> Optional[str]:
    m = _HREF_RE.search(cell)
    return m.group(1) if m else None


def _text(cell: str) -> str:
    return _TAG_RE.sub("", cell).strip()


def _age_to_date(age_str: str) -> Optional[datetime]:
    age_str = age_str.strip().lower()
    m = _AGE_RE.match(age_str)
    if not m:
        return None
    n, unit = int(m.group(1)), m.group(2)
    if unit == "d":
        return datetime.utcnow() - timedelta(days=n)
    if unit == "w":
        return datetime.utcnow() - timedelta(weeks=n)
    if unit == "mo":
        return datetime.utcnow() - timedelta(days=30 * n)
    return None


def _parse_readme(text: str) -> list[RawJob]:
    jobs: list[RawJob] = []
    seen_urls: set[str] = set()

    for line in text.splitlines():
        m = _ROW_RE.match(line.strip())
        if not m:
            continue
        cells = [c.strip() for c in m.group(1).split("|")]

        # Skip header/separator rows
        if len(cells) < 4:
            continue
        first = _text(cells[0])
        if not first or first.startswith("---") or first.lower() == "company":
            continue

        company_text = _text(cells[0])
        position_text = _text(cells[1])
        location_text = _text(cells[2])

        # Detect salary column: FAANG/Quant tables have 6 cols, Other has 5
        if len(cells) >= 6:
            posting_cell = cells[4]
            age_cell = cells[5] if len(cells) > 5 else ""
        else:
            posting_cell = cells[3]
            age_cell = cells[4] if len(cells) > 4 else ""

        # Skip closed postings (lock emoji sometimes appears in posting cell)
        if "🔒" in posting_cell:
            continue

        apply_url = _href(posting_cell)
        if not apply_url:
            continue
        if apply_url in seen_urls:
            continue
        seen_urls.add(apply_url)

        if not company_text or not position_text:
            continue

        date_posted = _age_to_date(_text(age_cell))
        country = _detect_country(location_text) or _detect_country(position_text)

        jobs.append(RawJob(
            title=position_text,
            company=company_text,
            location=location_text or None,
            url=apply_url,
            description=f"{position_text} at {company_text}. Location: {location_text or 'Not specified'}.",
            source="github_jobs",
            date_posted=date_posted,
            country=country,
            raw_data={"company": company_text, "location": location_text, "age": _text(age_cell)},
        ))

    return jobs


async def fetch_github_jobs() -> list[RawJob]:
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(README_URL)
            resp.raise_for_status()
        jobs = _parse_readme(resp.text)
        logger.info("GitHub jobs repo: parsed %d open listings", len(jobs))
        return jobs
    except Exception as e:
        logger.warning("GitHub jobs fetch failed: %s", e)
        return []
