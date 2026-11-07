# Chapter 7. PDF and document processing

The `pypdf` package can read text, merge pages and split documents. Its documentation is direct about the limits, and so should this book be.

- A PDF stores where to draw characters, not paragraphs or tables. Extracted text can have odd spacing, wrong order in columns, and broken tables.
- A scanned PDF is a set of images. pypdf cannot read text from images; you need OCR software such as Tesseract. I did not test OCR.
- Quality varies from file to file. Always read a sample of the output before trusting it.
- Password protected files need the password. Do not try to bypass protection on files that are not yours.

Word documents (`.docx`) can be handled with the `python-docx` package. I installed it (version 1.2.0) but did not write or test a project with it, so this book does not teach it.

### Project 15. PDF text extraction

**Problem:** You need the text of a PDF in a plain file for searching or editing.

**Expected result:** A text file with the text of each page under a page marker, and a warning for pages without text.

**Required tools:** Python standard library plus the `pypdf` package.

**Installation:** `py -m pip install pypdf` on Windows (the `py` launcher), `python3 -m pip install pypdf` on macOS and Linux. Run it inside your virtual environment.

**Complete source code** (`project15_pdf_text_extract.py`):

```
"""Project 15: extract the text of a PDF page by page into a .txt file.
Works only for PDFs that contain real text. Scanned pages need OCR.
Needs: python -m pip install pypdf"""
import argparse
from pathlib import Path

from pypdf import PdfReader
from pypdf.errors import PyPdfError


def main(argv=None):
    parser = argparse.ArgumentParser(description="Extract text from a PDF.")
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--out", type=Path, help="default: same name, .txt")
    args = parser.parse_args(argv)
    if not args.pdf.is_file():
        print(f"Error: {args.pdf} not found.")
        return 1
    out = args.out or args.pdf.with_suffix(".txt")
    if out.exists():
        print(f"Error: {out} already exists. Use --out with a new name.")
        return 1

    try:
        reader = PdfReader(args.pdf)
        if reader.is_encrypted:
            print("Error: the PDF is password protected.")
            return 1
        parts, empty, words = [], [], 0
        for number, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").strip()
            if not text:
                empty.append(number)
            words += len(text.split())
            parts.append(f"--- Page {number} ---\n{text}\n")
    except (PyPdfError, OSError) as error:
        print(f"Error: could not read the PDF ({error}).")
        return 1

    out.write_text("\n".join(parts), encoding="utf-8")
    print(f"{len(reader.pages)} pages, about {words} words -> {out}")
    if empty:
        print(f"No text found on pages {empty}: probably scanned images. "
              "OCR is needed for those.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

**Code explanation:**

- `PdfReader` loads the file. `reader.is_encrypted` is checked so a protected file gives a clear message.
- `page.extract_text()` returns the text layer. The pypdf documentation explains that PDFs store positioned characters, not paragraphs, so spacing, columns and tables may come out in a strange order.
- A page with no extracted text is counted in `empty`. Scanned pages are images; pypdf never reads text from images and the documentation points to OCR software such as Tesseract for that.
- The sample `scanned_like.pdf` is a blank page I built to simulate a page with no text layer. It is not a real scan, and OCR was not tested in this book.

**Sample input:** `sample_data/pdfs/handbook.pdf` (5 pages of generated text) and `sample_data/pdfs/scanned_like.pdf` (one blank page).

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

Text PDF:

```
5 pages, about 45 words -> handbook.txt
```

Page without a text layer:

```
1 pages, about 0 words -> scanned.txt
No text found on pages [1]: probably scanned images. OCR is needed for those.
```

**How to run it** (from the `source` folder):

```
py project15_pdf_text_extract.py sample_data/pdfs/handbook.pdf --out handbook.txt
py project15_pdf_text_extract.py sample_data/pdfs/scanned_like.pdf --out scanned.txt
```

**Common errors and fixes:**

- **Error: ... password protected.** Decrypt it with the password in a tool you trust. This script does not guess.
- **Words glued together or in the wrong order.** A known limit of PDF text extraction. Try a different PDF tool or export from the source program.

**Safe-use notes:** Only process PDFs from sources you trust. Do not try to remove passwords from files you have no right to open.

**Optional challenge:** Search the extracted text for a keyword and print the page numbers where it appears.

### Project 16. Merging PDF files

**Problem:** Several one-page PDFs must become one document in a set order.

**Expected result:** A new PDF containing all pages in the order of the arguments.

**Required tools:** Python standard library plus the `pypdf` package.

**Installation:** `py -m pip install pypdf` on Windows (the `py` launcher), `python3 -m pip install pypdf` on macOS and Linux. Run it inside your virtual environment.

**Complete source code** (`project16_merge_pdfs.py`):

```
"""Project 16: join several PDFs into one, in the order you list them.
Needs: python -m pip install pypdf"""
import argparse
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.errors import PyPdfError


