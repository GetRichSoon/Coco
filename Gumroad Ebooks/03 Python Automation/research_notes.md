# Research notes, Book 03: Python Automation for Beginners (2026-11-07)

## Starting point
`Organic Research\03_Python_Automation_research.md` (18 Gumroad pages, price table, gap analysis). Gap: nothing found combines beginners + files + spreadsheets + reports in one title; Excel-only and "script pack" listings dominate.

## Extra pass (2026-11-07)
Competitor pages opened (Gumroad, via WebFetch): vigneshselvaraj /python-automation-playbook, numbpilled /pythonninja, driscollis /openpyxl, bookkeeper72 /guide, codeeliteintprep /measzo. All five returned little beyond the title (no contents, price or version information visible), so no deeper comparison is claimed. The first two showed no mention of source code or tested versions in the text returned.

Buyer complaints: one WebSearch for complaints found no Reddit thread. It found Goodreads/retailer review summaries about related titles (mainly Automate the Boring Stuff, a Cookbook title). Themes: pacing too fast for absolute beginners; too basic for experienced readers; some library content dated. No "scripts don't work" complaint was found, but the search was shallow and aggregator summaries (Fakespot) are not reliable. I did not read the underlying reviews.

How the book answers these: slow setup chapter; a short Python primer; every script run and its real output shown; versions named (3.14.4 tested); a "not tested" list; error tables; dry-run and backup patterns.

## Factual sources opened
- docs.python.org/3/library/venv.html: venv and activation commands; page was the Python 3.15.2 documentation.
- pypdf.readthedocs.io/en/stable/user/extract-text.html: extraction limits; scanned PDFs need OCR; pypdf never extracts text from images.
- jsonplaceholder.typicode.com: free fake API, no signup/key, resources (users 10, todos 200), no stated limits.
- rfc-editor.org/rfc/rfc9309: robots.txt rules are not access authorisation.
- learn.microsoft.com Task Scheduler start page: triggers and purpose.
- openpyxl.readthedocs.io simple_usage page: HTTP 404 on 2026-11-07. Not used. The formula limitation is shown by my own test (Project 13).
- python.org/downloads: not re-fetched by me; the prior research file recorded newer series than 3.14 on the same date. The book says "3.12 or newer" and names only 3.14.4, which I ran.

## Not verified
Task Scheduler/cron/launchd commands (syntax from general knowledge, untested). pip/venv steps on macOS and Linux. Whether mail clients open the .eml files as drafts. python-docx was installed but no project was written, so docx is not taught.
