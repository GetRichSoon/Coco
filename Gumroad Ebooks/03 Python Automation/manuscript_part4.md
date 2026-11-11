# Chapter 11. Scheduling

A script that runs by itself needs three things: a trigger, a reliable way to start, and a record of what happened.

## Make the script scheduler-friendly

- Use absolute paths for Python, the script and the folders. A scheduler does not start in your folder.
- Return a non-zero exit code on failure.
- Log to a file (Project 25 shows how).
- Make a repeat run harmless. Project 25 does nothing if today's report exists.
- Use the virtual environment's Python by its full path, so the right packages are found.

## Logging

```
import logging
logging.basicConfig(filename="job.log", level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(message)s")
logging.info("Job started")
try:
    1 / 0
except ZeroDivisionError:
    logging.exception("Job failed")   # writes the full traceback
```

Levels from low to high: DEBUG, INFO, WARNING, ERROR, CRITICAL. Use `print` for what the user should see; use `logging` for the record.

## Operating system schedulers

I did not test any of the following. Treat them as starting points and test with a harmless script (one that only writes a line to a log) first.

**Windows Task Scheduler.** Microsoft describes it as a component that runs tasks when triggers such as a time, logon or boot occur. You can use the Task Scheduler app (Create Basic Task) or the command line. Example, daily at 07:30:

```
schtasks /create /tn "DailyReport" /sc daily /st 07:30 ^
  /tr "\"C:\proj\.venv\Scripts\python.exe\" \"C:\proj\project25_scheduled_report.py\" C:\proj\inbox C:\proj\reports"
```

**cron (Linux, macOS).** Edit your table with `crontab -e`. The five time fields are minute, hour, day of month, month, day of week.

```
30 7 * * 1-5 /home/me/proj/.venv/bin/python /home/me/proj/project25_scheduled_report.py /home/me/proj/inbox /home/me/proj/reports >> /home/me/proj/cron.out 2>&1
```

That line means 07:30 on weekdays, with output appended to a file.

**launchd (macOS).** A property list file in `~/Library/LaunchAgents/` names the program and a `StartCalendarInterval`. It is loaded with `launchctl`. The details differ between macOS versions; use Apple's current documentation for your version.

Remember that a laptop that is asleep or off does not run its jobs on time, and an unattended job runs with your permissions.

## Python-only options

The simplest is a loop with a pause, as Project 25's `--every-seconds` and `--runs` options do. It runs only while the program is open and stops when you log off. The standard library also has a `sched` module for in-process timers. Third-party schedulers exist; I did not test any.

### Project 25. Scheduled report preparation

**Problem:** A report should be prepared every day by a scheduler, leave a log, and not repeat itself if it runs twice.

**Expected result:** A dated Markdown report built from the newest CSV in an inbox folder, a rotating log file, and a clean exit code.

**Required tools:** Python standard library only.

**Installation:** nothing to install. Use `py` on Windows or `python3` on macOS and Linux to run it.

**Complete source code** (`project25_scheduled_report.py`):

```
"""Project 25: a report job that is safe to run from a scheduler. It takes
the newest CSV in an inbox folder, writes a dated Markdown report, logs
everything to a file, and skips the run if today's report already exists.
Python-only repeat: add --every-seconds N --runs M (see the book)."""
import argparse
import csv
import logging
import time
from collections import Counter
from datetime import date
from decimal import Decimal
from logging.handlers import RotatingFileHandler
from pathlib import Path


def run_once(inbox, outdir, log):
    files = sorted(inbox.glob("*.csv"), key=lambda p: p.stat().st_mtime)
    if not files:
        log.warning("No CSV files in %s", inbox)
        return 1
    newest = files[-1]
    target = outdir / f"report_{date.today().isoformat()}.md"
    if target.exists():
        log.info("Report %s already exists: nothing to do", target.name)
        return 0
    totals = Counter()
    with newest.open(newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            totals[row["category"]] += Decimal(row["amount"])
    lines = [f"# Spending report {date.today().isoformat()}", "",
             f"Source: {newest.name}", ""]
    lines += [f"- {cat}: {amount:.2f}" for cat, amount in totals.most_common()]
    lines += ["", f"Total: {sum(totals.values()):.2f}"]
    outdir.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    log.info("Wrote %s from %s (%d categories)", target.name, newest.name,
             len(totals))
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description="Scheduled report job.")
    parser.add_argument("inbox", type=Path)
    parser.add_argument("outdir", type=Path)
    parser.add_argument("--log", type=Path, default=Path("report_job.log"))
    parser.add_argument("--every-seconds", type=int, default=0)
    parser.add_argument("--runs", type=int, default=1)
    args = parser.parse_args(argv)

    log = logging.getLogger("report_job")
    log.setLevel(logging.INFO)
    # A rotating file keeps the log from growing without limit.
    handler = RotatingFileHandler(args.log, maxBytes=200_000, backupCount=3,
                                  encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    log.addHandler(handler)
    log.addHandler(logging.StreamHandler())  # also show on screen

    if not args.inbox.is_dir():
        log.error("Inbox %s is not a folder", args.inbox)
        return 1
    status = 0
    for run in range(args.runs):
        try:
            status = run_once(args.inbox, args.outdir, log)
        except Exception:  # a scheduled job must log the reason and not vanish
            log.exception("Report job failed")
            status = 1
        if run < args.runs - 1:
            time.sleep(args.every_seconds)
    return status


if __name__ == "__main__":
    raise SystemExit(main())
```

