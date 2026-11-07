"""Project 7: clean a messy CSV. Writes a clean file and a rejects file;
the original is never changed."""
import argparse
import csv
from datetime import datetime
from pathlib import Path

DATE_FORMATS = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%b %d %Y"]


def parse_date(text):
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    raise ValueError(f"unknown date '{text}'")


def clean_row(row):
    # Header names and values may carry stray spaces: normalise both.
    row = {k.strip().lower(): (v or "").strip() for k, v in row.items()}
    name = " ".join(row["name"].split()).title()
    region = row["region"].title()
    amount = row["amount"].replace("$", "").replace(",", "")
    return {"name": name, "region": region,
            "amount": f"{float(amount):.2f}", "date": parse_date(row["date"])}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Clean a CSV file.")
    parser.add_argument("input", type=Path)
    parser.add_argument("--out", type=Path, default=Path("clean.csv"))
    parser.add_argument("--rejects", type=Path, default=Path("rejects.csv"))
    args = parser.parse_args(argv)
    if not args.input.is_file():
        print(f"Error: {args.input} not found.")
        return 1

    clean, rejects, seen = [], [], set()
    with args.input.open(newline="", encoding="utf-8-sig") as fh:
        for line_no, row in enumerate(csv.DictReader(fh), start=2):
            if not any((v or "").strip() for v in row.values()):
                continue  # blank line
            try:
                item = clean_row(row)
            except (ValueError, KeyError) as error:
                rejects.append({"line": line_no, "reason": error,
                                "raw": "|".join(str(v) for v in row.values())})
                continue
            key = tuple(item.values())
            if key in seen:
                rejects.append({"line": line_no, "reason": "duplicate row",
                                "raw": "|".join(key)})
                continue
            seen.add(key)
            clean.append(item)

    for path, rows, fields in [(args.out, clean, ["name", "region", "amount", "date"]),
                               (args.rejects, rejects, ["line", "reason", "raw"])]:
        with path.open("w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=fields)
            writer.writeheader()
            writer.writerows(rows)
    print(f"Clean rows: {len(clean)}  Rejected: {len(rejects)}")
    for r in rejects:
        print(f"  line {r['line']}: {r['reason']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
