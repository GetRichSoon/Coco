"""Project 12: hand out invoice numbers such as INV-2026-0001 that never
repeat, even if you run the script many times. A small JSON file remembers
the last number used per year; every number is also logged to a CSV."""
import argparse
import csv
import json
import os
from datetime import date, datetime
from pathlib import Path


def load_state(path):
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        # Do not guess: a damaged counter could lead to repeated numbers.
        raise SystemExit(f"{path} is damaged. Fix or restore it first.")


def save_state(path, state):
    # Write to a temporary file, then swap: a crash cannot leave half a file.
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    os.replace(temp, path)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Invoice number generator.")
    parser.add_argument("--count", type=int, default=1)
    parser.add_argument("--prefix", default="INV")
    parser.add_argument("--state", type=Path, default=Path("invoice_state.json"))
    parser.add_argument("--log", type=Path, default=Path("invoice_log.csv"))
    args = parser.parse_args(argv)
    if not 1 <= args.count <= 500:
        print("Error: --count must be between 1 and 500.")
        return 1

    year = str(date.today().year)
    state = load_state(args.state)
    last = state.get(year, 0)
    new_numbers = [f"{args.prefix}-{year}-{n:04d}"
                   for n in range(last + 1, last + 1 + args.count)]
    # Save the counter BEFORE using the numbers: losing a number is harmless,
    # reusing one is not.
    state[year] = last + args.count
    save_state(args.state, state)

    is_new = not args.log.exists()
    with args.log.open("a", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        if is_new:
            writer.writerow(["invoice_number", "issued_at"])
        for number in new_numbers:
            writer.writerow([number, datetime.now().isoformat(timespec="seconds")])
    print("Issued:", ", ".join(new_numbers))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
