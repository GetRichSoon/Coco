"""Project 20: tidy a rough list of release notes into consistent bullets.
The original file is never changed."""
import argparse
import re
from pathlib import Path

BULLET = re.compile(r"^\s*[-*•]\s*")  # -, * or the bullet character


def clean_lines(text):
    seen, result = set(), []
    for raw in text.splitlines():
        if not BULLET.match(raw) and not raw.strip():
            continue  # drop blank lines
        line = BULLET.sub("", raw)
        line = " ".join(line.split())  # collapse runs of spaces, trim ends
        if not line:
            continue
        # Capitalise the first word; tone down a shouting ALL CAPS first word.
        first, _, rest = line.partition(" ")
        first = first.capitalize() if first.isupper() else first[0].upper() + first[1:]
        line = f"{first} {rest}".strip().rstrip(".")
        if line.lower() in seen:  # case-insensitive duplicate
            continue
        seen.add(line.lower())
        result.append(line)
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description="Clean release notes.")
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args(argv)
    if not args.input.is_file():
        print(f"Error: {args.input} not found.")
        return 1
    if args.output.exists():
        print(f"Error: {args.output} already exists. Choose a new name.")
        return 1

    original = args.input.read_text(encoding="utf-8")
    lines = clean_lines(original)
    args.output.write_text("\n".join(f"- {l}" for l in lines) + "\n",
                           encoding="utf-8")
    print(f"{len(original.splitlines())} lines in, {len(lines)} bullets out:")
    print(args.output.read_text(encoding="utf-8"), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
