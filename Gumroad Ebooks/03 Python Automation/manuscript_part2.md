# Chapter 4. Files, folders and batch renaming

File work is the safest place to start: the results are visible in your file manager, and the dangerous operations (rename, move, delete) are exactly where good habits matter most. Three rules run through the six projects.

- **Dry run first.** The script prints what it would do. A flag such as `--apply` turns on the real action.
- **Never overwrite.** If a target exists, the script stops, skips, or chooses a new name.
- **Never delete.** No project in this book deletes a file. Where deletion might be wanted, the script reports and you decide.

### Project 1. Bulk file renaming

**Problem:** A folder holds files named IMG_4471.jpg, Beach day.jpg and notes final v2.txt. You want one consistent pattern such as trip_001.jpg.

**Expected result:** Every file renamed to prefix_NNN.ext in sorted order, lowercase extension, plus an undo log. Without --apply nothing changes.

**Required tools:** Python standard library only.

**Installation:** nothing to install. Use `py` on Windows or `python3` on macOS and Linux to run it.

**Complete source code** (`project01_bulk_rename.py`):

```
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
```

**Code explanation:**

- `plan_renames` builds the whole list of (old, new) pairs before touching anything. That is what makes a dry run possible.
- `sorted(...)` fixes the order, so the numbering is repeatable. `f"{number:03d}"` pads 1 to 001.
- The two checks stop the script if a target name already belongs to another file, or if two files would get the same name.
- Renaming goes through a temporary `.renaming` name first. Without that step, a rename such as a to b while b to a exists would overwrite a file.
- The undo log is a CSV of old and new names, so you can reverse the job by hand.

**Sample input:** Folder `sample_data/rename_demo` with five files: `Beach day.jpg`, `budget (copy).txt`, `IMG_4471.jpg`, `IMG_4472.jpg`, `notes final v2.txt`.

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

Dry run (default):

```
Beach day.jpg  ->  trip_001.jpg
budget (copy).txt  ->  trip_002.txt
IMG_4471.jpg  ->  trip_003.jpg
IMG_4472.jpg  ->  trip_004.jpg
notes final v2.txt  ->  trip_005.txt
Dry run: 5 files would be renamed. Add --apply.
```

Real run:

```
Beach day.jpg  ->  trip_001.jpg
budget (copy).txt  ->  trip_002.txt
IMG_4471.jpg  ->  trip_003.jpg
IMG_4472.jpg  ->  trip_004.jpg
notes final v2.txt  ->  trip_005.txt
Renamed 5 files. Undo log: rename_undo_log.csv
```

**How to run it** (from the `source` folder):

```
py project01_bulk_rename.py sample_data/rename_demo --prefix trip
py project01_bulk_rename.py sample_data/rename_demo --prefix trip --apply
```

These commands change or create files. To repeat a test, delete the `sample_data` folder and run `py make_sample_data.py` again.

**Common errors and fixes:**

- **Stopped: trip_001.jpg already exists and is not in the plan.** A file with a target name is already there. Choose another --prefix or --start.
- **PermissionError.** A file is open in another program. Close it and run again.

**Safe-use notes:** Run the dry run first and read every line. Keep the undo log. The script renames only files directly in the folder, never sub-folders.

**Optional challenge:** Add an option --undo that reads rename_undo_log.csv and restores the old names.

### Project 2. Organising a folder by file type

**Problem:** Your Downloads folder is a heap. You want Images, Documents, Spreadsheets, Archives, Audio and Other folders.

**Expected result:** Each file moved into a category folder chosen by its extension. Name clashes get _1, _2 added. Dry run by default.

**Required tools:** Python standard library only.

**Installation:** nothing to install. Use `py` on Windows or `python3` on macOS and Linux to run it.

**Complete source code** (`project02_organise_by_type.py`):

```
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
```

**Code explanation:**

- `CATEGORIES` is a dictionary from folder name to a set of extensions. Editing this one table customises the script.
- `category_for` lowercases the suffix so `.JPG` and `.jpg` behave the same.
- `free_name` loops until it finds a name that does not exist. This is how the script avoids overwriting.
- `shutil.move` is only called when `--apply` is present.

**Sample input:** Folder `sample_data/downloads` with 12 files such as `holiday.jpg`, `cv_2026.pdf`, `budget.xlsx`, `setup.exe` and `readme` (no extension).

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

Dry run:

```
backup.zip  ->  Archives/backup.zip
budget.xlsx  ->  Spreadsheets/budget.xlsx
cv_2026.pdf  ->  Documents/cv_2026.pdf
holiday.jpg  ->  Images/holiday.jpg
logo.png  ->  Images/logo.png
minutes.docx  ->  Documents/minutes.docx
notes.txt  ->  Documents/notes.txt
photo2.jpeg  ->  Images/photo2.jpeg
readme  ->  Other/readme
sales.csv  ->  Spreadsheets/sales.csv
setup.exe  ->  Other/setup.exe
song.mp3  ->  Audio/song.mp3
Dry run, would move 12 files (Archives: 1, Audio: 1, Documents: 3, Images: 3, Other: 2, Spreadsheets: 2).
```

Real run (last line only; the file list is identical):

```
Moved 12 files (Archives: 1, Audio: 1, Documents: 3, Images: 3, Other: 2, Spreadsheets: 2).
```

**How to run it** (from the `source` folder):

```
py project02_organise_by_type.py sample_data/downloads
py project02_organise_by_type.py sample_data/downloads --apply
```

These commands change or create files. To repeat a test, delete the `sample_data` folder and run `py make_sample_data.py` again.

**Common errors and fixes:**

- **Error: ... is not a folder.** Check the path. On Windows, wrap paths with spaces in double quotes.
- **A file lands in Other.** Add its extension to CATEGORIES.

