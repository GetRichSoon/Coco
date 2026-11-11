"""Project 1: rename the files in one folder to prefix_001.ext, prefix_002.ext.
Dry run by default; add --apply to really rename."""
import argparse
import csv
from pathlib import Path


def plan_renames(folder, prefix, start):
    # Sort so the numbering is the same every time you run the script.
    files = sorted(p for p in folder.iterdir()
                   if p.is_file() and p.name != "rename_undo_log.csv")
    plan = []
    for number, path in enumerate(files, start=start):
        new_name = f"{prefix}_{number:03d}{path.suffix.lower()}"
        plan.append((path, path.with_name(new_name)))
    return plan


def main(argv=None):
    parser = argparse.ArgumentParser(description="Bulk rename files.")
    parser.add_argument("folder", type=Path)
    parser.add_argument("--prefix", default="file")
    parser.add_argument("--start", type=int, default=1)
    parser.add_argument("--apply", action="store_true",
                        help="really rename (default is a dry run)")
    args = parser.parse_args(argv)

    if not args.folder.is_dir():
        print(f"Error: {args.folder} is not a folder.")
        return 1
    plan = plan_renames(args.folder, args.prefix, args.start)
    # Refuse to start if a target name already belongs to a different file.
    sources = {src for src, _ in plan}
    for src, dst in plan:
        if dst.exists() and dst not in sources:
            print(f"Stopped: {dst.name} already exists and is not in the plan.")
            return 1
    if len({dst for _, dst in plan}) != len(plan):
        print("Stopped: two files would get the same new name.")
        return 1

    for src, dst in plan:
        print(f"{src.name}  ->  {dst.name}")
    if not args.apply:
        print(f"Dry run: {len(plan)} files would be renamed. Add --apply.")
        return 0

    # Two steps (temporary names first) so a swap such as a->b, b->a is safe.
    temp = []
    for src, dst in plan:
        tmp = src.with_name(src.name + ".renaming")
        src.rename(tmp)
        temp.append((tmp, dst, src))
    for tmp, dst, _ in temp:
        tmp.rename(dst)
    # Undo log: lets you reverse the rename by hand if you change your mind.
    log = args.folder / "rename_undo_log.csv"
    with log.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["old_name", "new_name"])
        writer.writerows((s.name, d.name) for _, d, s in temp)
    print(f"Renamed {len(plan)} files. Undo log: {log.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
