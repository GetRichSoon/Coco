"""Project 9: read expenses from a CSV and print totals by category and month.
Money uses Decimal, not float, so cents never drift."""
import argparse
import csv
from collections import defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path


def main(argv=None):
    parser = argparse.ArgumentParser(description="Expense summary.")
    parser.add_argument("input", type=Path)
    parser.add_argument("--out", type=Path, default=Path("expense_summary.csv"))
    args = parser.parse_args(argv)
    if not args.input.is_file():
        print(f"Error: {args.input} not found.")
        return 1

    by_category = defaultdict(Decimal)
    by_month = defaultdict(Decimal)
    bad = 0
    with args.input.open(newline="", encoding="utf-8-sig") as fh:
        for line_no, row in enumerate(csv.DictReader(fh), start=2):
            try:
                amount = Decimal(row["amount"])
                month = row["date"][:7]  # "2026-10-05" -> "2026-10"
                by_category[row["category"].strip().title()] += amount
                by_month[month] += amount
            except (InvalidOperation, KeyError, TypeError):
                bad += 1
                print(f"Skipped line {line_no}: unreadable row")

    grand = sum(by_month.values(), Decimal("0"))
    print("By month:")
    for month, total in sorted(by_month.items()):
        print(f"  {month}  {total:>10.2f}")
    print("By category (largest first):")
    for cat, total in sorted(by_category.items(), key=lambda x: -x[1]):
        share = total / grand * 100 if grand else Decimal(0)
        print(f"  {cat:<10} {total:>10.2f}  {share:>5.1f}%")
    print(f"Grand total: {grand:.2f}  (skipped rows: {bad})")

    with args.out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["type", "name", "total"])
        writer.writerows(("month", m, f"{t:.2f}") for m, t in sorted(by_month.items()))
        writer.writerows(("category", c, f"{t:.2f}") for c, t in sorted(by_category.items()))
    print(f"Summary saved to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