**Safe-use notes:** Never point it at a system folder or a project folder with code. Files are moved, not copied, so take a backup first (Project 4) for anything you cannot replace.

**Optional challenge:** Add a date-based mode that puts files into YYYY-MM sub-folders inside each category.

### Project 3. Duplicate file detection

**Problem:** Copies of the same file are scattered over a folder tree and waste space. You want a list, not an automatic clean-up.

**Expected result:** A text report listing groups of files with identical content and the bytes that could be freed. Nothing is deleted or moved.

**Required tools:** Python standard library only.

**Installation:** nothing to install. Use `py` on Windows or `python3` on macOS and Linux to run it.

**Complete source code** (`project03_find_duplicates.py`):

```
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
```

**Code explanation:**

- Files are first grouped by size. Two files with different sizes cannot be identical, so most files are never read.
- `file_hash` reads 1 MB at a time and feeds a SHA-256 digest. Identical content gives an identical digest.
- The `:=` walrus operator reads a chunk and tests it in one line; the loop ends when `read` returns empty bytes.
- The script only writes the report file. There is no delete, move or rename call anywhere in it.

**Sample input:** Folder `sample_data/dupes`: two identical invoice text files in different sub-folders, two identical 2 KB binary files, and two files that look alike but differ.

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

```
Group 1 (2048 bytes each):
  c\photo.bin
  photo_again.bin
Group 2 (18 bytes each):
  a\invoice_march.txt
  b\invoice_march_copy.txt
2 duplicate groups, 2066 bytes could be freed. Nothing was deleted.
Report saved to duplicates_report.txt
```

**How to run it** (from the `source` folder):

```
py project03_find_duplicates.py sample_data/dupes
```

**Common errors and fixes:**

- **PermissionError while hashing.** The script prints Skipped and goes on. Run it on a folder you own.
- **It is slow.** Large folders take time because files of equal size are read in full. Try a smaller folder first.

**Safe-use notes:** A match means identical bytes, but only you can decide which copy to keep. Delete by hand, after looking at the report, or move to the recycle bin yourself.

**Optional challenge:** Add a --min-size option to ignore files smaller than a given number of bytes.

### Project 4. Automated file backup with timestamps

**Problem:** You want a dated copy of a project folder before you change it, without ever overwriting an earlier backup.

**Expected result:** A new folder named projectname_YYYYMMDD_HHMMSS containing a full copy. The source is untouched.

**Required tools:** Python standard library only.

**Installation:** nothing to install. Use `py` on Windows or `python3` on macOS and Linux to run it.

**Complete source code** (`project04_backup_folder.py`):

```
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
```

**Code explanation:**

- The destination is resolved to an absolute path and refused if it sits inside the source. Otherwise each backup would contain the previous one.
- `strftime("%Y%m%d_%H%M%S")` makes names that sort in time order.
- `shutil.copytree` raises an error if the target already exists, which gives you no-overwrite behaviour for free.
- After copying, the script compares file counts and warns if they differ. This is a basic check, not proof that every byte is identical.

**Sample input:** Folder `sample_data/project_files` (four files, 155,050 bytes).

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

Dry run:

```
Source: project_files (4 files, 155050 bytes)
Backup would be: project_files_20261107_012621
Dry run: nothing copied.
```

Real backup:

```
Source: project_files (4 files, 155050 bytes)
Backup would be: project_files_20261107_012624
Backup complete: 4 files copied to project_files_20261107_012624
```

Destination inside the source (refused):

```
Error: the destination must be outside the source folder.
```

**How to run it** (from the `source` folder):

```
py project04_backup_folder.py sample_data/project_files backups --dry-run
py project04_backup_folder.py sample_data/project_files backups
py project04_backup_folder.py sample_data/project_files sample_data/project_files/inside
```

**Common errors and fixes:**

- **FileExistsError / Backup failed.** Two runs in the same second. Wait a second and run again.
- **Backup failed: [Errno 28] No space left.** The target drive is full. Choose another drive.

**Safe-use notes:** A backup on the same disk does not protect you from disk failure. Keep a second copy elsewhere. Open a backup now and then to confirm it is usable.

**Optional challenge:** Add --keep N so the script lists backups older than the newest N (but only lists them; deleting stays manual).

### Project 5. Folder size report

**Problem:** The disk is nearly full and you do not know which folder is responsible.

**Expected result:** A total, a size per top-level sub-folder, and the largest files. Read only.

**Required tools:** Python standard library only.

**Installation:** nothing to install. Use `py` on Windows or `python3` on macOS and Linux to run it.

**Complete source code** (`project05_folder_size_report.py`):

```
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
```

**Code explanation:**

- `human` turns a byte count into KB, MB or GB by dividing by 1024 until the number is small.
- `path.relative_to(args.folder).parts[0]` gives the first folder name below the start folder, used as the group key.
- `try/except OSError` around `stat()` covers files that disappear while the scan runs.
- `sorted(files, reverse=True)` sorts by size first because each item is a (size, path) pair.

**Sample input:** Folder `sample_data/project_files`.

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

```
Total: 151.4 KB in 4 files
By sub-folder, largest first:
   149.6 KB  data
     1.6 KB  docs
      250 B  (files in the top folder)
Top 3 files:
   146.5 KB  data\big.bin
     3.1 KB  data\numbers.csv
     1.6 KB  docs\guide.md
```

**How to run it** (from the `source` folder):

```
py project05_folder_size_report.py sample_data/project_files
```

**Common errors and fixes:**

- **Output shows 0 files.** The folder is empty or the path is wrong.
- **Numbers differ from Windows Explorer.** Explorer may show size on disk, which rounds up to disk blocks.

**Safe-use notes:** The script only reads. On very large drives a full scan can take minutes.

