"""Project 17: split a PDF by page ranges, for example "1-2,3-5".
Needs: python -m pip install pypdf"""
import argparse
from pathlib import Path

from pypdf import PdfReader, PdfWriter


def parse_ranges(text, page_count):
    """'1-2,5' -> [(1, 2), (5, 5)] with every number checked."""
    ranges = []
    for chunk in text.split(","):
        first, _, last = chunk.strip().partition("-")
        start = int(first)
        end = int(last) if last else start
        if not 1 <= start <= end <= page_count:
            raise ValueError(f"range '{chunk}' is outside 1-{page_count}")
        ranges.append((start, end))
    return ranges


def main(argv=None):
    parser = argparse.ArgumentParser(description="Split a PDF.")
    parser.add_argument("pdf", type=Path)
    parser.add_argument("outdir", type=Path)
    parser.add_argument("--ranges", required=True, help='e.g. "1-2,3-5"')
    args = parser.parse_args(argv)
    if not args.pdf.is_file():
        print(f"Error: {args.pdf} not found.")
        return 1
    reader = PdfReader(args.pdf)
    try:
        ranges = parse_ranges(args.ranges, len(reader.pages))
    except ValueError as error:
        print(f"Error: {error}")
        return 1

    args.outdir.mkdir(parents=True, exist_ok=True)
    for start, end in ranges:
        target = args.outdir / f"{args.pdf.stem}_pages_{start}-{end}.pdf"
        if target.exists():
            print(f"Skipped {target.name}: already exists")
            continue
        writer = PdfWriter()
        for index in range(start - 1, end):  # pypdf pages start at 0
            writer.add_page(reader.pages[index])
        with target.open("wb") as fh:
            writer.write(fh)
        print(f"Wrote {target.name} ({end - start + 1} pages)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
