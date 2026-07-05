# Sturdy Fishstick — Complete Guide

This guide walks you through setting up, configuring, and using the app from scratch. It is written for someone who has never run it before.

The app has **two dashboards in one**: **My Careers** (industry internships and jobs) and **PhD** (funded doctoral positions). They share the install but have separate profiles, search settings, resumes, scoring, and trackers — so two people can run their searches side by side. The dedicated section at the end — **[The PhD track](#phd)** — explains the PhD side.

---

## Table of contents

1. [What you need before you start](#1-what-you-need-before-you-start)
2. [Installation](#2-installation)
3. [Configuration — your profile](#3-configuration--your-profile)
4. [Adding your resume (PDF parsing)](#4-adding-your-resume-pdf-parsing)
5. [Running the app](#5-running-the-app)
6. [Using the dashboard](#6-using-the-dashboard)
7. [Where jobs come from](#7-where-jobs-come-from)
8. [How AI scoring works](#8-how-ai-scoring-works)
9. [Tracker — including manual entries](#9-tracker--including-manual-entries)
10. [Logs — monitoring everything](#10-logs--monitoring-everything)
11. [Fishstick AI and character companions](#11-fishstick-ai-and-character-companions)
12. [Serper budget](#12-serper-budget)
13. [Accessing from other devices](#13-accessing-from-other-devices)
14. [Email notifications (optional)](#14-email-notifications-optional)
15. [The PhD track](#phd)

---

## 1. What you need before you start

**Python 3.10+** — `python3 --version` · https://www.python.org/downloads/

**Node.js 18+** — `node --version` · https://nodejs.org/

**Ollama** — runs the AI models locally, no GPU required. Download from https://ollama.com, then confirm with `ollama --version`.

**A Serper.dev API key** — how the app searches Google. Create a free account at https://serper.dev and copy the key. The app is aggressive about conserving these credits (see [Serper budget](#12-serper-budget)).

---

## 2. Installation

```bash
git clone <repo-url>
cd sturdy-fishstick
chmod +x setup.sh start.sh
./setup.sh
```

Setup creates `backend/.venv`, installs Python and Node dependencies, and pulls the two local models:
- `qwen3:1.7b` (~1.4 GB) — scores jobs
- `LFM2.5-1.2B-Instruct` (~0.7 GB) — writes cover letters, resume tips, and chats

Then add your Serper key to `backend/.env`:
```
SERPER_API_KEY=paste_your_key_here
```

---

## 3. Configuration — your profile

There are **two config files**:

| File | Contains |
|------|----------|
| `backend/config.yaml` | App settings (scheduler, LLM, budget) + the **My Careers** profile |
| `backend/phd_config.yaml` | The **PhD** profile + `phd_search` settings — overrides config.yaml's PhD sections when present |

### Careers profile (`config.yaml`)

```yaml
profile:
  name: "Your Name"
  positions:                    # drives search queries — be specific
    - "Software Engineer Intern"
    - "Machine Learning Engineer Intern"
  expertise:                    # used for search AND scoring
    - "Python"
    - "PyTorch"
  resume_summary: |
    2–4 sentences about yourself. Sent to the AI when scoring each job.
    Degree, key skills, experience, what role you want.
  location_preference: ["United States", "Germany"]
  remote_ok: true
  relocation_ok: false
```

The **first few `expertise` items define your specialization** — the scorer gives "strong field match" only to jobs focused on them, so put your niche (e.g. "LLM Post-Training") before generic skills (e.g. "Python").

### Scheduler & LLM (`config.yaml`)

```yaml
scheduler:
  times: ["08:00"]              # one scan/day — protects the Serper budget
  timezone: "America/Chicago"

llm:
  model: "hf.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF:latest"
  scoring_model: "qwen3:1.7b"
  priority_threshold: 7         # score >= this → Priority badge
  batch_size: 10
  max_scoring_minutes: 240      # a scoring pass stops after this; leftovers next pass
```

You can edit all of this in the browser too: **Settings → Config**, with hot reload.

---

## 4. Adding your resume (PDF parsing)

Resumes power **Resume Tips**, **Cover Letters**, and give the chat real context. They live as plain text in `backend/Resume/`, tagged by track in the filename:

```
backend/Resume/
├── MyResume___CAREER.txt      ← loaded in My Careers mode
├── SecondResume___CAREER.txt  ← multiple per track is fine
└── HerCV___PHD.txt            ← loaded in PhD mode
```

### Converting a PDF (or DOCX, PPTX, HTML…) to text

The bundled parser uses **Docling** for high-quality extraction. Its dependencies are heavy (PyTorch etc.), so install them from **`requirements_pdfparser.txt`** in a **separate virtual environment** — do *not* mix them into the app's venv:

```bash
python3 -m venv .venv-pdf
source .venv-pdf/bin/activate
pip install -r requirements_pdfparser.txt

python parse_resume.py /path/to/resume.pdf
# → backend/Resume/resume.txt   (rename to resume___CAREER.txt or ___PHD.txt)

deactivate
```

Run it once per document; you only need the `.venv-pdf` environment when parsing.

**Quick alternative:** drop PDFs into `Resume/Careers/` or `Resume/PhD/` at the repo root — the app extracts them automatically with pypdf. Docling output is cleaner, so prefer the parser for your "real" resumes.

---

## 5. Running the app

```bash
./start.sh
```

Open **http://localhost:5173** (dev) or **http://localhost:8001** (the built UI — what remote devices see). Stop with `Ctrl+C`.

`start.sh` also kills any stale backend processes before starting — always launch through it rather than running uvicorn by hand.

---

## 6. Using the dashboard

### The mode toggle

Under the logo in the sidebar: **My Careers / PhD**. Everything on screen — stats, job list, trends, feeds, tracker, chat context, even the background theme (teal sea vs. indigo deep-sea) — follows the active mode. Your choice persists across restarts.

### Stats bar

Four clickable metric cards (New today / Priority / Applications / Total), scoped to the mode. The main button is **Scan now** in Careers mode and **Crawl PhD** in PhD mode.

### Job list & detail drawer

Each card shows company, title, score, country, source, and age.

- **Wide screens:** clicking a card opens a **detail drawer on the right** — full description, match reason, status pills, deadline, notes, and the AI buttons. `Esc` closes it.
- **Narrow screens:** cards expand inline instead.

Inside the details:

| Action | What it does |
|--------|-------------|
| Status pills | New → Saved → Applied → Screening → Interview → Offer / Rejected |
| ✦ Cover Letter | Tailored letter via the local AI (uses your mode's resume + profile) |
| 📄 Resume Tips | AI reviews your resume against this job |
| Ask AI | Opens Fishstick chat with this job attached |
| Deadline / Notes | Saved immediately; amber border when ≤ 7 days remain |

**Score slider note (PhD mode):** unscored positions stay visible at any threshold so a fresh crawl never looks empty; once everything is scored the slider filters strictly.

### Buttons above the list

- **Crawl Careers** (Careers mode) / **Crawl PhD** (PhD mode) — manual crawls
- **Score jobs (N)** — appears when jobs await scoring; live "Scoring… N left" progress; turns into a green **All scored** chip at zero

### Floating feed panels (bottom right)

| Panel | Mode | Contents |
|-------|------|----------|
| LinkedIn | both | **Listings** and hiring-**Posts** tabs, mode-scoped, with a **Fetch** button |
| Careers | Careers | career-page crawl results |
| PhD | PhD | PhD positions |

The expand button (⤢) opens a full view with **collapsed company cards** — click a company to unfold its listings.

---

## 7. Where jobs come from

| Source | Cost | When |
|--------|------|------|
| Google Jobs (Serper) | budget-capped API calls | daily scan — a rotating window of your queries |
| LinkedIn listings (jobspy) | free | daily scan + LinkedIn panel Fetch |
| LinkedIn hiring posts (Serper) | 1–2 calls | LinkedIn crawl |
| GitHub intern repos | free | every scan |
| Career pages (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee) | free JSON APIs | Crawl Careers |
| Academic boards (EURAXESS, jobs.ac.uk) | free | Crawl PhD |
| Playwright headless browser | free | fallback for stubborn career pages |

### Career page watchlist

Upload a JSON in **Settings → Career Watch** (`company_careers.json` is a 71-company example):

```json
{
  "Frontier AI Labs": [
    { "name": "Anthropic", "url": "https://www.anthropic.com/careers" }
  ]
}
```

ATS platforms are auto-detected from URLs. The **Discover** button finds companies hiring for your profile keywords on Greenhouse/Lever/Ashby boards (uses ≤6 Serper credits) and adds them under a "Discovered" category.

---

## 8. How AI scoring works

Every new job gets scored 0–10 against your profile, in a single background pass covering both modes:

1. **Prefilter (no AI):** senior/staff/manager titles → 1; aggregate pages ("1,000+ jobs…", social posts) → 0.
2. **Categorical judgment:** the scoring model answers four questions — real job? intern/early/senior? field match strong/partial/none? skills overlap high/medium/low — and the score is computed deterministically from the answers. Small local models are much more reliable this way than when asked for a number directly.
3. Careers jobs are scored against `profile`, PhD jobs against `phd_profile`. Batches alternate between the tracks so neither waits.
4. The pass is single-flight (never two at once), time-boxed (`max_scoring_minutes`), and **unloads all models when done** — RAM is free between runs.

Score ≥ `priority_threshold` (default 7) earns the Priority badge. Watch progress on the **Logs** page or the Dashboard's "Scoring… N left" button.

---

## 9. Tracker — including manual entries

Sidebar → **Tracker**. A Kanban board per mode:

```
Applied → Screening → Interview → Offer
                                → Rejected
```

- **Drag** cards between columns.
- **Click** a card to open the full detail drawer (description, notes, deadline, AI tools).
- **➕ Add application** (top right) — record a role you applied to **outside the app**: title, company (or university/lab in PhD mode), URL, location, status, deadline, and notes. It's stored like any other job (source "manual") and gets the same drawer, notes, and AI features.

---

## 10. Logs — monitoring everything

Sidebar → **Logs**. Live view (auto-refreshes every 10 s) of everything the app does:

- **Counter tiles:** jobs awaiting score (pulses while scoring), PhD positions scored, Serper credits used today vs. cap, tasks running.
- **Event feed:** every scan, career/PhD/LinkedIn crawl, and scoring pass — `running`, `done` with counts ("added 44 new PhD positions", "scored 128 of 530"), or `failed` with the reason.

If something seems off, look here first.

---

## 11. Fishstick AI and character companions

### Fishstick AI

**Ask Fishstick** in the sidebar. On every question, the backend retrieves *live data* for the assistant: exact totals, status/source/country breakdowns, score distribution, the jobs best matching your question (full-text search), recent runs, and your watchlist. Counts come from the database, not the model's imagination — "how many PhD positions in Switzerland?" gets the real number.

Attach a job via **Ask AI** on any card for job-specific questions.

### Puff and Brownie

Two companions in the bottom-right corner — **Puff** (encouraging) and **Brownie** (direct). Same live data access, different personalities. In PhD mode they know the PhD profile and positions.

### Chat windows

All chats have **half-screen and full-screen buttons** in their headers (click the active one to shrink back). When a character chat expands, its sprite docks into the chat header and returns to the corner on close. Conversations survive resizing and closing.

---

## 12. Serper budget

Serper credits are precious. The app enforces:

- **`search.serper_daily_cap`** (default 10) — a hard daily ceiling shared by every Serper caller; enforced in code, survives restarts.
- **Query rationing** — the daily scan sends a small rotating window of your query list (full coverage over ~2 weeks), not all of it.
- **Free-first sourcing** — LinkedIn (jobspy), GitHub, ATS APIs, and academic boards cost nothing.

At the default cap, 2,500 credits last 8+ months. The Logs page shows today's usage; when the cap trips mid-run, the run history says so explicitly.

---

## 13. Accessing from other devices

**Same network:** `./start.sh` prints a LAN URL (`http://10.x.x.x:5173`) — open it on any device on your Wi-Fi.

**Anywhere (ngrok):**
```bash
brew install ngrok
ngrok config add-authtoken <token>    # one-time, free account
./start.sh --remote
```
Copy the `https://xxxx.ngrok-free.app` URL. The free tier changes the URL each restart.

---

## 14. Email notifications (optional)

High-scoring new jobs can trigger an email with an `.ics` calendar reminder.

1. Gmail → enable 2FA → create an **App password**
2. `backend/.env`: `SMTP_APP_PASSWORD=xxxx xxxx xxxx xxxx`
3. `config.yaml`:
   ```yaml
   notifications:
     email:
       enabled: true
       to: "you@example.com"
       from_addr: "your.gmail@gmail.com"
       score_threshold: 8
   ```

---

<a name="phd"></a>
## 15. The PhD track

The PhD side is a **first-class mode**, not a workaround: flip the sidebar toggle to **PhD** and the whole app — dashboard, tracker, feeds, chat, scoring — switches to the PhD profile. Your careers setup is untouched, so two people can share one install.

### Step 1 — fill in `backend/phd_config.yaml`

This file holds everything PhD-specific and **overrides** the equivalent sections in `config.yaml`:

```yaml
phd_search:
  sources: [google_jobs, linkedin]
  time_filter: "3months"        # PhD cycles are slower than job postings
  funding_required: true        # drop anything that doesn't mention funding
  extra_keywords:               # drive the board + LinkedIn searches
    - "fully funded PhD"
    - "PhD studentship"
    - "computer vision"         # ← your research area
    - "medical imaging"
  institution_whitelist:        # targeted Serper searches, rotated daily
    - "Johns Hopkins University"
    - "Carnegie Mellon University"
    # ... as many as you like — a small window rotates through them
  institution_blacklist: []

phd_profile:                    # keep LAST in the file
  name: "Your Name"
  positions:
    - "PhD Position Computer Vision"
    - "Fully Funded PhD"
    - "PhD Research Assistantship"
  expertise:                    # first items = your specialization (drives scoring)
    - "Computer Vision"
    - "Medical Imaging"
    - "Deep Learning"
    - "PyTorch"
  resume_summary: |
    3–4 sentences: degrees, research focus, publications, what kind of
    PhD you want (funded, field, region).
  location_preference: ["United States", "Canada", "Europe"]
  remote_ok: false
  relocation_ok: true
```

You can edit `phd_profile` in the browser too: **Settings → PhD Profile** (the default Settings tab in PhD mode) — it writes to this file and hot-reloads.

### Step 2 — add the CV

Parse it with Docling (see [section 4](#4-adding-your-resume-pdf-parsing) — `requirements_pdfparser.txt`) and name it with the PhD tag:

```
backend/Resume/MyCV___PHD.txt
```

PhD-mode Resume Tips, cover letters (research-statement drafts), and chat all use this CV — never the careers resume.

### Step 3 — crawl

Click **Crawl PhD** (the main button in PhD mode). One click runs, in order:

1. **Institution search** (Serper, budget-capped) — "PhD «your position» application «university»" across a rotating window of your whitelist
2. **Academic boards** (free) — EURAXESS and jobs.ac.uk, filtered to doctoral-titled positions, searched with your `extra_keywords`
3. **LinkedIn** (free) — PhD listings via jobspy, plus funded-PhD hiring posts
4. A scoring pass against the `phd_profile`

With `funding_required: true`, results that never mention funding/assistantship/studentship/stipend are dropped (academic-board results are inherently salaried and skip this check).

The LinkedIn panel in PhD mode has a **Posts** tab — professors announcing openings ("Fully funded PhD position in…") often appear there before any job board.

### Step 4 — read the results

- **7–10** — the position's focus matches your specialization; read carefully
- **5–6** — related area or generic PhD listing; skim
- **0–2** — wrong field, guide pages, or hiring-post noise
- **unscored** — a pass hasn't reached it yet (they stay visible in PhD mode regardless of the score slider)

### Step 5 — track applications

The PhD Tracker is separate from the careers one. Use **➕ Add application** for programs you applied to through university portals — record the PI's name, portal login hints, and deadlines in the notes. Set deadlines so cards warn you (amber) when ≤ 7 days remain.

### PhD-specific tips

- Application season (Oct–Dec for the US, rolling for Europe): run **Crawl PhD** daily — it's nearly free (boards and LinkedIn cost nothing; only the institution search spends a few Serper credits)
- Put target labs' pages in the career watchlist — Playwright can often scrape positions from personal lab sites
- Ask Brownie "which of my PhD positions have deadlines this month?" — the chat sees live data

---

*For anything not covered here, open the Fishstick AI chat and ask — it has full knowledge of every feature. And check the **Logs** page whenever you wonder what the app is doing.*