**Optional challenge:** Write the sub-folder table to a CSV so you can compare sizes month to month.

### Project 6. Image file organisation by date

**Problem:** Hundreds of photos sit in one folder. You want YEAR/YEAR-MONTH folders.

**Expected result:** Image files copied (or moved with --move) into folders built from each file's modified date.

**Required tools:** Python standard library only.

**Installation:** nothing to install. Use `py` on Windows or `python3` on macOS and Linux to run it.

**Complete source code** (`project06_photo_organiser.py`):

```
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
```

**Code explanation:**

- The date comes from `st_mtime`, the modified time. For a camera file this is often the capture time, but copying or editing can change it. Reading the true capture date needs EXIF data and a library such as Pillow, which this project does not use.
- `strftime("%Y-%m")` builds the month folder name.
- Copying is the default and `copy2` keeps the original modified time, so a second run files each picture in the same place.
- A file that already exists at the target is skipped, which makes the script safe to re-run.

**Sample input:** Folder `sample_data/photos`: five dummy image files with modified dates from August to October 2026, and one text file that must be ignored. The files are not real pictures; only names and dates matter here.

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

Dry run:

```
a.jpg -> 2026\2026-08\a.jpg
b.jpg -> 2026\2026-08\b.jpg
c.png -> 2026\2026-09\c.png
d.jpeg -> 2026\2026-10\d.jpeg
e.jpg -> 2026\2026-10\e.jpg
Would handle 5 images, skipped 0.
```

Real run (last line only):

```
Copied 5 images, skipped 0.
```

Second real run:

```
Skipped a.jpg: already in 2026-08
Skipped b.jpg: already in 2026-08
Skipped c.png: already in 2026-09
Skipped d.jpeg: already in 2026-10
Skipped e.jpg: already in 2026-10
Copied 0 images, skipped 5.
```

**How to run it** (from the `source` folder):

```
py project06_photo_organiser.py sample_data/photos photos_sorted --dry-run
py project06_photo_organiser.py sample_data/photos photos_sorted
py project06_photo_organiser.py sample_data/photos photos_sorted
```

These commands change or create files. To repeat a test, delete the `sample_data` folder and run `py make_sample_data.py` again.

**Common errors and fixes:**

- **Photos land in the wrong month.** Modified time was changed by an edit or copy. Use EXIF dates in the challenge.
- **HEIC files are skipped.** Add the extension .heic if it is not listed; it is in the sample set.

**Safe-use notes:** Copy mode leaves the originals alone. Use --move only after you have checked the copies.

**Optional challenge:** Install Pillow and read the EXIF capture date, falling back to modified time when EXIF is missing.


# Chapter 5. CSV processing

A CSV (comma separated values) file is plain text with one record per line and fields separated by commas. Spreadsheets, shops, banks and databases all export it. Python's `csv` module handles quotes and commas inside fields correctly, which is why you should not split lines on commas yourself.

Three habits for the following projects. Open files with `newline=""` and an explicit encoding. Use `utf-8-sig` when reading, which also copes with the invisible marker Excel adds to some UTF-8 files. Read with `DictReader` so columns are found by name, not position.

```
import csv
with open("expenses.csv", newline="", encoding="utf-8-sig") as fh:
    for row in csv.DictReader(fh):
        print(row["category"], row["amount"])
```

### Project 7. CSV cleanup

**Problem:** A CSV export has stray spaces, mixed capitalisation, money written as $1,200.50, dates in four formats, blank lines and duplicate rows.

**Expected result:** clean.csv with tidy rows, and rejects.csv listing every row that could not be fixed, with the reason.

**Required tools:** Python standard library only.

**Installation:** nothing to install. Use `py` on Windows or `python3` on macOS and Linux to run it.

**Complete source code** (`project07_csv_cleanup.py`):

```
"""Project 7: clean a messy CSV. Writes a clean file and a rejects file;
the original is never changed."""
import argparse
import csv
from datetime import datetime
from pathlib import Path

DATE_FORMATS = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%b %d %Y"]


def parse_date(text):
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    raise ValueError(f"unknown date '{text}'")


def clean_row(row):
    # Header names and values may carry stray spaces: normalise both.
    row = {k.strip().lower(): (v or "").strip() for k, v in row.items()}
    name = " ".join(row["name"].split()).title()
    region = row["region"].title()
    amount = row["amount"].replace("$", "").replace(",", "")
    return {"name": name, "region": region,
            "amount": f"{float(amount):.2f}", "date": parse_date(row["date"])}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Clean a CSV file.")
    parser.add_argument("input", type=Path)
    parser.add_argument("--out", type=Path, default=Path("clean.csv"))
    parser.add_argument("--rejects", type=Path, default=Path("rejects.csv"))
    args = parser.parse_args(argv)
    if not args.input.is_file():
        print(f"Error: {args.input} not found.")
        return 1

    clean, rejects, seen = [], [], set()
    with args.input.open(newline="", encoding="utf-8-sig") as fh:
        for line_no, row in enumerate(csv.DictReader(fh), start=2):
            if not any((v or "").strip() for v in row.values()):
                continue  # blank line
            try:
                item = clean_row(row)
            except (ValueError, KeyError) as error:
                rejects.append({"line": line_no, "reason": error,
                                "raw": "|".join(str(v) for v in row.values())})
                continue
            key = tuple(item.values())
            if key in seen:
                rejects.append({"line": line_no, "reason": "duplicate row",
                                "raw": "|".join(key)})
                continue
            seen.add(key)
            clean.append(item)

    for path, rows, fields in [(args.out, clean, ["name", "region", "amount", "date"]),
                               (args.rejects, rejects, ["line", "reason", "raw"])]:
        with path.open("w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=fields)
            writer.writeheader()
            writer.writerows(rows)
    print(f"Clean rows: {len(clean)}  Rejected: {len(rejects)}")
    for r in rejects:
        print(f"  line {r['line']}: {r['reason']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

**Code explanation:**

- `DictReader` gives each row as a dictionary keyed by the header. `.strip().lower()` on the keys copes with a header such as ` Region `.
- `" ".join(text.split())` collapses any run of spaces into one, then `.title()` fixes the capitalisation.
- `parse_date` tries each format in `DATE_FORMATS`. Order matters: 03/10/2026 is read as day/month, so 3 October. If your data uses month/day, change the list.
- Rows that raise `ValueError` or `KeyError` go to the rejects list instead of stopping the run.
- `seen` is a set of finished rows, which detects exact duplicates after cleaning.

**Sample input:** `sample_data/sales_messy.csv`, 8 data lines (one blank, one duplicate after cleaning, one amount `abc`, one text date).

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

```
Clean rows: 4  Rejected: 3
  line 5: duplicate row
  line 7: could not convert string to float: 'abc'
  line 9: unknown date 'not a date'
