# PLAN.md — Sturdy Fishstick feature roadmap

> Source of truth for the requests in [FEATURE.md](FEATURE.md). We implement **one phase at a
> time**, verify it in the running app, tick the boxes here, and **commit before moving on**
> (the first Dual Mode implementation was lost to an uncommitted session — never again).
>
> Status legend: `[ ]` todo · `[x]` done · `[~]` partially done / needs follow-up
>
> Last updated: 2026-07-03

---

## Current state (baseline)

- Dual Mode (My Careers / PhD) re-implemented and working; LFM2.5 models pulled into Ollama.
- Scoring: `scoring_model` = LFM2.5-350M, single-pass `score_pending_jobs()`, model unloads after.
- DB: ~1,424 jobs (987 careers non-aggregate, 103 phd), all scored. All `status="new"`.
- **Nothing committed yet** — commit the Dual Mode work as step zero.
- Scheduler reduced to **1 run/day (08:00)** on 2026-07-03 (was 4/day) — first Serper mitigation, already applied to config.yaml.

---

## Phase 0 — Hygiene + quick bug fixes  *(small, do first)*

### 0.0 Commit the Dual Mode work
- [ ] `git add` + commit current tree (backend mode endpoints, resumes.py, scheduler single-pass, frontend Dual Mode, config.yaml).

### 0.1 Bug #5 — chat closes when clicking the message box
**Root cause (found):** in `App.jsx → CornerCompanions`, the `<CharacterChat>` panel is rendered
*inside* the character's wrapper `<div>` which has `onClick={() => toggle(persona)}`. Any click
inside the open chat (input box, messages) bubbles up and toggles the chat closed.
- [ ] Stop propagation at the chat panel root (`onClick={(e) => e.stopPropagation()}` on the top-level container in `CharacterChat.jsx`), or move the panel outside the clickable wrapper.
- [ ] Same check for the badge/label elements.
- Files: `frontend/src/components/CharacterChat.jsx`, `frontend/src/App.jsx`

### 0.2 Bug #6 — "Score Pending" reads as a stuck status
**Root cause (found):** "Score Pending" is the *label of the manual trigger button* on the
Dashboard — it's always visible, so it reads like a permanent status. When clicked with zero
unscored jobs, nothing visibly happens (backend correctly does nothing: DB currently has 0
unscored). No feedback loop.
- [ ] `POST /search/score-pending` returns `{pending: N}`; add `GET /search/pending-count`.
- [ ] Button becomes dynamic: "Score jobs (N)" when N>0, hidden or "All scored ✓" (disabled) when N=0; poll count while a pass is running so progress is visible.
- Files: `backend/app/routers/search.py`, `frontend/src/pages/Dashboard.jsx`, `frontend/src/api.js`

### 0.3 Item #8 — separate PhD / Careers resumes ✅ already done
`backend/app/resumes.py` reads PDFs from `Resume/Careers/` and `Resume/PhD/` per mode (pypdf,
mtime-cached). Legacy `backend/Resume/*.txt` is only a fallback.
- [x] Mode-specific resume loading (2026-07-03)
- [ ] Optional cleanup: delete stale `backend/Resume/*.txt` so fallback can't serve outdated text.

---

## Phase 1 — Serper budget (#14)  *(urgent — protects the new 2,500 credits)*

**Measured burn:** `build_queries()` = 22 positions × 3 skills + 22 × 2 locations + 10 keywords
≈ **120 queries/run**; `fetch()` sends *all of them* to Serper (+3 linkedin site-searches)
≈ 123 calls/run × 4 runs/day ≈ **~500 calls/day**, plus career-crawl Serper fallbacks and PhD
crawls (2 per institution). 2,000 credits in a week checks out.

**Budget:** 2,500 credits / 180 days ⇒ **≤10 Serper calls/day** hard cap.

