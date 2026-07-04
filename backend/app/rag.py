"""Lightweight retrieval over everything the app knows, for the chat assistants.

No embedding model — on an 8GB machine we use SQLite FTS5 (zero extra RAM) for
keyword retrieval plus exact SQL aggregates for numeric questions, so counts
come from the database rather than the LLM's imagination.

build_context(message, mode) returns a text bundle:
  - exact stats (totals, statuses, priorities, score buckets, top countries)
  - top-k jobs matching the user's message (FTS5, bm25-ranked, mode-scoped)
  - recent search runs
  - watchlist summary
"""
from __future__ import annotations

import logging
import re

from sqlalchemy import text

from .database import engine

logger = logging.getLogger(__name__)

_MODE_SQL = {
    "phd": "AND source = 'phd'",
    "careers": "AND (source != 'phd' OR source IS NULL)",
}


def _mode_sql(mode: str | None) -> str:
    return _MODE_SQL.get(mode or "", "")


# ── FTS index ────────────────────────────────────────────────────────────────

def _ensure_fts(conn) -> bool:
    """Create/refresh the FTS index. Rebuild is cheap (<1s for a few thousand
    rows) and only happens when the job count changed."""
    try:
        conn.execute(text(
            "CREATE VIRTUAL TABLE IF NOT EXISTS jobs_fts USING fts5("
            "job_id UNINDEXED, title, company, description, notes)"
        ))
        n_jobs = conn.execute(text("SELECT COUNT(*) FROM jobs")).scalar()
        n_fts = conn.execute(text("SELECT COUNT(*) FROM jobs_fts")).scalar()
        if n_jobs != n_fts:
            conn.execute(text("DELETE FROM jobs_fts"))
            conn.execute(text(
                "INSERT INTO jobs_fts (job_id, title, company, description, notes) "
                "SELECT id, title, COALESCE(company,''), "
                "COALESCE(substr(description,1,1500),''), COALESCE(notes,'') FROM jobs"
            ))
            conn.commit()
            logger.info("Rebuilt jobs_fts index (%d rows)", n_jobs)
        return True
    except Exception as e:
        logger.warning("FTS unavailable, falling back to LIKE: %s", e)
        return False


_STOPWORDS = {
    "the", "a", "an", "of", "in", "on", "at", "for", "to", "and", "or", "is",
    "are", "was", "what", "which", "who", "how", "many", "much", "does", "do",
    "can", "could", "should", "would", "me", "my", "i", "you", "your", "show",
    "list", "find", "tell", "about", "with", "from", "job", "jobs", "have",
    "there", "any", "all", "that", "this", "it", "best", "top", "good",
}


def _keywords(message: str) -> list[str]:
    words = re.findall(r"[A-Za-z][A-Za-z0-9+#.-]{1,}", message.lower())
    return [w for w in words if w not in _STOPWORDS][:8]


def _search_jobs(conn, fts_ok: bool, message: str, mode: str | None, k: int = 8) -> list:
    kws = _keywords(message)
    if not kws:
        return []
    if fts_ok:
        match = " OR ".join(f'"{w}"' for w in kws)
        try:
            rows = conn.execute(text(
                "SELECT j.title, j.company, j.location, j.country, j.match_score, "
                "j.status, j.url, substr(COALESCE(j.description,''),1,150) "
                f"FROM jobs_fts f JOIN jobs j ON j.id = f.job_id "
                f"WHERE jobs_fts MATCH :m AND j.is_aggregate = 0 {_mode_sql(mode)} "
                "ORDER BY rank LIMIT :k"
            ), {"m": match, "k": k}).fetchall()
            return rows
        except Exception as e:
            logger.warning("FTS query failed (%s) — falling back to LIKE", e)
    like = f"%{kws[0]}%"
    return conn.execute(text(
        "SELECT title, company, location, country, match_score, status, url, "
        "substr(COALESCE(description,''),1,150) FROM jobs "
        f"WHERE is_aggregate = 0 {_mode_sql(mode)} "
        "AND (title LIKE :l OR company LIKE :l OR description LIKE :l) "
        "ORDER BY match_score DESC LIMIT :k"
    ), {"l": like, "k": k}).fetchall()


# ── Exact aggregates ─────────────────────────────────────────────────────────