```

**How to run it** (from the `source` folder):

```
py project07_csv_cleanup.py sample_data/sales_messy.csv
```

**Common errors and fixes:**

- **KeyError: 'name'.** The header is missing or named differently. Edit the column names in clean_row.
- **UnicodeDecodeError.** The file is not UTF-8. Try encoding="cp1252" in the open call.

**Safe-use notes:** The input file is only read. Look at rejects.csv before you trust the clean file; silently dropping rows is how reports go wrong.

**Optional challenge:** Add a --date-order option so the user can choose day-first or month-first.

### Project 8. Splitting a large CSV

**Problem:** A CSV is too big for a tool that accepts a limited number of rows, or you want to hand parts to different people.

**Expected result:** Files named name_part001.csv, name_part002.csv and so on, each with the header row repeated.

**Required tools:** Python standard library only.

**Installation:** nothing to install. Use `py` on Windows or `python3` on macOS and Linux to run it.

**Complete source code** (`project08_split_csv.py`):

```
"""Project 8: split a big CSV into smaller files, repeating the header."""
import argparse
import csv
from pathlib import Path


def main(argv=None):
    parser = argparse.ArgumentParser(description="Split a CSV file.")
    parser.add_argument("input", type=Path)
    parser.add_argument("outdir", type=Path)
    parser.add_argument("--rows", type=int, default=10, help="rows per part")
    args = parser.parse_args(argv)
    if not args.input.is_file():
        print(f"Error: {args.input} not found.")
        return 1
    if args.rows < 1:
        print("Error: --rows must be 1 or more.")
        return 1
    if args.outdir.exists() and any(args.outdir.iterdir()):
        print(f"Error: {args.outdir} is not empty. Choose a new folder.")
        return 1
    args.outdir.mkdir(parents=True, exist_ok=True)

    parts = total = 0
    with args.input.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.reader(fh)
        header = next(reader, None)
        if header is None:
            print("Error: the file is empty.")
            return 1
        batch = []
        for row in reader:
            batch.append(row)
            if len(batch) == args.rows:
                parts += 1
                write_part(args.outdir, args.input.stem, parts, header, batch)
                total += len(batch)
                batch = []
        if batch:  # the last, shorter part
            parts += 1
            write_part(args.outdir, args.input.stem, parts, header, batch)
            total += len(batch)
    print(f"Split {total} data rows into {parts} files in {args.outdir}")
    return 0


def write_part(outdir, stem, number, header, rows):
    path = outdir / f"{stem}_part{number:03d}.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(header)
        writer.writerows(rows)
    print(f"  {path.name}: {len(rows)} rows")


if __name__ == "__main__":
    raise SystemExit(main())
```

**Code explanation:**

- The file is read row by row, so memory use stays small even for large files.
- `batch` collects rows; when it reaches `--rows`, `write_part` saves it and the list is emptied.
- After the loop, a shorter final batch is written too. Forgetting this is the classic off-by-one bug.
- The script refuses an output folder that already contains files.

**Sample input:** `sample_data/orders.csv` with 25 order rows.

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

```
  orders_part001.csv: 10 rows
  orders_part002.csv: 10 rows
  orders_part003.csv: 5 rows
Split 25 data rows into 3 files in orders_parts
```

**How to run it** (from the `source` folder):

```
py project08_split_csv.py sample_data/orders.csv orders_parts --rows 10
```

**Common errors and fixes:**

- **Error: ... is not empty.** Choose a new output folder name.
- **Parts have odd line breaks.** Open files with newline="" as the script does; do not remove it.

**Safe-use notes:** The original is not changed. Check the row total printed at the end against the original.

**Optional challenge:** Split by the value of a column instead, for example one file per customer.

### Project 9. Simple expense tracking

**Problem:** You keep a CSV of expenses (date, category, description, amount) and want monthly and category totals.

**Expected result:** Printed totals by month and by category with percentages, and expense_summary.csv.

**Required tools:** Python standard library only.

**Installation:** nothing to install. Use `py` on Windows or `python3` on macOS and Linux to run it.

**Complete source code** (`project09_expense_tracker.py`):

```
"""Project 9: read expenses from a CSV and print totals by category and month.
Money uses Decimal, not float, so cents never drift."""
import argparse
import csv
from collections import defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path


