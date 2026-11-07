"""Project 19: replace text in every .txt and .md file under a folder.
Dry run by default. With --apply each changed file is first copied to
NAME.bak so you can restore it."""
import argparse
import shutil
from pathlib import Path


def main(argv=None):
    parser = argparse.ArgumentParser(description="Find and replace in files.")
    parser.add_argument("folder", type=Path)
    parser.add_argument("find")
    parser.add_argument("replace")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args(argv)
    if not args.folder.is_dir():
        print(f"Error: {args.folder} is not a folder.")
        return 1
    if not args.find:
        print("Error: the text to find cannot be empty.")
        return 1

    changed = replacements = 0
    for path in sorted(args.folder.rglob("*")):
        if path.suffix.lower() not in {".txt", ".md"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError) as error:
            print(f"Skipped {path.name}: {error}")
            continue
        found = text.count(args.find)
        if not found:
            continue
        changed += 1
        replacements += found
        print(f"{path.relative_to(args.folder)}: {found} match(es)")
        if args.apply:
            backup = path.with_name(path.name + ".bak")
            if backup.exists():
                print(f"  Stopped for this file: {backup.name} already exists")
                continue
            shutil.copy2(path, backup)  # backup BEFORE the change
            path.write_text(text.replace(args.find, args.replace),
                            encoding="utf-8")
    mode = "Replaced" if args.apply else "Dry run, would replace"
    print(f"{mode} {replacements} matches in {changed} files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
