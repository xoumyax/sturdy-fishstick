from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Small local models can't produce calibrated 0-10 scores directly (they
# collapse to one number). Instead we ask four easy categorical questions and
# compute the score deterministically in _categories_to_score().
MATCH_PROMPT = """\
Evaluate ONE job listing against a candidate. Answer four questions about it.

Questions:
1. real_job — true if this is a single genuine job/position listing. \
false if it is a search-results page, a list of many jobs, a blog/social post, \
a person's CV, or anything that is not one specific opening.
2. level — "intern" if it is an internship, PhD/graduate student role, \
fellowship, or explicitly early-career. "senior" if the title or text says \
senior, staff, principal, lead, manager, director, VP, or requires 5+ years \
of experience. Otherwise "early".
3. field_match — "strong" only if the job's PRIMARY focus is the candidate's \
specialization (the first few core skills below). "partial" if it is general \
software/data/ML work outside that specialization. "none" if a different field \
entirely.
4. skills_overlap — "high" if the job needs several of the candidate's core \
skills, "medium" if a few, "low" if almost none.

Candidate:
Target positions: {positions}
Core skills: {expertise}
Background: {resume_summary}

Job listing:
Title: {title}
Company: {company}
Description: {description}

Return ONLY a JSON object exactly like:
{{"real_job": true, "level": "intern", "field_match": "partial", "skills_overlap": "medium", "reason": "<one short sentence>"}}\
"""


_SENIOR_TITLE_WORDS = (
    "senior ", "sr. ", "sr ", "staff ", "principal ", "director", "vp ",
    "vice president", "head of", "manager", " lead", "lead,", "lead ",
)
_JUNK_TITLE_PATTERNS = (
    "'s post", "- linkedin", "jobs in ", "+ jobs", ".md at main", "cv -",
    "top 20", "apply now", "hiring now", "job openings", "internships:",
)


def prefilter_score(title: str) -> Optional[tuple[float, str]]:
    """Deterministic score for obvious cases — no LLM call needed.
    Returns None when the LLM should decide."""
    t = f" {title.lower()} "
    if any(p in t for p in _JUNK_TITLE_PATTERNS):
        return 0.0, "Not a single job listing (aggregate/post/page)"
    if any(w in t for w in _SENIOR_TITLE_WORDS) and "intern" not in t:
        return 1.0, "Senior-level title"
    return None


def _categories_to_score(cats: dict) -> Optional[float]:
    """Deterministic score from the model's categorical answers."""
    if not cats.get("real_job", True):
        return 0.0
    level = str(cats.get("level", "early")).lower()
    field = str(cats.get("field_match", "none")).lower()
    skills = str(cats.get("skills_overlap", "low")).lower()

    base = {"strong": 8, "partial": 5, "none": 2}.get(field, 2)
    base += {"high": 1, "medium": 0, "low": -1}.get(skills, 0)
    if level == "senior":
        return float(min(base, 2))
    if level == "intern":
        base += 1
    return float(max(0, min(10, base)))

COVER_LETTER_PROMPT = """\
You are a professional cover letter writer. Write a concise, compelling cover letter \
for the job below based on the candidate's profile. Use a warm but professional tone. \
3 short paragraphs: (1) why this role, (2) relevant skills/experience, (3) closing. \
Address it to "Hiring Manager". Do not invent facts.

Candidate:
Name: {name}
Positions seeking: {positions}
Skills: {expertise}
Background: {resume_summary}

Job:
Title: {title}
Company: {company}
Description: {description}

Write only the cover letter body. Start with "Dear Hiring Manager,"\
"""

RESUME_ADVICE_PROMPT = """\
You are an expert career coach and resume reviewer. Analyze the candidate's resume(s) \
against the job description below and give specific, actionable advice.

Structure your response with these sections:
## Add or Emphasize
- Bullet points for skills/experiences to highlight or add

## Remove or De-emphasize
- Bullet points for things that hurt more than help for this role

## Reword
- Specific suggestions: "Change X to Y" format

## Keywords to Include
- ATS-critical keywords from the job description missing from the resume

Be specific and reference actual content from both the resume and job description.

---
CANDIDATE RESUME(S):
{resume_text}

---
JOB:
Title: {title}
Company: {company}
Description: {description}

---
CANDIDATE PROFILE:
Name: {name}
Target positions: {positions}
Core skills: {expertise}\
"""


