# JobRadar — Complete Architecture Plan

A locally-hosted job/internship search dashboard that searches multiple sources daily, scores matches with a local LLM, and persists state across restarts. Fully configurable per user profile.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | FastAPI (Python 3.11+) | Async, fast, great for scheduled tasks + REST |
| Database | SQLite via SQLModel | Zero-config, file-based, survives restarts |
| Scheduler | APScheduler (AsyncIOScheduler) | Runs inside the FastAPI process, no separate process needed |
| Search | Serper.dev API | Google Jobs structured results + LinkedIn site search |
| LLM | Ollama with phi3:mini | 2.3 GB VRAM, fast on M1, good reasoning for matching |
| Frontend | React + Vite + TailwindCSS | Fast dev, easy filter/sort UI |
| Config | config.yaml + .env | Human-readable, easy to hand off to another user |

---

## Recommended Ollama Model for Mac M1 8 GB

On M1 with 8 GB unified memory, after OS overhead (~2–3 GB), you have ~5–6 GB available.

- **phi3:mini** (2.3 GB) — Best choice: fast inference, good reasoning, comfortable headroom
- **llama3.2:3b** (2.0 GB) — Also good; slightly less reasoning depth
- **mistral:7b-q4_0** (4.1 GB) — Better quality but tight; may cause swapping under load

Install: `ollama pull phi3:mini`

---

## Project Structure

```
jobradar/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry, lifespan hooks
│   │   ├── config.py            # Loads config.yaml + .env
│   │   ├── database.py          # SQLite engine + session factory
│   │   ├── scheduler.py         # APScheduler setup, run pipeline
│   │   ├── models/
│   │   │   ├── job.py           # Job SQLModel table
│   │   │   └── run.py           # SearchRun history table
│   │   ├── scrapers/
│   │   │   ├── base.py          # Abstract scraper interface
│   │   │   ├── serper.py        # Google Jobs + LinkedIn via Serper.dev
│   │   │   └── indeed.py        # Indeed scraper (optional)
│   │   ├── matcher/
│   │   │   └── llm.py           # Ollama match scoring
│   │   └── routers/
│   │       ├── jobs.py          # GET /jobs, PATCH /jobs/{id}
│   │       ├── runs.py          # GET /runs (search history)
│   │       └── config.py        # GET/POST /config (live reload)
│   ├── data/
│   │   └── jobradar.db          # SQLite file (persists everything)
│   ├── .env                     # API keys (git-ignored)
│   ├── config.yaml              # User profile (committed, per-person)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── JobCard.jsx      # Expandable job card
│   │   │   ├── FilterBar.jsx    # Source / date / score / status filters
│   │   │   ├── ScoreBadge.jsx   # Color-coded 0–10 match badge
│   │   │   └── RunHistory.jsx   # Last N search run results
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx    # Main view: All + Priority tabs
│   │   │   ├── Tracker.jsx      # Kanban: Applied / Interview / Offer
│   │   │   └── Settings.jsx     # Config editor UI
│   │   └── App.jsx
│   ├── index.html
│   └── package.json
├── start.sh                     # One command: starts backend + frontend
└── README.md
```

---

## Database Schema

### jobs table

```sql
CREATE TABLE jobs (
  id            TEXT PRIMARY KEY,        -- UUID
  title         TEXT NOT NULL,
  company       TEXT,
  location      TEXT,
  url           TEXT UNIQUE NOT NULL,    -- dedup key
  description   TEXT,
  source        TEXT,                    -- 'google_jobs' | 'linkedin' | 'indeed'
  date_posted   TIMESTAMP,              -- parsed from listing
  date_found    TIMESTAMP DEFAULT NOW(),
  match_score   REAL,                   -- 0.0–10.0 from LLM
  match_reason  TEXT,                   -- 1–2 sentence LLM explanation
  is_priority   BOOLEAN DEFAULT FALSE,  -- score >= priority_threshold
  status        TEXT DEFAULT 'new',     -- new | saved | applied | screen | interview | offer | rejected
  notes         TEXT,                   -- user freetext
  raw_data      JSON                    -- full source payload for debugging
);
```

### search_runs table

```sql
CREATE TABLE search_runs (
  id            TEXT PRIMARY KEY,
  started_at    TIMESTAMP,
  completed_at  TIMESTAMP,
  jobs_found    INTEGER DEFAULT 0,
  jobs_new      INTEGER DEFAULT 0,      -- net new after dedup
  status        TEXT,                   -- running | completed | failed
  error_msg     TEXT
);
```

---

## Config System (config.yaml)

This is the file you hand off to another user — they only touch this file and `.env`.

