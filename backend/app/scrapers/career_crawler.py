"""
Crawls Greenhouse and Lever ATS APIs for companies in career_watchlist.json (or .md).
Adds matching jobs to the database and updates the watchlist with recent findings.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import httpx

from .base import RawJob
from .serper import _detect_country

logger = logging.getLogger(__name__)

WATCHLIST_PATH = Path(__file__).parent.parent.parent / "data" / "career_watchlist.md"
WATCHLIST_JSON_PATH = Path(__file__).parent.parent.parent / "data" / "career_watchlist.json"

# Known domain suffix → (ats_type, slug)
_DOMAIN_ATS: dict[str, tuple[str, str]] = {
    "anthropic.com":      ("greenhouse", "anthropic"),
    "openai.com":         ("greenhouse", "openai"),
    "cohere.com":         ("greenhouse", "cohere"),
    "elevenlabs.io":      ("greenhouse", "elevenlabs"),
    "mistral.ai":         ("lever",      "mistral-ai"),
    "scale.com":          ("lever",      "scaleai"),
    "huggingface.co":     ("greenhouse", "huggingface"),
    "cloudflare.com":     ("greenhouse", "cloudflare"),
    "stripe.com":         ("greenhouse", "stripe"),
    "databricks.com":     ("greenhouse", "databricks"),
    "airbnb.com":         ("greenhouse", "airbnb"),
    "atlassian.com":      ("greenhouse", "atlassian"),
    "github.com":         ("greenhouse", "github"),
    "gitlab.com":         ("greenhouse", "gitlab"),
    # netflix.com intentionally omitted — they use jobs.netflix.com (custom site, not Greenhouse)
    "wandb.ai":           ("lever",      "wandb"),
    "stability.ai":       ("lever",      "stability-ai"),
    "anyscale.com":       ("greenhouse", "anyscale"),
    "perplexity.ai":      ("greenhouse", "perplexityai"),
    "together.ai":        ("greenhouse", "together-computer"),
    "elastic.co":         ("greenhouse", "elastic"),
    "confluent.io":       ("greenhouse", "confluent"),
    "hashicorp.com":      ("greenhouse", "hashicorp"),
    "vercel.com":         ("greenhouse", "vercel"),
    "arm.com":            ("greenhouse", "arm"),
    "twosigma.com":       ("greenhouse", "twosigma"),
    "citadel.com":        ("lever",      "citadel"),
}


def _detect_ats(url: str) -> tuple[str, str]:
    """Return (ats_type, slug_or_url). Checks direct ATS URLs first, then domain mapping."""
    # Direct Greenhouse board URL
    m = re.search(r"boards\.greenhouse\.io/([^/?#]+)", url)
    if m:
        return ("greenhouse", m.group(1))
    # Direct Lever URL
    m = re.search(r"jobs\.lever\.co/([^/?#]+)", url)
    if m:
        return ("lever", m.group(1))
    # Domain mapping
    domain = urlparse(url).netloc.lstrip("www.")
    for known, ats_info in _DOMAIN_ATS.items():
        if known in domain:
            return ats_info
    return ("serper", url)


def _parse_watchlist_json() -> list[dict]:
    """Parse companies from career_watchlist.json (uploaded via Settings)."""
    if not WATCHLIST_JSON_PATH.exists():
        return []
    try:
        data = json.loads(WATCHLIST_JSON_PATH.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning("Failed to read career_watchlist.json: %s", e)
        return []
    companies = []
    for category, entries in data.items():
        for entry in entries:
            name = entry.get("name", "").strip()
            url = entry.get("url", "").strip()
            if not name or not url:
                continue
            ats, slug = _detect_ats(url)
            companies.append({"company": name, "category": category, "ats": ats, "slug": slug, "url": url})
    return companies


def _parse_watchlist() -> list[dict]:
    """Parse the companies table from career_watchlist.md."""
    if not WATCHLIST_PATH.exists():
        return []
    text = WATCHLIST_PATH.read_text(encoding="utf-8")
    section_match = re.search(r"## Companies to Monitor\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
    if not section_match:
        return []
    section = section_match.group(1)
    companies = []
    for line in section.splitlines():
        line = line.strip()
        if not line.startswith("|") or line.startswith("|---") or line.lower().startswith("| company"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 4:
            continue
        company, category, ats, slug = cells[0], cells[1], cells[2], cells[3]
        if not company or not ats or ats.lower() == "manual":
            continue
        companies.append({"company": company, "category": category, "ats": ats.lower(), "slug": slug})
    return companies


def _is_relevant(title: str, description: str, positions: list[str], expertise: list[str]) -> bool:
    """Keyword-based relevance check before sending to Ollama."""
    text = (title + " " + description).lower()
    pos_match = any(kw.lower() in text for pos in positions for kw in pos.split())
    exp_match = any(kw.lower() in text for kw in expertise)
    senior_words = ["senior", "staff ", "principal", "director", "vp ", "vice president", "manager", "lead "]
    is_senior = any(w in text[:60] for w in senior_words)
    return (pos_match or exp_match) and not is_senior


async def _scrape_with_playwright(url: str, company: str,
                                  positions: list[str], expertise: list[str]) -> list[RawJob]:
    """Headless-browser fallback for career pages that don't have a JSON API."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.warning("Playwright not installed — run: pip install playwright && playwright install chromium")
        return []

    kw = [p.lower() for p in positions] + [e.lower() for e in expertise[:3]]
    links: list[dict] = []

    _SEARCH_SELECTORS = [
        'input[type="search"]',
        'input[placeholder*="earch" i]',
        'input[aria-label*="earch" i]',
        'input[name*="earch" i]',
        'input[id*="earch" i]',
    ]

    async def _collect_links(page) -> list[dict]:
        return await page.evaluate("""() => {
            const seen = new Set();
            const out = [];
            document.querySelectorAll('a[href]').forEach(el => {
                const text = (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ');
                const href = el.href;
                if (text.length >= 5 && text.length <= 200 && href && !seen.has(href)) {
                    seen.add(href);
                    out.push({ text, href });
                }
            });
            return out;
        }""")

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            try:
                page = await browser.new_page()
                page.set_default_timeout(25_000)
                try:
                    await page.goto(url, wait_until="networkidle", timeout=20_000)
                except Exception:
                    await page.goto(url, wait_until="domcontentloaded")
                    await page.wait_for_timeout(4_000)

                # Try to use a search box with the first position keyword
                search_performed = False
                search_term = positions[0] if positions else "engineer intern"
                for sel in _SEARCH_SELECTORS:
                    try:
                        el = page.locator(sel).first
                        if await el.count() > 0:
                            await el.fill(search_term)
                            await el.press("Enter")
                            await page.wait_for_timeout(3_500)
                            search_performed = True
                            break
                    except Exception:
                        pass

                if not search_performed:
                    await page.wait_for_timeout(2_000)

                links = await _collect_links(page)
            finally:
                await browser.close()
    except Exception as e:
        logger.warning("Playwright scrape failed for %s (%s): %s", company, url, e)
        return []

    skip_terms = {"privacy", "cookie", "terms", "login", "sign in", "sign up",
                  "back to", "learn more", "home", "about", "contact", "blog", "news", "press"}
    jobs: list[RawJob] = []
    for link in links:
        title = link["text"]
        href = link["href"]
        title_lower = title.lower()
        if not any(k in title_lower for k in kw):
            continue
        if any(s in title_lower for s in skip_terms):
            continue
        if not href.startswith("http"):
            continue
        jobs.append(RawJob(
            title=title,
            company=company,
            location=None,
            url=href,
            description=f"Found via Playwright on {url}",
            source="career_page",
            date_posted=None,
            country=None,
            raw_data={"method": "playwright", "source_url": url},
        ))

    return jobs[:20]


