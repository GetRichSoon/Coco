# CHANGELOG: Keep Your Own Books, final manuscript (2026-11-07)

Start text: `03_improved\manuscript_with_diagrams.md`. Output: `manuscript_final.md` (about 15,800 words, 16 numbered chapters). Nothing in `00_original_backup` or `03_improved` was touched. No tax rules, rates, thresholds, deadlines or filing steps were added; the book still contains none.

## Facts for the listing (use these, not the old description)

- Numbered chapters: **16** (Chapter 1 What bookkeeping actually is ... Chapter 16 When to stop doing this yourself).
- Chapters with a "When it goes wrong" section: **15** (chapters 1 to 15). Chapter 16 has none.
- Chapters with a "Checklist": **16** (all numbered chapters).
- Chapters that have both: 15 (1 to 15). Chapter 16 has a checklist only.
- Unnumbered front matter: How to use this book; What this book does not do (neither has the two sections). Back matter: Conclusion, Recommended next steps and further resources, About the publisher, Copyright.
- So the true claim is "16 chapters; 15 of them end with 'When it goes wrong' and a checklist, and the 16th ends with a checklist". The old "21 chapters" and "every chapter ends with the ways it goes wrong and a checklist" are wrong.
- The cash vs accrual chapter is Chapter 7, the chart of accounts Chapter 4, reconciliation Chapter 8, the worked month Chapter 14.

## 1. Factual corrections

| Where | Before | After | Evidence |
|---|---|---|---|
| How to use this book; Ch 3 | "about four hundred years old"; "a four-hundred-year-old inheritance" | "centuries old"; "a centuries-old inheritance" | Wikipedia, Double-entry bookkeeping, accessed 2026-11-07: full double-entry ledger 1299 to 1300, first printed description 1494. |
| Ch 14 worked month, "What the month actually tells you" | "3,000 of the earnings is sitting in somebody else's accounts payable" | Rewritten bridge: receivables grew 1,500 (1,500 to 3,000, owed to you), the 600 deposit was income in June but cash in May, payables grew 500 (300 to 800, keeps 500 in the bank), drawings 1,200; "3,675 − 1,500 − 600 + 500 − 1,200 = 875" | `verify_figures.py` (below): receivables 1,500 to 3,000, payables 300 to 800, bridge sums to 875. Payables are what you owe, so the old wording was backwards. |
| Diagram `profit_is_not_cash` | Labels already said "Receivables rose" and "Payables rose"; the chapter text did not match them | Labels kept (they were right), diagram redrawn with larger type, text corrected to match | Same script. |
| Ch 14 opening | Depreciation absent from June without comment | Added "To keep the arithmetic short, depreciation is left out of this month." (also under Additions) | Audit weakness 9(e). |
| Ch 16 Resources | "the rules in chapter 3 come from" (standard setters) | "where accounting rules come from" | Chapter 3 is double entry, not standards; claim removed. |

## 2. Wording and overclaim fixes

| Where | Before | After | Evidence |
|---|---|---|---|
| Ch 1, "The one rule" | "Every hour of bookkeeping misery I have ever seen traces back to..." | "Much of the bookkeeping misery described in this book traces back to..." | First-person authority claim under an editorial-team author; audit weakness 8. |
| Ch 15, "What your accountant actually wants" | "Having asked a few, the answer is consistent and shorter than people expect." | "The list is usually shorter than people expect." | Same. |
| Ch 7 | "it is impossible to be profitable on paper and broke in reality" | "it keeps your profit figure close to your bank balance, so you are much less likely to look profitable on paper while short of cash" | Too absolute; audit 9(c). |
| Ch 9 "When it goes wrong" | "This usually increases your recorded costs, which is in your favour." | "...increases your recorded costs and so lowers your recorded profit, which is simply a truer picture." | Removes tax-advantage tone; audit 9(d). |
| Ch 8 | "Unauthorised transactions have time limits for disputes in most places." | "...often have time limits for disputes." | Could not verify "most places"; softened. |
| Ch 6 | "Thermal till receipts fade to blank within a year or two" | "can fade to blank..." | Not verified; softened. |
| Ch 6/15 | "Digital copies are acceptable in most places"; "Many professional bodies run free clinics"; "Every major [tax authority] publishes free small-business guidance"; "Most [bodies] maintain a directory ... many run free ... clinics" | "in many places"; "Some"; "Most publish"; "Many maintain ... some run" | Not verified; softened. |
| Ch 16 Resources | IFRS Foundation "publishes the standards used in much of the world"; FASB "publishes those used in the United States" | IFRS: "required for use by more than 140 jurisdictions" (quoted from its site); FASB no longer named, replaced by "Some countries, the United States among them, use their own national standards" | ifrs.org/about-us/who-we-are/ accessed 2026-11-07. fasb.org returned HTTP 403, so it is not cited. |

