# Organic research 03: Python Automation for Beginners (date 2026-11-07)

Book: PYTHON AUTOMATION FOR BEGINNERS: 25 Practical Projects for Files, Spreadsheets, Reports & Everyday Work.
Method: WebSearch (4 queries) for Gumroad /l/ pages, then gumroad_extract.py for price, ratings, seller-shown sales. "not visible" = the page data did not show it. Ratings are not sales. Sales counts are only what the seller page shows. No keyword tool was available, so no search volumes exist here.
Titles marked (search) came from search result titles because the script returned no name.

## 1. Competitor table (18 pages extracted; technivis, brittmon, jovapad, johnnathan7209 returned no data and are dropped; not confirmed as 404, just empty extracts)

| Title | Price | Ratings (count / avg) | Sales shown | Positioning | Bonuses / format |
|---|---|---|---|---|---|
| Automating Excel with Python (driscollis /openpyxl) | $25 | 23 / 5.0 | not visible | OpenPyXL-only Excel book by known author | PDF, epub, mobi |
| Automating Excel with Python Video Course + Book Bundle (driscollis /excel_bundle) | $49 | 0 | not visible | Same topic plus video | 10 videos + eBook |
| AUTOMATING EXCEL WITH PYTHON (pythonclcoding /gqrlq) | $13 | 2 / 5.0 | 33 | Beginner and pro Excel automation, 177 pages (per search) | not visible |
| Automate Your Excel Workflows with Python (m4tzer /omclfk) | 29 EUR | 0 | not visible | Toolkit: cleaning, dashboards, LaTeX reports | scripts toolkit |
| Excel files with Python (pythoncourses /LZPLl) | $10 | none | not visible | Beginner video course, Excel read/write/charts | source code per example |
| Python Automation Playbook (vigneshselvaraj) | $19.99 | 0 | not visible | 50 real-world scripts: files, Excel, email; 234 pages (search) | not visible |
| Python Automation Ninja: 10 Custom Python Automations (numbpilled /pythonninja) | $28 | 0 | not visible | 10 automations, beginners and experienced | not visible |
| Python Secrets: Practical Guide to Automating Your Life, Business, Workflow (bookkeeper72 /guide) | $9 | 0 | not visible | No-experience beginner guide | not visible |
| Python Scripts Pack: Automate Your Daily Tasks (lunsy) | $1 | 1 / 5.0 | 1 | 5 scripts | bonus beginner PDF, zip |
| Automate Your Daily Tasks with Python (nafizrezo) (search) | $3 | 0 | not visible | Beginner setup + automation mindset | not visible |
| Automate the Boring Stuff, 1st Edition PDF (drh) | $14.99 | 0 | not visible | Resale of a famous title; licence unverified | PDF |
| Python Dev Kit (wellsr) | $25 | 0 | not visible | Big Book of Python Scripts + cheatsheet | 2 files |
| Practice Python Projects (learnbyexample /py_projects) | $10 | 11 / 4.9 | 1841 | Project practice book by established seller | PDF + EPUB |
| 100 Python Projects (pythonclcoding /100PythonProjects) | $15 | 0 | 64 | Volume of projects | not visible |
| Python Projects, 23 projects (codingbootcampinc /syrkwg) (search) | $4.99 | 0 | not visible | 23 projects with source code | source code |
| 20 hands on python projects examples ebook (codemycodes) (search) | $7.99 | none | not visible | 20 projects | not visible |
| Beginner Python Projects (codeeliteintprep /measzo) (search) | $2.99 | 3 / 5.0 | 163 | Beginner projects to automation tools | not visible |
| 7-Day Coding Jumpstart (tjkuch /cfhss) | $4.99 | none | not visible | Learn Python in 7 days | not visible |

Observed price range $1 to $49; most ebooks $3 to $29. The two highest social-proof pages are cheap project-practice books ($10 with 1841 shown sales; $2.99 with 163), not automation-specific ones. The only automation titles with ratings are Excel-only (23 and 2 ratings). Currency and "+" pay-what-you-want flags were not checked.