def main(argv=None):
    parser = argparse.ArgumentParser(description="Merge PDF files.")
    parser.add_argument("output", type=Path)
    parser.add_argument("inputs", type=Path, nargs="+")
    args = parser.parse_args(argv)
    if args.output.exists():
        print(f"Error: {args.output} already exists. Choose a new name.")
        return 1

    writer = PdfWriter()
    for path in args.inputs:
        try:
            reader = PdfReader(path)
            if reader.is_encrypted:
                print(f"Skipped {path.name}: password protected")
                continue
            for page in reader.pages:
                writer.add_page(page)
            print(f"Added {path.name}: {len(reader.pages)} pages")
        except (PyPdfError, OSError) as error:
            print(f"Skipped {path}: {error}")
    if len(writer.pages) == 0:
        print("Nothing was merged.")
        return 1
    with args.output.open("wb") as fh:
        writer.write(fh)
    print(f"Saved {args.output}: {len(writer.pages)} pages")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

**Code explanation:**

- `PdfWriter` collects pages; `add_page` appends one at a time.
- Inputs are processed in the order given on the command line, so you control the order.
- A damaged or encrypted input is skipped with a message while the rest are merged.
- The file is opened in `"wb"` mode because PDFs are binary.

**Sample input:** `sample_data/pdfs/invoice_a.pdf` and `invoice_b.pdf`, one page each.

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

```
Added invoice_a.pdf: 1 pages
Added invoice_b.pdf: 1 pages
Saved invoices_merged.pdf: 2 pages
```

**How to run it** (from the `source` folder):

```
py project16_merge_pdfs.py invoices_merged.pdf sample_data/pdfs/invoice_a.pdf sample_data/pdfs/invoice_b.pdf
```

**Common errors and fixes:**

- **Nothing was merged.** Every input failed. Check paths and passwords.
- **Error: ... already exists.** Pick a new output name.

**Safe-use notes:** Originals are only read. Bookmarks and form fields of the source PDFs are not handled by this simple script.

**Optional challenge:** Accept a folder and merge all PDFs in alphabetical order.

### Project 17. Splitting a PDF by page range

**Problem:** You need pages 1 to 2 of a handbook in one file and pages 3 to 5 in another.

**Expected result:** One new PDF per range, named with the page numbers.

**Required tools:** Python standard library plus the `pypdf` package.

**Installation:** `py -m pip install pypdf` on Windows (the `py` launcher), `python3 -m pip install pypdf` on macOS and Linux. Run it inside your virtual environment.

**Complete source code** (`project17_split_pdf.py`):

