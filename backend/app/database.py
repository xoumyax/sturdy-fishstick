from __future__ import annotations

from pathlib import Path

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine

DB_PATH = Path(__file__).parent.parent / "data" / "jobradar.db"
DB_PATH.parent.mkdir(exist_ok=True)

engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)


def create_tables():
    SQLModel.metadata.create_all(engine)
    _run_migrations()
    _backfill_countries()


def _backfill_countries():
    """Detect country from location + title for existing jobs that have none."""
    import logging
    from .scrapers.serper import _detect_country
    from .models.job import Job
    from sqlmodel import select as sm_select
    log = logging.getLogger(__name__)
    with Session(engine) as session:
        jobs = session.exec(sm_select(Job).where(Job.country == None)).all()
        updated = 0
        for job in jobs:
            detected = _detect_country(job.location) or _detect_country(job.title)
            if detected:
                job.country = detected
                session.add(job)
                updated += 1
        if updated:
            session.commit()
            log.info("Backfilled country for %d jobs", updated)


def _run_migrations():
    additive = [
        "ALTER TABLE jobs ADD COLUMN deadline DATE",
        "ALTER TABLE jobs ADD COLUMN is_aggregate BOOLEAN DEFAULT FALSE",
        "ALTER TABLE jobs ADD COLUMN country TEXT",
    ]
    with engine.connect() as conn:
        for sql in additive:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # column already exists

        # One-time data fix: mark existing aggregate listings
        conn.execute(text("""
            UPDATE jobs SET is_aggregate=1 WHERE is_aggregate IS NULL OR is_aggregate=0 AND (
                url LIKE '%/jobs/search%'
                OR url LIKE '%glassdoor.com/Job/%'
                OR url LIKE '%indeed.com/jobs%'
                OR url LIKE '%facebook.com/groups%'
                OR url LIKE '%reddit.com/r/%'
                OR url LIKE '%/jobs?%'
                OR url LIKE '%linkedin.com/jobs/pytorch%'
                OR url LIKE '%linkedin.com/jobs/machine-learning%'
                OR url LIKE '%linkedin.com/jobs/software%'
                OR (url LIKE '%linkedin.com/jobs/%' AND url NOT LIKE '%linkedin.com/jobs/view/%')
            )
        """))
        conn.commit()


def get_session():
    with Session(engine) as session:
        yield session
