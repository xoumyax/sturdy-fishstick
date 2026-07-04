"""Daily Serper credit budget.

Every Serper HTTP call must go through try_spend() first. The counter is a
one-row-per-day table in the main SQLite DB, so the cap holds across restarts
and is shared by all callers (scheduled runs, career-crawl fallback, PhD crawl).
"""
from __future__ import annotations

import logging
from datetime import date

from sqlmodel import Field, Session, SQLModel

from .database import engine

logger = logging.getLogger(__name__)


class SerperUsage(SQLModel, table=True):
    __tablename__ = "serper_usage"

    day: str = Field(primary_key=True)  # YYYY-MM-DD
    calls: int = 0


def _today() -> str:
    return date.today().isoformat()


def calls_today() -> int:
    with Session(engine) as session:
        row = session.get(SerperUsage, _today())
        return row.calls if row else 0


def try_spend(cap: int, n: int = 1) -> bool:
    """Reserve n Serper calls if today's total stays within cap."""
    with Session(engine) as session:
        row = session.get(SerperUsage, _today())
        if row is None:
            row = SerperUsage(day=_today(), calls=0)
        if row.calls + n > cap:
            return False
        row.calls += n
        session.add(row)
        session.commit()
        return True


def cap_reached(cap: int) -> bool:
    return calls_today() >= cap
