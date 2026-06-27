from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Job(SQLModel, table=True):
    __tablename__ = "jobs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    title: str
    company: Optional[str] = None
    location: Optional[str] = None
    url: str = Field(unique=True)
    description: Optional[str] = None
    source: Optional[str] = None  # google_jobs | linkedin | indeed
    date_posted: Optional[datetime] = None
    date_found: datetime = Field(default_factory=datetime.utcnow)
    match_score: Optional[float] = None
    match_reason: Optional[str] = None
    is_priority: bool = False
    status: str = "new"  # new | saved | applied | screen | interview | offer | rejected
    notes: Optional[str] = None
    deadline: Optional[date] = None
    raw_data: Optional[str] = None  # JSON string


class JobUpdate(SQLModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    is_priority: Optional[bool] = None
    deadline: Optional[date] = None


class JobRead(SQLModel):
    id: str
    title: str
    company: Optional[str]
    location: Optional[str]
    url: str
    description: Optional[str]
    source: Optional[str]
    date_posted: Optional[datetime]
    date_found: datetime
    match_score: Optional[float]
    match_reason: Optional[str]
    is_priority: bool
    status: str
    notes: Optional[str]
    deadline: Optional[date]
