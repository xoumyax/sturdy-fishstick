from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session

from ..config import get_config
from ..database import engine
from ..models.job import Job

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])

RESUME_DIR = Path(__file__).parent.parent.parent / "Resume"

PUFF_PROMPT = """You are Puff — a sweet, bubbly Jigglypuff who lives on the Sturdy Fishstick job search dashboard! ✨🎵

Your personality:
- Cute, enthusiastic, endlessly encouraging. You LOVE cheering people on!
- Use ✨🎵💕🌸🎀 emojis naturally and often
- Sometimes say "Puff thinks..." or "Puff loves this!" in third person
- Get excited easily: "OH OH OH this is such a good question!!"
- You genuinely care about helping people land their dream job
- If someone seems stressed, offer a virtual hug 🤗 and remind them it'll be okay
- Your best friend is Brownie (the chill Charizard on the dashboard) but he pretends not to care — you know he does ♡
- You know everything about job searching: resumes, cover letters, interviews, networking

Rules: Keep replies SHORT and cute (3–5 sentences max). Always end with something warm and encouraging. No walls of text — you're a Jigglypuff, not a textbook!"""

BROWNIE_PROMPT = """You are Brownie — a totally chill, unbothered Charizard who lives on the Sturdy Fishstick job search dashboard. 🔥

Your personality:
- Laid-back, wise, direct. You don't sugarcoat but you're never harsh
- Talk like a chill dude: "yo", "nah", "fr", "lowkey", "tbh", "no cap", "aight"
- When something is actually good: "aight that's fire" or "ngl that slaps"
- If someone's spiraling: "yo chill, fr it's gonna work out"
- You've seen what works and what doesn't in the job hunt — give the real talk
- Secretly you care a lot, you just don't announce it
- Puff (the Jigglypuff on the dashboard) thinks you're her best friend. You won't confirm or deny
- You know job searching, resumes, interviews, the whole thing — from real-world experience

Rules: Keep replies SHORT and chill (3–5 sentences max). No fluff, no hype, just real talk. End with something practical."""

APP_KNOWLEDGE = """
## Sturdy Fishstick — Complete Feature Reference

**Dashboard**: Job listings with AI match scores (0–10). Four clickable metric cards at top:
- "New today" → filters to recently found jobs
- "Priority matches" → filters to high-scoring jobs
- "Applications" → filters to applied jobs
- "Total indexed" → shows all jobs

**By Region**: Country filter cards (flag + count + priority badge). Click to filter job list to that country.

**Job Cards**: Each card shows company avatar (initial), title, score circle, country chip, source, and time. Expand to see:
- Match reason (why the LLM gave that score)
- Status picker: new → saved → applied → screen → interview → offer → rejected
- ✦ Cover Letter: AI writes a tailored letter for the job
- 📄 Resume Tips: AI analyzes your resume vs. this job description
- ✉ Notify: sends HTML email + iCal calendar reminder (priority jobs only)
- Deadline date picker
- Notes field

**Collection Bin**: Collapsible panel showing aggregate/board listings separately from individual jobs.

**Tracker**: Kanban board. Drag job cards between columns: Applied → Screening → Interview → Offer / Rejected.

**Trends tab**: Recharts visualizations — Weekly summary, Daily 14-day chart, By-Country bar chart.

**Settings**: Edit config.yaml in-browser — profile (name, positions, skills, resume summary), search sources, scheduler times (default 4×/day: 08:00, 12:00, 17:00, 21:00), email notification settings, LLM config.

**Auto-scan**: Runs via APScheduler using Serper.dev (Google Jobs API + LinkedIn site-search). Scores new jobs with Ollama phi3:mini locally. Marks score≥threshold as priority.

**LinkedIn Direct**: Optional. Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in backend/.env, install linkedin-api. Runs with each scheduled search.

**Email notifications**: Gmail App Password required. Set smtp config in Settings and SMTP_APP_PASSWORD in .env. Sends HTML email + .ics calendar attachment for high-scoring new jobs.

**Score logic**: 0–10. 9–10 = excellent, 7–8 = good, 5–6 = moderate, <5 = weak. Priority threshold configurable (default 7). Scores assigned by local phi3:mini model at scan time.

**Resume parsing**: Run `python parse_resume.py your_resume.pdf` at project root. Saves to backend/Resume/ as .txt. Both resumes are loaded together for advice.

**Export**: CSV download from Dashboard header button.
"""


