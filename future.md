# future.md — local LLM choices for Sturdy Fishstick

What runs the app today, why, and what to switch to on the next machine.
Benchmarked with `backend/scripts/bench_models.py` (categorical scoring prompt +
deterministic prefilter — see `backend/app/matcher/llm.py`).

## Current machine: MacBook Air M1, 8 GB unified memory

Constraint: model + macOS + browser + backend must coexist ⇒ keep the resident
model ≤ ~2.5 GB and unload aggressively (the app already unloads after every
scoring pass, and generation models auto-unload after 5 min idle).

| Role | Model | RAM | Why |
|---|---|---|---|
| Scoring (routine, batch) | **qwen3:1.7b** (thinking ON) | ~1.4 GB | Only small model tested that discriminates: exact-specialization matches → 9–10, adjacent roles → 5–6, senior/aggregate traps → 0–2. ~15–20 s/job, fine for a daily batch. |
| Generation (cover letters, resume tips, chat) | **LFM2.5-1.2B-Instruct** | ~0.8 GB | Fast (~1.5 s first token), good prose, on-device-optimized. |

### Shootout results (2026-07-04, synthetic known-quality cases)

| Model | Verdict |
|---|---|
| LFM2.5-350M | No discrimination — everything scored 6. Fine only as a text generator for trivial tasks. |
| LFM2.5-1.2B-Instruct | Catches senior traps, but no field separation (perfect match = generic frontend = 6). Kept for generation. |
| LFM2.5-1.2B-Thinking (GGUF) | Unusable via Ollama: raw `<think>` floods the context before JSON appears; ~35 s/job. Deleted. |
| qwen3:1.7b (thinking) | Winner: 10 / 10 / 6 / 1 / 0 / 10 on the test set. Thinking mode is essential — with `think: false` it collapses to 6s. |
| phi3:mini | Legacy (pre-2026-07). No longer used; `ollama rm phi3:mini` frees 2.2 GB disk. |

### Lessons that transfer to any machine
- Small models cannot emit calibrated 0–10 scores; they collapse to one number.
  Ask categorical questions (real job? level? field? skills?) and map to a score
  in Python (`_categories_to_score`).
- Handle the easy cases without an LLM: senior titles and aggregate pages are
  regex-detectable (`prefilter_score`) — instant and 100% consistent.
- Thinking/reasoning mode is worth 10× latency for *judgment* tasks run in
  batch, and worthless for streaming chat.

## Next machine: Mac mini M4, 24 GB unified memory

Budget ~16 GB for models while the app runs. Recommended lineup (Ollama):

| Role | First choice | RAM (Q4) | Alternative |
|---|---|---|---|
| Scoring | **qwen3:8b** (thinking) | ~5.5 GB | qwen3:4b (~3 GB) if you want faster daily passes |
| Generation / chat | **gemma3:12b-it-qat** | ~8 GB | llama3.3-equivalent small, or qwen3:8b doing double duty |
| Heavy drafting (cover letters you'll actually send) | **qwen3:14b** or **phi4:14b** | ~9 GB | mistral-small3.2:24b (~13 GB) when nothing else is loaded |
| RAG embeddings (Phase 3+) | **nomic-embed-text** | ~0.3 GB | embeddinggemma (~0.6 GB) |
| Open-weights reasoning (optional) | gpt-oss:20b (MXFP4) | ~13 GB | needs most of the budget; use keep_alive=0 |

Notes for the M4:
- With 24 GB you can keep the scorer resident (`keep_alive: 30m`) instead of
  unloading — scheduled passes start instantly.
- Re-check the Ollama library then: model quality moves fast; re-run
  `bench_models.py` with any new 4–14 B contender before switching.
- Embeddings + sqlite-vec would upgrade the Phase 3 FTS5 RAG to semantic
  retrieval with negligible RAM cost.
