# PLAN.md — Sturdy Fishstick feature roadmap

> Source of truth for the requests in [FEATURE.md](FEATURE.md). We implement **one phase at a
> time**, verify it in the running app, tick the boxes here, and **commit before moving on**
> (the first Dual Mode implementation was lost to an uncommitted session — never again).
>
> Status legend: `[ ]` todo · `[x]` done · `[~]` partially done / needs follow-up
>
> Last updated: 2026-07-04 — **ALL PHASES (0–6) COMPLETE.**
> (commits: b44cb95, 53c6bb7, ea773f0, 0ca269c, f190c22, cd077f7, + Phase 5/6 commits)
>
> ⚠️ Open loose ends: (1) re-score was interrupted with ~700 jobs unscored — start the app
> (`./start.sh`) and hit "Score jobs (N)"; (2) careers LinkedIn-posts query needs loosening;
> (3) girlfriend's phd_profile specs pending; (4) check priority_threshold after re-score.

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
- [x] `git add` + commit current tree — commit `b44cb95` (2026-07-04).

### 0.1 Bug #5 — chat closes when clicking the message box
**Root cause (found):** in `App.jsx → CornerCompanions`, the `<CharacterChat>` panel is rendered
*inside* the character's wrapper `<div>` which has `onClick={() => toggle(persona)}`. Any click
inside the open chat (input box, messages) bubbles up and toggles the chat closed.
- [x] Stop propagation at the chat panel root in `CharacterChat.jsx` (click + mouseEnter).
- [x] Close button already stopped propagation; badge sits under the sprite (toggle is the intended behavior there).
- Files: `frontend/src/components/CharacterChat.jsx`, `frontend/src/App.jsx`

### 0.2 Bug #6 — "Score Pending" reads as a stuck status
**Root cause (found):** "Score Pending" is the *label of the manual trigger button* on the
Dashboard — it's always visible, so it reads like a permanent status. When clicked with zero
unscored jobs, nothing visibly happens (backend correctly does nothing: DB currently has 0
unscored). No feedback loop.
- [x] `POST /search/score-pending` returns `{pending: N}` (and `status: idle` at 0); added `GET /search/pending-count`.
- [x] Button is dynamic: "Score jobs (N)" → spinner "Scoring… N left" (polls every 5s, refreshes job list on finish) → green "All scored" chip at 0.
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
- [x] **Daily cap enforcement:** `serper_usage` table + `serper_budget.try_spend()`, checked inside `SerperScraper._fetch_google_jobs` (single choke point, shared by scheduled runs + career fallback + PhD crawl); `search.serper_daily_cap: 10` in config; cap note written to run history `error_msg`.
- [x] **Query rationing:** `_ration_queries()` in scheduler — 8-query window (cap − 2 reserve) rotates through the full 120-query list daily, derived from `date.today().toordinal()` (no state).
- [x] **Killed `fetch_linkedin` via Serper** — method deleted, `linkedin` removed from config sources (it only produced aggregate search pages).
- [x] Career-crawl Serper fallback + PhD crawl trimmed from 2 queries per company/institution to 1.
- [x] **Free alternative chosen: `python-jobspy`** — spike verified 2026-07-04: 10 real LinkedIn postings (direct `/jobs/view/` URLs, title/company/location) with no login and zero credits. Added to requirements.txt; wiring into the pipeline happens in Phase 4.2. (Adzuna/Jooble/RSS not needed for now.)
- [~] **Shift bulk discovery to free sources:** GitHub + Greenhouse/Lever already free; jobspy validated; more ATS APIs + FindAPhD land in Phase 6.
- Files: `backend/app/scrapers/serper.py`, `backend/app/scheduler.py`, `backend/app/config.py`, `backend/config.yaml`

---

## Phase 2 — Model quality (#1, #15)

