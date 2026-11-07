# Introduction

Most office and study work contains tasks that repeat: renaming forty files, tidying a spreadsheet export, joining PDFs, writing the same monthly summary. This book teaches you to hand those tasks to short Python scripts. It assumes you can use a computer comfortably and have never programmed, or have only dabbled.

You get 25 complete projects. Each starts from a problem, gives a full script, explains the important lines, shows the real output I got when I ran it, and lists the errors you are likely to meet. The scripts are small on purpose: one script, one job, readable in a few minutes.

## What is tested and what is not

All 25 scripts were run on 2026-11-07 on Windows 11 with Python 3.14.4, inside a virtual environment, with openpyxl 3.1.5 and pypdf 7.0.0. Every "Sample output" in this book is the real output of that run. The data is invented sample data, included in the optional download.

Not tested: macOS, Linux, any scheduler (Windows Task Scheduler, cron, launchd), any mail program opening the draft emails, OCR for scanned PDFs, and Excel itself opening the generated workbooks. The scripts use `pathlib` and standard libraries so they should work on other systems, but I have not run them there. Where a platform detail differs, the book says so. Outputs on macOS or Linux will show `/` instead of `\` in paths.

A smaller compatibility check was also run on Python 3.12.12 (Windows 11, openpyxl 3.1.5, pypdf 4.3.1, 2026-11-07): all 25 scripts compiled and showed their help text, and nine representative scripts (Projects 3, 7, 9, 13, 14, 15, 18, 21 and 22) gave the same results as on 3.14.4. The other scripts were not run in full on 3.12, and Python 3.13 was not tested.

The one network project (Project 24) reached its public test API when I ran it. Its failure path was also run, using an address that refuses connections.

## Which Python version

Use Python 3.12 or newer. At the time of writing python.org offers newer series than 3.14 as well; download the current stable release from python.org and check the documentation for your version at docs.python.org. The scripts avoid new features and should work on any 3.12 or newer, but the full test run used 3.14.4 and a smaller check used 3.12.12.

## How to use this book

- Read Chapters 1 to 3 once. If you already program, skim Chapter 3.
- Do the projects in order within a chapter, or jump to the one you need. Each project stands alone.
- Run every script first on the sample data, then on a copy of your own files, never on the only copy.
- Every project has the same twelve labelled parts, so you can find the code, the commands and the warnings quickly.

## Optional bonus download

The folder `source`, with all 25 scripts, the sample data, `requirements.txt` and a README, is available as `Python_Automation_Project_Source.zip`. It is optional: every script is printed in full in this book, but typing well over a thousand lines of code is not a good use of your time. The one script not printed with a project is `make_sample_data.py`, which creates the sample data.

## What this book does not do

It does not teach all of Python, web scraping, data science or machine learning. It does not promise that automation saves a particular amount of time; that depends on how often your task repeats and how long the script takes you to adapt. It does not replace professional advice for legal, tax or privacy questions about the data you process.

## How this book was researched

On 2026-11-07 I reviewed competing Python automation titles on Gumroad (several pages returned only a title, so I could not compare contents), read the official documentation for pypdf, `venv`, JSONPlaceholder, robots.txt (RFC 9309) and Windows Task Scheduler, and searched for reader complaints. The pattern I found, with limited evidence, was: books that are Excel-only or a bag of unrelated scripts; code without tested output; and weak coverage of safety. This book combines files, spreadsheets, PDFs, text, reports and scheduling for beginners, shows tested output, and makes dry runs and backups part of every script that changes something. Sources are listed in Appendix F.

# Chapter 1. Introduction to Python automation

## What automation means here

Automation means writing down the steps of a task once, precisely, so a computer can repeat them. A script is a text file of such steps in Python. You run it, it does the work, and it can report what it did.

Python suits this work for three reasons. Its syntax is close to plain English. Its standard library already handles files, CSV, dates, regular expressions, email messages and web requests. And a large set of free packages covers formats the standard library does not, such as Excel files and PDFs.

## Is a task worth automating

Use this quick test before you write any code.

- [ ] The task repeats, or it is large (hundreds of files or rows).
- [ ] The steps are the same every time, or the differences can be described as rules.
- [ ] A mistake is cheap to undo, or you can keep a backup.
- [ ] You can describe the correct result in a sentence.

If the first box is not ticked, doing it by hand may be faster. A simple estimate helps: if the task takes 10 minutes and happens weekly, that is about 520 minutes a year (10 x 52). If writing and testing the script takes three hours (180 minutes), it pays back in a little over a third of a year. Your numbers will differ; the arithmetic is the point.

## The shape of every script in this book

Each project follows the same pattern, which is also a good habit for your own scripts:

1. Read the arguments (which folder, which file).
2. Validate them and stop with a clear message if something is wrong.
3. Work out what would be done, before doing it.
4. Print the plan. If the script changes things, stop here unless `--apply` was given.
5. Do the work without overwriting anything.
6. Report what happened.

## Tasks this book covers

| Area | Chapter | Projects |
|---|---|---|
| Files and folders | 4 | 1 to 6 |
| CSV data | 5 | 7 to 12 |
| Excel | 6 | 13 to 14 |
| PDF | 7 | 15 to 17 |
| Text | 8 | 18 to 21 |
| Reports and drafts | 9 | 22 to 23 |
| APIs | 10 | 24 |
| Scheduling | 11 | 25 |

# Chapter 2. Installing Python and setting up

## Install Python

Download the current stable Python from the official page, https://www.python.org/downloads/, and follow the installer for your system. Python 3.12 or newer is required.

- **Windows:** run the installer. If it offers "Add python.exe to PATH", tick it. The installer also provides the `py` launcher. Check with `py --version` in PowerShell or Command Prompt.
- **macOS:** use the installer from python.org. Check with `python3 --version` in Terminal.
- **Linux:** Python 3 is usually installed. Check with `python3 --version`. On Debian or Ubuntu you may need `sudo apt install python3-venv python3-pip`. This is the general pattern on those systems; I did not test it.

On Windows, type `py` where this book shows `py`. On macOS and Linux, replace `py` with `python3` in every command. Both of these are the same program: `py script.py` on Windows and `python3 script.py` elsewhere.

If your computer has several Pythons (for example one bundled inside another application), check which one runs: `py -0p` on Windows lists the installed ones. Use a normal Python installation, not the copy inside another program.

## Virtual environments

A virtual environment is a private folder of packages for one project. It stops one project's packages from clashing with another's and keeps your main Python clean. Create one inside the folder where you keep the book's files:

```
py -m venv .venv
```

Activate it. The commands below are from the official `venv` documentation:

```
# Windows PowerShell
.venv\Scripts\Activate.ps1