```
"""Project 17: split a PDF by page ranges, for example "1-2,3-5".
Needs: python -m pip install pypdf"""
import argparse
from pathlib import Path

from pypdf import PdfReader, PdfWriter


def parse_ranges(text, page_count):
    """'1-2,5' -> [(1, 2), (5, 5)] with every number checked."""
    ranges = []
    for chunk in text.split(","):
        first, _, last = chunk.strip().partition("-")
        start = int(first)
        end = int(last) if last else start
        if not 1 <= start <= end <= page_count:
            raise ValueError(f"range '{chunk}' is outside 1-{page_count}")
        ranges.append((start, end))
    return ranges


def main(argv=None):
    parser = argparse.ArgumentParser(description="Split a PDF.")
    parser.add_argument("pdf", type=Path)
    parser.add_argument("outdir", type=Path)
    parser.add_argument("--ranges", required=True, help='e.g. "1-2,3-5"')
    args = parser.parse_args(argv)
    if not args.pdf.is_file():
        print(f"Error: {args.pdf} not found.")
        return 1
    reader = PdfReader(args.pdf)
    try:
        ranges = parse_ranges(args.ranges, len(reader.pages))
    except ValueError as error:
        print(f"Error: {error}")
        return 1

    args.outdir.mkdir(parents=True, exist_ok=True)
    for start, end in ranges:
        target = args.outdir / f"{args.pdf.stem}_pages_{start}-{end}.pdf"
        if target.exists():
            print(f"Skipped {target.name}: already exists")
            continue
        writer = PdfWriter()
        for index in range(start - 1, end):  # pypdf pages start at 0
            writer.add_page(reader.pages[index])
        with target.open("wb") as fh:
            writer.write(fh)
        print(f"Wrote {target.name} ({end - start + 1} pages)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

**Code explanation:**

- `parse_ranges` turns "1-2,3-5" into pairs and checks each against the page count before anything is written.
- Humans count pages from 1, pypdf from 0, so the loop uses `range(start - 1, end)`.
- An existing target is skipped, not replaced.
- A bad range such as 4-9 stops the run with a clear message.

**Sample input:** `sample_data/pdfs/handbook.pdf` (5 pages).

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

Valid ranges:

```
Wrote handbook_pages_1-2.pdf (2 pages)
Wrote handbook_pages_3-5.pdf (3 pages)
```

Range outside the document:

```
Error: range '4-9' is outside 1-5
```

**How to run it** (from the `source` folder):

```
py project17_split_pdf.py sample_data/pdfs/handbook.pdf handbook_parts --ranges 1-2,3-5
py project17_split_pdf.py sample_data/pdfs/handbook.pdf handbook_parts --ranges 4-9
```

**Common errors and fixes:**

- **ValueError: invalid literal for int().** A range contained text. Use digits, a dash and commas only.
- **Skipped ... already exists.** Delete or rename the old file yourself, then run again.

**Safe-use notes:** The source PDF is never modified. Check that each part opens in a PDF viewer.

**Optional challenge:** Add --each to write one file per page.


# Chapter 8. Text processing

Plain text is the easiest data to process, and the most useful skills here are the regular expression and the `Counter`. A regular expression is a compact pattern for text. Useful pieces:

| Pattern | Meaning |
|---|---|
| `\d` | one digit |
| `\w+` | one or more letters, digits or underscores |
| `^` and `$` | start and end of a line |
| `(...)` | a group you can pull out |
| `[-*]` | one of the listed characters |

Build patterns step by step and test them on small samples. The documentation for the `re` module at docs.python.org is the reference.

### Project 18. Word frequency counter

**Problem:** You want to know which words dominate a set of notes or articles.

**Expected result:** A ranked list of the most common words, optionally saved as CSV.

**Required tools:** Python standard library only.

**Installation:** nothing to install. Use `py` on Windows or `python3` on macOS and Linux to run it.

**Complete source code** (`project18_word_frequency.py`):

```
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
```

**Code explanation:**

- `re.findall(r"\w+", text.lower())` splits text into lowercase words.
- `Counter` counts them; `most_common(n)` returns the top n.
- STOP_WORDS removes very common words that carry no meaning. The list is short on purpose; extend it for your texts.
- Files that are not valid UTF-8 are reported and skipped.

**Sample input:** `sample_data/notes` with `a.txt`, `b.txt` and `c.md` (short English texts).

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

```
Read 3 files, 33 counted words, 26 different words.
  tools        4
  acme         3
  python       2
  task         2
  makes        1
  small        1
