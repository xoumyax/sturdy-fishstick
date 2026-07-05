"""App-wide activity log — every crawl/scan/scoring pass records start,
completion, and failure here so the Logs page can show what's happening."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from sqlmodel import Field, Session, SQLModel

from .database import engine

logger = logging.getLogger(__name__)


class ActivityEvent(SQLModel, table=True):
    __tablename__ = "activity_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    ts: datetime = Field(default_factory=datetime.utcnow, index=True)
    kind: str    # scan | careers_crawl | phd_crawl | linkedin_crawl | scoring | discovery
    status: str  # started | completed | failed
    detail: str = ""


def log_activity(kind: str, status: str, detail: str = "") -> None:
    try:
        with Session(engine) as session:
            session.add(ActivityEvent(kind=kind, status=status, detail=detail[:500]))
            session.commit()
    except Exception as e:  # logging must never break the task it describes
        logger.debug("log_activity failed: %s", e)