def main(argv=None):
    parser = argparse.ArgumentParser(description="Expense summary.")
    parser.add_argument("input", type=Path)
    parser.add_argument("--out", type=Path, default=Path("expense_summary.csv"))
    args = parser.parse_args(argv)
    if not args.input.is_file():
        print(f"Error: {args.input} not found.")
        return 1

    by_category = defaultdict(Decimal)
    by_month = defaultdict(Decimal)
    bad = 0
    with args.input.open(newline="", encoding="utf-8-sig") as fh:
        for line_no, row in enumerate(csv.DictReader(fh), start=2):
            try:
                amount = Decimal(row["amount"])
                month = row["date"][:7]  # "2026-10-05" -> "2026-10"
                by_category[row["category"].strip().title()] += amount
                by_month[month] += amount
            except (InvalidOperation, KeyError, TypeError):
                bad += 1
                print(f"Skipped line {line_no}: unreadable row")

    grand = sum(by_month.values(), Decimal("0"))
    print("By month:")
    for month, total in sorted(by_month.items()):
        print(f"  {month}  {total:>10.2f}")
    print("By category (largest first):")
    for cat, total in sorted(by_category.items(), key=lambda x: -x[1]):
        share = total / grand * 100 if grand else Decimal(0)
        print(f"  {cat:<10} {total:>10.2f}  {share:>5.1f}%")
    print(f"Grand total: {grand:.2f}  (skipped rows: {bad})")

    with args.out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["type", "name", "total"])
        writer.writerows(("month", m, f"{t:.2f}") for m, t in sorted(by_month.items()))
        writer.writerows(("category", c, f"{t:.2f}") for c, t in sorted(by_category.items()))
    print(f"Summary saved to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

**Code explanation:**

- `Decimal` is used for money. With plain floats, sums such as 0.1 + 0.2 produce tiny errors; Decimal keeps exact cents.
- `defaultdict(Decimal)` starts every new key at zero, so `+=` works on first use.
- `row["date"][:7]` slices "2026-10-05" to "2026-10". It relies on ISO dates; clean other formats with Project 7 first.
- The `{total:>10.2f}` format right-aligns numbers in a column with two decimals.

**Sample input:** `sample_data/expenses.csv`: 18 invented expenses for September and October 2026.

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

```
By month:
  2026-09     1288.00
  2026-10     1274.00
By category (largest first):
  Rent          1816.00   70.9%
  Food           424.00   16.5%
  Health         142.00    5.5%
  Transport      135.00    5.3%
  Software        45.00    1.8%
Grand total: 2562.00  (skipped rows: 0)
Summary saved to expense_summary.csv
```

**How to run it** (from the `source` folder):

```
py project09_expense_tracker.py sample_data/expenses.csv
```

**Common errors and fixes:**

- **Skipped line N: unreadable row.** The amount has a currency symbol or comma. Clean it with Project 7.
- **Totals look too small.** Rows with a missing amount are skipped and counted at the end.

**Safe-use notes:** Read only apart from the summary file. These are sample numbers, not advice about any budget.

**Optional challenge:** Add a monthly budget per category in a second CSV and flag categories that exceed it.

### Project 10. Contact list de-duplication

**Problem:** A contact export holds the same person twice, with different spellings but the same email or phone.

**Expected result:** contacts_unique.csv, a contacts_dropped.csv showing which earlier contact each dropped row matched, and a printed list.

**Required tools:** Python standard library only.

**Installation:** nothing to install. Use `py` on Windows or `python3` on macOS and Linux to run it.

**Complete source code** (`project10_contact_dedupe.py`):

```
"""Project 10: find duplicate contacts by email or phone number.
Writes a de-duplicated copy and a list of what was dropped; the original
file is untouched."""
import argparse
import csv
import re
from pathlib import Path


def phone_key(phone):
    digits = re.sub(r"\D", "", phone)
    return digits[-7:] if len(digits) >= 7 else ""  # compare the last 7 digits


def main(argv=None):
    parser = argparse.ArgumentParser(description="Contact list de-duplicator.")
    parser.add_argument("input", type=Path)
    parser.add_argument("--out", type=Path, default=Path("contacts_unique.csv"))
    parser.add_argument("--dropped", type=Path, default=Path("contacts_dropped.csv"))
    args = parser.parse_args(argv)
    if not args.input.is_file():
        print(f"Error: {args.input} not found.")
        return 1

    seen_email, seen_phone = {}, {}
    keep, dropped = [], []
    with args.input.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        fields = reader.fieldnames
        for row in reader:
            email = row["email"].strip().lower()
            phone = phone_key(row["phone"])
            match = seen_email.get(email) if email else None
            match = match or (seen_phone.get(phone) if phone else None)
            if match:
                dropped.append({**row, "duplicate_of": match})
                continue
            keep.append(row)
            if email:
                seen_email[email] = row["name"]
            if phone:
                seen_phone[phone] = row["name"]

    with args.out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(keep)
    with args.dropped.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields + ["duplicate_of"])
        writer.writeheader()
        writer.writerows(dropped)
    print(f"Kept {len(keep)}, flagged {len(dropped)} as duplicates:")
    for row in dropped:
        print(f"  {row['name']} looks like {row['duplicate_of']}")
    print("Review the dropped list before trusting it: matches can be wrong.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

**Code explanation:**

- Emails are lowercased before comparing, so ALICE@example.com matches alice@example.com.
- `phone_key` removes everything but digits and compares the last seven, so +1 555 0101 matches 555-0101.
- Two dictionaries remember which name first used each email or phone, so the report can say who a row duplicates.
- Rows without an email or a usable phone are never matched on that field. Otherwise all blanks would collapse into one.

**Sample input:** `sample_data/contacts.csv`, 7 rows. Note Robert Smith has a different email from Bob Smith but the same phone.

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

```
Kept 4, flagged 3 as duplicates:
  A. Johnson looks like Alice Johnson
  Robert Smith looks like Bob Smith
  Dan Lee looks like Dan Lee
Review the dropped list before trusting it: matches can be wrong.
```

**How to run it** (from the `source` folder):

```
py project10_contact_dedupe.py sample_data/contacts.csv
```

**Common errors and fixes:**

- **KeyError: 'email'.** Your file has different column names. Change them in the script.
- **Two different people were merged.** Shared phones (an office line) cause this. Always read the dropped file.

**Safe-use notes:** The original file is untouched and nothing is merged automatically beyond dropping the later row. Matching is a guess; a person must confirm it.

**Optional challenge:** Keep the row with the most filled-in fields instead of always keeping the first.

### Project 11. Data validation report

**Problem:** Before importing a file into another system you want to know which rows break the rules.

**Expected result:** A CSV report of every problem (line, field, value, reason) and an exit code of 2 when problems exist.

**Required tools:** Python standard library only.

**Installation:** nothing to install. Use `py` on Windows or `python3` on macOS and Linux to run it.

**Complete source code** (`project11_validation_report.py`):

```
"""Project 11: check each row of a CSV against simple rules and write a
report of every problem. The data file is only read, never changed."""
import argparse
import csv
import re
from datetime import datetime
from pathlib import Path

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")  # a sanity check, not RFC
STATUSES = {"paid", "pending", "shipped", "cancelled"}


def check_row(row):
    problems = []
    if not row["order_id"].strip():
        problems.append(("order_id", "missing"))
    if not EMAIL.match(row["email"].strip()):
        problems.append(("email", "does not look like an email address"))
    try:
        if float(row["amount"]) <= 0:
            problems.append(("amount", "must be greater than zero"))
    except ValueError:
        problems.append(("amount", "not a number"))
    try:
        datetime.strptime(row["date"], "%Y-%m-%d")
    except ValueError:
        problems.append(("date", "not a real YYYY-MM-DD date"))
    if row["status"].strip().lower() not in STATUSES:
        problems.append(("status", f"must be one of {sorted(STATUSES)}"))
    return problems


def main(argv=None):
    parser = argparse.ArgumentParser(description="CSV validation report.")
    parser.add_argument("input", type=Path)
    parser.add_argument("--report", type=Path, default=Path("validation_report.csv"))
    args = parser.parse_args(argv)
    if not args.input.is_file():
        print(f"Error: {args.input} not found.")
        return 1

    findings, rows = [], 0
    with args.input.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        needed = {"order_id", "email", "amount", "date", "status"}
        if not needed.issubset(reader.fieldnames or []):
            print(f"Error: the file needs these columns: {sorted(needed)}")
            return 1
        for line_no, row in enumerate(reader, start=2):
            rows += 1
            for field, message in check_row(row):
                findings.append([line_no, field, row[field], message])

    with args.report.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["line", "field", "value", "problem"])
        writer.writerows(findings)
    bad_rows = len({f[0] for f in findings})
    print(f"Checked {rows} rows: {bad_rows} with problems, "
          f"{len(findings)} problems in total.")
    for line_no, field, value, message in findings:
        print(f"  line {line_no}: {field} '{value}' - {message}")
    return 0 if not findings else 2  # exit code 2 lets a scheduler notice


