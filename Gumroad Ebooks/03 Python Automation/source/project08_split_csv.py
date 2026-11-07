"""Project 8: split a big CSV into smaller files, repeating the header."""
import argparse
import csv
from pathlib import Path


def main(argv=None):
    parser = argparse.ArgumentParser(description="Split a CSV file.")
    parser.add_argument("input", type=Path)
    parser.add_argument("outdir", type=Path)
    parser.add_argument("--rows", type=int, default=10, help="rows per part")
    args = parser.parse_args(argv)
    if not args.input.is_file():
        print(f"Error: {args.input} not found.")
        return 1
    if args.rows < 1:
        print("Error: --rows must be 1 or more.")
        return 1
    if args.outdir.exists() and any(args.outdir.iterdir()):
        print(f"Error: {args.outdir} is not empty. Choose a new folder.")
        return 1
    args.outdir.mkdir(parents=True, exist_ok=True)

    parts = total = 0
    with args.input.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.reader(fh)
        header = next(reader, None)
        if header is None:
            print("Error: the file is empty.")
            return 1
        batch = []
        for row in reader:
            batch.append(row)
            if len(batch) == args.rows:
                parts += 1
                write_part(args.outdir, args.input.stem, parts, header, batch)
                total += len(batch)
                batch = []
        if batch:  # the last, shorter part
            parts += 1
            write_part(args.outdir, args.input.stem, parts, header, batch)
            total += len(batch)
    print(f"Split {total} data rows into {parts} files in {args.outdir}")
    return 0


def write_part(outdir, stem, number, header, rows):
    path = outdir / f"{stem}_part{number:03d}.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(header)
        writer.writerows(rows)
    print(f"  {path.name}: {len(rows)} rows")


if __name__ == "__main__":
    raise SystemExit(main())
