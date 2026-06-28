# 🐟 Sturdy Fishstick — Personal Job Radar

A self-hosted job search dashboard that automatically scrapes, scores, and organises job listings using a local LLM. Everything runs on your machine — no cloud, no subscriptions beyond a free Serper API key.

---

## What it does

- **Auto-scans** Google Jobs + LinkedIn 4× per day for roles matching your profile
- **Scores each listing 0–10** using Ollama (phi3:mini) against your skills and target roles
- **Groups listings by country** with one-click region filter cards
- **Kanban tracker** to move applications through stages (Applied → Screening → Interview → Offer)
- **AI cover letter and resume tips** for any job, generated locally
- **Fishstick AI chat** — ask questions about jobs, your resume, or the app
- **Puff & Brownie** — two character companions (Jigglypuff + Charizard) with distinct personalities, each powered by the local model
- **Email notifications** with iCal attachments for high-scoring listings (optional)
- **CSV export** of your full job list

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11+ | `python3 --version` |
| Node.js | 18+ | `node --version` |
| [Ollama](https://ollama.com) | latest | Must be running locally |
| [Serper.dev](https://serper.dev) account | free | 2 500 free searches/month |

---

## Quick start

### 1 — Clone and set up

```bash
git clone <repo-url>
cd sturdy-fishstick
chmod +x setup.sh start.sh
./setup.sh          # one-time: creates venv, installs deps, pulls phi3:mini
```

`setup.sh` does the following automatically:
- Checks Python 3.11+ and Node 18+
- Creates `backend/.venv` and installs Python deps
- Copies `backend/.env.example` → `backend/.env` (if it doesn't exist)
- Runs `ollama pull phi3:mini`
- Runs `npm install` in `frontend/`
- Creates `backend/Resume/` and `backend/data/` directories

### 2 — Add your Serper API key

Get a free key at <https://serper.dev> (2 500 searches/month, no credit card needed for the free tier).

Open `backend/.env` and set:

```bash
SERPER_API_KEY=your_key_here
```

### 3 — Edit your profile

Open `backend/config.yaml` and update the `profile` section to match your background:

```yaml
profile:
  name: "Your Name"
  positions:
    - "Software Engineer Intern"
    - "Machine Learning Engineer Intern"
  expertise:
    - "Python"
    - "PyTorch"
    - "Machine Learning"
  resume_summary: |
    Brief background paragraph used by the LLM to score jobs.
    Include your degree, key skills, and what you're looking for.
  location_preference:
    - "United States"
    - "Germany"
    - "Canada"
  remote_ok: true
  relocation_ok: false
```

The `location_preference` list drives both the search queries and the **By Region** country cards on the dashboard. Add as many countries as you like.

### 4 — Add your resume (optional but recommended)

The resume enables the **Resume Tips** and **AI cover letter** features and gives Fishstick AI full context about your background.

```bash
# Parse a PDF or DOCX resume into plain text:
python parse_resume.py /path/to/your/resume.pdf

# The parsed text lands in backend/Resume/<filename>.txt
# You can add multiple resumes — all are loaded together
```

You can also drop `.txt` or `.md` files directly into `backend/Resume/` if you prefer to copy-paste.

### 5 — Launch

```bash
./start.sh
```

Then open **<http://localhost:5173>** in your browser.

The backend API runs at <http://localhost:8001> (interactive docs at <http://localhost:8001/docs>).

---

## Dashboard walkthrough

### Metric cards
Four cards at the top show live stats. **Click any card to filter the job list:**

| Card | Filter applied |
|------|----------------|
| New today | All jobs found in the last 24 hours |
| Priority matches | Jobs scored ≥ your priority threshold |
| Applications | Jobs you've marked as "applied" |
| Total indexed | All jobs (clears other filters) |

Click the same card again to clear the filter.

### By Region
A horizontal scrollable row of country cards, one per detected country in your results. Click a card to filter the list to that country. Click **Clear** (top-right of the row) or click the active card again to reset.

### Job cards
Each card shows: company avatar (initial letter), job title, match score (0–10 circle), country chip, source (Google / LinkedIn), and time since found. Click a card to expand:

| Action | What it does |
|--------|-------------|
| Status pills | Move the job: `new → saved → applied → screen → interview → offer → rejected` |
| ✦ Cover Letter | Generates a tailored cover letter via Ollama |
| 📄 Resume Tips | Compares your resume against the JD, gives section-by-section advice |
| ✉ Notify | Sends a one-off HTML email + `.ics` calendar reminder (priority jobs only) |
| Deadline picker | Set an application deadline; card border turns amber when ≤ 7 days away |
| Notes | Freeform notes saved to the database |
| Ask AI | Opens the Fishstick AI chat with this job pre-loaded as context |

### Job Collections
The **📦 Job Collections** accordion (collapsed by default) holds aggregate listings — job board search pages, batch postings, and similar non-individual URLs. These are kept separate so they don't clutter the main list.

### Tracker (Kanban)
Click **Tracker** in the sidebar. Drag job cards between columns to track your pipeline:
`Applied → Screening → Interview → Offer / Rejected`

### Trends tab
Click the **Trends** segment at the top of the Dashboard to see:
- **Weekly** — bar chart of new jobs and priority matches per week (last 4 weeks)
- **Daily (14d)** — day-by-day breakdown
- **By Country** — horizontal bar chart of total jobs indexed per country

### Settings
Edit your profile, search configuration, scheduler times, email notification settings, and LLM model directly in the browser. Changes save to `backend/config.yaml` and take effect immediately — no restart needed.

---

## Fishstick AI (main chat)

Click **Ask Fishstick** in the sidebar. The assistant has access to:
- Your full profile and resume content
- Every job in your database
- Full knowledge of all app features

**Attach a specific job:** Click **Ask AI** on an expanded job card. The assistant switches context to that listing automatically.

---

## Puff & Brownie

Two character companions sit in the bottom-right corner of every page:

- **Puff** (Jigglypuff) — enthusiastic, encouraging, emoji-heavy. Great for resume pep talks and motivation.
- **Brownie** (Charizard) — chill, straight-talking, no fluff. Good for honest feedback and priority calls.

Click either character to open their chat bubble. Both run on the same local Ollama model with different system prompts. The main Fishstick chat and the character chats are independent.

---

## Configuration reference (`backend/config.yaml`)

```yaml
search:
  sources:
    - google_jobs      # Google Jobs API via Serper
    - linkedin         # LinkedIn site-search via Serper
  time_filter: "month" # "week" | "month" | "3months"
  max_results_per_query: 20
  extra_keywords:      # optional extra search terms
    - "remote"
  company_blacklist:   # companies to skip entirely
    - "Some Staffing Agency"
  company_whitelist:   # if non-empty, only match these companies

scheduler:
  times:               # 24-hour, local timezone — 4 scans/day by default
    - "08:00"
    - "12:00"
    - "17:00"
    - "21:00"
  timezone: "America/Chicago"

llm:
  model: "phi3:mini"   # any model you have pulled in Ollama
  priority_threshold: 7  # score >= this → marked Priority
  batch_size: 10

notifications:
  email:
    enabled: false
    to: "you@example.com"
    from_addr: "you@gmail.com"
    smtp_host: "smtp.gmail.com"
    smtp_port: 587
    score_threshold: 8   # only notify for scores >= this
```

---

## Email notifications (optional)

1. Enable 2-factor authentication on your Gmail account
2. Generate a **Gmail App Password**: Google Account → Security → App Passwords
3. Add it to `backend/.env`:
   ```
   SMTP_APP_PASSWORD=your_16_char_app_password
   ```
4. In Settings (or `config.yaml`), set `notifications.email.enabled: true` and fill in `to` and `from_addr`

Notifications fire automatically after each scan for jobs scoring ≥ `score_threshold`. Each email includes an `.ics` calendar attachment as a "apply by tomorrow" reminder.

---

## LinkedIn direct scraper (optional)

Uses the unofficial `linkedin-api` library with a LinkedIn account to fetch additional listings beyond what Serper returns.

```bash
# 1. Create a throwaway LinkedIn account (don't use your main profile)
# 2. Install the library
cd backend && .venv/bin/pip install linkedin-api

# 3. Add credentials to backend/.env
LINKEDIN_EMAIL=dummy@example.com
LINKEDIN_PASSWORD=yourpassword

# 4. Restart — the scraper activates automatically
```

> **Warning:** LinkedIn may block accounts that scrape heavily. Use a dedicated dummy account.

---

## Switching the LLM

Any model available in Ollama works. Larger models give better scores and cover letters at the cost of speed.

```bash
ollama pull llama3           # better quality, slower
ollama pull mistral          # good balance
ollama pull phi3:mini        # default — fast, small footprint
```

Then update `config.yaml` (or change it in Settings):
```yaml
llm:
  model: "llama3"
```

---

## Project structure

```
sturdy-fishstick/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app + lifespan hooks
│   │   ├── config.py          # Config loader (config.yaml + .env)
│   │   ├── database.py        # SQLModel engine, migrations, country backfill
│   │   ├── models/            # Job, SearchRun SQLModel tables
│   │   ├── routers/           # jobs, chat, config, runs, search
│   │   ├── scrapers/          # serper.py, linkedin_scraper.py
│   │   ├── matcher/           # llm.py — scoring, cover letters, resume advice
│   │   ├── notifications.py   # Email + iCal sender
│   │   └── scheduler.py       # APScheduler setup + search pipeline
│   ├── data/                  # jobradar.db (SQLite, auto-created on first run)
│   ├── Resume/                # Drop parsed resumes here (.txt / .md)
│   ├── config.yaml            # Main config — edit this
│   └── .env                   # Secrets — never commit this
├── frontend/
│   └── src/
│       ├── pages/             # Dashboard, Tracker, Settings
│       └── components/        # JobCard, ChatPanel, CharacterChat, TrendCharts, …
├── parse_resume.py            # CLI: PDF/DOCX → backend/Resume/<name>.txt
├── setup.sh                   # One-time setup script
└── start.sh                   # Launch backend + frontend concurrently
```

---

## Troubleshooting

**No jobs appearing after scan**
- Check that `SERPER_API_KEY` is set in `backend/.env`
- Visit <http://localhost:8001/docs#/runs> to see run history and error messages
- Check the backend terminal for log output

**Ollama errors / cover letter times out**
- Make sure Ollama is running: `ollama serve`
- Confirm the model is pulled: `ollama list`
- phi3:mini can be slow on CPU — scoring timeout is 30s per batch, cover letters 60s, chat 90s

**"By Region" only shows "Other"**
- Jobs scraped before the country detection feature was added have no location data
- Restart the backend once — it runs a backfill on startup that detects countries from job titles
- Future scans will tag new jobs automatically

**Port 8001 already in use**
- Change `app.port` in `config.yaml` and update `frontend/src/api.js` (`const BASE = "http://localhost:PORT"`)

**Scores are all null after a scan**
- Ollama may have timed out scoring the batch
- Switch to a faster model (`phi3:mini`) or reduce `batch_size` in config

**Resume Tips / Cover Letter says "no resume found"**
- Run `python parse_resume.py /path/to/resume.pdf` at the project root
- Or drop a `.txt` / `.md` file directly into `backend/Resume/`

---

## License

MIT — see `LICENSE`.
