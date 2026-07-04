from __future__ import annotations

import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import nullslast, or_
from sqlmodel import Session, select

from ..config import get_config, profile_for_mode
from ..database import get_session
from ..matcher.llm import OllamaMatcher
from ..models.job import Job, JobRead, JobUpdate
from ..resumes import load_resumes

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _apply_mode(stmt, mode: Optional[str]):
    """phd → only PhD-track jobs; careers → everything else."""
    if mode == "phd":
        return stmt.where(Job.track == "phd")
    if mode == "careers":
        return stmt.where(or_(Job.track != "phd", Job.track == None))
    return stmt


@router.get("", response_model=list[JobRead])
def list_jobs(
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    score_min: Optional[float] = Query(None),
    is_priority: Optional[bool] = Query(None),
    country: Optional[str] = Query(None),
    mode: Optional[str] = Query(None),
    kind: Optional[str] = Query(None),
    show_aggregates: bool = Query(False),
    only_aggregates: bool = Query(False),
    session: Session = Depends(get_session),
):
    stmt = _apply_mode(select(Job), mode)
    if only_aggregates:
        stmt = stmt.where(Job.is_aggregate == True)
    elif not show_aggregates:
        stmt = stmt.where(Job.is_aggregate == False)
    if status:
        stmt = stmt.where(Job.status == status)
    if source:
        stmt = stmt.where(Job.source == source)
    if kind:
        stmt = stmt.where(Job.kind == kind)
    else:
        # Hiring posts live in the LinkedIn panel's Posts tab, not the main list
        stmt = stmt.where(or_(Job.kind != "post", Job.kind == None))
    # score_min=0 must include unscored jobs (NULL >= 0 is NULL → excluded), so skip the filter
    if score_min is not None and score_min > 0:
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
def export_jobs_csv(mode: Optional[str] = Query(None), session: Session = Depends(get_session)):
    stmt = _apply_mode(select(Job), mode)
    jobs = session.exec(
        stmt.where(Job.is_aggregate == False).order_by(nullslast(Job.match_score.desc()))
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
async def generate_cover_letter(job_id: str, mode: Optional[str] = Query(None),
                                session: Session = Depends(get_session)):
    job = session.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    cfg = get_config()
    profile = profile_for_mode(cfg, mode)
    matcher = OllamaMatcher(base_url=cfg.ollama_base_url, model=cfg.llm.model, timeout=60.0)
    text = await matcher.generate_cover_letter(
        title=job.title, company=job.company, description=job.description,
        name=profile.name, positions=profile.positions,
        expertise=profile.expertise, resume_summary=profile.resume_summary,
    )
    if text is None:
        raise HTTPException(status_code=503, detail="Ollama unavailable or timed out")
    return {"cover_letter": text}


@router.post("/{job_id}/resume-advice")
async def generate_resume_advice(job_id: str, mode: Optional[str] = Query(None),
                                 session: Session = Depends(get_session)):
    job = session.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    resume_text = load_resumes(mode or "careers")
    if not resume_text:
        raise HTTPException(
            status_code=404,
            detail="No resume files found. Add PDFs to Resume/Careers/ or Resume/PhD/",
        )

    cfg = get_config()
    profile = profile_for_mode(cfg, mode)
    matcher = OllamaMatcher(base_url=cfg.ollama_base_url, model=cfg.llm.model, timeout=90.0)
    advice = await matcher.generate_resume_advice(
        title=job.title, company=job.company, description=job.description,
        resume_text=resume_text, name=profile.name,
        positions=profile.positions, expertise=profile.expertise,
    )
    if advice is None:
        raise HTTPException(status_code=503, detail="Ollama unavailable or timed out")
    return {"advice": advice}


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: str, session: Session = Depends(get_session)):
    job = session.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    session.delete(job)
    session.commit()


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
