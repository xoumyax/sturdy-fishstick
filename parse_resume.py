#!/usr/bin/env python3
"""
Parse a resume file (PDF, DOCX, PPTX, HTML, etc.) using Docling
and save the extracted text to backend/Resume/.

Usage:
    python parse_resume.py path/to/resume.pdf
    python parse_resume.py path/to/resume.docx --output my_resume.txt

Requirements:
    pip install docling
"""

import argparse
import sys
from pathlib import Path

RESUME_DIR = Path(__file__).parent / "backend" / "Resume"


def main():
    parser = argparse.ArgumentParser(description="Parse a resume file into text using Docling.")
    parser.add_argument("input", help="Path to the resume file (PDF, DOCX, etc.)")
    parser.add_argument("--output", help="Output filename (saved to backend/Resume/). Defaults to <input_stem>.txt")
    args = parser.parse_args()

    input_path = Path(args.input).expanduser().resolve()
    if not input_path.exists():
        print(f"✗ File not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    try:
        from docling.document_converter import DocumentConverter, PdfFormatOption
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions
    except ImportError:
        print("✗ Docling not installed. Run: pip install docling", file=sys.stderr)
        sys.exit(1)

    print(f"→ Parsing {input_path.name} with Docling…")

    # Disable OCR — resumes are text-based PDFs; OCR isn't needed and pulls heavy models
    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_ocr = False

    converter = DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)}
    )
    result = converter.convert(str(input_path))
    text = result.document.export_to_markdown()

    RESUME_DIR.mkdir(parents=True, exist_ok=True)
    out_name = args.output or (input_path.stem + ".txt")
    out_path = RESUME_DIR / out_name
    out_path.write_text(text, encoding="utf-8")

    word_count = len(text.split())
    print(f"✓ Saved to {out_path}")
    print(f"  {word_count} words extracted")


if __name__ == "__main__":
    main()
