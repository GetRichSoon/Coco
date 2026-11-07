# Test log

Date: 2026-11-07
Python: 3.14.4 (tags/v3.14.4:23116f9, Apr 7 2026, MSC v.1944 64 bit AMD64), in a virtual environment
Platform: Windows-11-10.0.26300-SP0
Packages: openpyxl 3.1.5, pypdf 7.0.0
Method: source folder copied to a scratch folder; `make_sample_data.py` run there; each command below run from that folder with the venv's `python`; output captured. The first full run found two cosmetic issues (word count in Project 15 included page markers; Project 20 left an ALL CAPS first word), both fixed and the whole suite re-run. A rename undo log was also excluded from Project 1's file list after review.

| Project | Command (arguments) | Result |
|---|---|---|
| 1 | sample_data/rename_demo --prefix trip (dry run, --apply, rerun) | PASS |
| 2 | sample_data/downloads (dry run, --apply) | PASS |
| 3 | sample_data/dupes | PASS (2 groups found) |
| 4 | sample_data/project_files backups (--dry-run, real, destination inside source) | PASS (refusal case also correct) |
| 5 | sample_data/project_files | PASS |
| 6 | sample_data/photos photos_sorted (--dry-run, real, rerun) | PASS (rerun skipped 5) |
| 7 | sample_data/sales_messy.csv | PASS (4 clean, 3 rejected) |
| 8 | sample_data/orders.csv orders_parts --rows 10 | PASS (10, 10, 5) |
| 9 | sample_data/expenses.csv | PASS (total 2562.00) |
| 10 | sample_data/contacts.csv | PASS |
| 11 | sample_data/orders_to_check.csv | PASS (exit code 2 by design, 5 problems found) |
| 12 | --count 3, then default | PASS (0001 to 0003, then 0004) |
| 13 | sample_data/sales/sales_2026_10.csv sales_october.xlsx | PASS (F2 reads None with data_only, as documented) |
| 14 | sample_data/branches merged_branches.xlsx | PASS (wrong-header file skipped) |
| 15 | handbook.pdf, scanned_like.pdf | PASS (blank page warning shown) |
| 16 | invoices_merged.pdf + two PDFs | PASS (2 pages) |
| 17 | handbook.pdf, ranges 1-2,3-5 and 4-9 | PASS (bad range refused) |
| 18 | sample_data/notes --top 6 | PASS |
| 19 | notes ACME Tools "Northwind Tools" (dry, --apply, dry) | PASS |
| 20 | release_notes_raw.txt release_notes_clean.txt | PASS |
| 21 | sample_data/app.log | PASS |
| 22 | sample_data --month 2026-10 | PASS (total 2692.95 equals Project 13 total) |
| 23 | reminders.csv drafts --sender me@example.com | PASS (2 drafts, 1 skipped) |
| 24 | live API (--users 3); --base-url http://localhost:9 | PASS (API reachable on 2026-11-07; failure path used cache) |
| 25 | inbox reports (twice); --every-seconds 1 --runs 2 | PASS (second run skipped) |

Not tested: macOS, Linux, Windows Task Scheduler, cron, launchd, opening .eml in a mail client, opening .xlsx in Excel, OCR, Python versions other than 3.14.4.


## Additional compatibility check (added 2026-11-07)
Python 3.12.12, Windows 11, openpyxl 3.1.5, pypdf 4.3.1: all 25 scripts compile and print help; Projects 3, 7, 9, 13, 14, 15, 18, 21, 22 run with results matching the 3.14.4 run (e.g. 2 duplicate groups, total 2562.00, 12 merged rows, 2692.95 revenue). Not run in full on 3.12: the other projects. Python 3.13 not tested.
