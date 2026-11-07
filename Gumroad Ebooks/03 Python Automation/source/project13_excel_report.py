"""Project 13: turn a sales CSV into a formatted Excel workbook with a data
sheet and a summary sheet. Needs: python -m pip install openpyxl"""
import argparse
import csv
from collections import defaultdict
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill


def main(argv=None):
    parser = argparse.ArgumentParser(description="CSV to Excel report.")
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args(argv)
    if not args.input.is_file():
        print(f"Error: {args.input} not found.")
        return 1
    if args.output.exists():
        print(f"Error: {args.output} already exists. Choose a new name.")
        return 1

    wb = Workbook()
    data = wb.active
    data.title = "Data"
    data.append(["Date", "Region", "Product", "Units", "Unit price", "Revenue"])
    with args.input.open(newline="", encoding="utf-8-sig") as fh:
        for n, row in enumerate(csv.DictReader(fh), start=2):
            # Real numbers, not text, so Excel can sum and sort them.
            data.append([row["date"], row["region"], row["product"],
                         int(row["units"]), float(row["unit_price"]),
                         f"=D{n}*E{n}"])  # a formula: Excel calculates it
    last = data.max_row
    data.append(["", "", "", f"=SUM(D2:D{last})", "", f"=SUM(F2:F{last})"])

    header_fill = PatternFill("solid", start_color="1F4E78")
    for cell in data[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")
    for cell in data[data.max_row]:
        cell.font = Font(bold=True)
    for row in data.iter_rows(min_row=2, min_col=5, max_col=6):
        for cell in row:
            cell.number_format = "#,##0.00"
    for letter, width in zip("ABCDEF", (12, 10, 12, 8, 12, 12)):
        data.column_dimensions[letter].width = width
    data.freeze_panes = "A2"

    # Python's own totals go on the summary sheet as plain numbers.
    totals = defaultdict(float)
    with args.input.open(newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            totals[row["region"]] += int(row["units"]) * float(row["unit_price"])
    summary = wb.create_sheet("Summary")
    summary.append(["Region", "Revenue (calculated by Python)"])
    for region, value in sorted(totals.items()):
        summary.append([region, round(value, 2)])
    summary.column_dimensions["A"].width = 14
    summary.column_dimensions["B"].width = 30
    for cell in summary[1]:
        cell.font = Font(bold=True)
    wb.save(args.output)
    print(f"Saved {args.output} ({last - 1} data rows)")

    # openpyxl writes formulas but does not calculate them. Prove it:
    check = load_workbook(args.output, data_only=True)["Data"]
    print("Formula cell F2 as openpyxl reads it back:", check["F2"].value)
    print("Python total revenue:", round(sum(totals.values()), 2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
