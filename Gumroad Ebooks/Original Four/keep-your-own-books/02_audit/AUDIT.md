# Audit: Keep Your Own Books (slug keep-your-own-books)

Audit date: 2026-11-07. Nothing live was changed. Live facts read from `..\..\live_state.json` and the public page (fetched 2026-11-07): price $29, category Other (not in Discover), 0 ratings, 0 sales (sales count is not publicly shown and not claimed), EPUB only (51.9 KB, "22 sections"), summary field empty, Pages field empty, no refund policy, 9 tags.

## 1. Ranked weaknesses (most severe first)

| # | Weakness | Evidence | Fix |
|---|---|---|---|
| 1 | **Category is "Other", so the book is invisible in Gumroad Discover** and cannot be browsed under Business & Money. | live_state.json; owner note that Discover needs a real category. | Set "Business & Money > Accounting" (confirm in editor, see listing_improved.md). |
| 2 | **Cross-references between chapters are wrong and chapters are not numbered.** Headings carry no numbers (EPUB nav lists titles only), yet the text says "chapter 4", "Chapter 12" and so on. By the intro's own scheme (chapters 1 to 4 foundation, chart of accounts = 4, cash vs accrual = 7) I count about 21 of roughly 36 references that point at the wrong chapter. Examples: "Chapter 10 is entirely about finding the difference" (reconciliation is chapter 8 in that scheme; line 180); "Chapter 17's worked month" (it is 14; line 1807); "Chapters 11 and 12 teach you what to look for" in the statements (they are 12 and 13; line 1251); "Chapter 12" for mixed spending (it is 10; line 164); "Chapter 8" for drawings (it is 9; lines 207, 271, 768); "chapter 15" for the equation (it is 13; line 261). The conclusion says "Twenty chapters" while the intro's scheme ends at 16 and the listing says 21. A reader cannot resolve any of them. | Number every chapter heading and fix every reference, or replace references with chapter titles. This is the cheapest, highest-trust fix to the manuscript. (Manuscript sentences were NOT changed in 03_improved; this needs the owner's approval.) |
| 3 | **No tools in a how-to money book.** The market for this problem is overwhelmingly templates (spreadsheets, Notion) at $5 to $30; the book says "No worksheets to print or write into". It has the chart of accounts and worked month as text, but no downloadable ledger, no reconciliation worksheet, no month-end checklist page. | Competitor table below; listing text. | Add a free starter pack (ledger sheet with debit/credit columns and balance check, chart of accounts, reconciliation worksheet, month-end checklist, handover note). Without it, hold the price down (section 7). |
| 4 | **Cover and thumbnail do not sell.** Text only, no benefit, no format or "what you get" signal, subtitle at about 9 px on the cover, disclaimer text unreadable, "YOUR OWN" in low-contrast blue-grey, a row of copper squares that means nothing. Dark navy is the opposite of the light, mockup-led covers that dominate this niche, and nothing signals "bookkeeping". Only one cover image is on the page (and no separate thumbnail is served). See COVER_CONVENTIONS.md. | 01_live_assets_as_found; 13 competitor covers viewed. | Rebuild per cover_brief.md and COVER_CONVENTIONS.md. |
| 5 | **EPUB-only delivery.** A consumer buying a $29 bookkeeping guide expects a PDF they can print and tick through. No PDF, no cover image inside the EPUB, no title page, no copyright page up front. | content.opf lists no cover item, no images, no fonts; spine begins with "How to use this book". | Add a PDF (and EPUB), embedded cover, title and copyright pages. |
| 6 | **Description is inaccurate in places.** "21 chapters" (the file has 22 sections, 20 before the publisher and copyright pages; the book itself says twenty). "Every chapter ends with the ways it goes wrong and a checklist": true for 15 core chapters (3 to 17), not for the intro, the "does not do" chapter, the stop chapter (checklist only), the conclusion or the resources chapter. "It says so in chapter 2": the chapter is the second file but unnumbered. Also the description is one long block with "WHAT..." labels and no scannable bullets, and the page summary field is empty, so Google and Gumroad previews show the first 160 characters ("You started working for yourself, somebody said...") with no keyword. | Gumroad page and og:description read 2026-11-07. | Use listing_improved.md. |
| 7 | **EPUB formatting defect in the chart of accounts.** The starting chart (26 lines of "- Account" bullets) is not a list: the bullets collapsed into running paragraphs because there was no blank line after the bold label. This is the most copy-from chapter in the book and the one the description promises "you can copy". Tables and code blocks elsewhere render. | ch06.xhtml: 26 inline "\n- " lines, 0 `<li>` for those. | Fix the Markdown (blank line before each list) and rebuild. |
| 8 | **Voice and authority claims the author cannot support.** The author is "The Velvet Foundry Editorial Team" but the text says "Every hour of bookkeeping misery I have ever seen" (line 158) and "Having asked a few, the answer is consistent" about accountants (line 1657). No named author, no qualifications, no bio. For a money book the buyer's first question is "who says?". | manuscript lines 158 and 1657. | Remove or soften the personal claims; add an honest "how this book was made / reviewed by" note only if true. |
| 9 | **Small accuracy and wording slips.** (a) "about four hundred years old" (double entry is documented well over five hundred years; use "centuries old"). (b) Worked month: "3,000 of the earnings is sitting in somebody else's accounts payable" should say receivables (they owe you). (c) "it is impossible to be profitable on paper and broke in reality" on cash basis is too absolute. (d) "This usually increases your recorded costs, which is in your favour" edges toward tax-advantage language in a book that disclaims tax. (e) Rounding "Equipment" depreciation not shown in June (fine, but unexplained). | lines 10, 1599, 846, 1102. | Light copy edit (needs owner approval). |
| 10 | **No refund policy, no Pages detail, no preview.** Pages attribute empty, "22 sections" shown instead; refund_policy null on the page JSON. Free sample not offered. | page JSON 2026-11-07. | Set a refund policy (wording in listing_improved.md), set Pages when a PDF exists, add a free sample chapter (chapter "What this book does not do" plus the five-accounts chapter). |
| 11 | **Only 0 ratings, 0 reviews; tags weak.** 9 tags, several generic ("business finance", "accounting basics"); no tag for the problem words buyers type (reconciliation, bank statement, invoicing, drawings). | live_state.json. | New tag list in listing_improved.md. |