### 2.1 Tighten scoring (#1) — done, with a twist
The plan's "strict rubric prompt" approach **failed on small models**: the 1.2B collapsed to
scoring everything 2 (including a perfect synthetic match). What shipped instead:
- [x] **Categorical decomposition:** the model answers 4 easy questions (`real_job`, `level`,
  `field_match`, `skills_overlap`) and `_categories_to_score()` maps them to 0–10
  deterministically in Python. Small models handle categories far better than calibrated numbers.
- [x] **Deterministic prefilter** (`prefilter_score`): senior titles → 1, aggregate/junk pages
  ("N+ jobs", "'s Post - LinkedIn", ".md at main"…) → 0, no LLM call at all.
- [x] temperature 0 for scoring; `think` param support in OllamaMatcher.
- [x] `scoring_model` → **qwen3:1.7b** (thinking) — not the LFM 1.2B as originally guessed;
  see shootout in future.md. Generation stays LFM2.5-1.2B-Instruct.
- [x] Full re-score of 1,090 jobs kicked off 2026-07-04 (backgrounded, hours).
- [ ] After re-score completes: check distribution, recalibrate `priority_threshold` if needed.

### 2.2 Best model for MacBook Air M1 8GB (#15)
- [x] Benchmark script `backend/scripts/bench_models.py` (parse rate, spread, senior-leak, latency).
- [x] Shootout run: 350M = no discrimination; 1.2B-Instruct = traps only; 1.2B-Thinking GGUF =
  broken via Ollama (raw `<think>` overruns ctx); **qwen3:1.7b (thinking) = winner**.
- [x] **`future.md` written** — current picks + M4-mini-24GB lineup (qwen3:8b scorer,
  gemma3:12b-qat generation, nomic-embed-text for RAG) and transferable lessons.
- [x] setup.sh now pulls qwen3:1.7b + LFM2.5-1.2B-Instruct (phi3:mini references removed;
  `ollama rm phi3:mini` frees 2.2 GB disk).

---

## Phase 3 — Chat: RAG + expandable UI (#2, #3, #4)

### 3.1 RAG-style assistants (#2) ✅ 2026-07-04
- [x] **`backend/app/rag.py`**: FTS5 index over jobs (auto-rebuilt when job count changes,
  LIKE fallback if FTS5 missing); exact SQL aggregates (totals, statuses, sources, score
  buckets, top countries — all mode-scoped) so counts come from the DB, not the LLM;
  bundle = stats + top-8 FTS-matched jobs (HTML-stripped snippets) + last 3 runs + watchlist
  summary, capped ~3.8k chars.
- [x] `/chat/stream` retrieves on the latest user message for personas AND main Fishstick
  (main also keeps resume + focused-job sections); num_ctx → 4096.
- [x] Verified end-to-end: "How many PhD positions total / in Switzerland?" → "103 / 5" (exact).
- [ ] Optional (M4 machine): embeddings + sqlite-vec for semantic retrieval — see future.md.

### 3.2 Expandable chat windows (#3) + icon docking (#4) ✅ 2026-07-04
- [x] `CharacterChat`: bubble → half (50vw) → full (inset 0) with header buttons; clicking the
  active size returns to bubble; size persisted per persona (`charChatSize:puff|brownie`).
- [x] `ChatPanel`: side (390px) → half → full, persisted (`chatPanelSize`); stale "phi3:mini"
  header label fixed.
- [x] Icon docking: expanded chat hides the corner sprites + name badges (fade/slide) and shows
  the character's avatar image in the chat header; sprites return when shrunk/closed.
- [x] Multi-turn history survives resize/close (components stay mounted; state above the
  resizing container). Conversation column centered at 720–760px in expanded modes.

---

## Phase 4 — Feeds & panels (#7, #9, #10, #11)

### 4.1 Careers panel grouped by company (#7) ✅ 2026-07-04
- [x] Expanded Careers/PhD panel modal: one collapsed card per company (initial, name, count,
  top score, priority chip) — click to reveal that company's listings (accordion).

### 4.2 Fix LinkedIn (#9) ✅ 2026-07-04 — real listings via jobspy
- [x] `scrapers/jobspy_scraper.py`: real LinkedIn postings (direct /jobs/view/ URLs) with full
  descriptions (`linkedin_fetch_description=True`), async thread wrapper, URL dedupe.
