# Sturdy Fishstick — Complete Guide

This guide walks you through setting up, configuring, and using the app from scratch. It is written for someone who has never run it before.

There is a dedicated section at the end — **[Setting it up for PhD search](#phd)** — written for a PhD applicant who wants to use the app to find research positions and PhD openings.

---

## Table of contents

1. [What you need before you start](#1-what-you-need-before-you-start)
2. [Installation](#2-installation)
3. [Configuration — your profile](#3-configuration--your-profile)
4. [Adding your resume](#4-adding-your-resume)
5. [Running the app](#5-running-the-app)
6. [Using the dashboard](#6-using-the-dashboard)
7. [Career page crawling](#7-career-page-crawling)
8. [Tracker (Kanban)](#8-tracker-kanban)
9. [Fishstick AI and character companions](#9-fishstick-ai-and-character-companions)
10. [Accessing from other devices](#10-accessing-from-other-devices)
11. [Email notifications (optional)](#11-email-notifications-optional)
12. [Setting it up for PhD search](#phd)

---

## 1. What you need before you start

### Required tools

**Python 3.11 or newer**
```bash
python3 --version
# should print Python 3.11.x or higher
```
If not installed: https://www.python.org/downloads/

**Node.js 18 or newer**
```bash
node --version
# should print v18.x or higher
```
If not installed: https://nodejs.org/

**Ollama** — runs the AI model locally on your machine. No GPU required.
1. Download from https://ollama.com
2. Install it (drag to Applications on Mac, run the installer on Windows/Linux)
3. Confirm it works:
```bash
ollama --version
```

**A Serper.dev account** — this is how the app searches Google Jobs and LinkedIn.
1. Go to https://serper.dev and create a free account (no credit card)
2. The free tier gives you 2 500 searches per month, which is more than enough
3. Copy your API key from the dashboard — you will need it in step 2

---

## 2. Installation

### Clone the repo
```bash
git clone <repo-url>
cd sturdy-fishstick
```

### Run setup
```bash
chmod +x setup.sh start.sh
./setup.sh
```

This script does the following:
- Checks Python 3.11+ and Node 18+
- Creates `backend/.venv` (isolated Python environment)
- Installs all Python dependencies
- Copies `backend/.env.example` to `backend/.env` if it does not exist
- Pulls the `phi3:mini` model into Ollama (~2.2 GB download, one time only)
- Runs `npm install` in the frontend
- Creates `backend/Resume/` and `backend/data/` directories

### Add your Serper API key
Open `backend/.env` in any text editor and set:
```
SERPER_API_KEY=paste_your_key_here
```
This is the only required secret. Everything else is optional.

---

## 3. Configuration — your profile

Open `backend/config.yaml`. This is the main configuration file. You do not need to touch anything except the `profile` section to get started.

### Profile fields

```yaml
profile:
  name: "Your Name"

  positions:
    - "Software Engineer Intern"
    - "Machine Learning Engineer Intern"
    - "Data Science Intern"

  expertise:
    - "Python"
    - "Machine Learning"
    - "PyTorch"
    - "SQL"

  resume_summary: |
    Write 2–4 sentences about yourself here. This text is sent to the AI
    when scoring each job, so be specific. Include your degree, key skills,
    relevant experience, and what type of role you want.
    Example: "MS Computer Science student specialising in machine learning.
    Strong Python, PyTorch, computer vision. Looking for summer 2026
    research or engineering internships in the US or Germany."

  location_preference:
    - "United States"
    - "Germany"
    - "Canada"

  remote_ok: true
  relocation_ok: false
```

**Tips:**
- `positions` drives the search queries. Be specific — "Software Engineer Intern" works better than just "Software Engineer"
- `expertise` is used both for search and for AI scoring. List actual skills, not vague terms
- `location_preference` can be a single country or a list. Each country gets its own region card on the dashboard
- The `resume_summary` is the single most important field for score quality. Write it as if you were introducing yourself in a cover letter

### Scheduler

By default the app scans 4 times per day. The times are in your local timezone:
```yaml
scheduler:
  times: ["08:00", "12:00", "17:00", "21:00"]
  timezone: "America/Chicago"
```

Change `timezone` to your own: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

### Score threshold

Jobs scoring at or above `priority_threshold` get a Priority badge and appear at the top of the list:
```yaml
llm:
  priority_threshold: 7    # 0–10, default 7
```

---

## 4. Adding your resume

The resume enables two features:
- **Resume Tips** — the AI compares your resume against a job description and gives section-by-section advice
- **Cover Letter** — the AI writes a tailored letter drawing on your actual experience

### Parse a PDF or DOCX

```bash
python parse_resume.py /path/to/your/resume.pdf
```

This saves a plain-text version to `backend/Resume/resume.txt`. You can run it multiple times with different files — all files in `backend/Resume/` are loaded together (useful if you have separate CV versions).

### Or copy-paste manually

Drop any `.txt` or `.md` file into `backend/Resume/`. The filename does not matter.

---

## 5. Running the app

```bash
./start.sh
```

Then open **http://localhost:5173** in your browser.

The first scan runs automatically if the last run was more than 2 hours ago. You can also trigger one manually from the dashboard (see section 6).

**To stop:** press `Ctrl+C` in the terminal.

---

## 6. Using the dashboard

### Stats bar (top)

Four cards show live counts. Click any card to filter the job list:

| Card | What it shows |
|------|---------------|
| New today | Jobs found in the last 24 hours |
| Priority | Jobs scored ≥ your priority threshold |
| Applied | Jobs you have marked as applied |
| Total | Everything (click to clear filters) |

Click the same card a second time to clear the filter.

### By Region

A scrollable row of country cards appears when you have jobs from multiple countries. Click a card to filter to that country. Click **Clear** at the top right, or click the active card again, to reset.

### Job list

Each card shows: company initial, job title, match score, country, source tag, and when it was found.

**Click any card to expand it.** Inside the expanded view:

| Action | What it does |
|--------|-------------|
| Status pills | Move through: New → Saved → Applied → Screening → Interview → Offer / Rejected |
| ✦ Cover Letter | Generates a tailored cover letter via the local AI |
| 📄 Resume Tips | AI reviews your resume against this specific job |
| Deadline | Set an application deadline; card border turns amber when ≤ 7 days remain |
| Notes | Freeform notes, saved immediately |
| Ask AI | Opens the Fishstick chat with this job as context |
| Delete (🗑) | Hover the card to reveal a delete button; two clicks to confirm |

### Crawl buttons

Two manual crawl buttons sit above the job list:

- **Crawl Careers** — immediately runs the career page crawler across all companies in your watchlist (see section 7)
- **Crawl PhD** — runs a dedicated PhD/research position search (see the [PhD section](#phd))

### Floating side panels

Three floating panels sit on the right edge of the screen:

| Panel | What it shows |
|-------|---------------|
| LinkedIn | Jobs from LinkedIn sources |
| Careers | Jobs from career page crawls (career_page source) |
| PhD | PhD/research positions |

Each panel has a mini view (top 20 by score) and an expand button (⤢) that opens a full-screen modal with all listings **grouped by company**. This makes it easy to see how many open roles a specific employer has at a glance.

### Trends view

Click **Trends** in the view switcher above the job list to see:
- Weekly bar chart (new jobs and priority matches per week, last 4 weeks)
- Day-by-day breakdown (last 14 days)
- Country breakdown bar chart

### Deleting noise

If a job is irrelevant, hover the card and click the trash icon. The first click turns the button red as a warning; the second click removes the job permanently. This is useful after a crawl brings in off-topic listings.

---

## 7. Career page crawling

The scheduler's main scan uses Google Jobs and LinkedIn. The career page crawler is a separate, targeted scrape of specific company career pages.

### How to set it up

1. Go to **Settings → Career Watch**
2. Click **Upload JSON** and select your company list file

The file format is simple:
```json
{
  "Frontier AI Labs": [
    { "name": "Anthropic", "url": "https://www.anthropic.com/careers" },
    { "name": "OpenAI",    "url": "https://openai.com/careers/" }
  ],
  "Big Tech": [
    { "name": "Google", "url": "https://careers.google.com/" },
    { "name": "Meta",   "url": "https://www.metacareers.com/" }
  ]
}
```

Categories are just labels — you can name them anything. Each entry needs a `name` and a `url`.

A ready-to-use 71-company file is included in the repo at `company_careers.json`. Upload it as a starting point and customise from there.

### How it works under the hood

- If the URL is a **Greenhouse** board (e.g. `boards.greenhouse.io/anthropic`), it hits their JSON API directly — fast and reliable
- If the URL is a **Lever** board (e.g. `jobs.lever.co/mistral-ai`), same thing
- For other companies, it uses domain-to-ATS mapping (e.g. `anthropic.com` → Greenhouse slug `anthropic`)
- If the API returns a 404 (wrong slug, company changed ATS), **Playwright** launches a headless Chrome browser, visits the page, and extracts job links from the rendered DOM
- Companies with no known ATS fall back to Serper site-search (`site:company.com Software Engineer intern 2026`)

### Running it

Click **Crawl Careers** on the dashboard, or wait for it to run in the scheduled pipeline. New jobs appear in the **Careers** floating panel, tagged with source `career_page`.

---

## 8. Tracker (Kanban)

Click **Tracker** in the sidebar. Jobs you have moved out of New status appear here as cards in columns:

```
Applied → Screening → Interview → Offer
                                → Rejected
```

Drag cards between columns. Each card shows the company, title, score, and your notes. The tracker is a focused view — it only shows jobs you are actively pursuing.

---

## 9. Fishstick AI and character companions

### Fishstick AI (main assistant)

Click **Ask Fishstick** in the sidebar. The assistant has access to:
- Your profile and resume
- All jobs in your database
- Full knowledge of the app's features

**With a job attached:** Click **Ask AI** on an expanded job card. The assistant automatically loads that job as context. You can ask things like "is this role a good fit for me?" or "what should I highlight in my cover letter for this position?"

### Puff and Brownie

Two character companions sit in the bottom-right corner:
- **Puff** (Jigglypuff) — enthusiastic, encouraging, great for resume pep talks and motivation
- **Brownie** (Charizard) — chill, direct, useful for honest feedback on priorities

Click either to open their chat. They run on the same local model with different personalities.

---

## 10. Accessing from other devices

### Same network (home, office LAN)

Just run `./start.sh` as usual. The startup output prints a LAN URL:
```
  On your LAN:
    Dashboard: http://10.187.97.15:5173
```

Open that URL on any phone, tablet, or other computer on the same Wi-Fi.

### Different network (internet, mobile data, remote access)

This uses **ngrok** to create a secure public tunnel to your Mac.

**One-time setup:**
```bash
brew install ngrok
# Create a free account at ngrok.com, then:
ngrok config add-authtoken <your-token-from-dashboard.ngrok.com>
```

**Every time you want remote access:**
```bash
./start.sh --remote
```

This builds the React app, starts the backend serving both the UI and API on port 8001, and opens a tunnel. Copy the `https://xxxx.ngrok-free.app` URL from the output — open it in any browser, anywhere.

> The URL changes every time you restart ngrok on the free tier. For a stable URL, the paid plan ($10/month) gives you a fixed subdomain.

---

## 11. Email notifications (optional)

When a high-scoring job appears, the app can send you an email with an `.ics` calendar attachment as a reminder to apply.

### Setup

1. Enable 2-factor authentication on your Gmail account
2. Go to: Google Account → Security → 2-Step Verification → App passwords
3. Generate an app password (select "Mail" and your device)
4. Add it to `backend/.env`:
   ```
   SMTP_APP_PASSWORD=xxxx xxxx xxxx xxxx
   ```
5. In Settings → Config (or directly in `config.yaml`), set:
   ```yaml
   notifications:
     email:
       enabled: true
       to: "you@example.com"
       from_addr: "your.gmail@gmail.com"
       score_threshold: 8
   ```

Notifications fire automatically after each scan for any new job scoring ≥ `score_threshold`. You can also send one manually from any Priority job card (the ✉ button appears on expanded cards).

---

<a name="phd"></a>
## Setting it up for PhD search

This section is written for someone searching for PhD positions or funded research opportunities, not industry internships.

The app was built with internship searches in mind but adapts well to PhD hunting with a few changes to the profile and by using the dedicated PhD crawl feature.

---

### Step 1 — Install everything the same way

Follow sections 1–5 exactly as written above. The setup is identical.

---

### Step 2 — Write your profile for a PhD search

Open `backend/config.yaml` and replace the `profile` section with one tailored to academic applications.

```yaml
profile:
  name: "Your Name"

  positions:
    - "PhD student"
    - "PhD candidate"
    - "PhD fellowship"
    - "research assistant"
    - "graduate research assistant"
    - "funded PhD position"

  expertise:
    - "your research area"        # e.g. "computational biology"
    - "your methods"              # e.g. "single-cell RNA sequencing"
    - "your tools/languages"      # e.g. "Python", "R", "MATLAB"
    - "related field keywords"    # e.g. "genomics", "bioinformatics"

  resume_summary: |
    Write 3–4 sentences about your academic background. Include your
    undergraduate degree and institution, your thesis topic or research
    focus, any publications or conference presentations, and what kind
    of PhD you are looking for (fully funded, specific field, location).

    Example:
    "MSc Bioinformatics graduate from [University], thesis on single-cell
    transcriptomics of tumour microenvironments. Published at [conference].
    Experienced in Python, R, and Snakemake pipelines. Seeking fully funded
    PhD positions in computational biology, cancer genomics, or related
    fields at North American or European institutions."

  location_preference:
    - "United States"
    - "Canada"
    - "United Kingdom"
    - "Germany"
    - "Netherlands"

  remote_ok: false
  relocation_ok: true    # PhD positions almost always require relocation
```

**Important:** The `positions` list drives the search. Terms like "PhD student" and "funded PhD position" match how universities post openings. Add your specific field too — e.g. "PhD computational neuroscience" — if you want targeted results.

---

### Step 3 — Add your CV

PhD applications are assessed on your CV, publications, and research statement — not a one-page resume. Add whatever documents you have:

```bash
python parse_resume.py /path/to/your/cv.pdf
# or drop a .txt/.md version directly into backend/Resume/
```

You can add multiple files — a CV, a research statement, a list of publications. The AI reads all of them together when generating advice.

---

### Step 4 — Use the PhD Crawl button

On the dashboard, click **Crawl PhD**. This runs a targeted Serper search specifically for PhD positions using your profile's `positions` and `location_preference`.

The results appear tagged with source `phd` and show up in the purple **PhD** floating panel on the right side of the screen.

Click the expand button (⤢) in the PhD panel to open the full view, where results are grouped by university or institution. This makes it easy to see how many openings a given lab or department has at once.

---

### Step 5 — Set up a university watchlist

For PhD searches, the career page watchlist works as a list of university and research institute websites. Create a JSON file like this:

```json
{
  "Top CS Programs": [
    { "name": "MIT CSAIL",         "url": "https://www.csail.mit.edu/research" },
    { "name": "Stanford AI Lab",   "url": "https://ai.stanford.edu/" },
    { "name": "CMU School of CS",  "url": "https://www.cs.cmu.edu/research" }
  ],
  "Computational Biology": [
    { "name": "Broad Institute",   "url": "https://www.broadinstitute.org/careers" },
    { "name": "EMBL",              "url": "https://www.embl.org/jobs/" },
    { "name": "Sanger Institute",  "url": "https://www.sanger.ac.uk/careers/" }
  ],
  "EU Research Institutes": [
    { "name": "Max Planck",        "url": "https://www.mpg.de/jobboard" },
    { "name": "ETH Zurich",        "url": "https://jobs.ethz.ch/site/index" },
    { "name": "Helmholtz",         "url": "https://www.helmholtz.de/en/careers/" }
  ]
}
```

Organise by field, geography, or prestige tier — whatever makes sense for your search.

Upload it in **Settings → Career Watch**, then click **Crawl Careers** to run it. Results appear in the teal **Careers** panel, grouped by institution in the expanded view.

---

### Step 6 — Reading the results

PhD listings behave a bit differently from industry job postings:

- **Score 7–10** — the position closely matches your research area and stated background. Read it carefully
- **Score 4–6** — adjacent field or partial skill match. Worth a quick read; you may be a strong candidate even if the AI is uncertain
- **Score 1–3** — unlikely match, but if you recognise the lab or PI, it may still be worth a look
- **Score null** — the AI could not score it (no description, timed out). Check these manually

PhD listings often have sparse descriptions ("seeking motivated PhD students in machine learning"). The score will be lower than for a detailed industry JD — that is expected.

**Use the AI features for PhD applications too:**
- **Resume Tips** — compares your CV against the position description
- **Cover Letter** — generates a research statement / letter of interest draft you can edit
- **Ask AI** — open the Fishstick chat with the position attached and ask: "What research experience should I emphasise for this lab?"

---

### Step 7 — Track your applications

Use the **Tracker** (Kanban view in the sidebar) to track where each application stands. The columns work the same way:

- **Applied** — submitted your application
- **Screening** — heard back, initial contact with the lab
- **Interview** — Zoom/in-person interview with the PI or committee
- **Offer** — admission offer received

Set a **deadline** on each card (inside the expanded job view) so you do not miss submission windows.

---

### Tips specific to PhD searching

- **Run Crawl PhD daily during peak season** (October–December for US programs, rolling for EU). Click it from the dashboard or wait for the scheduled run
- **Add individual lab pages** to your career watchlist if you have specific PIs you want to work with — the Playwright scraper can often pull position listings from personal lab websites
- **Notes field is your friend** — use it to record the PI's name, research group, and any personal connection or reason you are interested
- **Email notifications** — set `score_threshold: 6` instead of 8 for PhD searches, since sparse descriptions lead to generally lower scores

---

### Example PhD config

Here is a complete `config.yaml` profile section ready to use for a computational biology PhD search:

```yaml
profile:
  name: "Your Name"
  positions:
    - "PhD student computational biology"
    - "PhD candidate bioinformatics"
    - "graduate research assistant genomics"
    - "funded PhD position machine learning biology"
    - "PhD fellowship"
  expertise:
    - "Python"
    - "R"
    - "bioinformatics"
    - "single-cell sequencing"
    - "machine learning"
    - "genomics"
  resume_summary: |
    MSc Bioinformatics graduate seeking a fully funded PhD position in
    computational biology or genomics. Research background in single-cell
    RNA sequencing analysis and tumour microenvironment modelling.
    Strong Python and R skills. Open to positions in the US, UK, Germany,
    and the Netherlands.
  location_preference:
    - "United States"
    - "United Kingdom"
    - "Germany"
    - "Netherlands"
  remote_ok: false
  relocation_ok: true

llm:
  priority_threshold: 6     # lower threshold suits sparse PhD listings
```

---

*For anything not covered here, open the Fishstick AI chat and ask — it has full knowledge of every feature in the app.*
