# 🐟 Sturdy Fishstick — Personal Job & PhD Radar

A self-hosted job search dashboard that automatically scrapes, scores, and organises listings using local LLMs. Everything runs on your machine — no cloud, no subscriptions beyond a free API key.

It runs **two dashboards in one app**: **My Careers** (industry internships/jobs) and **PhD** (funded doctoral positions), each with its own profile, search config, scoring, tracker, and AI context. Switch with the toggle under the sidebar logo.

> **New here?** Read [GUIDE.md](GUIDE.md) for a full step-by-step walkthrough, including the dedicated PhD-track setup.

---

## What it does

- **Dual Mode** — My Careers / PhD toggle; every page, panel, feed, and AI feature is scoped to the active mode
- **Daily auto-scan** — Google Jobs (Serper, budget-capped), real LinkedIn listings (jobspy, free), GitHub internship repos
- **AI scoring 0–10** — a local model answers categorical questions (real job? level? field match? skills overlap?) mapped to a deterministic score; senior roles and aggregate pages are auto-filtered without an LLM call
- **Career page crawler** — Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee JSON APIs; Playwright fallback for custom sites; **Discover** button finds new companies hiring for your keywords
- **PhD search** — institution-whitelist Serper queries, academic boards (EURAXESS, jobs.ac.uk), PhD LinkedIn listings and hiring posts, optional funded-only filter
- **LinkedIn feed** — Listings and hiring-Posts tabs, in both modes, fetched free via jobspy
- **Logs page** — live view of every crawl/scan/scoring pass: running, done (with counts), or failed (with reason)
- **Kanban tracker** — Applied → Screening → Interview → Offer, per mode, with **manual entry** for roles you applied to elsewhere; every card opens a full-detail drawer
- **AI cover letters & resume tips** — generated locally against your actual (mode-specific) resume
- **RAG chat** — Fishstick, Puff & Brownie answer with exact numbers from your database (FTS5 retrieval, no hallucinated counts); chats expand to half/full screen
- **Serper budget guard** — hard daily cap (default 10 calls) with query rationing; a 2,500-credit budget lasts 6+ months
- **Access from any device** — LAN mode and ngrok remote tunnel built in

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.10+ | `python3 --version` |
| Node.js | 18+ | `node --version` |
| [Ollama](https://ollama.com) | latest | Runs the local LLMs |
| [Serper.dev](https://serper.dev) | free key | used sparingly — hard-capped per day |

---

## Quick start

```bash
git clone <repo-url>
cd sturdy-fishstick
chmod +x setup.sh start.sh
./setup.sh          # one-time: venv, deps, pulls qwen3:1.7b + LFM2.5-1.2B
```

Add your Serper key to `backend/.env`:
```
SERPER_API_KEY=your_key_here
```

Edit your profile in `backend/config.yaml` (and the PhD profile in `backend/phd_config.yaml`), then:
```bash
./start.sh
```

Open **http://localhost:5173** (dev) or **http://localhost:8001** (built UI).

---

## Resumes (PDF parsing)

The AI features (Resume Tips, cover letters, chat) read plain-text resumes from `backend/Resume/`. Tag filenames by track: `MyResume___CAREER.txt`, `HerCV___PHD.txt` — each mode loads only its own.

To convert a PDF/DOCX (or any document) to clean text, use the bundled **Docling** parser. It has its own, heavier dependency set — install it in a **separate environment** from `requirements_pdfparser.txt`:

```bash
python3 -m venv .venv-pdf && source .venv-pdf/bin/activate
pip install -r requirements_pdfparser.txt
python parse_resume.py /path/to/resume.pdf        # → backend/Resume/resume.txt
deactivate
```

(Quick alternative: drop PDFs into `Resume/Careers/` or `Resume/PhD/` at the repo root — they're extracted with pypdf automatically, with slightly rougher text than Docling.)

### Apple Silicon vs. Intel Mac

`requirements_pdfparser.txt` pins `torch==2.11.0`, which only resolves on Apple
Silicon (and Linux/Windows). **On an Intel Mac (`uname -m` → `x86_64`) it will
fail** — PyPI ships no PyTorch wheel past 2.2.2 for Intel macOS, and 2.2.2 in
turn clashes with the modern numpy/transformers that current Docling pulls in.

Two ways around it on Intel Mac:

- **Easiest** — skip Docling and use the pypdf quick alternative above (drop the
  PDF into `Resume/Careers/` or `Resume/PhD/`).
- **For Docling quality** — get a newer PyTorch from conda-forge, which *does*
  build for Intel macOS:
  ```bash
  conda create -n docling-pdf -c conda-forge python=3.12 pytorch torchvision -y
  conda activate docling-pdf
  pip install docling          # NOT requirements_pdfparser.txt
  python parse_resume.py /path/to/resume.pdf --output MyCV___PHD.txt
  ```

---

## Local models & memory

| Role | Model | Disk | Behaviour |
|------|-------|------|-----------|
| Scoring (batch) | `qwen3:1.7b` (thinking) | 1.4 GB | loaded once per pass, **unloaded after** |
| Generation & chat | `LFM2.5-1.2B-Instruct` | 0.7 GB | loads on demand, auto-unloads after 5 min idle |

Scoring passes are single-flight (never stack) and time-boxed (`llm.max_scoring_minutes`); every pass ends by evicting **all** loaded models, so RAM is free between runs. Model choices and the benchmark behind them: [future.md](future.md) — including the upgrade path for a bigger machine.

---

## Configuration

**`backend/config.yaml`** — app settings + your careers profile:

```yaml
profile:            # name, positions, expertise, resume_summary, locations
search:
  sources: [google_jobs]
  serper_daily_cap: 10        # hard cap on Serper API calls per day
  time_filter: "month"
  company_whitelist: []       # optional
scheduler:
  times: ["08:00"]            # one scan per day keeps the budget safe
  timezone: "America/Chicago"
llm:
  model: "hf.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF:latest"
  scoring_model: "qwen3:1.7b"
  priority_threshold: 7
  max_scoring_minutes: 240    # time-box per scoring pass
notifications:
  email: { enabled: false }   # Gmail app-password based, optional
```

**`backend/phd_config.yaml`** — the PhD track, kept separate so two people can share one install:

```yaml
phd_search:
  time_filter: "3months"       # PhD cycles are slower
  funding_required: true       # only surface funded positions
  extra_keywords: ["fully funded PhD", "computer vision", ...]
  institution_whitelist: ["Johns Hopkins University", ...]
phd_profile:                   # name, positions, expertise, resume_summary
```

When `phd_config.yaml` exists, its sections override `config.yaml`'s. The Settings → PhD Profile editor writes to it directly.

---

## Project structure

```
sturdy-fishstick/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + SPA serving
│   │   ├── config.py            # config.yaml + phd_config.yaml + .env loader
│   │   ├── database.py          # SQLite engine, migrations
│   │   ├── scheduler.py         # daily pipeline + single-pass scoring
│   │   ├── serper_budget.py     # daily API-call cap
│   │   ├── activity.py          # activity log (Logs page)
│   │   ├── rag.py               # FTS5 retrieval for the chat assistants
│   │   ├── resumes.py           # mode-aware resume loading
│   │   ├── matcher/llm.py       # categorical scoring, cover letters, advice
│   │   ├── models/              # Job (kind/track), SearchRun, ActivityEvent
│   │   ├── routers/             # jobs, chat, config, runs+logs, search
│   │   └── scrapers/            # serper, jobspy, career ATS, phd boards, github
│   ├── config.yaml              # main config — edit this
│   ├── phd_config.yaml          # PhD track (profile + phd_search)
│   ├── Resume/                  # *___CAREER.txt / *___PHD.txt resumes
│   └── .env                     # secrets — never commit
├── frontend/src/                # React/Vite/Tailwind (Dashboard, Tracker, Logs, Settings)
├── company_careers.json         # example 71-company watchlist
├── parse_resume.py              # any document → text (Docling)
├── requirements_pdfparser.txt   # deps for parse_resume.py (separate venv!)
├── future.md                    # model benchmark + upgrade path
├── setup.sh / start.sh          # setup & launch (start.sh kills stale backends)
└── PLAN.md                      # feature roadmap history
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No new jobs after scan | Check the **Logs** page first — it shows every step with counts and errors |
| "Serper daily cap reached" | By design — the budget guard; raise `search.serper_daily_cap` if you have credits to spare |
| Jobs stuck "unscored" | A scoring pass runs after each scan (watch Logs); or click **Score jobs (N)** on the Dashboard |
| PhD dashboard scores look odd | Scores come from the `phd_profile` in `backend/phd_config.yaml` — make sure it's filled in |
| Resume Tips: "no resume found" | Add `*___CAREER.txt` / `*___PHD.txt` to `backend/Resume/` (see Resumes above) |
| `parse_resume.py` fails on Intel Mac | Pinned torch has no Intel-macOS wheel — use the conda-forge route or the pypdf drop-in (see [Resumes](#resumes-pdf-parsing)) |
| Two backends running / weird scores | Always start via `./start.sh` — it kills stale processes first |
| Ollama holding RAM | Passes unload everything when done; `ollama ps` should be empty when idle |
| ngrok auth error | `ngrok config add-authtoken <token>` |

---

## License

MIT — see `LICENSE`.
