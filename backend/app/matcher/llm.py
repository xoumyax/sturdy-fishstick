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
    def __init__(self, base_url: str, model: str, timeout: float = 30.0):
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._timeout = timeout

    async def _call_ollama(self, prompt: str, timeout: Optional[float] = None,
                            keep_alive: int = 0, num_ctx: int = 2048) -> Optional[str]:
        payload = {
            "model": self._model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "keep_alive": keep_alive,   # 0 = unload immediately; seconds otherwise
            "options": {"num_ctx": num_ctx},
        }
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

    async def score_job(
        self,
        title: str,
        company: Optional[str],
        description: Optional[str],
        positions: list[str],
        expertise: list[str],
        resume_summary: str,
    ) -> tuple[Optional[float], Optional[str]]:
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

        content = await self._call_ollama(prompt, keep_alive=120, num_ctx=2048)
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
            return float(result["score"]), str(result["reason"])
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
