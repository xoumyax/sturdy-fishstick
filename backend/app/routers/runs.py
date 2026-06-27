from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..database import get_session
from ..models.run import SearchRun

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("", response_model=list[SearchRun])
def list_runs(session: Session = Depends(get_session)):
    return session.exec(select(SearchRun).order_by(SearchRun.started_at.desc()).limit(50)).all()
