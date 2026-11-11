# 00 MASTER PROJECT STATUS (2026-11-07)

**Headline: all five books are produced and packaged. NOTHING is published on Gumroad.** The Claude in Chrome extension was not connected (no browsers listed), so Claude could not log in to or upload to your Gumroad account. Everything left is in `00 PHONE UPLOAD CHECKLIST.md`, and the phone pack is `Gumroad_5_Ebooks_Phone_Upload_Pack.zip` (25 MB, in this folder).

Nothing was deleted or overwritten without a copy: v1 files are in `01 AI Workflow Playbook\_backup v1 2026-11-07`, the original Book 01 PDF `The_AI_Workflow_Playbook.pdf` and its 6-page sample are untouched, and the earlier cover renders are still in `Design Atelier\Gumroad Covers\AI Workflow Playbook\`.

## Summary table

| Book | Pages | Words (approx.) | Final PDF | Free sample | Landscape | Thumbnail | Price | Published |
|---|---|---|---|---|---|---|---|---|
| 01 The AI Workflow Playbook | 67 | 9,300 | yes | 9 pages | yes | yes | $14 | No |
| 02 The Client Acquisition Playbook | 85 | 13,900 | yes | 13 pages | yes | yes | $19 | No |
| 03 Python Automation for Beginners | 136 | 20,900 (incl. 25 full scripts) | yes (+ source ZIP) | 17 pages | yes | yes | $14 | No |
| 04 The Practical Money System | 72 | 12,300 | yes | 11 pages | yes | yes | $9 | No |
| 05 The Job Interview Playbook | 97 | 15,000 | yes | 12 pages | yes | yes | $12.99 | No |

Totals: 5 PDFs, 5 free samples, 5 portrait covers (supplied by you), 5 landscape covers, 5 thumbnails, 5 listing packages, 5 FAQ sets, 0 products published, 0 product URLs.

## Book by book

### BOOK 01: THE AI WORKFLOW PLAYBOOK
- Manuscript: complete, about 9,300 words, 12 chapters, 30 workflows, 31 prompts, 6 worksheets (folder `01 AI Workflow Playbook`)
- Final PDF: `01_The_AI_Workflow_Playbook.pdf` (67 pages; audited: 12 chapters, 30 workflows, 33 code blocks = 31 prompts + prompt template + policy template, 47 contents links resolve, bookmarks open, no placeholder author text). This is a NEW version with cover page, title page, copyright and notice, and "Before you begin" as its own chapter-style section; the earlier 65-page PDF is preserved.
- Free sample: `01_The_AI_Workflow_Playbook_FREE_SAMPLE.pdf` (9 pages)
- Covers: portrait supplied; landscape and thumbnail recomposed from the portrait (see "Graphics" below)
- Listing: `01 AI Workflow Playbook\Gumroad Listing.md`
- Published: No. Discover eligibility: unknown (see below). Manual tasks: all (see checklist).

### BOOK 02: THE CLIENT ACQUISITION PLAYBOOK
- Manuscript: complete, 15 chapters + introduction, conclusion, appendices A to E; 20 outreach, 10 follow-up, 10 discovery-call and 5 proposal templates (O1..O20, F1..F10, C1..C10, P1..P5 verified by script), ICP and qualification worksheets, CRM structure, 30-day roadmap
- Verified: pricing arithmetic run in `pricing_check.py`; CRM formulas tested in LibreOffice on a small workbook (NOT Excel or Google Sheets)
- Not verified: UK ICO pages returned 403; those points are flagged as pointers; qualification cut-offs are the author's unvalidated decision aid
- PDF 85 pages, sample 13 pages. Listing: `02 Client Acquisition Playbook\Gumroad Listing.md`. Published: No.

### BOOK 03: PYTHON AUTOMATION FOR BEGINNERS
- Manuscript: complete, 12 chapters + appendices A to F, exactly 25 projects, each with the 12 required parts
- Testing: all 25 scripts run on Windows 11, Python 3.14.4 (openpyxl 3.1.5, pypdf 7.0.0); extra compatibility check on Python 3.12.12 (all compile and show help; 9 scripts produced matching results). NOT tested: macOS, Linux, Task Scheduler, cron, launchd, Excel opening the files, mail clients opening the drafts, OCR, Python 3.13. The book states this.
- Source ZIP: `03 Python Automation\Python_Automation_Project_Source.zip` (83 files; scripts, sample data, requirements, README, test log). It is an optional bonus download.
- PDF 136 pages, sample 17 pages. Length is above the 8,000 to 12,000 target because 25 complete scripts are included (about 5,600 words of code). Prose is shorter. Listing: `03 Python Automation\Gumroad Listing.md`. Published: No.

### BOOK 04: THE PRACTICAL MONEY SYSTEM
- Manuscript: complete, 12 chapters + conclusion with 90-day plan, appendices A to D
- Math: every calculation run in `verify_math.py`; 47 printed figures compared with the script output, 0 mismatches (`math_check_log.md`). Rates are labelled assumptions. No products recommended, no returns promised.
- Not verified: Investor.gov, the SEC guide and MoneyHelper pages failed to open and are NOT cited as read; "pig butchering" wording comes from search summaries and is labelled so.
- PDF 72 pages, sample 11 pages. Listing: `04 Practical Money System\Gumroad Listing.md`. Published: No.

### BOOK 05: THE JOB INTERVIEW PLAYBOOK
- Manuscript: complete, 13 guidance chapters + 7 question chapters (Q1 to Q100, 100 unique; each has all six labelled elements; groups 20/20/15/15/10/10/10), story bank, glossary, references
- Known weakness: example answers in Q41 to Q100 are often 40 to 60 words (shorter than the 60 to 90 target). Consider an edit pass.
- Sources opened: LinkedIn Help profile page, a Roche resume-parsing FAQ, an Ohio State ATS FAQ, US OPM structured-interview page, BLS handbook home page. The 15/10/50/25 STAR split is labelled a rule of thumb.
- PDF 97 pages, sample 12 pages. Listing: `05 Job Interview Playbook\Gumroad Listing.md`. Published: No.

## Graphics (Part 10)
- Landscape 1280x720 and square 600x600 PNGs for all five books were recomposed from your portrait covers (the title block and the illustration are cropped from the original artwork and placed on a background rebuilt from the cover's own edge colours; nothing was stretched). Dimensions verified. Because the source portrait is 1024x1536, the landscape title block is scaled down slightly and the square thumbnail shows the book title only (the subtitle is omitted so the title stays readable at small size). The script is `_shared\compose_covers.py`.
- No interior images were created: tables and worksheets already carry the explanations, and decorative filler was ruled out.

## Research and quality limits (honest list)
- Competitor data: 16 to 23 public Gumroad pages per book read on 2026-11-07 with a script (price, ratings count, seller-shown sales). Reviews and Reddit threads were mostly NOT reachable (Gumroad pages returned titles only to the fetch tool; no live Reddit threads were found). Complaint themes are therefore anecdotal and labelled.
- Keywords and tags: hypotheses; no keyword-volume tool was available.
- OpenAI help pages returned 403 to the fetch tool; ChatGPT feature statements in Book 01 come from search summaries and are dated.
- Discover: see below.
- Manuscripts 02 to 05 were drafted by sub-agents and then checked by script and by looking at the rendered PDFs. They have NOT had a line-by-line human edit. Expect to read Books 02, 04 and 05 before relying on every sentence, particularly legal, tax and finance statements.

## Gumroad Discover (reported separately)
- Official Gumroad help (read through search summaries; the article page itself did not render): a product needs a selected category and ratings enabled.
- Third-party blogs claim more gates (a minimum sales balance quoted as $10 or $100, payout setup and a risk review). These conflict and are not verified.
- Because no product exists on Gumroad yet, none has Discover eligibility. Whether your account meets any extra gate can only be seen in your dashboard.

## Creator profile and brand text (for you to paste if you want)
Profile name: not provided (no author name has been invented).
Bio (plain, no credentials): Practical guides for work and money: AI workflows, client acquisition, Python automation, personal finance basics and job interviews. Each guide has templates, worked examples and a free sample so you can see the quality before you buy.
Brand line: Practical guides with checklists, examples and no hype.
Collection name: Practical Guides.
Visual identity: the five covers share a dark, premium look with gold titles; keep the same covers and thumbnails across the profile.

## Cross-selling map (relevant only)
- 01 with 02 (AI drafting for outreach plus a full client acquisition system)
- 01 with 03 (chat-based workflows, then code-based automation)
- 02 with 05 is not recommended (different audiences)
- 03 with 04 (Project 9 expense tracking with the budgeting worksheets)
- 04 with 05 (money basics with salary negotiation)

## Where everything is
- Books and listings: each numbered folder in `C:\Users\Lenovo\Good Space\Coco\Gumroad Ebooks\`
- Phone checklist: `00 PHONE UPLOAD CHECKLIST.md`; phone ZIP: `Gumroad_5_Ebooks_Phone_Upload_Pack.zip`
- Research: `Organic Research\` and each book's `research_notes.md`
- Rebuild tools: `_shared\build_book.py`, `make_sample.py`, `compose_covers.py`, `make_pack.py`, `_tools\gumroad_extract.py`
- Book 01 strategy files: `01 AI Workflow Playbook\1 Strategy, SEO and Sales Page v2.md`, `5 PDF Formatting, Image Prompts and Checklist.md`, `6 Organic Discovery Strategy (all five books).md`

## What remains for you
1. Read the PDFs you want to vouch for (especially 02, 04 and 05).
2. Upload and publish via the phone checklist (or reconnect the Claude in Chrome extension and ask Claude to do it).
3. Decide: refund policy, final prices, optional tweaks to Book 05 example answers.
