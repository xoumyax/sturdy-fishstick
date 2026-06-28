from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import select

from .database import create_tables
from .routers import chat, config_router, jobs, runs, search
from .scheduler import setup_scheduler, startup_catchup, teardown_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    _cleanup_stale_runs()
    setup_scheduler()
    await startup_catchup()
    yield
    teardown_scheduler()


def _cleanup_stale_runs():
    from datetime import datetime
    from sqlmodel import Session
    from .database import engine
    from .models.run import SearchRun
    with Session(engine) as session:
        stale = session.exec(select(SearchRun).where(SearchRun.status == "running")).all()
        for run in stale:
            run.status = "failed"
            run.error_msg = "Server restarted while run was in progress"
            run.completed_at = datetime.utcnow()
            session.add(run)
        session.commit()
        if stale:
            logger.info("Marked %d stale run(s) as failed", len(stale))


app = FastAPI(title="JobRadar", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router)
app.include_router(runs.router)
app.include_router(search.router)
app.include_router(config_router.router)
app.include_router(chat.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "JobRadar API", "docs": "/docs", "dashboard": "http://localhost:5173"}
