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


def _bundle(files) -> str:
    parts = []
    for f in files:
        text = _extract(f).strip()
        if text:
            parts.append(f"--- {f.name} ---\n{text}")
    return "\n\n".join(parts)


def load_resumes(mode: str = "careers") -> str:
    tag = "phd" if mode == "phd" else "career"
    other = "career" if mode == "phd" else "phd"

    # 1) Curated text files in backend/Resume tagged with CAREER / PHD in the
    #    filename win — cleaner than PDF extraction.
    if LEGACY_DIR.exists():
        tagged = sorted(
            p for p in LEGACY_DIR.iterdir()
            if p.is_file() and p.suffix.lower() in (".txt", ".md")
            and tag in p.name.lower()
        )
        if tagged:
            out = _bundle(tagged)
            if out:
                return out

    # 2) Mode-specific PDF directory at the project root.
    subdir = "PhD" if mode == "phd" else "Careers"
    mode_dir = RESUME_BASE / subdir
    if mode_dir.exists():
        files = sorted(
            p for p in mode_dir.iterdir()
            if p.is_file() and p.suffix.lower() in (".pdf", ".txt", ".md")
        )
        out = _bundle(files)
        if out:
            return out

    # 3) Last resort: any untagged legacy text files (excluding the other mode's).
    if LEGACY_DIR.exists():
        rest = sorted(
            p for p in LEGACY_DIR.iterdir()
            if p.is_file() and p.suffix.lower() in (".txt", ".md")
            and other not in p.name.lower()
        )
        out = _bundle(rest)
        if out:
            return out
    return ""
