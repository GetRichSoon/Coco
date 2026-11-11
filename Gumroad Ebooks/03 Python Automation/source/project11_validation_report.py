"""Project 11: check each row of a CSV against simple rules and write a
report of every problem. The data file is only read, never changed."""
import argparse
import csv
import re
from datetime import datetime
from pathlib import Path

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")  # a sanity check, not RFC
STATUSES = {"paid", "pending", "shipped", "cancelled"}


def check_row(row):
    problems = []
    if not row["order_id"].strip():
        problems.append(("order_id", "missing"))
    if not EMAIL.match(row["email"].strip()):
        problems.append(("email", "does not look like an email address"))
    try:
        if float(row["amount"]) <= 0:
            problems.append(("amount", "must be greater than zero"))
    except ValueError:
        problems.append(("amount", "not a number"))
    try:
        datetime.strptime(row["date"], "%Y-%m-%d")
    except ValueError:
        problems.append(("date", "not a real YYYY-MM-DD date"))
    if row["status"].strip().lower() not in STATUSES:
        problems.append(("status", f"must be one of {sorted(STATUSES)}"))
    return problems


def main(argv=None):
    parser = argparse.ArgumentParser(description="CSV validation report.")
    parser.add_argument("input", type=Path)
    parser.add_argument("--report", type=Path, default=Path("validation_report.csv"))
    args = parser.parse_args(argv)
    if not args.input.is_file():
        print(f"Error: {args.input} not found.")
        return 1

    findings, rows = [], 0
    with args.input.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        needed = {"order_id", "email", "amount", "date", "status"}
        if not needed.issubset(reader.fieldnames or []):
            print(f"Error: the file needs these columns: {sorted(needed)}")
            return 1
        for line_no, row in enumerate(reader, start=2):
            rows += 1
            for field, message in check_row(row):
                findings.append([line_no, field, row[field], message])

    with args.report.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["line", "field", "value", "problem"])
        writer.writerows(findings)
    bad_rows = len({f[0] for f in findings})
    print(f"Checked {rows} rows: {bad_rows} with problems, "
          f"{len(findings)} problems in total.")
    for line_no, field, value, message in findings:
        print(f"  line {line_no}: {field} '{value}' - {message}")
    return 0 if not findings else 2  # exit code 2 lets a scheduler notice


if __name__ == "__main__":
    raise SystemExit(main())
