"""Benchmark candidate scoring models on real jobs from the DB.

Usage:
    .venv/bin/python scripts/bench_models.py [model ...]

For each model: runs the production MATCH_PROMPT over a stratified sample of
jobs (careers + phd + a few senior-titled ones that SHOULD score low), then
reports JSON-parse rate, score distribution, and latency. Unloads each model
before moving to the next so the comparison is fair on 8GB RAM.
"""
from __future__ import annotations

import asyncio
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlmodel import Session, select

from app.config import load_config
from app.database import engine
from app.matcher.llm import OllamaMatcher
from app.models.job import Job

# 2026-07-04 shootout on synthetic known-quality cases (categorical prompt + prefilter):
#   LFM2.5-350M        — no discrimination (everything 6), ~1s/job
#   LFM2.5-1.2B-Instr  — traps only (senior→2), no field separation, ~1.5s/job
#   LFM2.5-1.2B-Think  — GGUF emits raw <think> that overruns ctx; unusable, ~35s/job
#   qwen3:1.7b (think) — WINNER: 10/10/6/1/0/10 separation, ~15-20s/job
DEFAULT_MODELS = [
    "hf.co/LiquidAI/LFM2.5-350M-GGUF:latest",
    "hf.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF:latest",
    "qwen3:1.7b",
]

SENIOR_WORDS = ("senior", "staff", "principal", "director", "manager", "lead")


def sample_jobs() -> list[Job]:
    """Stratified, deterministic sample: real ATS listings with descriptions,
    obvious good matches, senior traps, junk/aggregate-ish titles, phd."""
    with Session(engine) as session:
        ats = session.exec(  # career_page = Greenhouse/Lever, real descriptions
            select(Job).where(Job.source == "career_page", Job.description != None)
            .order_by(Job.date_found.desc()).limit(300)
        ).all()
        recent = session.exec(
            select(Job).where(Job.is_aggregate == False, Job.source != "phd")
            .order_by(Job.date_found.desc()).limit(200)
        ).all()
        phd = session.exec(select(Job).where(Job.source == "phd").limit(50)).all()

    def has(j, *words):
        t = j.title.lower()
        return any(w in t for w in words)

    good = [j for j in ats if has(j, "machine learning intern", "ml intern", "research intern", "ai intern")][:5]
    ats_other = [j for j in ats if has(j, "intern") and j not in good][:4]
    senior = [j for j in ats + recent if has(j, *SENIOR_WORDS)][:4]
    junk = [j for j in recent if has(j, "post -", "top 2026", ".md at main", "cv -")][:3]
    return good + ats_other + senior + junk + phd[:5]


async def bench(model: str, jobs: list[Job], cfg) -> dict:
    matcher = OllamaMatcher(base_url=cfg.ollama_base_url, model=model, timeout=90.0)
    scores, latencies, failures = [], [], 0
    senior_leak = 0  # senior-titled jobs that scored > 4

    for job in jobs:
        prof = cfg.phd_profile if (job.source == "phd" and cfg.phd_profile) else cfg.profile
        t0 = time.time()
        score, reason = await matcher.score_job(
            title=job.title, company=job.company, description=job.description,
            positions=prof.positions, expertise=prof.expertise,
            resume_summary=prof.resume_summary,
        )
        latencies.append(time.time() - t0)
        print(f"    [{score if score is not None else '??'}] {job.title[:64]} — {(reason or '')[:60]}")
        if score is None:
            failures += 1
        else:
            scores.append(score)
            if any(w in job.title.lower() for w in SENIOR_WORDS) and score > 4:
                senior_leak += 1

    await matcher.unload()
    return {
        "model": model,
        "n": len(jobs),
        "parse_ok": len(scores),
        "failures": failures,
        "mean": round(statistics.mean(scores), 2) if scores else None,
        "stdev": round(statistics.stdev(scores), 2) if len(scores) > 1 else None,
        "min": min(scores) if scores else None,
        "max": max(scores) if scores else None,
        "senior_leak": senior_leak,
        "avg_latency_s": round(statistics.mean(latencies), 2),
    }


async def main():
    models = sys.argv[1:] or DEFAULT_MODELS
    cfg = load_config()
    jobs = sample_jobs()
    print(f"Benchmarking {len(models)} models on {len(jobs)} jobs "
          f"(incl. {sum(1 for j in jobs if any(w in j.title.lower() for w in SENIOR_WORDS))} senior-titled, "
          f"{sum(1 for j in jobs if j.source == 'phd')} phd)\n")

    for model in models:
        try:
            r = await bench(model, jobs, cfg)
        except Exception as e:
            print(f"{model}: FAILED — {e}")
            continue
        print(f"{r['model']}\n"
              f"  parsed {r['parse_ok']}/{r['n']} (failures: {r['failures']}) | "
              f"mean {r['mean']} stdev {r['stdev']} range [{r['min']}, {r['max']}] | "
              f"senior>4: {r['senior_leak']} | avg {r['avg_latency_s']}s/job\n")


if __name__ == "__main__":
    asyncio.run(main())
