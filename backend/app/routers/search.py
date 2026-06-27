from __future__ import annotations

import asyncio

from fastapi import APIRouter, BackgroundTasks

from ..models.run import SearchRun
from ..scheduler import run_search_pipeline

router = APIRouter(prefix="/search", tags=["search"])


@router.post("/trigger", response_model=dict)
async def trigger_search(background_tasks: BackgroundTasks):
    """Manually kick off a search run in the background."""
    background_tasks.add_task(_run_in_background)
    return {"status": "started", "message": "Search triggered — check /runs for progress"}


async def _run_in_background():
    await run_search_pipeline()
