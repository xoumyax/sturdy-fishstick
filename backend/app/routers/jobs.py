from __future__ import annotations

import csv
import io
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import nullslast
from sqlmodel import Session, select

from ..config import get_config
from ..database import get_session
from ..matcher.llm import OllamaMatcher
from ..models.job import Job, JobRead, JobUpdate

router = APIRouter(prefix="/jobs", tags=["jobs"])

RESUME_DIR = Path(__file__).parent.parent.parent / "Resume"


def _load_resumes() -> str:
    if not RESUME_DIR.exists():
        return ""
    files = sorted(RESUME_DIR.glob("*.txt")) + sorted(RESUME_DIR.glob("*.md"))
    if not files:
        return ""
    parts = []
    for f in files:
        parts.append(f"--- {f.name} ---\n{f.read_text(encoding='utf-8', errors='ignore')}")
    return "\n\n".join(parts)


@router.get("", response_model=list[JobRead])
def list_jobs(
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    score_min: Optional[float] = Query(None),
    is_priority: Optional[bool] = Query(None),
    country: Optional[str] = Query(None),
    show_aggregates: bool = Query(False),
    only_aggregates: bool = Query(False),
    session: Session = Depends(get_session),
):
    stmt = select(Job)
    if only_aggregates:
        stmt = stmt.where(Job.is_aggregate == True)
    elif not show_aggregates:
        stmt = stmt.where(Job.is_aggregate == False)
    if status:
        stmt = stmt.where(Job.status == status)
    if source:
        stmt = stmt.where(Job.source == source)
    if score_min is not None:
        stmt = stmt.where(Job.match_score >= score_min)
    if is_priority is not None:
        stmt = stmt.where(Job.is_priority == is_priority)
    if country == "Other":
        stmt = stmt.where((Job.country == None) | (Job.country == "Other"))
    elif country:
        stmt = stmt.where(Job.country == country)
    stmt = stmt.order_by(nullslast(Job.match_score.desc()), Job.date_found.desc())
    return session.exec(stmt).all()


@router.get("/export")
def export_jobs_csv(session: Session = Depends(get_session)):
    jobs = session.exec(
        select(Job).where(Job.is_aggregate == False).order_by(nullslast(Job.match_score.desc()))
    ).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "title", "company", "location", "country", "url", "source",
        "match_score", "match_reason", "status", "is_priority",
        "date_posted", "date_found", "deadline", "notes",
    ])
    for job in jobs:
        writer.writerow([
            job.title, job.company, job.location, job.country, job.url, job.source,
            job.match_score, job.match_reason, job.status, job.is_priority,
            job.date_posted, job.date_found, job.deadline, job.notes,
        ])

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sturdy_fishstick_export.csv"},
    )


@router.get("/{job_id}", response_model=JobRead)
def get_job(job_id: str, session: Session = Depends(get_session)):
    job = session.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.patch("/{job_id}", response_model=JobRead)
def update_job(job_id: str, update: JobUpdate, session: Session = Depends(get_session)):
    job = session.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(job, field, value)
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


@router.post("/{job_id}/cover-letter")
async def generate_cover_letter(job_id: str, session: Session = Depends(get_session)):
    job = session.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    cfg = get_config()
    matcher = OllamaMatcher(base_url=cfg.ollama_base_url, model=cfg.llm.model, timeout=60.0)
    text = await matcher.generate_cover_letter(
        title=job.title, company=job.company, description=job.description,
        name=cfg.profile.name, positions=cfg.profile.positions,
        expertise=cfg.profile.expertise, resume_summary=cfg.profile.resume_summary,
    )
    if text is None:
        raise HTTPException(status_code=503, detail="Ollama unavailable or timed out")
    return {"cover_letter": text}


@router.post("/{job_id}/resume-advice")
async def generate_resume_advice(job_id: str, session: Session = Depends(get_session)):
    job = session.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    resume_text = _load_resumes()
    if not resume_text:
        raise HTTPException(
            status_code=404,
            detail="No resume files found. Add .txt or .md files to backend/Resume/",
        )

    cfg = get_config()
    matcher = OllamaMatcher(base_url=cfg.ollama_base_url, model=cfg.llm.model, timeout=90.0)
    advice = await matcher.generate_resume_advice(
        title=job.title, company=job.company, description=job.description,
        resume_text=resume_text, name=cfg.profile.name,
        positions=cfg.profile.positions, expertise=cfg.profile.expertise,
    )
    if advice is None:
        raise HTTPException(status_code=503, detail="Ollama unavailable or timed out")
    return {"advice": advice}


@router.post("/{job_id}/notify")
async def notify_job(job_id: str, session: Session = Depends(get_session)):
    job = session.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    cfg = get_config()
    from ..notifications import send_opportunity_email
    sent = send_opportunity_email(job, cfg)
    if not sent:
        raise HTTPException(status_code=503, detail="Email not configured or failed. Check config.yaml notifications.email section and SMTP_APP_PASSWORD in .env")
    return {"status": "sent"}
