"""Project 22: build a monthly sales report (Excel, Markdown and HTML) from a
folder of sales_YYYY_MM.csv files, with a comparison to the previous month.
Needs: python -m pip install openpyxl"""
import argparse
import csv
import html
from collections import defaultdict
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font


def load_month(folder, month):
    """Return {region: [units, revenue]} for month like '2026-10'."""
    path = folder / f"sales_{month.replace('-', '_')}.csv"
    if not path.is_file():
        return None
    totals = defaultdict(lambda: [0, 0.0])
    with path.open(newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            units = int(row["units"])
            totals[row["region"]][0] += units
            totals[row["region"]][1] += units * float(row["unit_price"])
    return dict(totals)


def previous(month):
    year, mon = map(int, month.split("-"))
    return f"{year - 1}-12" if mon == 1 else f"{year}-{mon - 1:02d}"


def main(argv=None):
    parser = argparse.ArgumentParser(description="Monthly sales report.")
    parser.add_argument("folder", type=Path)
    parser.add_argument("--month", required=True, help="YYYY-MM")
    parser.add_argument("--outdir", type=Path, default=Path("report_out"))
    args = parser.parse_args(argv)

    current = load_month(args.folder, args.month)
    if current is None:
        print(f"Error: no sales file for {args.month} in {args.folder}")
        return 1
    before = load_month(args.folder, previous(args.month)) or {}
    args.outdir.mkdir(parents=True, exist_ok=True)

    rows = []
    for region in sorted(current):
        units, revenue = current[region]
        old = before.get(region, [0, 0.0])[1]
        change = f"{(revenue - old) / old * 100:+.1f}%" if old else "n/a"
        rows.append((region, units, round(revenue, 2), change))
    total_units = sum(r[1] for r in rows)
    total_rev = round(sum(r[2] for r in rows), 2)
    heading = ["Region", "Units", "Revenue", "vs previous month"]

    wb = Workbook()
    ws = wb.active
    ws.title = args.month
    ws.append(heading)
    for r in rows:
        ws.append(list(r))
    ws.append(["Total", total_units, total_rev, ""])
    for cell in ws[1] + ws[ws.max_row]:
        cell.font = Font(bold=True)
    wb.save(args.outdir / f"report_{args.month}.xlsx")

    md = [f"# Sales report {args.month}", "",
          "| " + " | ".join(heading) + " |", "|---|---:|---:|---:|"]
    md += [f"| {r[0]} | {r[1]} | {r[2]:.2f} | {r[3]} |" for r in rows]
    md += [f"| **Total** | **{total_units}** | **{total_rev:.2f}** | |"]
    (args.outdir / f"report_{args.month}.md").write_text("\n".join(md) + "\n",
                                                          encoding="utf-8")

    cells = "".join("<tr>" + "".join(f"<td>{html.escape(str(c))}</td>" for c in r)
                    + "</tr>" for r in rows)
    page = (f"<!doctype html><meta charset='utf-8'><title>Sales {args.month}"
            f"</title><h1>Sales report {args.month}</h1><table border='1' "
            f"cellpadding='6'><tr>{''.join(f'<th>{h}</th>' for h in heading)}"
            f"</tr>{cells}<tr><th>Total</th><th>{total_units}</th>"
            f"<th>{total_rev:.2f}</th><th></th></tr></table>")
    (args.outdir / f"report_{args.month}.html").write_text(page, encoding="utf-8")

    print("\n".join(md))
    print(f"\nFiles written to {args.outdir}: xlsx, md, html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