**Code explanation:**

- `run_once` is the whole job. Keeping it in a function lets you call it once, in a loop, or from a scheduler.
- If today's report exists, the job logs it and stops. That makes accidental double runs harmless (idempotent).
- `RotatingFileHandler` caps log size and keeps three old files.
- The top-level `try/except` writes the traceback to the log with `log.exception`. A scheduled job has nobody watching, so the log is the only witness.
- `--every-seconds` and `--runs` give a Python-only repeat. It lasts only while the program runs.

**Sample input:** `sample_data/inbox/expenses_latest.csv` (the expense data from Project 9).

**Sample output** (real output from my test run, Windows 11, Python 3.14.4, 2026-11-07):

First run:

```
Wrote report_2026-11-07.md from expenses_latest.csv (5 categories)
```

Second run the same day:

```
Report report_2026-11-07.md already exists: nothing to do
```

Two runs one second apart, new output folder:

```
Wrote report_2026-11-07.md from expenses_latest.csv (5 categories)
Report report_2026-11-07.md already exists: nothing to do
```

**How to run it** (from the `source` folder):

```
py project25_scheduled_report.py sample_data/inbox reports
py project25_scheduled_report.py sample_data/inbox reports
py project25_scheduled_report.py sample_data/inbox reports_b --every-seconds 1 --runs 2 --log job_b.log
```

**Common errors and fixes:**

- **No CSV files in .** Check the inbox path in the scheduler's command; the working folder may differ.
- **Nothing happens when the scheduler runs.** Use absolute paths for python, the script and all folders.

**Safe-use notes:** The scheduled setup itself (Task Scheduler, cron, launchd) was not tested for this book. Test it with a harmless script first, and give the job only the access it needs.

**Optional challenge:** Exit with code 3 when the newest CSV is older than 7 days, so a scheduler can alert you.


# Chapter 12. Debugging, security and next steps

## Reading a traceback

Read from the bottom. The last line names the error and message. The lines above show the chain of calls; the one nearest the bottom in your own file is usually where to look.

```
Traceback (most recent call last):
  File "demo.py", line 3, in <module>
    total = int(price) * 2
ValueError: invalid literal for int() with base 10: '4.5'
```

Here the message says `int` cannot convert the text `4.5`. The fix is `float(price)`.

## Three debugging tools

- **print:** print the variable just before the line that fails. Remove the prints afterwards.
- **logging:** like print but with levels and a file; good for scheduled jobs.
- **pdb:** the built-in debugger. Add `breakpoint()` before the failing line and run the script. At the `(Pdb)` prompt, `p variable` prints a value, `n` runs the next line, `c` continues, `q` quits.

## Safe file handling checklist

- [ ] Work on a copy of the data while testing.
- [ ] Take a backup (Project 4) before any move, rename or in-place edit.
- [ ] Offer a dry run, and make it the default.
- [ ] Refuse to overwrite; write to a new name.
- [ ] Never delete automatically. Report instead.
- [ ] Validate paths and inputs, and print a clear error.
- [ ] Log what the script did.
- [ ] Count inputs and outputs and compare.

## Secrets

Do not write passwords, API keys or tokens in script files or in the folder you back up or share. Use environment variables or your operating system's credential store. If a secret was ever saved in a file you shared, treat it as exposed and replace it at its source. Email scripts: prepare drafts (Project 23) rather than storing a mail password.

