"""Project 21: summarise a log file: counts per level, the most common error
messages, and busy hours. Read only."""
import argparse
import re
from collections import Counter
from pathlib import Path

# Example line: 2026-11-01 08:35:00 ERROR payment timeout
LINE = re.compile(r"^(\d{4}-\d{2}-\d{2}) (\d{2}):\d{2}:\d{2} "
                  r"(DEBUG|INFO|WARNING|ERROR|CRITICAL) (.*)$")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Log file summary.")
    parser.add_argument("logfile", type=Path)
    args = parser.parse_args(argv)
    if not args.logfile.is_file():
        print(f"Error: {args.logfile} not found.")
        return 1

    levels, errors, hours = Counter(), Counter(), Counter()
    unreadable = 0
    # errors="replace": one bad byte should not stop the whole summary.
    with args.logfile.open(encoding="utf-8", errors="replace") as fh:
        for line in fh:
            match = LINE.match(line.strip())
            if not match:
                unreadable += 1
                continue
            day, hour, level, message = match.groups()
            levels[level] += 1
            hours[f"{day} {hour}:00"] += 1
            if level in ("ERROR", "CRITICAL"):
                errors[message] += 1

    print(f"Lines understood: {sum(levels.values())}, not understood: {unreadable}")
    for level, number in levels.most_common():
        print(f"  {level:<9} {number}")
    print("Most common errors:")
    for message, number in errors.most_common(3):
        print(f"  {number} x {message}")
    busiest, count = hours.most_common(1)[0] if hours else ("none", 0)
    print(f"Busiest hour: {busiest} with {count} entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
