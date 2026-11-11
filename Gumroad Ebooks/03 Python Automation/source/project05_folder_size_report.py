"""Project 5: show how much space each sub-folder uses and the biggest files.
Read only: nothing is changed."""
import argparse
from pathlib import Path


def human(size):
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024


def main(argv=None):
    parser = argparse.ArgumentParser(description="Folder size report.")
    parser.add_argument("folder", type=Path)
    parser.add_argument("--top", type=int, default=3, help="biggest files")
    args = parser.parse_args(argv)
    if not args.folder.is_dir():
        print(f"Error: {args.folder} is not a folder.")
        return 1

    per_folder, files = {}, []
    for path in args.folder.rglob("*"):
        if not path.is_file():
            continue
        try:
            size = path.stat().st_size
        except OSError:  # e.g. a file that vanished while we were scanning
            continue
        parts = path.relative_to(args.folder).parts
        top = parts[0] if len(parts) > 1 else "(files in the top folder)"
        per_folder[top] = per_folder.get(top, 0) + size
        files.append((size, path))

    print(f"Total: {human(sum(per_folder.values()))} in {len(files)} files")
    print("By sub-folder, largest first:")
    for name, size in sorted(per_folder.items(), key=lambda x: -x[1]):
        print(f"  {human(size):>9}  {name}")
    print(f"Top {args.top} files:")
    for size, path in sorted(files, reverse=True)[: args.top]:
        print(f"  {human(size):>9}  {path.relative_to(args.folder)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
