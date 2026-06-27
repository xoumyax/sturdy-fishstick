from __future__ import annotations

import yaml
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import CONFIG_PATH, get_config, reload_config
from ..scheduler import reload_scheduler

router = APIRouter(prefix="/config", tags=["config"])


@router.get("")
def get_current_config():
    cfg = get_config()
    return {
        "profile": {
            "name": cfg.profile.name,
            "positions": cfg.profile.positions,
            "expertise": cfg.profile.expertise,
            "resume_summary": cfg.profile.resume_summary,
            "location_preference": cfg.profile.location_preference,
            "remote_ok": cfg.profile.remote_ok,
            "relocation_ok": cfg.profile.relocation_ok,
        },
        "search": {
            "sources": cfg.search.sources,
            "time_filter": cfg.search.time_filter,
            "max_results_per_query": cfg.search.max_results_per_query,
            "extra_keywords": cfg.search.extra_keywords,
            "company_blacklist": cfg.search.company_blacklist,
            "company_whitelist": cfg.search.company_whitelist,
        },
        "scheduler": {
            "times": cfg.scheduler.times,
            "timezone": cfg.scheduler.timezone,
        },
        "llm": {
            "model": cfg.llm.model,
            "priority_threshold": cfg.llm.priority_threshold,
            "batch_size": cfg.llm.batch_size,
        },
        "app": {
            "port": cfg.app.port,
            "host": cfg.app.host,
        },
    }


class ConfigUpdate(BaseModel):
    yaml_content: str


@router.post("")
def update_config(body: ConfigUpdate):
    """Replace config.yaml content and hot-reload the app config + scheduler."""
    try:
        parsed = yaml.safe_load(body.yaml_content)
    except yaml.YAMLError as e:
        raise HTTPException(status_code=400, detail=f"Invalid YAML: {e}")

    required_keys = {"profile", "search", "scheduler", "llm", "app"}
    missing = required_keys - set(parsed.keys())
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing config sections: {missing}")

    CONFIG_PATH.write_text(body.yaml_content)
    new_cfg = reload_config()
    reload_scheduler()

    return {"status": "reloaded", "profile_name": new_cfg.profile.name}


@router.get("/stats")
def get_stats():
    from datetime import datetime, timedelta

    from sqlmodel import Session, func, select

    from ..database import engine
    from ..models.job import Job
    from ..models.run import SearchRun

    with Session(engine) as session:
        total = session.exec(select(func.count(Job.id))).one()
        priority = session.exec(select(func.count(Job.id)).where(Job.is_priority == True)).one()
        applied = session.exec(select(func.count(Job.id)).where(Job.status == "applied")).one()

        cutoff = datetime.utcnow() - timedelta(hours=24)
        new_today = session.exec(
            select(func.count(Job.id)).where(Job.date_found >= cutoff)
        ).one()

        last_run = session.exec(
            select(SearchRun).where(SearchRun.status == "completed").order_by(SearchRun.completed_at.desc())
        ).first()

    return {
        "total_jobs": total,
        "new_today": new_today,
        "priority_matches": priority,
        "applied": applied,
        "last_run": last_run.completed_at.isoformat() if last_run else None,
    }