## 2. Title-structure analysis
- Pattern A, "Automating/Automate X with Python": Excel and Daily Tasks titles are plain, keyword-first.
- Pattern B, number + noun: "50 Scripts", "10 Automations", "23 Projects", "100 Projects", "20 Projects". Numbers signal concreteness. 25 projects sits inside this pattern.
- Pattern C, brand/secret hooks ("Ninja", "Secrets", "Playbook", "Dev Kit"): weak for search because they contain few search words.
- Almost none combine Python + beginners + files + spreadsheets + reports in one title; Excel-only and generic "scripts" dominate. The book's subtitle covers four use areas that no single competitor in this sample names together.
- Tip from the sample: put "Python" and "Automation" in the first words; keep tool names (Excel, PDF, CSV) in the subtitle.

## 3. Underserved long-tail phrases (HYPOTHESES from gaps, not verified volumes)
- python automation for beginners projects pdf
- automate excel reports with python for beginners
- python scripts to organize files and folders
- python csv to excel report automation
- python for office work / everyday work automation
- python project ebook with source code beginners
- automate pdf reports with python
- python rename and sort files script

Reasoning: the sample has Excel-only books and generic script packs but few beginner books that unify files + spreadsheets + reports. Test by checking Gumroad search suggestions and Google autocomplete manually before relying on any phrase.

## 4. Category and tags
- Gumroad category: existing listings sit under Software Development > Programming > Python (gumroad.com/software-development/programming/python). Use that. Fallback: Education.
- Tag candidates (8): python, automation, python automation, beginners, excel, projects, ebook, productivity. (Alternates: csv, scripting.)

## 5. Price recommendation
Suggest $12 to $15 (leaning $14). Reasoning from the table: automation-specific ebooks cluster at $9 to $29; the strongest proof sits at $10 (practice book) and $2.99. 25 projects with reports is broader than the $13 Excel-only title and the $19.99 playbook, but with zero reviews at launch a price under $20 lowers friction. No fake "was" prices or misleading discounts; if launching low, say honestly it is a launch price. Revisit after real reviews exist.

## 6. Draft SEO copy
- Title: Python Automation for Beginners: 25 Practical Projects
- Subtitle: Automate files, spreadsheets, reports and everyday work with step-by-step Python scripts (no coding experience needed)
- First paragraph: Learn Python by automating the tasks you actually do: renaming files, cleaning spreadsheets, building reports and more. Each of the 25 projects walks you from a clear problem to a working script you can adapt to your own work.

## 7. Python version guidance (python.org/downloads, fetched 2026-11-07)
- Python 3.15 is the newest feature series (released 2026-10-09; the page listed 3.15.2 on 2026-10-25); 3.14 is also in bugfix status; 3.13, 3.12, 3.11 are security-only; 3.10 reached end of life 2026-10-01.
- Search snapshots disagreed on the latest patch (3.15.1 vs 3.15.2), so do not print a patch version in the book.
- Recommendation: write "Python 3.12 or newer" and tell readers to download the current version from python.org; run every project on the version actually named before publishing.

## 8. Sources (accessed 2026-11-07)
https://gumroad.com/software-development/programming/python
https://numbpilled.gumroad.com/l/pythonninja
https://nafizrezo.gumroad.com/l/AutomateYourDailyTaskswithPython
https://bookkeeper72.gumroad.com/l/guide
https://codeeliteintprep.gumroad.com/l/measzo
https://vigneshselvaraj.gumroad.com/l/python-automation-playbook
https://technivis.gumroad.com/l/AutomatetheBoringStuffwithPythonandLLMs
https://brittmon.gumroad.com/l/pybot
https://jovapad.gumroad.com/l/PythonforTotalNewbies
https://tjkuch.gumroad.com/l/cfhss
https://driscollis.gumroad.com/l/openpyxl
https://driscollis.gumroad.com/l/excel_bundle
https://pythonclcoding.gumroad.com/l/gqrlq
https://pythonclcoding.gumroad.com/l/100PythonProjects
https://m4tzer.gumroad.com/l/omclfk
https://pythoncourses.gumroad.com/l/LZPLl
https://lunsy.gumroad.com/l/python-automation-pack
https://codemycodes.gumroad.com/l/20-hands-on-python-projects-examples-ebook
https://codingbootcampinc.gumroad.com/l/syrkwg
https://johnnathan7209.gumroad.com/l/mkids
https://drh.gumroad.com/l/automatetheboringstuffwithpython1stEdition
https://wellsr.gumroad.com/l/python-dev-kit
https://learnbyexample.gumroad.com/l/py_projects
https://www.python.org/downloads/
