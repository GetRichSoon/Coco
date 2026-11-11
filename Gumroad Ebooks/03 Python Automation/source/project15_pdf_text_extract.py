"""Project 15: extract the text of a PDF page by page into a .txt file.
Works only for PDFs that contain real text. Scanned pages need OCR.
Needs: python -m pip install pypdf"""
import argparse
from pathlib import Path

from pypdf import PdfReader
from pypdf.errors import PyPdfError


def main(argv=None):
    parser = argparse.ArgumentParser(description="Extract text from a PDF.")
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--out", type=Path, help="default: same name, .txt")
    args = parser.parse_args(argv)
    if not args.pdf.is_file():
        print(f"Error: {args.pdf} not found.")
        return 1
    out = args.out or args.pdf.with_suffix(".txt")
    if out.exists():
        print(f"Error: {out} already exists. Use --out with a new name.")
        return 1

    try:
        reader = PdfReader(args.pdf)
        if reader.is_encrypted:
            print("Error: the PDF is password protected.")
            return 1
        parts, empty, words = [], [], 0
        for number, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").strip()
            if not text:
                empty.append(number)
            words += len(text.split())
            parts.append(f"--- Page {number} ---\n{text}\n")
    except (PyPdfError, OSError) as error:
        print(f"Error: could not read the PDF ({error}).")
        return 1

    out.write_text("\n".join(parts), encoding="utf-8")
    print(f"{len(reader.pages)} pages, about {words} words -> {out}")
    if empty:
        print(f"No text found on pages {empty}: probably scanned images. "
              "OCR is needed for those.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