async def _crawl_greenhouse(slug: str, company_name: str,
                             fallback_url: str = "",
                             positions: list[str] | None = None,
                             expertise: list[str] | None = None) -> list[RawJob]:
    url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.get(url)
        if r.status_code == 404:
            logger.warning("Greenhouse 404 for slug: %s — trying Playwright fallback", slug)
            if fallback_url:
                return await _scrape_with_playwright(fallback_url, company_name,
                                                     positions or [], expertise or [])
            return []
        data = r.json()
    except Exception as e:
        logger.warning("Greenhouse fetch error (%s): %s", slug, e)
        return []

    jobs = []
    for j in data.get("jobs", []):
        title = j.get("title", "")
        location = j.get("location", {}).get("name", "")
        apply_url = j.get("absolute_url", "")
        raw_desc = j.get("content", "") or ""
        description = re.sub(r"<[^>]+>", " ", raw_desc)[:2000]
        if not apply_url:
            continue
        jobs.append(RawJob(
            title=title,
            company=company_name,
            location=location or None,
            url=apply_url,
            description=description,
            source="career_page",
            date_posted=None,
            country=_detect_country(location),
            raw_data={"ats": "greenhouse", "slug": slug, "id": j.get("id")},
        ))
    return jobs


async def _crawl_lever(slug: str, company_name: str,
                        fallback_url: str = "",
                        positions: list[str] | None = None,
                        expertise: list[str] | None = None) -> list[RawJob]:
    url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.get(url)
        if r.status_code == 404:
            logger.warning("Lever 404 for slug: %s — trying Playwright fallback", slug)
            if fallback_url:
                return await _scrape_with_playwright(fallback_url, company_name,
                                                     positions or [], expertise or [])
            return []
        data = r.json()
    except Exception as e:
        logger.warning("Lever fetch error (%s): %s", slug, e)
        return []

    jobs = []
    for j in data:
        title = j.get("text", "")
        cats = j.get("categories", {})
        location = cats.get("location") or j.get("workplaceType", "")
        apply_url = j.get("hostedUrl", "")
        description = (j.get("description", "") or "") + " " + (j.get("additional", "") or "")
        description = re.sub(r"<[^>]+>", " ", description)[:2000]
        if not apply_url:
            continue
        jobs.append(RawJob(
            title=title,
            company=company_name,
            location=location or None,
            url=apply_url,
            description=description,
            source="career_page",
            date_posted=None,
            country=_detect_country(location or ""),
            raw_data={"ats": "lever", "slug": slug, "id": j.get("id")},
        ))
    return jobs


