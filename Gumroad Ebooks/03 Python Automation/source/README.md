# Python Automation for Beginners: project source

25 scripts (`project01_...py` to `project25_...py`), sample data in `sample_data/`, and `make_sample_data.py` which recreates the sample data.

## Setup

Use Python 3.12 or newer. Tested only with Python 3.14.4 on Windows 11 (2026-11-07). On Windows type `py`; on macOS and Linux type `python3` instead.

```
py -m venv .venv
.venv\Scripts\Activate.ps1          (macOS/Linux: source .venv/bin/activate)
py -m pip install -r requirements.txt
py make_sample_data.py
```

## What each project needs

| Projects | Needs |
|---|---|
| 13, 14, 22 | openpyxl (tested 3.1.5) |
| 15, 16, 17 | pypdf (tested 7.0.0) |
| all others | standard library only |
| make_sample_data.py | openpyxl |

## How to run

Every script has `--help`. The exact command for each project is in the book under "How to run it". Scripts that change files (1, 2, 6, 19) do a dry run unless you add `--apply` (1, 2, 19) or run without `--dry-run` (6). Run them on a copy of your data.

## Testing

See `test_log.md`. All 25 scripts were run on sample data in a scratch copy and passed. Not tested: macOS, Linux, schedulers (Task Scheduler, cron, launchd), opening the .eml files in a mail program, opening the .xlsx files in Excel, OCR.

Project 24 needs internet access to the public test API https://jsonplaceholder.typicode.com. Without it, the script shows a message and uses its cache file if one exists.

Do not put passwords or keys in these scripts. All sample data is invented.
