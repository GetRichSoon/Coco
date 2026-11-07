"""Project 14: merge the "Sales" sheet of every .xlsx file in a folder into
one workbook. Files whose headers differ are skipped and reported.
Needs: python -m pip install openpyxl"""
import argparse
from pathlib import Path

from openpyxl import Workbook, load_workbook


def main(argv=None):
    parser = argparse.ArgumentParser(description="Merge Excel files.")
    parser.add_argument("folder", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--sheet", default="Sales")
    args = parser.parse_args(argv)
    if not args.folder.is_dir():
        print(f"Error: {args.folder} is not a folder.")
        return 1
    if args.output.exists():
        print(f"Error: {args.output} already exists. Choose a new name.")
        return 1

    merged = Workbook()
    out = merged.active
    out.title = "Merged"
    expected, total, skipped = None, 0, []
    for path in sorted(args.folder.glob("*.xlsx")):
        try:
            # read_only keeps memory low; data_only gives stored values.
            wb = load_workbook(path, read_only=True, data_only=True)
        except Exception as error:  # damaged or password protected file
            skipped.append((path.name, f"cannot open ({error})"))
            continue
        if args.sheet not in wb.sheetnames:
            skipped.append((path.name, f"no sheet called {args.sheet}"))
            wb.close()
            continue
        rows = list(wb[args.sheet].iter_rows(values_only=True))
        wb.close()
        if not rows:
            skipped.append((path.name, "sheet is empty"))
            continue
        header, body = rows[0], rows[1:]
        if expected is None:
            expected = header
            out.append(list(header) + ["source_file"])
        elif header != expected:
            skipped.append((path.name, f"headers differ: {list(header)}"))
            continue
        for row in body:
            out.append(list(row) + [path.name])
        total += len(body)
        print(f"Merged {path.name}: {len(body)} rows")

    if expected is None:
        print("Nothing to merge.")
        return 1
    merged.save(args.output)
    print(f"Saved {args.output}: {total} rows")
    for name, reason in skipped:
        print(f"SKIPPED {name}: {reason}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
