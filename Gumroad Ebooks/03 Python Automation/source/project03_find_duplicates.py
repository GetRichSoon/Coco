"""Project 3: find duplicate files by content (SHA-256). Report only:
this script never deletes, moves or renames anything."""
import argparse
import hashlib
from collections import defaultdict
from pathlib import Path


def file_hash(path, chunk_size=1024 * 1024):
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        # Read in chunks so a huge file does not fill the memory.
        while chunk := fh.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def find_duplicates(folder):
    by_size = defaultdict(list)
    for path in folder.rglob("*"):
        if path.is_file():
            by_size[path.stat().st_size].append(path)
    groups = defaultdict(list)
    for size, paths in by_size.items():
        if len(paths) < 2:  # a file with a unique size cannot be a duplicate
            continue
        for path in paths:
            try:
                groups[file_hash(path)].append(path)
            except OSError as error:
                print(f"Skipped {path}: {error}")
    return [sorted(g) for g in groups.values() if len(g) > 1]


def main(argv=None):
    parser = argparse.ArgumentParser(description="Report duplicate files.")
    parser.add_argument("folder", type=Path)
    parser.add_argument("--report", type=Path, default=Path("duplicates_report.txt"))
    args = parser.parse_args(argv)
    if not args.folder.is_dir():
        print(f"Error: {args.folder} is not a folder.")
        return 1

    groups = find_duplicates(args.folder)
    lines, wasted = [], 0
    for number, group in enumerate(groups, start=1):
        size = group[0].stat().st_size
        wasted += size * (len(group) - 1)
        lines.append(f"Group {number} ({size} bytes each):")
        lines.extend(f"  {p.relative_to(args.folder)}" for p in group)
    lines.append(f"{len(groups)} duplicate groups, {wasted} bytes could be "
                 "freed. Nothing was deleted.")
    args.report.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    print(f"Report saved to {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