```yaml
profile:
  name: "Your Name"
  positions:
    - "Software Engineer Intern"
    - "Machine Learning Engineer"
    - "Research Scientist Intern"
  expertise:
    - "Python"
    - "Machine Learning"
    - "PyTorch"
    - "Computer Vision"
  resume_summary: |
    MS Computer Science student with 2 years experience in ML research.
    Strong Python, PyTorch, computer vision. Published at CVPR 2024.
    Seeking summer 2025 internships in ML/AI.
  location_preference: "United States"
  remote_ok: true
  relocation_ok: false

search:
  sources:
    - google_jobs
    - linkedin
    - indeed
  time_filter: "month"          # week | month | 3months
  max_results_per_query: 20
  extra_keywords: []            # e.g. ["actively hiring", "urgent"]
  company_blacklist:
    - "Some Company I Hate"
  company_whitelist: []         # if set, only returns these companies

scheduler:
  times:
    - "08:00"
    - "14:00"
    - "20:00"
  timezone: "America/Chicago"   # set per user

llm:
  model: "phi3:mini"
  priority_threshold: 7         # score >= this → priority dashboard
  batch_size: 10                # jobs to score per Ollama call

app:
  port: 8000
  host: "127.0.0.1"
```

### PhD-search variant (for your colleague)

She creates her own `config.yaml`:

```yaml
profile:
  name: "Colleague Name"
  positions:
    - "PhD Position"
    - "PhD Studentship"
    - "Doctoral Researcher"
    - "Graduate Research Assistant"
  expertise:
    - "Quantum Computing"
    - "Condensed Matter Physics"
  resume_summary: |
    MSc Physics graduate with focus on quantum systems...
  location_preference: "North America, Europe"
  remote_ok: false

search:
  sources:
    - google_jobs
    - linkedin
  time_filter: "3months"
  extra_keywords:
    - "fully funded"
    - "stipend"
    - "PhD fellowship"
```

Same app, different config. No code changes needed.

---

## .env File

```ini
SERPER_API_KEY=your_serper_dev_key_here
OLLAMA_BASE_URL=http://localhost:11434
```

---

## Search Strategy (Serper.dev)

Serper.dev has a dedicated `/search/google-jobs` endpoint that returns structured data (title, company, location, date, description) — much better than scraping raw HTML.

```python
# For each position × expertise combination:
def build_queries(positions, expertise, location, extra_keywords):
    queries = []
    for pos in positions:
        for skill in expertise[:3]:          # top 3 skills to avoid query explosion
            queries.append(f"{pos} {skill}")
    for pos in positions:
        queries.append(f"{pos} {location}")  # location-specific pass
    if extra_keywords:
        for kw in extra_keywords:
            queries.append(f"{positions[0]} {kw}")
    return list(dict.fromkeys(queries))      # deduplicate query list

# Serper Google Jobs endpoint (structured results):
POST https://google.serper.dev/search
{
  "q": "Machine Learning Engineer Intern Python",
  "gl": "us",
  "hl": "en",
  "num": 20,
  "tbs": "qdr:m"    # posted in last month
}

# For LinkedIn specifically:
POST https://google.serper.dev/search
{
  "q": "site:linkedin.com/jobs Machine Learning Engineer Intern",
  "num": 10
}
```

**Deduplication:** Hash the normalized URL on ingest. A job already in the DB is silently skipped (no status reset, preserving any user edits).

---

## LLM Matching (phi3:mini via Ollama)

```python
MATCH_PROMPT = """
You are a job match evaluator. Given a candidate profile and a job listing,
output a JSON object with two fields:
- "score": integer 0 to 10 (10 = perfect match)
- "reason": one sentence explaining the score

Candidate profile:
Positions seeking: {positions}
Skills: {expertise}
Background: {resume_summary}

Job:
Title: {title}
Company: {company}
Description (first 800 chars): {description[:800]}

Return ONLY valid JSON. No markdown, no explanation outside the JSON.
"""

# Response parsing (phi3:mini returns clean JSON reliably):
async def score_job(job, profile) -> tuple[float, str]:
    response = await ollama.chat(
        model="phi3:mini",
        messages=[{"role": "user", "content": MATCH_PROMPT.format(...)}]
    )
    result = json.loads(response["message"]["content"])
    return result["score"], result["reason"]
```

Score thresholds:
- 0–4: Low match (shown in All Jobs, grayed)
- 5–6: Moderate match (normal display)
- 7–8: Strong match (highlighted, added to Priority tab)
- 9–10: Excellent match (top of Priority tab, notification)

---

## Scheduler Logic

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler(timezone=config.scheduler.timezone)

for time_str in config.scheduler.times:
    h, m = map(int, time_str.split(":"))
    scheduler.add_job(run_search_pipeline, "cron", hour=h, minute=m)

# On startup: check if any scheduled window was missed since last run
async def startup_catchup():
    last_run = db.get_last_run()
    if last_run is None or missed_a_scheduled_window(last_run):
        await run_search_pipeline()