- [x] Scheduler → 1 run/day (config.yaml, applied 2026-07-03)
- [ ] **Daily cap enforcement:** `serper_calls` counter (new small table or reuse SearchRun), checked inside `SerperScraper`; hard-stop at `search.serper_daily_cap` (default 10), log + surface "cap reached" in run history.
- [ ] **Query rationing:** round-robin — each daily run picks ~5 queries (rotate through the position list day by day, e.g. `day_of_year % len(queries)` window) instead of all 120. State lives in DB or is derived from date.
- [ ] **Kill `fetch_linkedin` via Serper** — it only returns aggregate search pages (see Phase 4); reclaim those 3 calls/run.
- [ ] **Shift bulk discovery to free sources:** GitHub repos (already free), Greenhouse/Lever ATS APIs (free, already implemented), new ATS APIs + FindAPhD (Phase 6) — Serper becomes gap-filler only.
- [ ] **Evaluate free alternatives** (pick 1–2, don't build all):
  - `python-jobspy` (scrapes LinkedIn/Indeed/Glassdoor directly, free, no key; risk: breakage/blocks)
  - Adzuna API (free tier ~250 calls/month), Jooble API (free key)
  - RSS: WeWorkRemotely, HN "Who is hiring" (monthly)
- Files: `backend/app/scrapers/serper.py`, `backend/app/scheduler.py`, `backend/app/config.py`, `backend/config.yaml`

---

## Phase 2 — Model quality (#1, #15)

### 2.1 Switch scoring to 1.2B + tighten the rubric (#1)
Observed: LFM2.5-350M scores are generous and compressed (PhD batch: 35× 9, 66× 8, 2× 7 —
everything "priority"). Useless for ranking.
- [ ] `scoring_model` → `hf.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF:latest` (config.yaml one-liner).
- [ ] Rewrite `MATCH_PROMPT` with a hard rubric + anchors:
  - explicit score bands ("9–10 exact role+skills match at target company; 7–8 …; ≤4 wrong seniority/field") and 2–3 few-shot examples with *low* scores so the model learns to use the bottom half;
  - penalize: senior/staff roles, non-target countries, aggregate pages;
  - ask for a 0–10 **integer**, temperature 0 (`options.temperature: 0`).
- [ ] Recalibrate `priority_threshold` after a re-score (likely 8 → keep, but check distribution).
- [ ] One-off re-score: `UPDATE jobs SET match_score=NULL ...` then run Score Pending; compare distributions (expect a spread, not 8–9 wall).
- Files: `backend/app/matcher/llm.py`, `backend/config.yaml`

### 2.2 Best model for MacBook Air M1 8GB (#15)
Constraint: ~8GB unified RAM shared with macOS + browser + backend ⇒ keep resident model
**≤ ~2.5GB**, prefer fast unload (already implemented). Candidates to benchmark (all Ollama-pullable):

| Model | RAM (Q4) | Role | Notes |
|---|---|---|---|
| LFM2.5-1.2B-Instruct (current) | ~0.8 GB | scoring + chat | fastest, on-device-specialized |
| Qwen3-1.7B | ~1.2 GB | scoring + chat | strong JSON discipline, /no_think mode |
| Llama-3.2-3B-Instruct | ~2.0 GB | chat/generation | better prose for cover letters |
| Phi-4-mini (3.8B) | ~2.4 GB | generation | strong reasoning, tight fit — test under load |
| Gemma-3-4B-QAT | ~2.4 GB | generation | good quality, tight fit |

- [ ] Benchmark script (`backend/scripts/bench_models.py`): 20 sampled jobs × each model → JSON-parse rate, score spread (stddev), latency; pick scorer + generator.
- [ ] Working hypothesis: **scorer = LFM2.5-1.2B or Qwen3-1.7B; generator = Llama-3.2-3B** if it fits comfortably, else keep 1.2B for both.
- [ ] Write **`future.md`** — model plan for Mac mini M4 24GB: Qwen3-14B (Q4 ~9GB), Gemma-3-12B-QAT (~8GB), Phi-4 14B (~9GB), Mistral-Small-3.2-24B (Q4 ~13GB), gpt-oss-20b (MXFP4 ~13GB); embedding model for RAG (nomic-embed-text / embeddinggemma-300m); keep-alive strategies when RAM is plentiful.

---

## Phase 3 — Chat: RAG + expandable UI (#2, #3, #4)

### 3.1 RAG-style assistants (#2)
Today Puff/Brownie/Fishstick only see the top-20-by-score snapshot; they can't answer "how many
PhD roles in the UK?" or "what did the last run find?".
- [ ] **Retrieval layer** (`backend/app/rag.py`):
  - SQLite **FTS5** index over jobs (title/company/description/notes) — zero extra RAM, no embedding model needed on the M1;
  - structured intent path: parse count/filter-style questions into SQL (counts by mode/country/score/status), so numeric answers are exact rather than hallucinated;
  - context bundle: matched jobs (top-k by FTS rank) + stats + last runs + config summary + watchlist names, trimmed to ~3–4k tokens.
- [ ] `/chat/stream` uses retrieval over the user's latest message (mode-scoped) instead of the fixed top-20 snapshot; personas get the same bundle.
- [ ] Optional (future.md / M4): embeddings + sqlite-vec for semantic retrieval.
- Files: new `backend/app/rag.py`, `backend/app/routers/chat.py`

### 3.2 Expandable chat windows (#3) + icon docking (#4)
- [ ] Three sizes for `ChatPanel` and `CharacterChat`: **bubble** (current) → **half** (50% width/height overlay) → **full screen**; expand/contract buttons in the header; size persisted in `localStorage`.
- [ ] Multi-turn history survives resize (state already held in component — keep it above the resizing container) and is retained per persona for the session.
- [ ] Icon docking (#4): when a character chat is expanded (half/full), hide the corner sprite and show it inside the chat header (avatar + name); on close, sprite returns to the bottom-right corner. Same pattern for the Fishstick panel's launcher.
- Files: `frontend/src/components/ChatPanel.jsx`, `CharacterChat.jsx`, `App.jsx`

---

## Phase 4 — Feeds & panels (#7, #9, #10, #11)

### 4.1 Careers panel grouped by company (#7)
- [ ] `FloatingJobPanel` (careers source): group fetched jobs by `company`; render one card per company (logo initial, name, listing count); clicking a company expands its listings inline (accordion) or in a sub-view with back button.
- Files: `frontend/src/components/FloatingJobPanel.jsx`

### 4.2 Fix LinkedIn (#9) — real listings, not search pages
**Root cause (found):** LinkedIn jobs come from Serper `site:linkedin.com/jobs` queries — results
are aggregate search pages ("12,000+ Python Internship jobs in United States"), not postings.
The direct `linkedin-api` scraper only runs if `LINKEDIN_EMAIL/PASSWORD` are set in `backend/.env`
(currently not set).
- [ ] Primary: set up dummy LinkedIn account + `.env` credentials → `LinkedInScraper` returns real postings with title/company/description. Verify `linkedin-api` still works (fragile, unofficial).
- [ ] Fallback/alternative: `python-jobspy`'s LinkedIn scraper (no login) — evaluate in Phase 1 spike.
- [ ] Purge existing junk: delete/flag `source='linkedin'` aggregate rows (they're search pages).
- Files: `backend/app/scrapers/linkedin_scraper.py`, `backend/app/scheduler.py`, `.env`

### 4.3 LinkedIn in PhD mode (#10) + posts vs listings sections (#11)
- [ ] PhD-mode LinkedIn panel: same panel, PhD queries ("PhD position", "PhD studentship", phd_profile positions); jobs saved with `source='linkedin'` + mode-resolvable tag — **add a `kind` column** (see below).
- [ ] **Schema:** add `Job.kind: "listing" | "post"` (default `listing`). LinkedIn *posts* (people announcing openings) get `kind='post'`.
- [ ] Posts discovery: `site:linkedin.com/posts "hiring" <role>` via Serper (budget: counts against the 10/day cap — 1–2 queries) or linkedin-api search; PhD variant: `"PhD position" OR "fully funded"` posts.
- [ ] Panel UI: two tabs inside the LinkedIn panel — **Listings** / **Posts** — in both modes.
- Files: `backend/app/models/job.py` (+ migration), scrapers, `frontend/src/components/LinkedInPanel.jsx`

---

## Phase 5 — Dashboard aesthetics (#12)

- [ ] Rebuild `FishingBackground` with layered depth: gradient sky that shifts with light/dark, 3 parallax wave layers (CSS transforms, GPU-cheap), drifting fish at different depths/speeds, occasional bubbles; respect `prefers-reduced-motion`.
- [ ] Per-mode ambient theme: teal/sea for My Careers, indigo/night-sky (or "deep sea") for PhD — background + accent colors switch with the mode toggle (smooth transition).
- [ ] Polish pass: consistent card shadows/radii, dark-mode contrast audit on Dashboard cards (several `text-slate-800` on dark backgrounds), micro-animations on card hover/expand (Tailwind transitions, no new deps).
- Files: `frontend/src/components/FishingBackground.jsx`, `tailwind.config.js`, Dashboard components

---

## Phase 6 — Advanced discovery (#13)

### 6.1 Careers: broader company coverage
- [ ] Extend `_DOMAIN_ATS` + detection to more free ATS APIs: **Ashby** (`api.ashbyhq.com/posting-api/job-board/<org>`), **Workable** (`apply.workable.com/api/v1/widget/accounts/<org>`), **SmartRecruiters** (`api.smartrecruiters.com/v1/companies/<org>/postings`), **Recruitee** (`<org>.recruitee.com/api/offers`). All free, no key.
- [ ] One-time company auto-discovery from profile (uses ~20 Serper credits, run once): for each expertise cluster, find companies' ATS boards (`site:boards.greenhouse.io <keyword>`, `site:jobs.lever.co ...`, `site:jobs.ashbyhq.com ...`) → merge into `company_careers.json` watchlist. (`company_careers.json` exists at repo root — upload it via Settings → Career Watch first.)
- [ ] Relevance filter (`_is_relevant`) tune-up so the wider net doesn't flood the DB.

### 6.2 PhD: FindAPhD + academic boards
- [ ] `backend/app/scrapers/phd_boards.py`: **FindAPhD** scraper — crawl `findaphd.com/phds/?Keywords=<kw>` result pages (httpx + regex/bs4; Playwright fallback exists if needed), parse title/university/deadline/link → `source='phd'`.
- [ ] Add 1–2 similar boards behind the same interface: **jobs.ac.uk** (UK, clean HTML), **EURAXESS** (EU, has search API-ish endpoints), **academicpositions.com**, **PhDportal** — pick the two easiest to parse reliably.
- [ ] PhD profile stays config-driven: girlfriend's specs go into `phd_profile:` via Settings → PhD Profile (user will update — placeholders fine until then). Keywords for board queries come from `phd_profile.positions/expertise`.
- [ ] Wire into "Crawl PhD" button + daily run (free, no Serper cost).

---

## Suggested execution order

| Order | Phase | Why first |
|---|---|---|
| 1 | Phase 0 | 30-min fixes, commit safety, removes daily annoyances |
| 2 | Phase 1 | protects the 2,500-credit budget before anything else runs |
| 3 | Phase 2 | scoring quality unblocks priority/ranking everywhere else |
| 4 | Phase 3 | chat is the main interaction surface |
| 5 | Phase 4 | feeds (LinkedIn fix depends on Phase 1 alternatives spike) |
| 6 | Phase 6 | discovery breadth (free sources, complements Phase 1) |
| 7 | Phase 5 | pure polish, anytime |

Each phase ends with: build (`cd frontend && npm run build`), restart backend, exercise the
feature in the app, tick boxes here, **commit**.
