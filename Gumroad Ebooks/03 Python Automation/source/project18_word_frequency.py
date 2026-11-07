"""Project 18: count the most common words in all .txt and .md files of a
folder. Read only."""
import argparse
import csv
import re
from collections import Counter
from pathlib import Path

# A short list on purpose; add words that clutter your results.
STOP_WORDS = {"the", "a", "an", "and", "or", "is", "are", "was", "to", "of",
              "in", "on", "it", "be", "for", "with", "when", "this", "that"}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Word frequency counter.")
    parser.add_argument("folder", type=Path)
    parser.add_argument("--top", type=int, default=10)
    parser.add_argument("--csv", type=Path, help="also save the table here")
    args = parser.parse_args(argv)
    if not args.folder.is_dir():
        print(f"Error: {args.folder} is not a folder.")
        return 1

    counts, files = Counter(), 0
    for path in sorted(args.folder.rglob("*")):
        if path.suffix.lower() not in {".txt", ".md"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError) as error:
            print(f"Skipped {path.name}: {error}")
            continue
        files += 1
        # \w+ keeps letters and digits; apostrophes split words, a known limit.
        words = re.findall(r"\w+", text.lower())
        counts.update(w for w in words if w not in STOP_WORDS and len(w) > 1)

    print(f"Read {files} files, {sum(counts.values())} counted words, "
          f"{len(counts)} different words.")
    for word, number in counts.most_common(args.top):
        print(f"  {word:<12} {number}")
    if args.csv:
        with args.csv.open("w", newline="", encoding="utf-8") as fh:
            writer = csv.writer(fh)
            writer.writerow(["word", "count"])
            writer.writerows(counts.most_common())
        print(f"Saved {args.csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
