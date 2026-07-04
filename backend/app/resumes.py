"""Shared resume loading for both routers.

Reads PDFs (via pypdf) plus .txt/.md from the mode-specific directory:
  Resume/Careers/  — industry resumes
  Resume/PhD/      — academic CV
Falls back to the legacy backend/Resume/ dir (parse_resume.py output) when
the mode directory is missing or empty. Extracted text is cached by mtime
so PDFs are only parsed once per change.
"""
from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# backend/app/resumes.py → three levels up is the project root
RESUME_BASE = Path(__file__).parent.parent.parent / "Resume"
LEGACY_DIR = Path(__file__).parent.parent / "Resume"

_cache: dict[Path, tuple[float, str]] = {}


def _extract(path: Path) -> str:
    mtime = path.stat().st_mtime
    cached = _cache.get(path)
    if cached and cached[0] == mtime:
        return cached[1]

    if path.suffix.lower() == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(str(path))
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as e:
            logger.warning("Failed to extract text from %s: %s", path.name, e)
            text = ""
    else:
        text = path.read_text(encoding="utf-8", errors="ignore")

    _cache[path] = (mtime, text)
    return text


def load_resumes(mode: str = "careers") -> str:
    subdir = "PhD" if mode == "phd" else "Careers"
    for directory in (RESUME_BASE / subdir, LEGACY_DIR):
        if not directory.exists():
            continue
        files = sorted(
            p for p in directory.iterdir()
            if p.is_file() and p.suffix.lower() in (".pdf", ".txt", ".md")
        )
        parts = []
        for f in files:
            text = _extract(f).strip()
            if text:
                parts.append(f"--- {f.name} ---\n{text}")
        if parts:
            return "\n\n".join(parts)
    return ""