## Dependency hygiene

- Install packages only from the official package index, and check the name for typos; lookalike names exist.
- Keep a `requirements.txt`, and use a virtual environment per project.
- Update on purpose, then rerun your tests. `py -m pip list --outdated` shows what is old.
- Fewer dependencies mean fewer problems. Prefer the standard library when it does the job.

## Next steps

Pick one task from your own week and automate it with the pattern from Chapter 1. Then explore: reading EXIF data with Pillow, `python-docx` for Word, OCR for scans, `pytest` for tests, Git to track versions of your scripts, and the official Python tutorial at docs.python.org.

# Conclusion

Automation is a habit more than a skill: notice a repeated task, write the steps, test on a copy, run safely. You now have 25 working examples of that cycle and a checklist to apply to new ones.

An action list for this week:

- [ ] Set up Python and a virtual environment (Chapter 2).
- [ ] Run Projects 1 and 5 on sample data, then on a copy of a real folder.
- [ ] Choose one monthly task and adapt Project 9, 13 or 22 to your own data.
- [ ] Add a dry run and a log to every script you write.
- [ ] Back up your scripts and data in two places.

# Appendix A. Python cheat sheet

| Task | Code |
|---|---|
| Join a path | `Path("a") / "b.txt"` |
| List files | `Path(".").glob("*.csv")` |
| File name parts | `p.name`, `p.stem`, `p.suffix` |
| Read text | `p.read_text(encoding="utf-8")` |
| Write text | `p.write_text(s, encoding="utf-8")` |
| Does it exist | `p.exists()` |
| Copy / move | `shutil.copy2(a, b)`, `shutil.move(a, b)` |
| Strip and split | `s.strip()`, `s.split(",")` |
| Count items | `Counter(items).most_common(5)` |
| Dictionary default | `d.get(key, 0)` |
| Sort by value | `sorted(d.items(), key=lambda x: x[1])` |
| Parse a date | `datetime.strptime(s, "%Y-%m-%d")` |
| Format a date | `dt.strftime("%Y%m%d_%H%M%S")` |
| Read CSV | `csv.DictReader(fh)` |
| JSON to Python | `json.loads(text)` |
| Environment variable | `os.environ.get("NAME")` |
| Format money | `f"{x:,.2f}"` |
| Run main only directly | `if __name__ == "__main__":` |

# Appendix B. Common error reference

| Error | Usual cause | Fix |
|---|---|---|
| `SyntaxError` | Missing colon, bracket or quote | Check the line shown and the one above it |
| `IndentationError` | Uneven spaces | Use four spaces everywhere |
| `NameError` | Misspelt or undefined name | Check spelling and order |
| `ModuleNotFoundError` | Package not installed in this Python | `py -m pip install name` in the active environment |
| `FileNotFoundError` | Wrong path or folder | Print `Path.cwd()`; use absolute paths |
| `PermissionError` | File open elsewhere or protected | Close the program; check permissions |
| `UnicodeDecodeError` | Wrong text encoding | Try `encoding="utf-8-sig"` or `"cp1252"` |
| `KeyError` | Missing dictionary key or column | Check the header; use `.get` |
| `ValueError` | Bad conversion such as `int("abc")` | Validate input first |
| `TypeError` | Wrong kind of value | Convert with `int()`, `str()` |
| `IndexError` | List position out of range | Check the length first |
| `ZeroDivisionError` | Dividing by zero | Test the divisor |
| `python is not recognized` | Python not on PATH | Use `py`, or reinstall with PATH ticked |
| `pip` installs to the wrong Python | Plain `pip` used | Use `py -m pip` |

# Appendix C. Glossary

**API:** a defined way for programs to request data or actions from each other.

**argument:** a value given to a script on the command line, or to a function.

**backup:** a separate copy of data kept so you can recover from mistakes.

**CSV:** plain text table with values separated by commas.

**dry run:** a run that shows what would happen without doing it.

**encoding:** the rule that maps characters to bytes; UTF-8 is the common choice.

**environment variable:** a named setting held by the operating system, often used for secrets.

**exit code:** the number a program returns; 0 means success.

**hash:** a fixed-length fingerprint of data, such as SHA-256; the same content always gives the same hash.

**idempotent:** safe to run twice, because the second run changes nothing.

**JSON:** a text format for lists and key-value data, common in APIs.

**OCR:** optical character recognition, turning images of text into text.

**package:** code written by others that you install with pip.