```

**How to run it** (from the `source` folder):

```
py project18_word_frequency.py sample_data/notes --top 6
```

**Common errors and fixes:**

- **Skipped ...: 'utf-8' codec can't decode.** Save the file as UTF-8 or change the encoding in read_text.
- **Words like don and t appear.** The pattern splits at apostrophes. Use r"[\w']+" to keep them.

**Safe-use notes:** Read only. For private documents keep the output file private too.

**Optional challenge:** Count two-word phrases (bigrams) instead of single words.

### Project 19. Find and replace across files

**Problem:** A product name changed and appears in dozens of text files.

**Expected result:** A list of files and match counts; with --apply the text is replaced and each changed file gets a .bak copy.

**Required tools:** Python standard library only.

**Installation:** nothing to install. Use `py` on Windows or `python3` on macOS and Linux to run it.

**Complete source code** (`project19_find_replace.py`):

```
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
```

**Code explanation:**

- The default run only counts matches, so you see the scope before any change.
- `shutil.copy2` creates `NAME.bak` before the file is rewritten. If a .bak already exists the script refuses to touch that file.
- Only `.txt` and `.md` files are processed, to avoid corrupting binary files.
- The replacement is case sensitive. `ACME Tools` does not match `acme tools`.

**Sample input:** `sample_data/notes`: the file `c.md` contains "ACME Tools" three times.

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

Dry run:

```
c.md: 3 match(es)
Dry run, would replace 3 matches in 1 files.
```

Real run:

```
c.md: 3 match(es)
Replaced 3 matches in 1 files.
```

Dry run again (nothing left to replace):

```
Dry run, would replace 0 matches in 0 files.
```

**How to run it** (from the `source` folder):

```
py project19_find_replace.py sample_data/notes "ACME Tools" "Northwind Tools"
py project19_find_replace.py sample_data/notes "ACME Tools" "Northwind Tools" --apply
py project19_find_replace.py sample_data/notes "ACME Tools" "Northwind Tools"
```

These commands change or create files. To repeat a test, delete the `sample_data` folder and run `py make_sample_data.py` again.

**Common errors and fixes:**

- **Stopped for this file: c.md.bak already exists.** Move or rename the old backup. The script will not overwrite it.
- **Dry run, would replace 0 matches.** Check spelling and capitalisation of the search text.

**Safe-use notes:** Always dry run first, and keep the .bak files until you have checked the results. Version control (Git) is even better for text projects.

**Optional challenge:** Add a --ignore-case option using re.sub with re.IGNORECASE.

### Project 20. Release notes text cleaner

**Problem:** Release notes were typed quickly: mixed bullet symbols, extra spaces, blank lines, repeated items.

**Expected result:** A tidy file where each item is one bullet, starts with a capital, has no trailing full stop and appears once.

**Required tools:** Python standard library only.

**Installation:** nothing to install. Use `py` on Windows or `python3` on macOS and Linux to run it.

**Complete source code** (`project20_release_notes_cleaner.py`):

```
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
```

**Code explanation:**

- The `BULLET` pattern matches -, * or the bullet character at the start of a line, so one regular expression handles all three.
- `" ".join(line.split())` collapses repeated spaces.
- The first word is capitalised; an ALL CAPS first word is toned down to a normal capital.
- `seen` holds lowercase versions of finished lines, so Added dark mode and -added dark mode count as one.

**Sample input:** `sample_data/release_notes_raw.txt`, 9 lines with mixed bullets, spaces and a repeated item.

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

```
9 lines in, 5 bullets out:
- Fixed login bug
- Added dark mode
- Improved search speed
- Fixed crash on startup
- Update docs
```

**How to run it** (from the `source` folder):

```
py project20_release_notes_cleaner.py sample_data/release_notes_raw.txt release_notes_clean.txt
```

**Common errors and fixes:**

- **Error: ... already exists.** Choose a new output file name.
- **A proper name was lowercased.** Only an ALL CAPS first word is changed. Add exceptions for product names in clean_lines.

**Safe-use notes:** The input is only read. Rules like removing full stops are style choices; change them to match your team.

**Optional challenge:** Group lines by their first word (Fixed, Added, Improved) under headings.

### Project 21. Log file summary

**Problem:** A log file with thousands of lines is hard to scan. You want counts and the most common errors.

**Expected result:** Counts per level, the three most common errors, the busiest hour and the number of lines that could not be read.

**Required tools:** Python standard library only.

**Installation:** nothing to install. Use `py` on Windows or `python3` on macOS and Linux to run it.

**Complete source code** (`project21_log_summary.py`):

```
"""Project 21: summarise a log file: counts per level, the most common error
messages, and busy hours. Read only."""
import argparse
import re
from collections import Counter
from pathlib import Path