if __name__ == "__main__":
    raise SystemExit(main())
```

**Code explanation:**

- `check_row` returns a list of problems rather than stopping at the first, so one run shows everything.
- The email pattern checks the shape `something@something.something`. It cannot tell whether the mailbox exists.
- `datetime.strptime` rejects impossible dates such as month 13.
- Line numbers start at 2 because line 1 is the header; they match what you see in a spreadsheet.

**Sample input:** `sample_data/orders_to_check.csv`, 6 rows with one valid row and five different faults.

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

```
Checked 6 rows: 5 with problems, 5 problems in total.
  line 3: email 'not-an-email' - does not look like an email address
  line 4: amount '-5' - must be greater than zero
  line 5: date '2026-13-40' - not a real YYYY-MM-DD date
  line 6: status 'shipped??' - must be one of ['cancelled', 'paid', 'pending', 'shipped']
  line 7: order_id '' - missing
```

**How to run it** (from the `source` folder):

```
py project11_validation_report.py sample_data/orders_to_check.csv
```

**Common errors and fixes:**

- **Error: the file needs these columns.** Rename the columns or edit the `needed` set.
- **Everything is flagged as a bad date.** Your dates use another format. Change the pattern in strptime.

**Safe-use notes:** Read only. Exit code 2 is useful in schedulers and batch files because they can react to it.

**Optional challenge:** Add a rule that order_id values must be unique.

### Project 12. Invoice number generator

**Problem:** Invoice numbers must be unique and in sequence, even across several runs.

**Expected result:** Numbers such as INV-2026-0001, remembered between runs in a small JSON file and logged in a CSV.

**Required tools:** Python standard library only.

**Installation:** nothing to install. Use `py` on Windows or `python3` on macOS and Linux to run it.

**Complete source code** (`project12_invoice_numbers.py`):

```
"""Project 12: hand out invoice numbers such as INV-2026-0001 that never
repeat, even if you run the script many times. A small JSON file remembers
the last number used per year; every number is also logged to a CSV."""
import argparse
import csv
import json
import os
from datetime import date, datetime
from pathlib import Path


def load_state(path):
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        # Do not guess: a damaged counter could lead to repeated numbers.
        raise SystemExit(f"{path} is damaged. Fix or restore it first.")


