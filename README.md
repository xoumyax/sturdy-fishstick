# 🐟 Sturdy Fishstick — Personal Job Radar

A self-hosted job search dashboard that automatically scrapes, scores, and organises job listings using a local LLM. Everything runs on your machine — no cloud, no subscriptions beyond a free API key.

> **New here?** Read [GUIDE.md](GUIDE.md) for a full step-by-step walkthrough, including a dedicated section for PhD position searches.

---

## What it does

- **Auto-scans** Google Jobs + LinkedIn 4× per day for roles matching your profile
- **Scores each listing 0–10** using a local Ollama model against your skills and target roles
- **Career page crawler** — scrapes Greenhouse, Lever, and custom career pages from your watchlist; falls back to Playwright for tricky sites
- **GitHub Jobs feed** — pulls daily from `speedyapply/2026-SWE-College-Jobs`
- **PhD search** — dedicated crawl for academic PhD and research positions
- **Floating feed panels** — LinkedIn, Careers, and PhD side panels with company-grouped expanded view
- **Groups listings by country** with one-click region filter cards
- **Kanban tracker** for your application pipeline (Applied → Screening → Interview → Offer)
- **AI cover letter and resume tips** generated locally via Ollama
- **Fishstick AI chat** — ask anything about jobs, your resume, or the app
- **Puff & Brownie** — two character companions for motivation and honest feedback
- **Access from any device** — LAN mode and ngrok remote tunnel built in

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11+ | `python3 --version` |
| Node.js | 18+ | `node --version` |
| [Ollama](https://ollama.com) | latest | Runs the local LLM |
| [Serper.dev](https://serper.dev) | free | 2 500 free searches/month |

---

## Quick start

```bash
git clone <repo-url>
cd sturdy-fishstick
chmod +x setup.sh start.sh
./setup.sh          # one-time: creates venv, installs deps, pulls phi3:mini
```

Add your Serper key to `backend/.env`:
```
SERPER_API_KEY=your_key_here
```

Edit your profile in `backend/config.yaml`, then:
```bash
./start.sh
```

Open **http://localhost:5173**.

---

## Access from other devices

**Same network (office or home LAN):**
```bash
./start.sh
# prints the LAN URL — open http://10.x.x.x:5173 on any device on your network
```

**Different network (internet, mobile hotspot, remote office):**
```bash
# one-time: brew install ngrok && ngrok config add-authtoken <your-token>
./start.sh --remote
# builds frontend, serves everything from port 8001, opens ngrok tunnel
# copy the https://xxxx.ngrok-free.app URL — works from anywhere
```

---

## Ollama memory usage

The model loads only when actively needed:

| State | Memory |
|-------|--------|
| Idle (between scans) | **0 GB** — unloads 2 min after last scoring call |
| During a scheduled scan | ~7 GB for ~5 minutes |
| Active chat or cover letter session | ~7 GB, unloads 5 min after last message |

Model: `phi3:mini` (~2.2 GB on disk). Switch in `config.yaml` or Settings → Config, then `ollama pull <model>`.

---

## Configuration reference (`backend/config.yaml`)

```yaml
profile:
  name: "Your Name"
  positions:
    - "Software Engineer Intern"
    - "Machine Learning Engineer Intern"
  expertise:
    - "Python"
    - "PyTorch"
  resume_summary: |
    Your background paragraph used by the LLM for scoring.
  location_preference:
    - "United States"
    - "Germany"
  remote_ok: true
  relocation_ok: false

search:
  sources: [google_jobs, linkedin]
  time_filter: "month"          # week | month | 3months
  max_results_per_query: 20
  extra_keywords: []
  company_blacklist: []
  company_whitelist: []

scheduler:
  times: ["08:00", "12:00", "17:00", "21:00"]
  timezone: "America/Chicago"

llm:
  model: "phi3:mini"
  priority_threshold: 7         # score >= this → Priority badge
  batch_size: 10

notifications:
  email:
    enabled: false
    to: "you@example.com"
    from_addr: "you@gmail.com"
    smtp_host: "smtp.gmail.com"
    smtp_port: 587
    score_threshold: 8
```

---

## Career page watchlist

Upload a JSON file in **Settings → Career Watch** to crawl specific company career pages directly:

```json
{
  "Frontier AI Labs": [
    { "name": "Anthropic", "url": "https://www.anthropic.com/careers" },
    { "name": "OpenAI",    "url": "https://openai.com/careers/" }
  ],
  "Big Tech": [
    { "name": "Google", "url": "https://careers.google.com/" }
  ]
}
```

ATS detection (Greenhouse, Lever) is automatic from the URL. Companies with custom career sites fall back to Playwright headless scraping. A 71-company example is in `company_careers.json`.

---

## Project structure

```
sturdy-fishstick/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app + SPA serving in remote mode
│   │   ├── config.py          # config.yaml + .env loader
│   │   ├── database.py        # SQLite engine, migrations, country backfill
│   │   ├── models/            # Job, SearchRun SQLModel tables
│   │   ├── routers/           # jobs, chat, config_router, runs, search
│   │   ├── scrapers/          # serper, linkedin_scraper, career_crawler, github_jobs
│   │   ├── matcher/llm.py     # Scoring, cover letters, resume advice (Ollama)
│   │   ├── notifications.py   # Email + iCal sender
│   │   └── scheduler.py       # APScheduler pipeline
│   ├── data/
│   │   ├── jobradar.db            # SQLite (auto-created)
│   │   └── career_watchlist.json  # Uploaded via Settings
│   ├── Resume/                # .txt / .md resumes for AI features
│   ├── config.yaml            # Main config — edit this
│   └── .env                   # Secrets — never commit
├── frontend/src/
│   ├── pages/                 # Dashboard, Tracker, Settings
│   └── components/            # JobCard, ChatPanel, FloatingJobPanel, …
├── company_careers.json       # 71-company example watchlist
├── parse_resume.py            # PDF/DOCX → backend/Resume/
├── setup.sh                   # One-time setup
└── start.sh                   # Dev launch; --remote for ngrok mode
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No jobs after scan | Check `SERPER_API_KEY` in `backend/.env`; see run history in Settings → Run History |
| Ollama times out | Reduce `batch_size` in config, or switch to a faster model |
| "By Region" shows only Other | Restart backend once — country backfill runs on startup |
| Resume Tips: "no resume found" | Run `python parse_resume.py resume.pdf` or drop a `.txt` into `backend/Resume/` |
| Career crawl returns 0 for a company | Playwright fallback will try the URL directly; check logs for details |
| ngrok auth error | `ngrok config add-authtoken <token>` — get token from dashboard.ngrok.com |
| Port 8001 in use | Change `app.port` in `config.yaml` |

---

## License

MIT — see `LICENSE`.
