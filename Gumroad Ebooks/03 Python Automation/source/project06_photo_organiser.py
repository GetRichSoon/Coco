"""Project 6: copy image files into YEAR/YEAR-MONTH folders using the file's
modified time. Copies by default, so the originals stay where they are."""
import argparse
import shutil
from datetime import datetime
from pathlib import Path

IMAGE_TYPES = {".jpg", ".jpeg", ".png", ".gif", ".heic"}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Organise photos by date.")
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--move", action="store_true",
                        help="move instead of copy")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    if not args.source.is_dir():
        print(f"Error: {args.source} is not a folder.")
        return 1

    done = skipped = 0
    for path in sorted(args.source.iterdir()):
        if not path.is_file() or path.suffix.lower() not in IMAGE_TYPES:
            continue
        # Modified time is a stand-in for "date taken"; see the book text.
        taken = datetime.fromtimestamp(path.stat().st_mtime)
        folder = args.destination / str(taken.year) / taken.strftime("%Y-%m")
        target = folder / path.name
        if target.exists():
            print(f"Skipped {path.name}: already in {folder.name}")
            skipped += 1
            continue
        print(f"{path.name} -> {target.relative_to(args.destination)}")
        if not args.dry_run:
            folder.mkdir(parents=True, exist_ok=True)
            # copy2 keeps the modified time, so a re-run files it the same way.
            (shutil.move if args.move else shutil.copy2)(path, target)
        done += 1
    verb = "Would handle" if args.dry_run else ("Moved" if args.move else "Copied")
    print(f"{verb} {done} images, skipped {skipped}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