# Example line: 2026-11-01 08:35:00 ERROR payment timeout
LINE = re.compile(r"^(\d{4}-\d{2}-\d{2}) (\d{2}):\d{2}:\d{2} "
                  r"(DEBUG|INFO|WARNING|ERROR|CRITICAL) (.*)$")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Log file summary.")
    parser.add_argument("logfile", type=Path)
    args = parser.parse_args(argv)
    if not args.logfile.is_file():
        print(f"Error: {args.logfile} not found.")
        return 1

    levels, errors, hours = Counter(), Counter(), Counter()
    unreadable = 0
    # errors="replace": one bad byte should not stop the whole summary.
    with args.logfile.open(encoding="utf-8", errors="replace") as fh:
        for line in fh:
            match = LINE.match(line.strip())
            if not match:
                unreadable += 1
                continue
            day, hour, level, message = match.groups()
            levels[level] += 1
            hours[f"{day} {hour}:00"] += 1
            if level in ("ERROR", "CRITICAL"):
                errors[message] += 1

    print(f"Lines understood: {sum(levels.values())}, not understood: {unreadable}")
    for level, number in levels.most_common():
        print(f"  {level:<9} {number}")
    print("Most common errors:")
    for message, number in errors.most_common(3):
        print(f"  {number} x {message}")
    busiest, count = hours.most_common(1)[0] if hours else ("none", 0)
    print(f"Busiest hour: {busiest} with {count} entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

**Code explanation:**

- The `LINE` regular expression names the parts of a line: date, hour, level and message. `groups()` returns them in that order.
- Lines that do not match are counted as not understood, not hidden.
- `errors="replace"` swaps undecodable bytes for a placeholder, so one bad byte does not stop the run.
- `Counter.most_common` does the ranking.

**Sample input:** `sample_data/app.log`: 41 lines, one of them deliberately not a log entry. The format is `2026-11-01 08:35:00 ERROR payment timeout`.

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

```
Lines understood: 40, not understood: 1
  INFO      30
  ERROR     7
  WARNING   3
Most common errors:
  6 x db connection lost
  1 x payment timeout
Busiest hour: 2026-11-01 08:00 with 6 entries
```

**How to run it** (from the `source` folder):

```
py project21_log_summary.py sample_data/app.log
```

**Common errors and fixes:**

- **Lines understood: 0.** Your log format differs. Adapt the LINE pattern.
- **IndexError on empty logs.** The script handles it: busiest hour shows none.

**Safe-use notes:** Logs can hold personal data or secrets. Do not paste a real log into shared places.

**Optional challenge:** Add --since HH:MM to look only at a time window.


# Chapter 9. Reports and spreadsheets

A report is a repeatable summary. The reliable approach has three steps: load the data, compute the numbers once, then write all outputs from those numbers. That is how Project 22 keeps its Excel, Markdown and HTML files consistent.

Choose the output for the reader. Excel suits people who will filter or calculate further. Markdown suits notes and version control. HTML opens in any browser and can be emailed as an attachment. Do not email or publish a report that contains personal data without checking who is allowed to see it.

### Project 22. Monthly report generation

**Problem:** Every month you build the same sales summary by hand and compare it with the month before.

**Expected result:** For a chosen month: an Excel file, a Markdown file and an HTML file with units and revenue per region and the percentage change on the previous month.

**Required tools:** Python standard library plus the `openpyxl` package.

**Installation:** `py -m pip install openpyxl` on Windows (the `py` launcher), `python3 -m pip install openpyxl` on macOS and Linux. Run it inside your virtual environment.

**Complete source code** (`project22_monthly_report.py`):

```
"""Project 22: build a monthly sales report (Excel, Markdown and HTML) from a
folder of sales_YYYY_MM.csv files, with a comparison to the previous month.
Needs: python -m pip install openpyxl"""
import argparse
import csv
import html
from collections import defaultdict
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font


def load_month(folder, month):
    """Return {region: [units, revenue]} for month like '2026-10'."""
    path = folder / f"sales_{month.replace('-', '_')}.csv"
    if not path.is_file():
        return None
    totals = defaultdict(lambda: [0, 0.0])
    with path.open(newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            units = int(row["units"])
            totals[row["region"]][0] += units
            totals[row["region"]][1] += units * float(row["unit_price"])
    return dict(totals)


def previous(month):
    year, mon = map(int, month.split("-"))
    return f"{year - 1}-12" if mon == 1 else f"{year}-{mon - 1:02d}"


def main(argv=None):
    parser = argparse.ArgumentParser(description="Monthly sales report.")
    parser.add_argument("folder", type=Path)
    parser.add_argument("--month", required=True, help="YYYY-MM")
    parser.add_argument("--outdir", type=Path, default=Path("report_out"))
    args = parser.parse_args(argv)

    current = load_month(args.folder, args.month)
    if current is None:
        print(f"Error: no sales file for {args.month} in {args.folder}")
        return 1
    before = load_month(args.folder, previous(args.month)) or {}
    args.outdir.mkdir(parents=True, exist_ok=True)

    rows = []
    for region in sorted(current):
        units, revenue = current[region]
        old = before.get(region, [0, 0.0])[1]
        change = f"{(revenue - old) / old * 100:+.1f}%" if old else "n/a"
        rows.append((region, units, round(revenue, 2), change))
    total_units = sum(r[1] for r in rows)
    total_rev = round(sum(r[2] for r in rows), 2)
    heading = ["Region", "Units", "Revenue", "vs previous month"]

    wb = Workbook()
    ws = wb.active
    ws.title = args.month
    ws.append(heading)
    for r in rows:
        ws.append(list(r))
    ws.append(["Total", total_units, total_rev, ""])
    for cell in ws[1] + ws[ws.max_row]:
        cell.font = Font(bold=True)
    wb.save(args.outdir / f"report_{args.month}.xlsx")

    md = [f"# Sales report {args.month}", "",
          "| " + " | ".join(heading) + " |", "|---|---:|---:|---:|"]
    md += [f"| {r[0]} | {r[1]} | {r[2]:.2f} | {r[3]} |" for r in rows]
    md += [f"| **Total** | **{total_units}** | **{total_rev:.2f}** | |"]
    (args.outdir / f"report_{args.month}.md").write_text("\n".join(md) + "\n",
                                                          encoding="utf-8")

    cells = "".join("<tr>" + "".join(f"<td>{html.escape(str(c))}</td>" for c in r)
                    + "</tr>" for r in rows)
    page = (f"<!doctype html><meta charset='utf-8'><title>Sales {args.month}"
            f"</title><h1>Sales report {args.month}</h1><table border='1' "
            f"cellpadding='6'><tr>{''.join(f'<th>{h}</th>' for h in heading)}"
            f"</tr>{cells}<tr><th>Total</th><th>{total_units}</th>"
            f"<th>{total_rev:.2f}</th><th></th></tr></table>")
    (args.outdir / f"report_{args.month}.html").write_text(page, encoding="utf-8")

    print("\n".join(md))
    print(f"\nFiles written to {args.outdir}: xlsx, md, html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

**Code explanation:**

- `load_month` finds `sales_YYYY_MM.csv`, adds up units and revenue per region and returns None if the file is missing.
- `previous` handles January by returning December of the year before.
- The change is `(revenue - old) / old * 100`. When last month had no data, the script prints n/a rather than dividing by zero.
- `html.escape` makes sure text from the data cannot break the HTML page.
- One set of numbers feeds all three outputs, so they cannot disagree.

**Sample input:** `sample_data/sales/sales_2026_09.csv` and `sales_2026_10.csv`, each 24 invented rows. The percentages are large because the sample data is random.

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

```
# Sales report 2026-10

| Region | Units | Revenue | vs previous month |
|---|---:|---:|---:|
| East | 182 | 1267.80 | +84.1% |
| North | 116 | 753.95 | +107.4% |
| South | 89 | 671.20 | -58.4% |
| **Total** | **387** | **2692.95** | |

Files written to report_out: xlsx, md, html
```

**How to run it** (from the `source` folder):

```
py project22_monthly_report.py sample_data/sales --month 2026-10
```

**Common errors and fixes:**

- **Error: no sales file for 2026-10.** File names must follow sales_YYYY_MM.csv.
- **n/a in the change column.** The previous month has no data for that region.

**Safe-use notes:** Writes only into the output folder and overwrites earlier reports for the same month. Rename or move a report you want to keep before re-running. Check totals against the source at least once by hand.

**Optional challenge:** Add a bar chart image or an Excel chart for the three regions.

### Project 23. Email preparation drafts

**Problem:** Payment reminders follow one template. You want drafts ready to review, not messages sent automatically.

**Expected result:** One .eml file per valid recipient. Rows with a bad address are skipped. Nothing is sent.

**Required tools:** Python standard library only.

**Installation:** nothing to install. Use `py` on Windows or `python3` on macOS and Linux to run it.

**Complete source code** (`project23_email_drafts.py`):

```
"""Project 23: prepare payment reminder emails as .eml files from a CSV.
Nothing is sent: the script has no mail server code and no password.
You open each file in your mail program, read it, and send it yourself."""
import argparse
import csv
import re
from email.message import EmailMessage
from pathlib import Path

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TEMPLATE = """Hello {name},

This is a friendly reminder that invoice {invoice} for {amount} is due on
{due}. If you have already paid, please ignore this message.

Kind regards
"""


def main(argv=None):
    parser = argparse.ArgumentParser(description="Prepare email drafts.")
    parser.add_argument("input", type=Path)
    parser.add_argument("outdir", type=Path)
    parser.add_argument("--sender", required=True, help="your address")
    args = parser.parse_args(argv)
    if not args.input.is_file():
        print(f"Error: {args.input} not found.")
        return 1
    if not EMAIL.match(args.sender):
        print("Error: --sender does not look like an email address.")
        return 1
    args.outdir.mkdir(parents=True, exist_ok=True)

    made = skipped = 0
    with args.input.open(newline="", encoding="utf-8-sig") as fh:
        for line_no, row in enumerate(csv.DictReader(fh), start=2):
            if not EMAIL.match(row["email"].strip()):
                print(f"Skipped line {line_no}: bad address '{row['email']}'")
                skipped += 1
                continue
            msg = EmailMessage()
            msg["From"] = args.sender
            msg["To"] = row["email"].strip()
            msg["Subject"] = f"Reminder: invoice {row['invoice']}"
            msg.set_content(TEMPLATE.format(
                name=row["name"], invoice=row["invoice"],
                amount=f"{float(row['amount']):.2f}", due=row["due"]))
            target = args.outdir / f"{row['invoice']}.eml"
            if target.exists():
                print(f"Skipped {target.name}: already exists")
                skipped += 1
                continue
            target.write_bytes(bytes(msg))  # a file on disk, nothing sent
            print(f"Draft written: {target.name} (to {msg['To']})")
            made += 1
    print(f"{made} drafts prepared, {skipped} skipped. Nothing was sent.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

**Code explanation:**

- `EmailMessage` builds a standards-based message object; no mail server is involved. The script imports no sending code and asks for no password.
- `TEMPLATE.format(...)` fills the placeholders from each CSV row.
- Addresses are checked with a simple pattern first. It catches typos like a missing @, not wrong mailboxes.
- `bytes(msg)` produces the raw message, saved as an .eml file you can open in a mail program.

**Sample input:** `sample_data/reminders.csv` with 3 rows; the third has an invalid address. Addresses use example.com, a domain reserved for examples.

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

```
Draft written: INV-2026-0001.eml (to alice@example.com)
Draft written: INV-2026-0002.eml (to bob@example.com)
Skipped line 4: bad address 'missing-at-sign'
2 drafts prepared, 1 skipped. Nothing was sent.
```

**How to run it** (from the `source` folder):

```
py project23_email_drafts.py sample_data/reminders.csv drafts --sender me@example.com
```

**Common errors and fixes:**

- **Skipped line N: bad address.** Fix the address in the CSV.
- **The .eml file does not open as a draft.** Mail programs treat .eml files differently. I did not test any mail program for this book; open the file and copy the text if needed.

**Safe-use notes:** Review each draft before you send it yourself. Do not add a password or SMTP login to a script. Sending bulk mail is covered by privacy and anti-spam rules in many countries; check the rules for your use.

**Optional challenge:** Write a plain .txt copy of each message too, for people who prefer copy and paste.


# Chapter 10. APIs and responsible web data usage

An API (application programming interface) is a way for programs to request data. A web API usually returns JSON, which Python reads with the `json` module into dictionaries and lists.

## Rules for using web data

- **Prefer an official API** to scraping pages.
- **Read the terms of use.** They decide what you may do with the data, whatever the technology allows.
- **Check robots.txt.** RFC 9309 describes it as a way for site owners to ask crawlers to avoid certain paths, and states that its rules are not a form of access authorisation. It is a courtesy signal, not permission or protection. Terms and law still apply.
- **Do not scrape sites that forbid it,** and do not bypass logins, paywalls or limits.
- **Limit your rate.** Pause between requests, set a timeout, and cache results so you do not ask twice.
- **Never put credentials in code.** Read them from environment variables, and never save them in files you share or upload.

Setting an environment variable for one terminal session:

```
# Windows PowerShell
$env:EXAMPLE_API_TOKEN = "paste-token-here"

# macOS and Linux
export EXAMPLE_API_TOKEN="paste-token-here"
```

In Python, `os.environ.get("EXAMPLE_API_TOKEN")` reads it. The test API in Project 24, JSONPlaceholder, needs no key. On 2026-11-07 its home page described it as free, with no signup, for tests and tutorials, and listed 10 users and 200 to-dos among its resources. It states no rate limit, so the project stays polite anyway. Its data is fake.

### Project 24. API data retrieval

**Problem:** You want to pull data from a public web service and summarise it, without hammering the service or storing keys in code.

**Expected result:** A table of users and their completed to-do counts from the JSONPlaceholder test API, saved to a local cache file. If the network fails, the script says so and shows the cached copy.

**Required tools:** Python standard library only.

**Installation:** nothing to install. Use `py` on Windows or `python3` on macOS and Linux to run it.

**Complete source code** (`project24_api_retrieval.py`):

```
"""Project 24: fetch public test data from JSONPlaceholder (a free,
documented, no-key API meant for practice) and summarise it.
Uses only the standard library. Be polite: few requests, a pause between
them, a timeout, and a local cache file so reruns need no network."""
import argparse
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE_URL = "https://jsonplaceholder.typicode.com"


def fetch_json(url, token=None):
    headers = {"User-Agent": "python-automation-book-demo/1.0",
               "Accept": "application/json"}
    if token:  # a real API key would come from an environment variable
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def main(argv=None):
    parser = argparse.ArgumentParser(description="API data retrieval.")
    parser.add_argument("--users", type=int, default=3, help="how many users")
    parser.add_argument("--base-url", default=BASE_URL)
    parser.add_argument("--cache", type=Path, default=Path("api_cache.json"))
    args = parser.parse_args(argv)
    if not 1 <= args.users <= 10:
        print("Error: --users must be between 1 and 10.")
        return 1
    token = os.environ.get("EXAMPLE_API_TOKEN")  # optional; never hard-code

    try:
        users = fetch_json(f"{args.base_url}/users", token)[: args.users]
        report = []
        for user in users:
            time.sleep(1)  # rate limiting: one request per second
            todos = fetch_json(f"{args.base_url}/todos?userId={user['id']}", token)
            done = sum(1 for t in todos if t["completed"])
            report.append({"id": user["id"], "name": user["name"],
                           "city": user["address"]["city"],
                           "todos": len(todos), "done": done})
        args.cache.write_text(json.dumps(report, indent=2), encoding="utf-8")
        source = "live API"
    except urllib.error.HTTPError as error:
        print(f"The server answered with an error: {error.code} {error.reason}")
        return 1
    except (urllib.error.URLError, TimeoutError) as error:
        print(f"Could not reach the API ({error}).")
        if not args.cache.exists():
            print("No cached copy exists yet. Try again when online.")
            return 1
        report = json.loads(args.cache.read_text(encoding="utf-8"))
        source = f"cache file {args.cache.name} (may be out of date)"
    except (json.JSONDecodeError, KeyError) as error:
        print(f"Unexpected data from the API: {error!r}")
        return 1

    print(f"Data source: {source}")
    for r in report:
        print(f"  {r['id']}. {r['name']:<22} {r['city']:<14} "
              f"{r['done']}/{r['todos']} todos done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

**Code explanation:**

- `urllib.request` is part of the standard library, so there is nothing to install.
- A `User-Agent` header identifies the script. `timeout=10` stops the script waiting forever.
- `time.sleep(1)` leaves a pause between requests. The API page states no limits, so the script stays polite anyway.
- `EXAMPLE_API_TOKEN` shows how a key would be read from an environment variable. JSONPlaceholder needs no key, so the variable is optional.
- The `except` blocks separate three cases: the server answered with an error, the network is unreachable, and the data has an unexpected shape.

**Sample input:** No input file. The service is `https://jsonplaceholder.typicode.com`, a free fake REST API for tests (checked 2026-11-07: no key, no signup). Its data is made up.

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

Live API (it was reachable when I tested):

```
Data source: live API
  1. Leanne Graham          Gwenborough    11/20 todos done
  2. Ervin Howell           Wisokyburgh    8/20 todos done
  3. Clementine Bauch       McKenziehaven  7/20 todos done
```

Unreachable server (simulated with http://localhost:9):

```
Could not reach the API (`<urlopen error [WinError 10061] No connection could be made because the target machine actively refused it>`).
Data source: cache file api_cache.json (may be out of date)
  1. Leanne Graham          Gwenborough    11/20 todos done
  2. Ervin Howell           Wisokyburgh    8/20 todos done
  3. Clementine Bauch       McKenziehaven  7/20 todos done
```

**How to run it** (from the `source` folder):

```
py project24_api_retrieval.py --users 3
py project24_api_retrieval.py --base-url http://localhost:9
```

**Common errors and fixes:**

- **Could not reach the API.** Check your connection, proxy or firewall. The cached copy is used if it exists.
- **HTTP Error 429.** You are sending too many requests. Wait, and raise the sleep time.

**Safe-use notes:** Read the terms and robots.txt of any site before you automate it. robots.txt asks crawlers to stay away from some paths but is not access authorisation; terms of use still apply. Do not scrape sites that forbid it, and prefer an official API.

**Optional challenge:** Save results as CSV and add a --refresh-after-hours option that avoids calls when the cache is recent.