## 3. Structure and formatting fixes

- All 16 body chapter headings are now `# Chapter N. Title`. Front and back matter stay unnumbered; Copyright and About the publisher are at the end.
- Chart of accounts (Ch 4): the five bold labels (Assets, Liabilities, Equity, Income, Expenses) now have a blank line before the bullet list, so the 26 account lines are real markdown lists (the cause of the collapsed EPUB paragraphs). Script check: no list item in the manuscript follows a non-blank, non-list line.
- Printable blocks: the profit and loss "shape" block (Ch 12) was up to 86 characters wide; it is now two short lines per row. The reconciliation proving formula (Ch 8) was shortened ("deposits recorded, not yet cleared"). No indented block is wider than 60 characters, so none wraps in a printed page. The debit/credit table (Ch 3) and the June statements (Ch 14) were already narrow and are unchanged. Tables and worked figures are consistent between chapters (see arithmetic check).
- Images now point to `diagrams/<name>.png`, each with a caption `*Figure N. ...*`, placed beside the text they support (Figures 1 to 5 in chapters 2, 5, 8, 11, 14).
- Diagrams redrawn in `02 FINAL MANUSCRIPTS\diagrams\` (SVG and PNG, originals untouched): all text is now 32 px or larger at 1200 px wide, which is about 9.2 pt at 4.8 inches printed (it was 22 to 30 px, about 6 to 8.6 pt). Layout reflowed (rows rather than side by side) so nothing overflows; each PNG was viewed after rendering with headless Chrome. Content of each diagram unchanged apart from shortened wording ("Debit Expense (or asset)" is now "Debit Expense").

## 4. Cross-reference fixes

Full listing with target chapter and title: `crossref_check.md`. Summary: 38 explicit "chapter N" references checked by script against the numbered headings, 25 fixed and 13 already correct; plus the reread pointer ("11 and 12" became "12 and 13"), and "Twenty chapters" became "Sixteen chapters". Intro paragraph "How to use this book" was reworded so that chapters 5 to 9 include reconciliation (chapter 8) and chapter 14 is the worked month with chapters 15 and 16 about other people. Examples: "Chapter 12" for mixed spending became Chapter 10; "Chapter 10 is entirely about finding the difference" became Chapter 8; "Chapter 17's worked month" became Chapter 14; "chapter 8" for drawings became Chapter 9; "chapter 15" for the equation became Chapter 13; "the next chapter" (reconciliation) became "chapter 8".

## 5. Additions

- Figure captions (5).
- One sentence in Ch 14 that depreciation is left out of the worked month.
- A "Sources opened for this edition" block with two sources (`references.md`).

## 6. Arithmetic check (script `verify_figures.py` in this folder, run 2026-11-07: "all figures verified")

Asserted: opening position 4,200 + 1,500 + 1,600 = 7,300 assets, 900 liabilities, equity 6,400; bank movements +1,500 −300 −450 −1,200 −60 +1,400 −15 = +875, closing 5,075; revenue 5,000, gross profit 4,200 (84%), profit 3,675; closing receivables 3,000, payables 800; total assets 9,675 = 800 + 8,875; bridge 3,675 − 1,500 − 600 + 500 − 1,200 = 875; "roughly 4,275 genuinely yours" = 5,075 − 800; depreciation example 2,000 over four years = 500 a year, about 42 a month; December example profit 8,000; the divisible-by-nine examples (540/450, 1,278/1,728); month-end minutes 15+20+2+10+5+5+3 = 60. No discrepancies. Illustrative figures (38% of mileage, a third of revenue, 60 days, 500 threshold) are examples, not rules, and are each followed by a statement that the real figure is the reader's to obtain.

## 7. Could not verify

- The Financial Accounting Standards Board page (403); the book makes only the general statement that some countries such as the United States use national standards.
- "Often have time limits for disputes", "can fade", "many places", "some bodies run clinics", "most tax authorities publish free guidance": softened, not sourced.
- The claim that four rounds of halving localise "almost any error" (Ch 8): left as practical advice, not tested.
- Owner decision needed: the UK/US vocabulary gap (sole trader, drawings, cheque) noted in the audit was not addressed because it would require adding a glossary; the book keeps UK terms.
