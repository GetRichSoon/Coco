"""Project 4: copy a folder into a new time-stamped backup folder.
It never overwrites an existing backup and never touches the source."""
import argparse
import shutil
from datetime import datetime
from pathlib import Path


def main(argv=None):
    parser = argparse.ArgumentParser(description="Timestamped folder backup.")
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path,
                        help="folder that will hold the backups")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    source = args.source.resolve()
    destination = args.destination.resolve()
    if not source.is_dir():
        print(f"Error: {source} is not a folder.")
        return 1
    # A backup inside the source would copy itself again on the next run.
    if destination == source or source in destination.parents:
        print("Error: the destination must be outside the source folder.")
        return 1

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    target = destination / f"{source.name}_{stamp}"
    files = [p for p in source.rglob("*") if p.is_file()]
    total = sum(p.stat().st_size for p in files)
    print(f"Source: {source.name} ({len(files)} files, {total} bytes)")
    print(f"Backup would be: {target.name}")
    if args.dry_run:
        print("Dry run: nothing copied.")
        return 0

    destination.mkdir(parents=True, exist_ok=True)
    try:
        # copytree refuses to run if target exists, so no overwrite is possible.
        shutil.copytree(source, target)
    except (OSError, shutil.Error) as error:
        print(f"Backup failed: {error}")
        return 1
    copied = [p for p in target.rglob("*") if p.is_file()]
    if len(copied) != len(files):
        print("Warning: file counts differ. Check the backup by hand.")
        return 1
    print(f"Backup complete: {len(copied)} files copied to {target.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