- [x] Wired into the daily pipeline (2 careers terms, free) and a new
  `POST /search/crawl-linkedin` (careers + PhD listings + posts, then scoring pass).
- [x] Purged the 34 junk `source='linkedin'` aggregate rows.
- [x] Verified live: 20 careers + 16 PhD real listings (ByteDance, Tesla, Rippling, Skild AI…).
- [ ] Optional secondary: dummy-account `linkedin-api` if jobspy ever gets rate-limited.

### 4.3 LinkedIn in PhD mode (#10) + posts vs listings (#11) ✅ 2026-07-04
- [x] **Schema:** `Job.kind` (listing|post) + **`Job.track`** (careers|phd) with migration +
  backfill; ALL mode filtering (jobs, stats, trends, RAG, scoring groups) moved from
  `source=='phd'` to `track` — so LinkedIn PhD jobs live in the PhD dashboard properly.
- [x] Posts discovery via Serper `site:linkedin.com/posts` (1 credit/query, budget-capped,
  last-week filter); PhD variant `"PhD position" ("fully funded" OR "hiring")`.
  Verified: 10 PhD hiring posts fetched with 2 credits.
- [x] LinkedIn panel: visible in BOTH modes, mode-scoped, Listings/Posts tabs, Fetch button
  (auto-refreshes as results land). Posts excluded from the main dashboard job list.
- [ ] Tune the careers posts query (exact phrase `"hiring" "<position>"` returned 0 this run —
  loosen to e.g. `hiring (intern OR internship) machine learning`).

---

## Phase 5 — Dashboard aesthetics (#12) ✅ 2026-07-04

- [x] `FishingBackground` rebuilt: 3 parallax wave layers, rising bubbles, swaying kelp bed,
  a drifting jellyfish, a tiny fish school, denser stars in dark mode; `prefers-reduced-motion`
  disables all background animation.
- [x] Per-mode ambient theme: teal tropical sea (My Careers) vs indigo deep-sea/night-sky (PhD)
  — sky, water, waves, fish palette and kelp all switch with the mode toggle (fade transition).
- [x] Dark-mode contrast fixes: page h1s (Dashboard/Tracker/Settings) and CountryCard
  number/name now have `dark:` variants.

---

## Phase 6 — Advanced discovery (#13)

### 6.1 Careers: broader company coverage ✅ 2026-07-04
- [x] Four new free ATS APIs in the career crawler: **Ashby**, **Workable**, **SmartRecruiters**,
  **Recruitee** — URL-pattern detection + JSON crawlers. Verified live (Ashby/openai → 724
  postings; the existing `_is_relevant` filter trims to intern-level matches).
- [x] `POST /search/discover-companies` + **Discover** button in Settings → Career Watch:
  finds boards hiring for profile keywords via ≤6 budget-capped Serper queries, merges new
  companies into the watchlist under "Discovered".
- [~] `_is_relevant` kept as-is for now — revisit if the wider net floods the DB.

### 6.2 PhD: academic boards ✅ 2026-07-04 (FindAPhD not possible)
- [x] `scrapers/phd_boards.py`: **EURAXESS** + **jobs.ac.uk** scrapers (httpx + bs4, free).
  **FindAPhD, academicpositions.com, and scholarshipdb.net are Cloudflare-walled** (verified:
  challenge pages even via headless Chromium) — skipped rather than building bot evasion.
- [x] Boards' keyword params are unreliable server-side → results filtered to doctoral-titled
  positions locally; the LLM scorer judges topical fit against phd_profile.
- [x] Wired into "Crawl PhD" (button + endpoint); keywords come from `phd_profile.expertise`.
- [x] Resume update: `backend/Resume/*___CAREER.txt` / `*___PHD.txt` (user-curated text) now
  take priority over PDF extraction in `resumes.py`; her PhD CV drives PhD mode.
- [ ] Girlfriend's exact `phd_profile:` specs — user updates via Settings → PhD Profile.

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
