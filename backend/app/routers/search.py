from __future__ import annotations

import json
import logging

from fastapi import APIRouter, BackgroundTasks
from sqlmodel import Session, select

from ..config import get_config
from ..database import engine
from ..models.job import Job
from ..scheduler import run_search_pipeline

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/search", tags=["search"])


@router.post("/trigger", response_model=dict)
async def trigger_search(background_tasks: BackgroundTasks):
    """Manually kick off a search run in the background."""
    background_tasks.add_task(_run_in_background)
    return {"status": "started", "message": "Search triggered — check /runs for progress"}


async def _run_in_background():
    await run_search_pipeline()


@router.post("/crawl-careers", response_model=dict)
async def trigger_career_crawl(background_tasks: BackgroundTasks):
    """Crawl Greenhouse/Lever career pages from the watchlist."""
    background_tasks.add_task(_crawl_careers_background)
    return {"status": "started", "message": "Career crawl started — check career_watchlist.md for results"}


async def _crawl_careers_background():
    from ..scrapers.career_crawler import crawl_career_pages, _update_watchlist_results
    config = get_config()
    raw_jobs = await crawl_career_pages(
        positions=config.profile.positions,
        expertise=config.profile.expertise,
        serper_api_key=config.serper_api_key,
    )
    if not raw_jobs:
        logger.info("Career crawl: no relevant jobs found")
        return

    with Session(engine) as session:
        existing_urls: set[str] = set(session.exec(select(Job.url)).all())

    new_jobs = []
    with Session(engine) as session:
        for raw in raw_jobs:
            if raw.url in existing_urls:
                continue
            job = Job(
                title=raw.title,
                company=raw.company,
                location=raw.location,
                url=raw.url,
                description=raw.description,
                source=raw.source,
                date_posted=raw.date_posted,
                country=raw.country,
                raw_data=json.dumps(raw.raw_data),
            )
            session.add(job)
            existing_urls.add(raw.url)
            new_jobs.append(job)
        session.commit()
        for j in new_jobs:
            session.refresh(j)

    logger.info("Career crawl: %d new jobs added to DB", len(new_jobs))

    if new_jobs:
        from ..matcher.llm import OllamaMatcher
        matcher = OllamaMatcher(base_url=config.ollama_base_url, model=config.llm.model)
        bs = config.llm.batch_size
        threshold = config.llm.priority_threshold
        for i in range(0, len(new_jobs), bs):
            batch = new_jobs[i: i + bs]
            job_dicts = [{"title": j.title, "company": j.company, "description": j.description} for j in batch]
            scores = await matcher.score_batch(
                jobs=job_dicts,
                positions=config.profile.positions,
                expertise=config.profile.expertise,
                resume_summary=config.profile.resume_summary,
            )
            with Session(engine) as session:
                for job, (score, reason) in zip(batch, scores):
                    db_job = session.get(Job, job.id)
                    if db_job:
                        db_job.match_score = score
                        db_job.match_reason = reason
                        if score is not None:
                            db_job.is_priority = score >= threshold
                        session.add(db_job)
                session.commit()

    new_urls = {j.url for j in new_jobs}
    _update_watchlist_results([j for j in raw_jobs if j.url in new_urls])


@router.post("/crawl-phd", response_model=dict)
async def trigger_phd_crawl(background_tasks: BackgroundTasks):
    """Search for PhD positions at institutions listed in career_watchlist.md."""
    background_tasks.add_task(_crawl_phd_background)
    return {"status": "started", "message": "PhD crawl started"}


async def _crawl_phd_background():
    import re
    from ..scrapers.career_crawler import WATCHLIST_PATH, crawl_phd_positions
    config = get_config()

    institutions = []
    if WATCHLIST_PATH.exists():
        text = WATCHLIST_PATH.read_text(encoding="utf-8")
        section = re.search(r"## PhD Program Searches\n(.*?)(?=\n## |\Z)", text, re.DOTALL)
        if section:
            for line in section.group(1).splitlines():
                if line.startswith("|") and not line.startswith("|---") and not line.lower().startswith("| institution"):
                    cells = [c.strip() for c in line.strip("|").split("|")]
                    if cells and cells[0]:
                        institutions.append(cells[0])

    if not institutions:
        institutions = ["CMU", "MIT", "Stanford", "UC Berkeley"]

    raw_jobs = await crawl_phd_positions(
        serper_api_key=config.serper_api_key,
        positions=config.profile.positions,
        institutions=institutions,
    )
    if not raw_jobs:
        return

    with Session(engine) as session:
        existing_urls: set[str] = set(session.exec(select(Job.url)).all())

    with Session(engine) as session:
        for raw in raw_jobs:
            if raw.url in existing_urls:
                continue
            job = Job(
                title=raw.title,
                company=raw.company,
                location=raw.location,
                url=raw.url,
                description=raw.description,
                source="phd",
                date_posted=raw.date_posted,
                country=raw.country,
                raw_data=json.dumps(raw.raw_data),
            )
            session.add(job)
            existing_urls.add(raw.url)
        session.commit()
    logger.info("PhD crawl: added jobs from %d institutions", len(institutions))