```

The `run_search_pipeline` function:
1. Create `SearchRun` record (status=running)
2. Build query list from config
3. Call Serper.dev for each query (rate-limited, 1 req/sec)
4. Deduplicate against DB by URL
5. Insert new jobs (status=new)
6. Batch-score new jobs with Ollama (10 at a time)
7. Flag `is_priority` where score >= threshold
8. Update `SearchRun` record (status=completed)

---

## REST API (FastAPI)

```
GET  /jobs                  List jobs (filter: status, source, score_min, date_from, is_priority)
GET  /jobs/{id}             Single job detail
PATCH /jobs/{id}            Update status, notes
POST /search/trigger        Manual search run (runs in background)
GET  /runs                  Search run history
GET  /config                Current config (sanitized, no API keys)
POST /config                Update config (triggers live reload)
GET  /stats                 Dashboard stats (new today, priority count, applied count)
```

---

## Frontend (React + Vite)

### Dashboard tabs
- **All Jobs** — full list with filter bar
- **Priority** — score >= threshold, sorted by score desc
- **Applied** — your application pipeline

### Job card (expandable)
- Header: title + company + location + score badge + date posted
- Expand: full description + match reason from LLM
- Actions: Save / Apply / Reject / Open Link
- Notes field: inline edit

### Filter bar
- Date posted (last 24h / week / month / all)
- Source (Google Jobs / LinkedIn / Indeed)
- Min match score (slider)
- Status (new / saved / applied / etc.)
- Location / remote toggle

### Stats bar (top of page)
New today: 12 | Priority matches: 3 | Applied: 7 | Last run: 2h ago

### Manual trigger
"Search now" button → calls `POST /search/trigger` → progress shown in UI.

---

## State Persistence on Restart

Everything lives in `jobradar.db`. On restart:

1. FastAPI starts, SQLite file already exists → all jobs, statuses, notes intact
2. APScheduler checks last run time → if a scheduled window was missed, runs immediately
3. Frontend loads → fetches from `/jobs` → same state as before disconnect

No Redis, no Docker, no background daemons. The SQLite file IS the state.

---

## start.sh (One-command launch)

```bash
#!/bin/bash
echo "Starting JobRadar..."

# Start Ollama in background (if not already running)
ollama serve &>/dev/null &

# Start backend
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Start frontend dev server
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "Backend: http://localhost:8000"
echo "Dashboard: http://localhost:5173"
echo "Press Ctrl+C to stop."

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
```

---

## Suggested Additional Features

These are genuinely worth building, roughly in priority order:

### High value
- **Application tracker (Kanban)**: Drag cards through Applied → Phone Screen → Interview → Offer / Rejected. Stores timestamps per stage. Gives you a birds-eye view of your pipeline.
- **Cover letter generator**: Button on each job card. Calls Ollama with your resume + job description to draft a tailored cover letter. Same model, no extra cost.
- **Deadline tracker**: Optional `deadline` field per job. Dashboard highlights ones expiring in < 7 days.
- **Company blacklist/whitelist in UI**: Not just config.yaml — editable from the Settings page and persisted to DB.

### Medium value
- **Daily email digest**: Using Python's `smtplib` (no external service). Sends a morning summary of new priority matches. Optional; configured in config.yaml.
- **Export to CSV**: One button downloads all current jobs with scores, statuses, dates. Useful for tracking over time.
- **Recruiter notes**: Store recruiter name + contact + LinkedIn URL per job. Useful when you want to follow up.
- **Saved search history**: Show which queries found the most results, so you can tune positions/expertise.

### Nice to have
- **Browser extension**: Highlight jobs you've already seen when browsing LinkedIn/Indeed manually.
- **Duplicate merging**: When the same job appears on both Google Jobs and LinkedIn, merge into one card showing both source links.
- **Interview prep mode**: Given a job description, Ollama generates likely interview questions based on your background.
- **GitHub integration**: Auto-search for "hiring" issues on company repos (common for startups).

---

## Getting Started (Implementation Order)

1. **Week 1**: Backend skeleton — FastAPI app, SQLModel schema, Serper.dev integration, manual search trigger endpoint
2. **Week 1**: Frontend skeleton — job list, basic card, filter bar (hardcoded data first)
3. **Week 2**: Scheduler + persistence — APScheduler, startup catchup, state-on-restart
4. **Week 2**: LLM matching — Ollama integration, score/reason per job, priority flagging
5. **Week 3**: Frontend polish — priority tab, expandable cards, score badges, apply tracker
6. **Week 3**: Config UI — Settings page, live config reload, per-user profiles
7. **Week 4**: Quality of life — cover letter generator, email digest, export, duplicate detection

---

## Notes for PhD Search (Your Colleague)

The app is already configurable enough. She needs to:
1. Clone the repo
2. Edit `config.yaml` with her positions, expertise, and resume summary
3. Add `SERPER_API_KEY` to `.env`
4. Run `ollama pull phi3:mini` (or `llama3.2:3b`)
5. Run `./start.sh`

No code changes. The scheduler, matching logic, dashboard, and persistence all work identically. The only meaningful difference is she may want `time_filter: "3months"` for PhD positions (which are posted less frequently than industry jobs) and should add `extra_keywords: ["funded", "stipend", "fellowship"]` to her search config.