## 2. What I checked and found sound (honest verdicts)

- **No tax rules claim holds.** I searched the full manuscript for rates, thresholds, deadlines, allowances and filing steps. None appear. The only numerals near the topic are illustrative round numbers (a 500 capitalisation threshold in the worked month, "38% of mileage" as an example of writing down a basis, "roughly a third" for client concentration, "over sixty days" for aged receivables, "divisible by nine" for transpositions): none is a legal or tax figure, and each sits next to a statement that the real figure is the reader's to obtain locally. VAT, sales tax, payroll and incorporation are named only as out of scope. The copyright page repeats the disclaimer. The listing says this honestly and accurately ("no tax rates, thresholds, deadlines or filing rules"). One caution: "Tax payable" appears as a liability account in the chart and balance sheet; that is bookkeeping method, not a rule, and is fine.
- **The arithmetic in the worked month is correct.** I recomputed: opening equity 6,400; June bank movement +875 (opening 4,200, closing 5,075); revenue 5,000; gross profit 4,200 (84%); profit 3,675; balance sheet 9,675 = 800 + 8,875. The bridge in diagram 5 (3,675 - 1,500 receivables - 600 deposit + 500 payables - 1,200 drawings = 875) also reconciles.
- **Disclaimers present:** not accounting, tax, legal or financial advice; no affiliation with tax authorities, standard setters, bodies or vendors. Keep both.
- **Qa-report PASS** is an internal checker; I did not rely on it.

## 3. Manuscript and product content check