def _stats_block(conn, mode: str | None) -> str:
    ms = _mode_sql(mode)
    total = conn.execute(text(f"SELECT COUNT(*) FROM jobs WHERE is_aggregate=0 {ms}")).scalar()
    prio = conn.execute(text(f"SELECT COUNT(*) FROM jobs WHERE is_aggregate=0 AND is_priority=1 {ms}")).scalar()
    unscored = conn.execute(text(f"SELECT COUNT(*) FROM jobs WHERE is_aggregate=0 AND match_score IS NULL {ms}")).scalar()

    statuses = conn.execute(text(
        f"SELECT status, COUNT(*) FROM jobs WHERE is_aggregate=0 {ms} GROUP BY status ORDER BY 2 DESC"
    )).fetchall()
    sources = conn.execute(text(
        f"SELECT COALESCE(source,'?'), COUNT(*) FROM jobs WHERE is_aggregate=0 {ms} GROUP BY source ORDER BY 2 DESC"
    )).fetchall()
    countries = conn.execute(text(
        f"SELECT COALESCE(country,'Other'), COUNT(*), "
        f"SUM(CASE WHEN match_score>=7 THEN 1 ELSE 0 END) "
        f"FROM jobs WHERE is_aggregate=0 {ms} GROUP BY country ORDER BY 2 DESC LIMIT 8"
    )).fetchall()
    buckets = conn.execute(text(
        f"SELECT CASE WHEN match_score>=9 THEN '9-10' WHEN match_score>=7 THEN '7-8' "
        f"WHEN match_score>=5 THEN '5-6' WHEN match_score>=3 THEN '3-4' ELSE '0-2' END b, COUNT(*) "
        f"FROM jobs WHERE is_aggregate=0 AND match_score IS NOT NULL {ms} GROUP BY b ORDER BY b DESC"
    )).fetchall()

    lines = [
        f"Mode: {'PhD positions' if mode == 'phd' else 'Career jobs (My Careers)'}",
        f"Total jobs: {total} | priority (score>=7): {prio} | unscored: {unscored}",
        "By status: " + ", ".join(f"{s}={n}" for s, n in statuses),
        "By source: " + ", ".join(f"{s}={n}" for s, n in sources),
        "Score buckets: " + (", ".join(f"{b}: {n}" for b, n in buckets) or "none scored yet"),
        "Top countries (total / score>=7): " + ", ".join(f"{c}={n}/{p or 0}" for c, n, p in countries),
    ]
    return "\n".join(lines)


def _runs_block(conn) -> str:
    rows = conn.execute(text(
        "SELECT started_at, status, jobs_found, jobs_new, COALESCE(error_msg,'') "
        "FROM search_runs ORDER BY started_at DESC LIMIT 3"
    )).fetchall()
    if not rows:
        return "No search runs yet."
    return "\n".join(
        f"- {str(r[0])[:16]} {r[1]}: found {r[2]}, new {r[3]}" + (f" ({r[4][:60]})" if r[4] else "")
        for r in rows
    )


def _watchlist_block() -> str:
    try:
        import json
        from .routers.config_router import CAREER_WATCH_PATH
        if not CAREER_WATCH_PATH.exists():
            return ""
        data = json.loads(CAREER_WATCH_PATH.read_text(encoding="utf-8"))
        total = sum(len(v) for v in data.values())
        cats = ", ".join(f"{k} ({len(v)})" for k, v in data.items())
        return f"Career watchlist: {total} companies — {cats}"
    except Exception:
        return ""


# ── Public API ───────────────────────────────────────────────────────────────

def build_context(message: str, mode: str | None, max_chars: int = 3800) -> str:
    """Retrieval bundle for the assistants' system prompt."""
    with engine.connect() as conn:
        fts_ok = _ensure_fts(conn)
        parts = ["## Live App Data (exact numbers from the database — use these for counts)"]
        parts.append(_stats_block(conn, mode))

        rows = _search_jobs(conn, fts_ok, message, mode)
        if rows:
            import html as html_mod
            parts.append("\n## Jobs matching the user's question (best matches first)")
            for t, co, loc, country, score, status, url, desc in rows:
                s = f"{score:.0f}/10" if score is not None else "unscored"
                parts.append(f"- [{s}] {t} @ {co or '?'} | {country or loc or '?'} | {status}\n  {url}")
                if desc and desc.strip():
                    clean = re.sub(r"<[^>]+>", " ", html_mod.unescape(desc))
                    clean = re.sub(r"\s+", " ", clean).strip()
                    if clean:
                        parts.append(f"  {clean[:130]}")

        parts.append("\n## Recent search runs")
        parts.append(_runs_block(conn))

        wl = _watchlist_block()
        if wl:
            parts.append(wl)

    bundle = "\n".join(parts)
    return bundle[:max_chars]
