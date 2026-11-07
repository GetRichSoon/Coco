"""Project 2: move the files in a folder into sub-folders by file type.
Dry run by default; add --apply to really move files."""
import argparse
import shutil
from pathlib import Path

CATEGORIES = {
    "Images": {".jpg", ".jpeg", ".png", ".gif", ".webp"},
    "Documents": {".pdf", ".doc", ".docx", ".txt", ".md"},
    "Spreadsheets": {".xlsx", ".xls", ".csv"},
    "Archives": {".zip", ".7z", ".tar", ".gz"},
    "Audio": {".mp3", ".wav", ".m4a"},
}


def category_for(path):
    suffix = path.suffix.lower()
    for name, extensions in CATEGORIES.items():
        if suffix in extensions:
            return name
    return "Other"


def free_name(target):
    """Return target, or target with _1, _2 ... so nothing is overwritten."""
    counter = 1
    candidate = target
    while candidate.exists():
        candidate = target.with_name(f"{target.stem}_{counter}{target.suffix}")
        counter += 1
    return candidate


def main(argv=None):
    parser = argparse.ArgumentParser(description="Organise files by type.")
    parser.add_argument("folder", type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args(argv)
    if not args.folder.is_dir():
        print(f"Error: {args.folder} is not a folder.")
        return 1

    counts = {}
    # Only files directly inside the folder; sub-folders are left alone.
    for path in sorted(p for p in args.folder.iterdir() if p.is_file()):
        category = category_for(path)
        target = free_name(args.folder / category / path.name)
        counts[category] = counts.get(category, 0) + 1
        print(f"{path.name}  ->  {category}/{target.name}")
        if args.apply:
            target.parent.mkdir(exist_ok=True)
            shutil.move(str(path), str(target))
    summary = ", ".join(f"{k}: {v}" for k, v in sorted(counts.items()))
    mode = "Moved" if args.apply else "Dry run, would move"
    print(f"{mode} {sum(counts.values())} files ({summary}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
