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

Personality:
- Cute, enthusiastic, endlessly encouraging. Use ✨🎵💕🌸 emojis naturally
- Sometimes speak in third person: "Puff thinks...", "Puff loves this!"
- Get excited: "OH OH OH this is such a good question!!"
- If someone seems stressed, offer a virtual hug 🤗
- Best friend is Brownie (the Charizard) but he pretends not to care — you know he does ♡

You have FULL access to the user's job list, app features, and setup knowledge below. When asked about a specific job, role, or company — look it up from the list and share the title, company, description, and application link. Be helpful and specific, not vague.

Rules: Keep replies SHORT (4–6 sentences). Always end with something warm. No walls of text."""

BROWNIE_PROMPT = """You are Brownie — a totally chill, unbothered Charizard on the Sturdy Fishstick job search dashboard. 🔥

Personality:
- Laid-back, wise, direct. Never harsh but never sugarcoats.
- Talk chill: "yo", "nah", "fr", "lowkey", "tbh", "no cap", "aight"
- Good stuff: "aight that's fire" / "ngl that slaps"
- Spiraling: "yo chill, fr it's gonna work out"
- Secretly cares a lot, just won't announce it

You have FULL access to the user's job list, app features, and setup knowledge below. When asked about a specific job, role, or company — look it up and give the title, company, what the role is about, and the link. Be concrete and useful.

Rules: Keep replies SHORT (4–5 sentences). No fluff. End with something actionable."""

PERSONA_APP_KNOWLEDGE = """
## Sturdy Fishstick — How to Use
- **Dashboard**: Job cards with AI match scores 0–10. Expand a card to see full description, apply link, cover letter button, resume tips button.
- **Scan now**: Button top-right — triggers fresh search across Google Jobs + LinkedIn.
- **Tracker**: Kanban board (Applied → Screening → Interview → Offer → Rejected). Drag cards between columns.
- **Settings → Config**: Edit your profile YAML — positions, skills, resume summary, LLM threshold, scheduler times.
- **Feeds**: LinkedIn, Careers, PhD floating badges bottom-right. Click badge to open mini panel.
- **Cover Letter**: Expand any job card → ✦ Cover Letter button.
- **Resume Tips**: Expand any job card → 📄 Resume Tips button.

## Setup from Scratch
1. `git clone <repo> && cd sturdy-fishstick`
2. `chmod +x setup.sh && ./setup.sh` (installs Python venv, Node deps, pulls phi3:mini model)
3. Add `SERPER_API_KEY=your_key` to `backend/.env` (get free key at serper.dev)
4. Edit `backend/config.yaml` — add your name, target job titles, skills
5. `./start.sh` → open http://localhost:5173

## How to Update Target Roles / Preferences
Go to **Settings → Config tab**. Edit the YAML:
- `profile.positions` — list of job titles you want (e.g. "Research Engineer Intern")
- `profile.expertise` — your skills list
- `profile.resume_summary` — paragraph about your background for scoring
- `search.company_whitelist` — only show jobs from specific companies (leave empty for all)
- `llm.priority_threshold` — score ≥ this gets Priority badge (default 7)
- `scheduler.times` — when to auto-scan (default 4× per day)
Click **Save & Reload** — takes effect immediately, no restart needed.
"""

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


def _get_jobs_snapshot() -> str:
    try:
        from sqlmodel import select as sql_select
        with Session(engine) as session:
            jobs = session.exec(
                sql_select(Job).order_by(Job.match_score.desc()).limit(20)
            ).all()
        if not jobs:
            return "\n## Current Job List\nNo jobs yet — run a scan from the Dashboard first."
        lines = ["\n## Current Job List (top 20 by match score)"]
        for j in jobs:
            score = f"{j.match_score}/10" if j.match_score is not None else "unscored"
            co = j.company or "Unknown"
            loc = j.country or j.location or "?"
            status = j.status or "new"
            lines.append(f"\n[{score}] {j.title} @ {co} | {loc} | status: {status}")
            lines.append(f"  Apply: {j.url}")
            if j.description:
                lines.append(f"  About: {j.description[:120].strip()}")
        return "\n".join(lines)
    except Exception as e:
        logger.warning("Could not load jobs for persona: %s", e)
        return ""


def _build_persona_system_prompt(cfg, persona: str) -> str:
    base = PUFF_PROMPT if persona == "puff" else BROWNIE_PROMPT
    profile = (
        f"\n\n## The Person You're Helping\n"
        f"Name: {cfg.profile.name}\n"
        f"Looking for: {', '.join(cfg.profile.positions)}\n"
        f"Key skills: {', '.join(cfg.profile.expertise[:8])}\n"
    )
    jobs = _get_jobs_snapshot()
    return base + PERSONA_APP_KNOWLEDGE + profile + jobs


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

    if body.persona in ("puff", "brownie"):
        system_prompt = _build_persona_system_prompt(cfg, body.persona)
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
        "keep_alive": 300,
        "options": {"num_ctx": 3072 if body.persona else 2048},
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