- **Completeness:** covers the full small-business loop (five accounts, double entry, chart, money in/out, cash vs accrual, reconciliation, drawings, mixed spending, month-end close, P&L, balance sheet, a worked month, records, handover, when to stop). Good for a one-person service business.
- **Depth:** about 15,800 words (my word count of the manuscript, including front and back matter). Substantive, plain, consistent teaching voice; the "When it goes wrong" sections are the book's best feature (e.g. the divisible-by-nine tip, halving the month to find a reconciliation error, unidentified-receipts holding account).
- **Practical usefulness:** high for reading, medium for doing. The reader must build their own spreadsheet from instructions (chapter 5 describes columns in a sentence).
- **Originality:** the framing (record vs tax, honest limits, "profit is not cash", four review accounts) is distinctive; the underlying method is standard, which is fine.
- **Gaps (concrete):**
  1. No downloadable ledger, chart of accounts, reconciliation or close-checklist file.
  2. No invoice template or worked invoice example (the book lists what an invoice contains but shows none).
  3. No worked reconciliation with real figures (only the worked month, which has nothing outstanding).
  4. No worked mixed-use apportionment example, and no sample "one-page policy note" for the accountant handover although the book calls it the most valuable thing to hand over.
  5. No cash-basis worked version of the same month (the book teaches both bases but only works accrual).
  6. No VAT/sales-tax-neutral note on how recording changes when registered (deliberately omitted; a "where this changes" pointer table would help without giving rules).
  7. No glossary or index; terminology varies between UK and US (drawings/owner's draw, receivables/accounts receivable, "sole trader" vs "sole proprietor"). The book uses UK terms; US readers (the largest Gumroad audience) may not recognise "sole trader", "drawings", "capitalisation", "cheque". Add a UK/US term list.
  8. No diagrams (added in 03_improved).
  9. Foreign currency, platform fees (Stripe/PayPal) and gross-versus-net are covered in a line each; one worked example would help freelancers.
- **Editing quality:** clean, few typos. Issues are structural (chapter numbering and references), the collapsed chart list, UK-only vocabulary, and the first-person claims noted above.
- **Format for the price:** at 15,800 words, EPUB only, no tools, $29 is high for the niche (section 7).

## 4. Interior design check (EPUB)

Unzipped with Python: 22 XHTML files, nav.xhtml, toc.ncx, content.opf (EPUB 3), one 611-byte stylesheet. Findings: no cover image or `cover` item; no images or fonts embedded; no title page, no copyright page at the front (copyright is the last file); chapter files unnumbered; a single CSS with default serif font (readers will use their own), tinted note class unused; `dcterms:modified` 2026-10-29; metadata includes keywords as dc:subject (good) but no cover. The one table (debit/credit) and the code blocks (reconciliation arithmetic, P&L, balance sheet) are structured correctly as table and pre. The chart of accounts list is broken (weakness 7). I did not test on physical readers; I inspected the XML only.

## 5. Market positioning

**Target customer.** A new or early freelancer, consultant, creative or one-person service business (sole trader / sole proprietor / independent contractor) who has a business bank account and a pile of receipts, no accounting background, and no desire to learn a full software package first. Many are US or UK based; the book is jurisdiction-neutral by design.

**The problem.** "Somebody said keep your books and nobody explained it." They want to know what to record, how to categorise, how to check it against the bank, and how to stop dreading year end, without being told tax law that may not apply to them.

**What makes them willing to pay.** Fear of doing it wrong, the cost of an accountant fixing messy records, and the relief of a repeatable one-hour monthly routine. They pay little for information that is free from tax authorities and software vendors; they pay for a ready-to-use system.

**What competitors offer (13 Gumroad listings opened, 2026-11-07; see table).** Mostly Google Sheets/Excel/Notion templates at $4.99 to $30, selling on dashboards and "instant download"; one UK guide-plus-spreadsheet (GBP 9.99, spreadsheets for 2020/21 and 2021/22 only); one broad finance ebook (Freelance Finance 101, $35). Several are tax-tracker or jurisdiction-specific (UK HMRC estimate, Australian version). All opened Gumroad listings show 0 ratings (ratings are not sales; sales counts were not visible).

**What they fail to provide.** Few teach the method; templates give no explanation of why, and few cover reconciliation, drawings versus expenses, unearned deposits, or "profit is not cash". Jurisdiction-specific ones go stale. None I opened offers both a clear explanation and a reusable tool.

**What would make this the better purchase.** (a) Teach the method that works in any country and never goes stale (genuine differentiator, keep); (b) add the tools the competitors sell (ledger, chart, reconciliation worksheet) so the buyer gets explanation AND template for one price; (c) PDF as well as EPUB; (d) a visible, honest "what this does not cover" promise; (e) a real category and a cover that says "bookkeeping" at thumbnail size; (f) a lower entry price or a bundle justified by the tools.

## 6. Search visibility: what a buyer types, what Gumroad and Google show

Hypotheses only; no volume data exists, I did not use a keyword tool.

- A buyer types: "bookkeeping for freelancers", "bookkeeping for sole traders", "how to do bookkeeping for self employed", "bookkeeping spreadsheet freelancer", "simple bookkeeping template", "bank reconciliation for small business", "separate business and personal finances", "double entry bookkeeping for beginners".
- In my three WebSearch queries run today (gumroad bookkeeping for freelancers ebook guide; gumroad simple bookkeeping template self-employed sole trader; bookkeeping for freelancers ebook price self-employed accounting guide buy), the results were dominated by templates (Gumroad, Payhip, Selar, Teachable), free blog guides and accounting-service blogs. This book's page did not appear in any of the three result lists I saw. That does not prove it is unindexed; I did not run a site: check.
- Gumroad shows the summary and the first part of the description on the page and in meta description (live page: description is truncated at about 160 characters and starts with the story, not the keyword). Gumroad Discover requires a non-Other category; the product is currently not eligible. Tags are used for Discover search; the live tag set omits "reconciliation", "invoice", "bank statement".
- Fix: keyword-first summary, bulleted description with exact buyer phrases, a real category, tags matching the phrases above (listing_improved.md).

## 7. Pricing view (do not change; recommendation only)

Seen on competitors (2026-11-07, as listed): $2.99 (printable tracker), $4.99 (three templates), $6.99, $8, $10, GBP 9.99 (guide + spreadsheet), GBP 12.99, $14 (a listing whose title did not load), $20 (Notion), $35 (Freelance Finance 101 book), A$30, $75 (a listing that looks like a service logo; outlier). From search snippets, not opened: Payhip guide GBP 4.99; Leanpub bookkeeping course minimum $19; Perlego subscription ePub.

Recommendation: the book as it stands (EPUB only, no tools) sits at the top of the range with the weakest packaging; a first-sale launch price of **$15 to $19** is easier to defend. With a PDF plus a starter template pack, **$24 to $29** becomes defensible (the only direct book competitor opened is GBP 9.99, the broadest book is $35). Keep $29 live until the owner approves; test one change at a time. No sales numbers exist to support any price; this is a positioning judgement, not a data result.

## 8. Customer purchasing experience

Page JSON shows: single cover (670 x 376 displayed, 1920 x 1080 native), thumbnail not separately served, no summary, Pages blank, "22 sections" shown (unhelpful), no refund policy, no preview or sample, no testimonials (none exist; do not invent), no bundle, no upsell. After purchase the buyer gets one EPUB; non-technical buyers may not know how to open an EPUB on a phone or laptop (add a one-line how-to in the description or delivery message, and a PDF).

## 9. Verdicts per area

| Area | Verdict |
|---|---|
| Original cover | Weak: text only, tiny subtitle, no benefit, wrong feel for the niche. |
| Landscape poster | Same design; elegant but unreadable at thumbnail; disclaimer text illegible. |
| Square thumbnail | Better than the wide cover (large title), still no bookkeeping signal, low-contrast middle line. |
| Interior (EPUB) | Functional, but no cover/title page, broken list in the chart chapter, unnumbered chapters. |
| Manuscript | Strong teaching, honest, accurate maths; cross-reference and voice defects, no tools. |
| Title and subtitle | Title is warm but vague ("books" is ambiguous); subtitle good but long. Improved pair in listing_improved.md; URL slug unchanged. |
| Description | Honest and clear in intent; wrong chapter count, overclaims checklists, wall of text. |
| SEO keywords and tags | Adequate but generic. |
| Category | Wrong ("Other"): top fix. |
| Pricing | High for current packaging. |
| Preview | None. |
| Purchase experience | Thin: EPUB only, no refund policy, no summary. |

## 10. Competitor table (all opened 2026-11-07 via the extract helper and the page JSON; covers saved in competitor_covers/)

| # | Product (seller) | Type | Price as seen | Ratings | Cover (viewed) | Notes |
|---|---|---|---|---|---|---|
| 1 | Freelance Finance 101 (hiroko) | PDF/EPUB/MOBI ebook, broad finance | $35 | 0 | tablet-in-hands photo, blue and yellow, benefit line "saves hundreds of hours" | Wide scope (taxes, retirement, structures); jurisdiction-specific content |
| 2 | Easy Bookkeeping (digitalsoftbloom) | PDF + Google Sheets link | $4.99 | 0 | pink watercolour, script title, device mockups | 8 cover images; "Turn client chaos into a smooth ride" |
| 3 | Ledger Lab (visfec1) | Notion template | $20 | 0 | white, icon, "Bookkeeping made simple" | Looks generic/AI-made |
| 4 | The Creator's Tax Book (thenichelesswriter) | printable PDF, 35 pages | $2.99 | 0 | small book on grey, circles | Amateur layout; worksheets |
| 5 | ClearLedger Freelancer Finance Tracker UK (liversidge8) | Google Sheets | GBP 12.99 | 0 | logo, screenshot collage, arrows, yellow banner | Tax estimate for UK bands |
| 6 | Easy Bookkeeping Spreadsheet (digivers) | Google Sheet | $4.99 | not shown | mint green, dashboard, tab list | "Included tabs" checklist on cover |
| 7 | Standard Bookkeeping Template (cfopro87) | template | $75 | 0 | logo for "Excell Bookkeeping Services" | Cover is a service logo; outlier price |
| 8 | Sole Trader Bookkeeping Guide + Excel (accountsmechanic) | ebook + 2 spreadsheets, UK | GBP 9.99 | 0 | solid red, white bold title, calculator icon | Closest direct competitor: a guide; sheets for 2020/21 and 2021/22 only |
| 9 | Small Business Bookkeeping Template (fluentfinance) | Google Sheets | $10 | 0 | pink, plants, "2023 edition" badge | 8 cover images |
| 10 | Easy Bookkeeping Template 2026 (syncmindscreations) | Google Sheets | $6.99 | 0 | cream, "Reusable every year", tab circles | 7 cover images |
| 11 | Small Business Bookkeeping Spreadsheet (exceldashbboard) | Excel | $4.99 | 0 | grey, device mockups, "5 tabs" | |
| 12 | All-in-One Excel Template for Small Business Accounting (sulistiya) | Excel | $8 | 0 | infographic list of contents | Looks AI-generated, garbled text on image |
| 13 | Freelance Bookkeeping/Tax Tracker (stresslesssheets) | Google Sheets | A$30 (Starter) | 0 | blue desk photo, green banner, badges "Universal" | Also a A$55 Australia version (from search snippet) |
| 14 | Bookkeeping Basics (Payhip) | guide | GBP 4.99 (snippet) | not opened | not seen | search result only |
| 15 | Bookkeeping Introduction (Leanpub) | course | min $19 (snippet) | not opened | not seen | search result only |
| 16 | Bookkeeping For Freelancers, T.S. Avini 2026 (Perlego) | ePub | subscription (snippet) | not opened | not seen | search result only |

Buyer complaints: none reachable. All opened Gumroad listings show 0 ratings and no review text, so no complaints could be read; the Perlego/Leanpub/Payhip pages were not opened.

## 11. Sources (all accessed 2026-11-07)

- Live page: https://thevelvetfoundry.gumroad.com/l/keep-your-own-books
- Competitors: https://hiroko.gumroad.com/l/freelancefinance101, https://digitalsoftbloom.gumroad.com/l/easy-bookkeeping, https://visfec1.gumroad.com/l/lctbkw, https://thenichelesswriter.gumroad.com/l/creator-tax-book, https://liversidge8.gumroad.com/l/ttugn, https://digivers.gumroad.com/l/Spreadsheet, https://cfopro87.gumroad.com/l/StandardBookkeepingTemplate, https://accountsmechanic.gumroad.com/l/PPGAmb, https://fluentfinance.gumroad.com/l/iwgcru, https://syncmindscreations.gumroad.com/l/easy-bookkeeping-tracker, https://exceldashbboard.gumroad.com/l/bookkeeping, https://sulistiya.gumroad.com/l/excel-accounting, https://stresslesssheets.gumroad.com/l/rxsgi
- Search snippets only (not opened): Payhip, Leanpub, Perlego results from WebSearch, 2026-11-07.
- Taxonomy: Gumroad category tree not fetched; "Business & Money > Accounting" is taken from the owner's note that the editor lists it. Confirm in the editor.

## 12. Could not verify

Gumroad's full category tree and tag limits; real search ranking of this page; sales or review text of any competitor; how the EPUB renders on physical readers; the three non-Gumroad competitors' pages.
