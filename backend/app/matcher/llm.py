from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

MATCH_PROMPT = """\
You are a job match evaluator. Given a candidate profile and a job listing,
output a JSON object with exactly two fields:
- "score": integer 0 to 10 (10 = perfect match)
- "reason": one sentence explaining the score

Candidate profile:
Positions seeking: {positions}
Skills: {expertise}
Background: {resume_summary}

Job:
Title: {title}
Company: {company}
Description: {description}

Return ONLY valid JSON. No markdown, no explanation outside the JSON.\
"""


class OllamaMatcher:
    def __init__(self, base_url: str, model: str, timeout: float = 30.0):
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._timeout = timeout

    async def score_job(
        self,
        title: str,
        company: Optional[str],
        description: Optional[str],
        positions: list[str],
        expertise: list[str],
        resume_summary: str,
    ) -> tuple[Optional[float], Optional[str]]:
        # Use chars 200-1200 to skip boilerplate intro
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

        payload = {
            "model": self._model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
        }

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self._base_url}/api/chat",
                    json=payload,
                    timeout=self._timeout,
                )
                resp.raise_for_status()
        except httpx.TimeoutException:
            logger.warning("Ollama timed out scoring job: %s", title)
            return None, None
        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            logger.warning("Ollama error scoring job %r: %s", title, e)
            return None, None

        content = resp.json().get("message", {}).get("content", "")
        try:
            # Strip any accidental markdown fences
            clean = content.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            result = json.loads(clean)
            score = float(result["score"])
            reason = str(result["reason"])
            return score, reason
        except Exception:
            logger.warning("Failed to parse Ollama response for %r: %r", title, content[:200])
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
            await asyncio.sleep(0.1)  # small gap between Ollama calls
        return results