# Windows Command Prompt
.venv\Scripts\activate.bat

# macOS and Linux (bash or zsh)
source .venv/bin/activate
```

On PowerShell you may first need `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`, which the same documentation mentions. The prompt shows `(.venv)` when active. Type `deactivate` to leave. Once active, `python` points to the environment's Python.

## Installing packages with pip

Always call pip through Python so you are sure which Python receives the package:

```
py -m pip install openpyxl pypdf
py -m pip list
```

The bonus download has a `requirements.txt` so one command installs both:

```
py -m pip install -r requirements.txt
```

Only 6 of the 25 projects need a package: openpyxl (Projects 13, 14, 22) and pypdf (Projects 15, 16, 17). The helper `make_sample_data.py` also needs openpyxl. The other 19 projects use the standard library only.

## Running a script

Save the script as a `.py` file, open a terminal in its folder, and run:

```
py project05_folder_size_report.py sample_data/project_files
```

Anything after the file name is an argument the script can read. If you see `can't open file`, you are in the wrong folder; use `cd` to move, or give the full path. Forward slashes work in paths on Windows too.

## Choosing an editor

Any plain text editor works. Beginners usually do better with an editor that colours code and shows errors: Visual Studio Code, PyCharm Community Edition, or IDLE, which comes with Python. Avoid word processors; they insert curly quotes that break code. Save files as UTF-8.