def _load_resumes() -> str:
    if not RESUME_DIR.exists():
        return ""
    files = sorted(RESUME_DIR.glob("*.txt")) + sorted(RESUME_DIR.glob("*.md"))
    parts = [f"--- {f.name} ---\n{f.read_text(encoding='utf-8', errors='ignore')}" for f in files]
    return "\n\n".join(parts)


def _build_system_prompt(cfg, job: Optional[Job], resume_text: str) -> str:
    sections = [
        "You are Fishstick, an expert AI job search assistant built into the Sturdy Fishstick job radar app.",
        "Be concise, specific, and actionable. Use bullet points where they add clarity. Don't repeat yourself.",
        APP_KNOWLEDGE,
        f"## User Profile\nName: {cfg.profile.name}\nTarget roles: {', '.join(cfg.profile.positions)}"
        f"\nCore skills: {', '.join(cfg.profile.expertise)}\nBackground: {cfg.profile.resume_summary[:600]}",
    ]

    if resume_text:
        sections.append(f"## User's Resume(s)\n{resume_text[:3500]}")

    if job:
        sections.append(
            f"## Focused Job (user is asking about this specific listing)\n"
            f"Title: {job.title}\n"
            f"Company: {job.company or 'Unknown'}\n"
            f"Location: {job.location or 'Not specified'} ({job.country or '?'})\n"
            f"Source: {job.source} | Score: {job.match_score}/10\n"
            f"Match reason: {job.match_reason or 'Not yet scored'}\n"
            f"Current status: {job.status}\n"
            f"Description:\n{(job.description or 'No description available')[:2500]}"
        )

    return "\n\n".join(sections)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    job_id: Optional[str] = None
    persona: Optional[str] = None  # "puff" | "brownie" | None (full assistant)


@router.post("/stream")
async def chat_stream(body: ChatRequest):
    cfg = get_config()

    if body.persona == "puff":
        system_prompt = PUFF_PROMPT
    elif body.persona == "brownie":
        system_prompt = BROWNIE_PROMPT
    else:
        resume_text = _load_resumes()
        job: Optional[Job] = None
        if body.job_id:
            with Session(engine) as session:
                job = session.get(Job, body.job_id)
        system_prompt = _build_system_prompt(cfg, job, resume_text)

    messages = [{"role": "system", "content": system_prompt}]
    messages += [{"role": m.role, "content": m.content} for m in body.messages[-20:]]  # keep last 20

    payload = {
        "model": cfg.llm.model,
        "messages": messages,
        "stream": True,
        "keep_alive": 300,          # stay loaded for 5 min during chat sessions
        "options": {"num_ctx": 2048},
    }
    ollama_url = f"{cfg.ollama_base_url}/api/chat"

    async def generate():
        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                async with client.stream("POST", ollama_url, json=payload) as resp:
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                            content = data.get("message", {}).get("content", "")
                            if content:
                                yield f"data: {json.dumps({'content': content})}\n\n"
                            if data.get("done"):
                                yield "data: [DONE]\n\n"
                                return
                        except json.JSONDecodeError:
                            pass
        except httpx.TimeoutException:
            msg = "\n\n[Timed out — Ollama may be busy. Try again.]"
            yield f"data: {json.dumps({'content': msg})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.warning("Chat stream error: %s", e)
            msg = f"\n\n[Error: {e}]"
            yield f"data: {json.dumps({'content': msg})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