class OllamaMatcher:
    def __init__(self, base_url: str, model: str, timeout: float = 30.0,
                 think: Optional[bool] = None):
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._timeout = timeout
        self._think = think  # False disables thinking on models like qwen3

    async def _call_ollama(self, prompt: str, timeout: Optional[float] = None,
                            keep_alive: int = 0, num_ctx: int = 2048,
                            temperature: Optional[float] = None) -> Optional[str]:
        options = {"num_ctx": num_ctx}
        if temperature is not None:
            options["temperature"] = temperature
        payload = {
            "model": self._model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "keep_alive": keep_alive,   # 0 = unload immediately; seconds otherwise
            "options": options,
        }
        if self._think is not None:
            payload["think"] = self._think
        t = timeout or self._timeout
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(f"{self._base_url}/api/chat", json=payload, timeout=t)
                resp.raise_for_status()
            return resp.json().get("message", {}).get("content", "")
        except httpx.TimeoutException:
            logger.warning("Ollama timed out (timeout=%.0fs)", t)
            return None
        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            logger.warning("Ollama error: %s", e)
            return None

    async def unload(self) -> None:
        """Ask Ollama to evict this model immediately so RAM is freed."""
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{self._base_url}/api/chat",
                    json={"model": self._model, "messages": [], "keep_alive": 0},
                    timeout=10.0,
                )
            logger.info("Requested unload of model %s", self._model)
        except Exception as e:
            logger.debug("Model unload request failed: %s", e)


async def unload_all_models(base_url: str) -> None:
    """Evict every model Ollama currently has loaded — end-of-run cleanup."""
    base = base_url.rstrip("/")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{base}/api/ps", timeout=10.0)
            resp.raise_for_status()
            loaded = [m.get("name") for m in resp.json().get("models", []) if m.get("name")]
            for name in loaded:
                await client.post(
                    f"{base}/api/chat",
                    json={"model": name, "messages": [], "keep_alive": 0},
                    timeout=10.0,
                )
            if loaded:
                logger.info("Unloaded %d model(s): %s", len(loaded), ", ".join(loaded))
    except Exception as e:
        logger.debug("unload_all_models failed: %s", e)

    async def score_job(
        self,
        title: str,
        company: Optional[str],
        description: Optional[str],
        positions: list[str],
        expertise: list[str],
        resume_summary: str,
    ) -> tuple[Optional[float], Optional[str]]:
        pre = prefilter_score(title)
        if pre is not None:
            return pre

        desc = description or ""
        relevant_desc = desc[200:1200] if len(desc) > 200 else desc

        prompt = MATCH_PROMPT.format(
            positions=", ".join(positions),
            expertise=", ".join(expertise),
            resume_summary=resume_summary.strip(),
            title=title,
            company=company or "Unknown",
            description=relevant_desc,
        )

        content = await self._call_ollama(prompt, keep_alive=120, num_ctx=2048, temperature=0)
        if content is None:
            return None, None

        try:
            clean = content.strip().removeprefix("```json").removeprefix("```").strip()
            # Extract just the first balanced JSON object — handles extra text after the closing brace
            start = clean.find("{")
            if start == -1:
                raise ValueError("no JSON object in response")
            depth, end = 0, -1
            for i, ch in enumerate(clean[start:], start):
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
            result = json.loads(clean[start:end] if end != -1 else clean)
            score = _categories_to_score(result)
            if score is None:
                raise ValueError(f"could not derive score from {result}")
            detail = f"{result.get('field_match', '?')} field / {result.get('skills_overlap', '?')} skills / {result.get('level', '?')}"
            reason = str(result.get("reason", "")).strip()
            return score, f"{reason} ({detail})" if reason else detail
        except Exception:
            logger.warning("Failed to parse Ollama score response for %r: %r", title, content[:200])
            return None, None

    async def score_batch(
        self,
        jobs: list[dict],
        positions: list[str],
        expertise: list[str],
        resume_summary: str,
    ) -> list[tuple[Optional[float], Optional[str]]]:
        results = []
        for job in jobs:
            score, reason = await self.score_job(
                title=job["title"],
                company=job.get("company"),
                description=job.get("description"),
                positions=positions,
                expertise=expertise,
                resume_summary=resume_summary,
            )
            results.append((score, reason))
            await asyncio.sleep(0.1)
        return results

    async def generate_cover_letter(
        self,
        title: str,
        company: Optional[str],
        description: Optional[str],
        name: str,
        positions: list[str],
        expertise: list[str],
        resume_summary: str,
    ) -> Optional[str]:
        prompt = COVER_LETTER_PROMPT.format(
            name=name,
            positions=", ".join(positions),
            expertise=", ".join(expertise),
            resume_summary=resume_summary.strip(),
            title=title,
            company=company or "the company",
            description=(description or "")[:2000],
        )
        return await self._call_ollama(prompt, timeout=60.0, keep_alive=300, num_ctx=2048)

    async def generate_resume_advice(
        self,
        title: str,
        company: Optional[str],
        description: Optional[str],
        resume_text: str,
        name: str,
        positions: list[str],
        expertise: list[str],
    ) -> Optional[str]:
        prompt = RESUME_ADVICE_PROMPT.format(
            resume_text=resume_text[:4000],
            title=title,
            company=company or "the company",
            description=(description or "")[:1500],
            name=name,
            positions=", ".join(positions),
            expertise=", ".join(expertise),
        )
        return await self._call_ollama(prompt, timeout=90.0, keep_alive=300, num_ctx=3072)