## Setup checklist

- [ ] `py --version` (or `python3 --version`) shows 3.12 or newer.
- [ ] A virtual environment is created and active.
- [ ] `py -m pip install openpyxl pypdf` worked.
- [ ] You unpacked the bonus download, or created a folder for your own scripts.
- [ ] In that folder, `py make_sample_data.py` printed "Sample data written to ...".

# Chapter 3. Python foundations needed

This chapter covers only what the projects use. Type the examples into a file and run them, or into the interactive prompt (`py` with no arguments; `exit()` to leave).

## Variables and types

```
name = "Ada"          # str: text
count = 3             # int: whole number
price = 4.5           # float: decimal number
paid = True           # bool: True or False
print(name, count * price, paid)
```

For money use `Decimal` (Project 9), because floats store some decimals approximately.

## Strings and f-strings

```
file = "  Report_Final.TXT "
print(file.strip().lower())      # report_final.txt
print(file.split("_"))           # ['  Report', 'Final.TXT ']
number = 7
print(f"invoice_{number:03d}.pdf")   # invoice_007.pdf
```

An f-string starts with `f` and puts values inside `{}`. After the colon you can format: `03d` pads to three digits, `.2f` gives two decimals.

## Lists and dictionaries

```
files = ["a.txt", "b.csv"]
files.append("c.pdf")
for item in files:
    print(item)

totals = {"North": 10, "South": 4}
totals["East"] = 7
print(totals["North"], totals.get("West", 0))   # 10 0
```

A list keeps order; a dictionary looks values up by key. `.get(key, default)` avoids an error when the key is missing.

## Decisions and loops

```
for n in range(1, 6):
    if n % 2 == 0:
        print(n, "even")
    else:
        print(n, "odd")
```

Indentation (four spaces) is how Python knows what belongs to the `for` or `if`. A missing or uneven indent gives `IndentationError`.

## Functions

```
def vat_total(net, rate=0.2):
    """Return net plus tax."""
    return net * (1 + rate)

print(vat_total(100))        # 120.0
```

A function names a piece of work. Small functions are easier to test and reuse, which is why the projects split work into them.

## Paths with pathlib

```
from pathlib import Path

folder = Path("sample_data")
for path in folder.iterdir():
    print(path.name, path.suffix, path.is_file())

target = folder / "notes" / "a.txt"      # the / joins parts
print(target.exists())
```

`pathlib` builds paths that work on any operating system. Useful pieces: `.name`, `.stem` (name without extension), `.suffix`, `.parent`, `.exists()`, `.is_file()`, `.glob("*.csv")`, `.rglob("*")` (include sub-folders).

## Reading and writing text

```
path = Path("hello.txt")
path.write_text("Hello\nWorld\n", encoding="utf-8")
text = path.read_text(encoding="utf-8")
print(text.splitlines())

with path.open("a", encoding="utf-8") as fh:   # "a" appends
    fh.write("Third line\n")
```

Always state `encoding="utf-8"`. Use `with` so the file closes by itself. Mode `"w"` replaces a file's content, which is why the projects check `exists()` before writing.

## Exceptions

```
try:
    value = int("abc")
except ValueError as error:
    print("Not a number:", error)
```

Catch the specific error you expect. Catching everything hides bugs; Project 25 does it only at the top of a scheduled job, and logs the full traceback.

## The main guard and arguments

```
import argparse

def main(argv=None):
    parser = argparse.ArgumentParser(description="Demo")
    parser.add_argument("folder")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args(argv)
    print(args.folder, args.apply)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
```

`if __name__ == "__main__":` runs `main()` only when you run the file directly, not when another script imports it. `argparse` reads the command line and creates `--help` for free. The returned number becomes the exit code: 0 means success, anything else means a problem, which schedulers can detect.

## Foundations checklist

- [ ] I can explain the difference between a list and a dictionary.
- [ ] I know why `"w"` mode needs care.
- [ ] I can run a script with an argument.
- [ ] I can read the last line of a traceback (Chapter 12).
