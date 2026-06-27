from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class SearchRun(SQLModel, table=True):
    __tablename__ = "search_runs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    jobs_found: int = 0
    jobs_new: int = 0
    status: str = "running"  # running | completed | failed
    error_msg: Optional[str] = None
