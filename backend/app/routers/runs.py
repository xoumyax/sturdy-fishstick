from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..database import get_session
from ..models.run import SearchRun

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("", response_model=list[SearchRun])
def list_runs(session: Session = Depends(get_session)):
    return session.exec(select(SearchRun).order_by(SearchRun.started_at.desc()).limit(50)).all()


@router.get("/logs")
def activity_logs(session: Session = Depends(get_session)):
    """Unified activity feed for the Logs page: every scan/crawl/scoring event,
    plus live counters. A kind whose latest event is 'started' is ongoing."""
    from sqlmodel import func

    from ..activity import ActivityEvent
    from ..config import get_config
    from ..models.job import Job
    from ..serper_budget import calls_today

    events = session.exec(
        select(ActivityEvent).order_by(ActivityEvent.ts.desc()).limit(120)
    ).all()

    # Ongoing = latest event per kind is a bare "started"
    ongoing = []
    seen: set[str] = set()
    for e in events:  # newest first
        if e.kind in seen:
            continue
        seen.add(e.kind)
        if e.status == "started":
            ongoing.append(e.kind)

    pending = session.exec(
        select(func.count(Job.id)).where(Job.match_score == None, Job.is_aggregate == False)
    ).one()
    scored_phd = session.exec(
        select(func.count(Job.id)).where(Job.track == "phd", Job.match_score != None)
    ).one()

    cfg = get_config()
    return {
        "events": [
            {"ts": e.ts.isoformat(), "kind": e.kind, "status": e.status, "detail": e.detail}
            for e in events
        ],
        "ongoing": ongoing,
        "pending_scores": pending,
        "phd_scored": scored_phd,
        "serper_today": calls_today(),
        "serper_cap": cfg.search.serper_daily_cap,
    }
