"""Project 16: join several PDFs into one, in the order you list them.
Needs: python -m pip install pypdf"""
import argparse
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.errors import PyPdfError


def main(argv=None):
    parser = argparse.ArgumentParser(description="Merge PDF files.")
    parser.add_argument("output", type=Path)
    parser.add_argument("inputs", type=Path, nargs="+")
    args = parser.parse_args(argv)
    if args.output.exists():
        print(f"Error: {args.output} already exists. Choose a new name.")
        return 1

    writer = PdfWriter()
    for path in args.inputs:
        try:
            reader = PdfReader(path)
            if reader.is_encrypted:
                print(f"Skipped {path.name}: password protected")
                continue
            for page in reader.pages:
                writer.add_page(page)
            print(f"Added {path.name}: {len(reader.pages)} pages")
        except (PyPdfError, OSError) as error:
            print(f"Skipped {path}: {error}")
    if len(writer.pages) == 0:
        print("Nothing was merged.")
        return 1
    with args.output.open("wb") as fh:
        writer.write(fh)
    print(f"Saved {args.output}: {len(writer.pages)} pages")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