def _update_watchlist_results(new_jobs: list[RawJob]) -> None:
    """Append new matches to the Recent Matches section of career_watchlist.md."""
    if not WATCHLIST_PATH.exists() or not new_jobs:
        return
    text = WATCHLIST_PATH.read_text(encoding="utf-8")
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    text = re.sub(r"\*Last crawled:.*?\*", f"*Last crawled: {now}*", text)

    by_company: dict[str, list[RawJob]] = {}
    for j in new_jobs:
        by_company.setdefault(j.company or "Unknown", []).append(j)

    new_section_lines = []
    for company, jobs in sorted(by_company.items()):
        new_section_lines.append(f"\n### {company} *(crawled {now})*")
        for job in jobs[:10]:
            loc = f" — {job.location}" if job.location else ""
            new_section_lines.append(f"- [{job.title}]({job.url}){loc}")

    insert_marker = "## Recent Matches"
    if insert_marker in text:
        parts = text.split(insert_marker, 1)
        header_end = parts[1].find("\n\n")
        if header_end == -1:
            header_end = len(parts[1])
        new_content = (
            parts[0]
            + insert_marker
            + parts[1][:header_end]
            + "\n"
            + "\n".join(new_section_lines)
            + parts[1][header_end:]
        )
        text = new_content
    else:
        text += "\n## Recent Matches\n" + "\n".join(new_section_lines)

    WATCHLIST_PATH.write_text(text, encoding="utf-8")


async def _crawl_serper(company_name: str, career_url: str, serper_api_key: str,
                        positions: list[str]) -> list[RawJob]:
    """Fallback: use Serper site: search for companies without a known ATS."""
    if not serper_api_key:
        return []
    from .serper import SerperScraper
    domain = urlparse(career_url).netloc.lstrip("www.")
    queries = [f"site:{domain} {pos} intern 2026" for pos in positions[:2]]
    scraper = SerperScraper(api_key=serper_api_key, time_filter="month")
    raw = await scraper.fetch(queries, max_results=5)
    for j in raw:
        j.company = company_name
        j.source = "career_page"
    return raw


async def crawl_career_pages(positions: list[str], expertise: list[str],
                              serper_api_key: str = "") -> list[RawJob]:
    """
    Fetch jobs from companies in career_watchlist.json (if present) or career_watchlist.md.
    Greenhouse/Lever companies use their JSON APIs; others fall back to Serper site-search.
    """
    # JSON watchlist (from Settings upload) takes priority
    companies = _parse_watchlist_json()
    if not companies:
        companies = _parse_watchlist()  # fall back to markdown
    if not companies:
        logger.warning("No companies found in either watchlist")
        return []

    all_raw: list[RawJob] = []
    for entry in companies:
        ats  = entry["ats"]
        slug = entry["slug"]
        name = entry["company"]
        url  = entry.get("url", "")

        if ats == "greenhouse":
            raw = await _crawl_greenhouse(slug, name, fallback_url=url,
                                          positions=positions, expertise=expertise)
        elif ats == "lever":
            raw = await _crawl_lever(slug, name, fallback_url=url,
                                     positions=positions, expertise=expertise)
        elif ats == "serper":
            raw = await _crawl_serper(name, url, serper_api_key, positions)
        else:
            continue
        all_raw.extend(raw)
        logger.info("Career crawl: %s (%s) → %d listings", name, ats, len(raw))

    relevant = [j for j in all_raw if _is_relevant(j.title, j.description or "", positions, expertise)]
    logger.info("Career crawl: %d total → %d relevant", len(all_raw), len(relevant))
    return relevant


async def crawl_phd_positions(serper_api_key: str, positions: list[str], institutions: list[str]) -> list[RawJob]:
    """Search for PhD positions using Serper."""
    from .serper import SerperScraper
    if not serper_api_key:
        return []

    queries = []
    for inst in institutions:
        for prog in positions[:2]:
            queries.append(f"PhD {prog} 2026 application {inst}")

    scraper = SerperScraper(api_key=serper_api_key, time_filter="month")
    raw = await scraper.fetch(queries, max_results=10)
    for j in raw:
        j.source = "phd"
    return raw