def save_state(path, state):
    # Write to a temporary file, then swap: a crash cannot leave half a file.
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(state, indent=2), encoding="utf-8")
    os.replace(temp, path)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Invoice number generator.")
    parser.add_argument("--count", type=int, default=1)
    parser.add_argument("--prefix", default="INV")
    parser.add_argument("--state", type=Path, default=Path("invoice_state.json"))
    parser.add_argument("--log", type=Path, default=Path("invoice_log.csv"))
    args = parser.parse_args(argv)
    if not 1 <= args.count <= 500:
        print("Error: --count must be between 1 and 500.")
        return 1

    year = str(date.today().year)
    state = load_state(args.state)
    last = state.get(year, 0)
    new_numbers = [f"{args.prefix}-{year}-{n:04d}"
                   for n in range(last + 1, last + 1 + args.count)]
    # Save the counter BEFORE using the numbers: losing a number is harmless,
    # reusing one is not.
    state[year] = last + args.count
    save_state(args.state, state)

    is_new = not args.log.exists()
    with args.log.open("a", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        if is_new:
            writer.writerow(["invoice_number", "issued_at"])
        for number in new_numbers:
            writer.writerow([number, datetime.now().isoformat(timespec="seconds")])
    print("Issued:", ", ".join(new_numbers))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

**Code explanation:**

- The state file stores the last number used per year, so the sequence restarts each January.
- The counter is saved before the numbers are shown or logged. If the script crashes, a number is lost but never reused.
- `os.replace` swaps the temporary file in one step, so a crash cannot leave a half written counter.
- A damaged state file stops the script instead of restarting from 1, because guessing would risk duplicates.

**Sample input:** No input file. The first run creates `invoice_state.json` and `invoice_log.csv`.

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

First run, three numbers:

```
Issued: INV-2026-0001, INV-2026-0002, INV-2026-0003
```

Second run, one number:

```
Issued: INV-2026-0004
```

**How to run it** (from the `source` folder):

```
py project12_invoice_numbers.py --count 3
py project12_invoice_numbers.py 
```

**Common errors and fixes:**

- **... is damaged. Fix or restore it first.** Restore the file from a backup, or set the last number by hand.
- **Numbers clash with another computer.** This script is for one machine. Two people need a shared system.

**Safe-use notes:** Do not run two copies at the same moment; there is no file locking. Back up the state file with your other data.

**Optional challenge:** Add a --peek option that shows the next number without using it.


# Chapter 6. Excel automation

The `openpyxl` package reads and writes `.xlsx` files without Excel being installed. Know its limits before you rely on it.

- **It does not calculate formulas.** It can write `=SUM(A1:A10)` as text for Excel to evaluate. When a program reads a never-calculated file with `data_only=True`, formula cells come back as `None`. Project 13 demonstrates this with real output. If you need a calculated number in Python, calculate it in Python.
- **It handles `.xlsx` only,** not the old `.xls`.
- **Editing an existing workbook may lose features** such as charts, images or macros that openpyxl does not keep (a commonly reported limit that I did not test). Create new files, or work on a copy.
- **Large files** should be read with `read_only=True`.

The openpyxl documentation I tried (the "simple usage" page) returned an error on 2026-11-07, so the formula point comes from my own test in Project 13, not from a quoted page. Check the current documentation at openpyxl.readthedocs.io.

### Project 13. Excel report generation

**Problem:** You have a sales CSV and want a formatted workbook with a data sheet and a summary sheet.

**Expected result:** An .xlsx file with a styled header, frozen top row, number formats, a totals row with formulas, and a Summary sheet.

**Required tools:** Python standard library plus the `openpyxl` package.

**Installation:** `py -m pip install openpyxl` on Windows (the `py` launcher), `python3 -m pip install openpyxl` on macOS and Linux. Run it inside your virtual environment.

**Complete source code** (`project13_excel_report.py`):

```
"""Project 13: turn a sales CSV into a formatted Excel workbook with a data
sheet and a summary sheet. Needs: python -m pip install openpyxl"""
import argparse
import csv
from collections import defaultdict
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill


def main(argv=None):
    parser = argparse.ArgumentParser(description="CSV to Excel report.")
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args(argv)
    if not args.input.is_file():
        print(f"Error: {args.input} not found.")
        return 1
    if args.output.exists():
        print(f"Error: {args.output} already exists. Choose a new name.")
        return 1

    wb = Workbook()
    data = wb.active
    data.title = "Data"
    data.append(["Date", "Region", "Product", "Units", "Unit price", "Revenue"])
    with args.input.open(newline="", encoding="utf-8-sig") as fh:
        for n, row in enumerate(csv.DictReader(fh), start=2):
            # Real numbers, not text, so Excel can sum and sort them.
            data.append([row["date"], row["region"], row["product"],
                         int(row["units"]), float(row["unit_price"]),
                         f"=D{n}*E{n}"])  # a formula: Excel calculates it
    last = data.max_row
    data.append(["", "", "", f"=SUM(D2:D{last})", "", f"=SUM(F2:F{last})"])

    header_fill = PatternFill("solid", start_color="1F4E78")
    for cell in data[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")
    for cell in data[data.max_row]:
        cell.font = Font(bold=True)
    for row in data.iter_rows(min_row=2, min_col=5, max_col=6):
        for cell in row:
            cell.number_format = "#,##0.00"
    for letter, width in zip("ABCDEF", (12, 10, 12, 8, 12, 12)):
        data.column_dimensions[letter].width = width
    data.freeze_panes = "A2"

    # Python's own totals go on the summary sheet as plain numbers.
    totals = defaultdict(float)
    with args.input.open(newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            totals[row["region"]] += int(row["units"]) * float(row["unit_price"])
    summary = wb.create_sheet("Summary")
    summary.append(["Region", "Revenue (calculated by Python)"])
    for region, value in sorted(totals.items()):
        summary.append([region, round(value, 2)])
    summary.column_dimensions["A"].width = 14
    summary.column_dimensions["B"].width = 30
    for cell in summary[1]:
        cell.font = Font(bold=True)
    wb.save(args.output)
    print(f"Saved {args.output} ({last - 1} data rows)")

    # openpyxl writes formulas but does not calculate them. Prove it:
    check = load_workbook(args.output, data_only=True)["Data"]
    print("Formula cell F2 as openpyxl reads it back:", check["F2"].value)
    print("Python total revenue:", round(sum(totals.values()), 2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

**Code explanation:**

- `Workbook()` makes a new file in memory; nothing exists on disk until `wb.save`.
- Units and prices are converted with `int` and `float` so Excel stores numbers, not text.
- `f"=D{n}*E{n}"` writes a formula as text starting with =. Excel calculates it when the file is opened.
- openpyxl does not calculate formulas. The last lines prove it: reading the saved file with `data_only=True` returns None for F2, because no program has calculated and stored a result yet. The Summary sheet therefore holds values calculated by Python.
- The script refuses to overwrite an existing output file.

**Sample input:** `sample_data/sales/sales_2026_10.csv`, 24 invented sales rows (date, region, product, units, unit_price).

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

```
Saved sales_october.xlsx (24 data rows)
Formula cell F2 as openpyxl reads it back: None
Python total revenue: 2692.95
```

**How to run it** (from the `source` folder):

```
py project13_excel_report.py sample_data/sales/sales_2026_10.csv sales_october.xlsx
```

**Common errors and fixes:**

- **ModuleNotFoundError: No module named 'openpyxl'.** Install it into the Python you are running: py -m pip install openpyxl.
- **PermissionError on save.** The target workbook is open in Excel. Close it.

**Safe-use notes:** Never write over the only copy of a workbook. This script refuses if the name exists. openpyxl can lose features such as charts or macros when it edits an existing file; this project only creates new files.

**Optional challenge:** Add a chart with openpyxl.chart.BarChart showing revenue per region.

### Project 14. Merging spreadsheets

**Problem:** Each branch sends its own workbook with a Sales sheet. You need one combined sheet.

**Expected result:** merged_branches.xlsx with all rows plus a source_file column. Files with different headers are skipped and reported.

**Required tools:** Python standard library plus the `openpyxl` package.

**Installation:** `py -m pip install openpyxl` on Windows (the `py` launcher), `python3 -m pip install openpyxl` on macOS and Linux. Run it inside your virtual environment.

**Complete source code** (`project14_merge_spreadsheets.py`):

```
"""Project 14: merge the "Sales" sheet of every .xlsx file in a folder into
one workbook. Files whose headers differ are skipped and reported.
Needs: python -m pip install openpyxl"""
import argparse
from pathlib import Path

from openpyxl import Workbook, load_workbook


def main(argv=None):
    parser = argparse.ArgumentParser(description="Merge Excel files.")
    parser.add_argument("folder", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--sheet", default="Sales")
    args = parser.parse_args(argv)
    if not args.folder.is_dir():
        print(f"Error: {args.folder} is not a folder.")
        return 1
    if args.output.exists():
        print(f"Error: {args.output} already exists. Choose a new name.")
        return 1

    merged = Workbook()
    out = merged.active
    out.title = "Merged"
    expected, total, skipped = None, 0, []
    for path in sorted(args.folder.glob("*.xlsx")):
        try:
            # read_only keeps memory low; data_only gives stored values.
            wb = load_workbook(path, read_only=True, data_only=True)
        except Exception as error:  # damaged or password protected file
            skipped.append((path.name, f"cannot open ({error})"))
            continue
        if args.sheet not in wb.sheetnames:
            skipped.append((path.name, f"no sheet called {args.sheet}"))
            wb.close()
            continue
        rows = list(wb[args.sheet].iter_rows(values_only=True))
        wb.close()
        if not rows:
            skipped.append((path.name, "sheet is empty"))
            continue
        header, body = rows[0], rows[1:]
        if expected is None:
            expected = header
            out.append(list(header) + ["source_file"])
        elif header != expected:
            skipped.append((path.name, f"headers differ: {list(header)}"))
            continue
        for row in body:
            out.append(list(row) + [path.name])
        total += len(body)
        print(f"Merged {path.name}: {len(body)} rows")

    if expected is None:
        print("Nothing to merge.")
        return 1
    merged.save(args.output)
    print(f"Saved {args.output}: {total} rows")
    for name, reason in skipped:
        print(f"SKIPPED {name}: {reason}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

**Code explanation:**

- `load_workbook(..., read_only=True, data_only=True)` opens quickly and returns stored values rather than formulas. If a workbook was never calculated and saved by Excel, formula cells give None.
- The first valid file defines the expected header. Any later file with another header is skipped, not forced in.
- `iter_rows(values_only=True)` yields plain tuples, which are easy to compare and copy.
- The `source_file` column keeps the trail back to the original workbook.

**Sample input:** `sample_data/branches` with `branch_north.xlsx`, `branch_south.xlsx`, `branch_east.xlsx` (header: date, product, units, revenue) and `branch_west_wrong_headers.xlsx` (header: day, item, qty).

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

```
Merged branch_east.xlsx: 4 rows
Merged branch_north.xlsx: 4 rows
Merged branch_south.xlsx: 4 rows
Saved merged_branches.xlsx: 12 rows
SKIPPED branch_west_wrong_headers.xlsx: headers differ: ['day', 'item', 'qty']
```

**How to run it** (from the `source` folder):

```
py project14_merge_spreadsheets.py sample_data/branches merged_branches.xlsx
```

**Common errors and fixes:**

- **SKIPPED ... no sheet called Sales.** Pass --sheet with the right sheet name.
- **SKIPPED ... cannot open.** The file is damaged, password protected or an old .xls file.

**Safe-use notes:** Source workbooks are opened read only and never changed. Old .xls files are not read by openpyxl; save them as .xlsx first.

**Optional challenge:** Add a check that reports rows whose date falls outside the month you expect.