**regular expression:** a pattern for matching text.

**traceback:** the report Python prints when an error stops a script.

**virtual environment:** a private folder of packages for one project.

# Appendix D. Project checklist

Use this before you run any script on real data.

- [ ] I know what the script changes and where.
- [ ] I ran it on sample data first.
- [ ] I have a backup, or the script only reads.
- [ ] I ran the dry run and read all of it.
- [ ] The output name does not exist yet.
- [ ] No password, key or personal data is written in the code.
- [ ] I know how to undo the result.
- [ ] I compared counts before and after.
- [ ] I saved the script and a note of how I ran it.

# Appendix E. 30-day learning plan

About 30 to 45 minutes a day. Adjust freely; skipping a day is fine.

- [ ] Day 1: Install Python; run `py --version`.
- [ ] Day 2: Create and activate a virtual environment.
- [ ] Day 3: Install openpyxl and pypdf; run `make_sample_data.py`.
- [ ] Day 4: Chapter 3, variables and strings.
- [ ] Day 5: Lists, dictionaries, loops.
- [ ] Day 6: Functions and exceptions.
- [ ] Day 7: Review; write a script that prints the files in a folder.
- [ ] Day 8: Project 5, folder size report.
- [ ] Day 9: Read Project 5's code line by line; change the output.
- [ ] Day 10: Project 1, bulk rename, dry run only.
- [ ] Day 11: Project 1, apply on a copy.
- [ ] Day 12: Project 2, organise by type.
- [ ] Day 13: Project 3, duplicates.
- [ ] Day 14: Project 4, backup; restore one file by hand.
- [ ] Day 15: Review week two; list tasks from your own work.
- [ ] Day 16: Project 7, CSV cleanup.
- [ ] Day 17: Project 9, expense summary on your own data.
- [ ] Day 18: Project 11, validation rules for your file.
- [ ] Day 19: Project 13, Excel report.
- [ ] Day 20: Project 14, merge workbooks.
- [ ] Day 21: Review; adapt one project to your data.
- [ ] Day 22: Project 15, PDF text extraction on a PDF of yours.
- [ ] Day 23: Projects 16 and 17, merge and split.
- [ ] Day 24: Projects 18 and 19, text tools.
- [ ] Day 25: Project 21, log summary.
- [ ] Day 26: Project 22, monthly report.
- [ ] Day 27: Project 24, API; read the terms of one API.
- [ ] Day 28: Project 25, logging and exit codes.
- [ ] Day 29: Set up a schedule for a harmless script.
- [ ] Day 30: Choose your first real automation and write its plan.

# Appendix F. References and further reading

The sources below were opened on 2026-11-07 ("accessed 2026-11-07"). A page that failed to open is noted.

- https://www.python.org/downloads/ - current releases and downloads (read in the preparation research on 2026-11-07, which noted newer series than 3.14; the book names no patch number except the one I ran).
- https://docs.python.org/3/library/venv.html - virtual environment creation and activation commands. Accessed 2026-11-07.
- https://pypdf.readthedocs.io/en/stable/user/extract-text.html - text extraction limits, scanned PDFs and OCR. Accessed 2026-11-07.
- https://jsonplaceholder.typicode.com/ - the free test API used in Project 24. Accessed 2026-11-07.
- https://www.rfc-editor.org/rfc/rfc9309 - Robots Exclusion Protocol; robots.txt is not access authorisation. Accessed 2026-11-07.
- https://learn.microsoft.com/en-us/windows/win32/taskschd/task-scheduler-start-page - what Windows Task Scheduler does and its triggers. Accessed 2026-11-07.
- https://openpyxl.readthedocs.io/en/stable/simple_usage.html - returned HTTP 404 when accessed 2026-11-07, so it is not used as a source.
- Competitor Gumroad pages (for example numbpilled.gumroad.com/l/pythonninja, vigneshselvaraj.gumroad.com/l/python-automation-playbook) - opened 2026-11-07; most showed only a title, which is why the market comparison in the Introduction is limited.

Full notes are in `research_notes.md` in the book folder.

## Bonus download

`Python_Automation_Project_Source.zip` contains the `source` folder: all 25 scripts, `make_sample_data.py`, the sample data, `requirements.txt`, `README.md` and `test_log.md`. It is an optional bonus; the book is complete without it. Unzip it, create a virtual environment inside, install the requirements, and run `py make_sample_data.py` to recreate the sample files at any time.
