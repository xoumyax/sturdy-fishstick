from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlmodel import Session, select

from .config import get_config
from .database import engine
from .matcher.llm import OllamaMatcher
from .models.job import Job
from .models.run import SearchRun
from .scrapers.github_jobs import fetch_github_jobs
from .scrapers.serper import SerperScraper, build_queries

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def run_search_pipeline() -> SearchRun:
    config = get_config()
    run = SearchRun()

    with Session(engine) as session:
        session.add(run)
        session.commit()
        session.refresh(run)
        run_id = run.id

    logger.info("Search run %s started", run_id)

    try:
        queries = build_queries(
            positions=config.profile.positions,
            expertise=config.profile.expertise,
            locations=config.profile.location_preference,
            extra_keywords=config.search.extra_keywords,
        )

        scraper = SerperScraper(
            api_key=config.serper_api_key,
            time_filter=config.search.time_filter,
        )

        raw_jobs = []
        if "google_jobs" in config.search.sources:
            raw_jobs.extend(await scraper.fetch(queries, config.search.max_results_per_query))
        if "linkedin" in config.search.sources:
            raw_jobs.extend(await scraper.fetch_linkedin(queries, config.search.max_results_per_query))

        # LinkedIn direct (if credentials configured)
        if config.linkedin_email and config.linkedin_password:
            try:
                from .scrapers.linkedin_scraper import LinkedInScraper
                li = LinkedInScraper(config.linkedin_email, config.linkedin_password)
                li_jobs = li.fetch(queries, config.profile.location_preference, max_results=15)
                raw_jobs.extend(li_jobs)
                logger.info("Run %s: LinkedIn direct fetched %d jobs", run_id, len(li_jobs))
            except Exception as e:
                logger.warning("LinkedIn direct fetch failed: %s", e)

        # GitHub repo (free, no quota — always run)
        gh_jobs = await fetch_github_jobs()
        raw_jobs.extend(gh_jobs)
        logger.info("Run %s: fetched %d raw jobs (%d from GitHub repo)", run_id, len(raw_jobs), len(gh_jobs))

        new_jobs: list[Job] = []
        blacklist = {c.lower() for c in (config.search.company_blacklist or [])}
        whitelist = {c.lower() for c in (config.search.company_whitelist or [])}

        with Session(engine) as session:
            existing_urls: set[str] = set(session.exec(select(Job.url)).all())

            for raw in raw_jobs:
                if raw.url in existing_urls:
                    continue
                if raw.company and blacklist and raw.company.lower() in blacklist:
                    continue
                if whitelist and (not raw.company or raw.company.lower() not in whitelist):
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

        logger.info("Run %s: %d new jobs inserted", run_id, len(new_jobs))

        matcher = OllamaMatcher(base_url=config.ollama_base_url, model=config.llm.model)
        batch_size = config.llm.batch_size
        threshold = config.llm.priority_threshold

        for i in range(0, len(new_jobs), batch_size):
            batch = new_jobs[i : i + batch_size]
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
                    if db_job is None:
                        continue
                    db_job.match_score = score
                    db_job.match_reason = reason
                    if score is not None:
                        db_job.is_priority = score >= threshold
                    session.add(db_job)
                session.commit()

        # Send email notifications for high-scoring new jobs
        if config.notifications.email.enabled:
            from .notifications import send_opportunity_notifications
            with Session(engine) as session:
                scored_new = [session.get(Job, j.id) for j in new_jobs]
                scored_new = [j for j in scored_new if j is not None]
            send_opportunity_notifications(scored_new, config)

        with Session(engine) as session:
            db_run = session.get(SearchRun, run_id)
            if db_run:
                db_run.completed_at = datetime.utcnow()
                db_run.jobs_found = len(raw_jobs)
                db_run.jobs_new = len(new_jobs)
                db_run.status = "completed"
                session.add(db_run)
                session.commit()
                session.refresh(db_run)
                return db_run

    except Exception as exc:
        logger.exception("Search run %s failed: %s", run_id, exc)
        with Session(engine) as session:
            db_run = session.get(SearchRun, run_id)
            if db_run:
                db_run.status = "failed"
                db_run.error_msg = str(exc)
                db_run.completed_at = datetime.utcnow()
                session.add(db_run)
                session.commit()
                session.refresh(db_run)
                return db_run

    return run


def _missed_scheduled_window(last_run_time: datetime, times: list[str], tz_name: str) -> bool:
    import pytz
    tz = pytz.timezone(tz_name)
    now = datetime.now(tz)
    last = last_run_time.replace(tzinfo=pytz.utc).astimezone(tz)
    today = now.date()
    for t in times:
        h, m = map(int, t.split(":"))
        window = tz.localize(datetime(today.year, today.month, today.day, h, m))
        if last < window <= now:
            return True
    return False


async def startup_catchup():
    from datetime import timedelta
    config = get_config()
    with Session(engine) as session:
        last_run = session.exec(
            select(SearchRun).where(SearchRun.status == "completed").order_by(SearchRun.completed_at.desc())
        ).first()

    should_run = False
    if last_run is None:
        logger.info("No previous completed run found — scheduling catchup search")
        should_run = True
    else:
        try:
            should_run = _missed_scheduled_window(
                last_run.completed_at,
                config.scheduler.times,
                config.scheduler.timezone,
            )
            if should_run:
                logger.info("Missed scheduled window — scheduling catchup search")
        except Exception:
            pass

    if should_run and _scheduler:
        run_at = datetime.utcnow() + timedelta(seconds=3)
        _scheduler.add_job(run_search_pipeline, "date", run_date=run_at, id="startup_catchup", replace_existing=True)


def setup_scheduler() -> AsyncIOScheduler:
    global _scheduler
    config = get_config()
    _scheduler = AsyncIOScheduler(timezone=config.scheduler.timezone)
    for time_str in config.scheduler.times:
        h, m = map(int, time_str.split(":"))
        _scheduler.add_job(run_search_pipeline, "cron", hour=h, minute=m, misfire_grace_time=300)
    _scheduler.start()
    return _scheduler


def teardown_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        _scheduler = None


def reload_scheduler():
    teardown_scheduler()
    setup_scheduler()
