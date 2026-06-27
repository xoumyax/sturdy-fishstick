from __future__ import annotations

import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from ..config import get_config
from ..database import get_session
from ..matcher.llm import OllamaMatcher
from ..models.job import Job, JobRead, JobUpdate

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[JobRead])
def list_jobs(
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    score_min: Optional[float] = Query(None),
    is_priority: Optional[bool] = Query(None),
    session: Session = Depends(get_session),
):
    stmt = select(Job)
    if status:
        stmt = stmt.where(Job.status == status)
    if source:
        stmt = stmt.where(Job.source == source)
    if score_min is not None:
        stmt = stmt.where(Job.match_score >= score_min)
    if is_priority is not None:
        stmt = stmt.where(Job.is_priority == is_priority)
    stmt = stmt.order_by(Job.date_found.desc())
    return session.exec(stmt).all()


@router.get("/export")
def export_jobs_csv(session: Session = Depends(get_session)):
    jobs = session.exec(select(Job).order_by(Job.date_found.desc())).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "title", "company", "location", "url", "source",
        "match_score", "match_reason", "status", "is_priority",
        "date_posted", "date_found", "deadline", "notes",
    ])
    for job in jobs:
        writer.writerow([
            job.title, job.company, job.location, job.url, job.source,
            job.match_score, job.match_reason, job.status, job.is_priority,
            job.date_posted, job.date_found, job.deadline, job.notes,
        ])

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=jobradar_export.csv"},
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
        title=job.title,
        company=job.company,
        description=job.description,
        name=cfg.profile.name,
        positions=cfg.profile.positions,
        expertise=cfg.profile.expertise,
        resume_summary=cfg.profile.resume_summary,
    )

    if text is None:
        raise HTTPException(status_code=503, detail="Ollama unavailable or timed out")

    return {"cover_letter": text}
