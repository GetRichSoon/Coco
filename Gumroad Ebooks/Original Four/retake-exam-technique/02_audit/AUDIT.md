# Audit: The Retake Method (slug `retake-exam-technique`), 2026-11-07

Nothing live was changed. Live facts from `..\..\live_state.json` and the public page: price $29, category "Other (not in Discover)", ONE tag ("exam technique"), EPUB only (52.7 KB), empty summary, no refund policy, 0 ratings, 0 sales.

What I read: manuscript intro and chapters 1 to 10 and 18 to 20 in full; headings only for chapters 11 to 17 (panic scripts, employer, family, error log, study week, exam day, last ten minutes); the EPUB structure by unzipping; both live images; 10 competitor covers and pages. Claims about chapters 11 to 17 content rest on headings and the listing text, not a full read.

## 1. Ranked weaknesses (most severe first)

| # | Weakness | Evidence | Fix |
|---|---|---|---|
| 1 | Wrong product thumbnail | `01_live_assets_as_found\live_thumbnail.png` is the "The Job Interview Playbook" cover (gold on navy, boardroom). The owner also reports the editor shows no thumbnail of its own. UNRESOLVED: why the public page metadata points at that image; I could not open the Gumroad editor. | Upload a dedicated square thumbnail; then re-check the public page metadata and the shared social preview. |
| 2 | Cover title is wrong and hard to read | Live cover reads "RETAKE METHOD: EXAM" in a thin light weight, then "TECHNIQUE FOR CANDIDATES RETAKING A PROFESSIONAL LICENSING EXAM" in bold: the long title is chopped so the memorable name is demoted, the subtitle and author are tiny grey on near-black, bottom 35 percent is empty | New short-title cover per `03_improved\cover_brief.md` and `COVER_CONVENTIONS.md` |
| 3 | Category "Other" and one tag | live_state: category Other (not in Discover), tags "exam technique" only. Sibling product is already in "Education" | Education category and 8 tags (listing_improved.md) |
| 4 | EPUB breaks the multiple-choice questions | In `OEBPS\ch07.xhtml` the answer options A, B, C, D sit inside one `<p>` separated by raw newlines, so readers collapse them into one run-on paragraph inside an italic blockquote. Worked questions are the heart of chapters 6 to 9. Same pattern for the email template in chapter 4 and the scripts. | Rebuild EPUB with line breaks or lists for options and scripts (not done; no uploads allowed) |
| 5 | Price high for what is delivered | $29, unreviewed, no worksheets, no PDF; comparable Gumroad products seen: $0.99 to $24.95 (see table; one $69 outlier with 0 sales shown) | Test $14 to $19 until reviews exist, or add a printable workbook and keep $29 |
| 6 | Listing is hard to buy from | Title is 87 characters; summary empty; description opens with an outcome sentence rather than the reader's problem; description says "No worksheets to print"; no refund policy | New title, summary, description, FAQs and refund wording drafted |
| 7 | Few reader tools | Scripts and templates are prose; no one-page rules card, no fillable error log, no checkpoint calculator sheet, no printable checklist | Add a short printable tools PDF (see section 6) |
| 8 | EPUB basics missing | No embedded cover, no title page, copyright last (spine ch22), no images, minimal CSS (serif, no embedded font), no dc:rights | Add cover and title page, move copyright to the front, add diagrams |
| 9 | Only EPUB offered | Many buyers read on phones or laptops where PDF is the default; competitors seen sell PDFs | Offer PDF alongside EPUB |
| 10 | Brand inconsistency | Book text says "Poppy Ebooks, an imprint of The Velvet Foundry"; store and cover say The Velvet Foundry only | Decide one publisher line |
| 11 | Heuristics read as rules | Chapter 8 ("broader option usually stronger on BEST", "prefer measured over extreme") and chapter 7 rules are general guidance; chapter 7 does say the exam's own conventions take precedence, but chapter 8 does not repeat it | One-line reminder in chapter 8; keep "heuristic, not a rule of your exam" wording |
| 12 | Metadata slip | listing.json says "17 chapters"; the book has 20 chapters plus publisher and copyright pages, about 18,000 words (the listing says 17,000) | Corrected in the new description |

## 2. Competitor table (public pages, seen 2026-11-07)

"Ratings" means rating count shown on the page. Sales are not visible on Gumroad pages except where noted. Not visible = could not be seen.

| # | Product | Seller / site | Price | Ratings shown | Notes |
|---|---|---|---|---|---|
| 1 | How to Pass the PMP Exam on Your Second Attempt | usmanifahad.gumroad.com | $0.99 | 1 (5.0) | Retake-specific, one exam only; credentialed author; page snippet "If you failed ... this book is for you" |
| 2 | Test Taking Strategies - Proven Methods For Success | mitchelmd.gumroad.com | $2.99 | 0 | General; "Learn the secrets behind rapid improvement in test results"; cover title differs |
| 3 | 30 Step Study Guide for Exam Preps | digitalmultiskills.gumroad.com | $15 | 0 | Self-study techniques for tests and professional qualifying exams |
| 4 | PMP Exam Prep Handbook | halite.gumroad.com | $24.95 | not visible | PDF, content summary for one exam |
| 5 | Don't be Afraid of the Test | luciaflare0.gumroad.com | $11 | 0 | 25-page study methods and test anxiety (per search result) |
| 6 | Stress and Anxiety Management Guide | thesmartestguy.gumroad.com | $69 | 0 | Page shows sales 0 |
| 7 | Test Anxiety For Kids | mindsetangel.gumroad.com | $0 | 0 | Children; breathing, scripts, worksheets per page text |
| 8 | The PMP Success Handbook | sujanm.gumroad.com | $6.99 | 0 | 60-day plan + questions; price from page, title from cover |
| 9 | FNP Study Guide 2026-2027 | testtreasurepub.gumroad.com | $15.99 | 0 | 91-page illustrated PDF, 200 questions; best cover and description structure in the sample |
| 10 | Overcoming Anxiety | gauravtiwari.gumroad.com | $0+ | not extracted | General anxiety, includes test anxiety (search result) |
| 11 | Bar Exam Comeback: The Retaker's Guide to Finally Passing | AbeBooks / Bookmate listing | not visible | n/a | Closest direct concept (retake plus anxiety); bar exam only; not opened |
| 12 | "OMG, I Failed the NCLEX Again! WTH!" | bookstore listing | $10.95 list (paperback) | n/a | Retake, nursing, study material choice; from search snippet |
| 13 | Overcoming Test Anxiety (Jordan, Lovett) | guilford.com | $39 paperback | n/a | Publisher page price from search snippet |
| 14 | Retake plan for NCLEX candidates | stan.store | not visible | n/a | "All sales are final" per snippet |
| - | Free guides | ACCA retake guides, ICAEW, many blogs | free | n/a | Free retake advice exists for accounting and real estate, securities, NCLEX etc. |

Items 11 to 14 and the free guides come from search results only; I did not open them. Buyer reviews/complaints: the only review found was one 5-star rating on #1 with no text read; no complaint text was reachable.

Patterns: (a) retake-specific products are exam-specific (PMP, NCLEX, bar); (b) the exam-agnostic ones are cheap general test-taking guides; (c) nobody sampled combines score report reading, decision rules, pacing, and the employer/family conversations; (d) the strongest-looking listing (#9) sells proof of contents (page count, question count, badges); (e) prices for general technique guides cluster at $0 to $15.

## 3. Verdict per area

| Area | Verdict |
|---|---|
| Original cover | Weak. Chopped title, tiny text, empty lower half, dark generic look. Replace. |
| Landscape poster (1005x565) | Same image family; same problems; title cut. Replace with a left-title right-image poster. |
| Square thumbnail | Wrong product. Highest urgency. |
| Interior design (EPUB) | Functional but basic; options and scripts collapse into one paragraph; no cover, title page or images. Fix before more traffic. |
| Manuscript quality | Good and honest. Strong structure, correct arithmetic (84 seconds, checkpoints 35/70/105/140 verified), consistent chapter cross references (1 to 20 verified), clear scope limits. Weakness is depth of practice material, not prose. |
| Title and subtitle | Too long to scan; the cover loses it. Shorten (draft in listing_improved.md). |
| Gumroad description | Accurate but bland; lacks the reader-problem opening, FAQs, refund wording. |
| SEO keywords and tags | One tag only. Eight drafted. |
| Category | "Other" blocks Discover. Move to Education. |
| Pricing | $29 looks high against visible comparables; see price view. |
| Product preview | Not assessed: cannot open the Gumroad editor; no preview/sample chapter evident. Offer the introduction and chapter 5 as a free sample. |
| Purchase experience | EPUB only, no PDF, no Pages detail, empty summary, no refund policy, no social proof. |

## 4. Market positioning

- Target customer: adult professional (25 to 45) who failed a multiple-choice licensing exam and has a retake planned, any field; often working, embarrassed, short of time and money after exam fees.
- Problem: they do not know why they failed, so they re-read the same books; they also struggle with how to tell employer and family.
- What makes them willing to pay: fear of paying the exam fee again and of another fail; a clear different action to take this week. Willingness is highest right after the result arrives and in the days before the retake.
- What competitors offer: exam-specific retake guides (PMP at $0.99), cheap general test-taking and anxiety guides ($0 to $15), content and question banks for one exam ($7 to $25), free articles from exam bodies and prep brands.
- What they fail to provide: a diagnostic that separates knowledge, method and nerves; decision rules for FIRST/NEXT/BEST/MOST LIKELY questions with a tie-breaker sequence; pacing math; scripts for the people conversations; an exam-agnostic version of all that.
- What would make our book the better purchase: the same method, plus (1) a printable tools pack (rules card, error log, checkpoint sheet, score-report template), (2) diagrams, (3) PDF and EPUB, (4) a cover that names the problem, (5) a lower launch price until reviews exist, (6) a free sample chapter, and (7) an honest "what this will not do" line, which competitors rarely give.

## 5. Product content check

Strengths: complete arc from result to retake to after-result; honest scope; worked examples deliberately invented so no exam content; plain language; correct calculations; a mental-health referral line (chapter 18) and the "not exam content" disclaimers.

Concrete gaps:
- Only about 5 worked questions (kitchen oil, bicycle tyre, train, bread, bicycle noise) plus one tie example; none for LEAST/EXCEPT/NOT. Add 10 to 15 short invented practice drills with explanations.
- The tie-breaker worked example in chapter 8 is weak: option B ("check the forecast again") is not a true second plausible option, so it barely tests steps 1 to 7.
- No fillable score-report template, error-log table (the manuscript describes one but does not give a table), weekly plan grid, or checkpoint worksheet.
- Dana's results ("practice scores rose within a fortnight", "finishing with eight minutes to spare") are labelled hypothetical, but a skimming reader may read them as outcomes; keep the "hypothetical" label next to each.
- "A note on sources" refers to the testing effect, spaced repetition and test anxiety without any named reference. It is honest about this; a short list of two or three primary sources would raise credibility. I have not verified any such source and do not supply one.
- Heuristics such as "prefer the measured option" and "the broader option is stronger" are presented as rules; some exam bodies teach a different frame for FIRST/priority questions (not verified for any specific exam). Repeat the "your exam's conventions take precedence" line in chapter 8.
- No references or links to where exam bodies publish retake rules (by design, but a blank "your rules" worksheet would help).
- Editing: no typos noticed in what I read; British spellings ("licence", "practise") mixed with the US-style market (Gumroad buyers largely US). Choose one for the audience; the "licence/license" noun/verb split is correct British use.
- Length: 18,000 words is reasonable for the topic; the price question is about format and tools, not word count.
- Risk claims checked in text read: no pass guarantee, no affiliation claim, no exam content claim (also confirmed by the old `qa-report.json`, which I did not independently re-run).

## 6. Search visibility

What a buyer would type (hypotheses; no volume data): "failed [exam name] what now", "retake strategy", "how to pass licensing exam second time", "how to read exam score report", "test taking strategies multiple choice". Exam-name searches (NCLEX, PMP, bar, CPA) will be won by exam-specific products; our angle is the exam-agnostic method, so category and tags should say licensing exam, retake and test taking.

What Gumroad shows: the buyer sees the thumbnail, title, price and seller name. Today that is the wrong thumbnail, an 87-character title and no category, so Discover cannot list it. What Google shows from a quick look: mostly blogs from prep companies and exam bodies for specific exams (real estate, NCLEX, PMP, CPA); I saw no Gumroad listing for an exam-agnostic retake guide in the results, which suggests the niche is open, not that demand exists. Gumroad pages have no keyword field beyond title, summary, description and tags, so those carry all the SEO. A standalone landing page and a free sample chapter would help but are outside this audit.

## 7. Recommended order of work
1. Dedicated thumbnail (fixes the wrong-product problem).
2. Category and tags, summary line, new title and description.
3. New cover and poster from the brief.
4. Rebuild EPUB (option line breaks, cover, title page, diagrams), add PDF.
5. Add printable tools pack and more drills; then consider price back up.

## Sources (opened or searched 2026-11-07)
- Live page: https://thevelvetfoundry.gumroad.com/l/retake-exam-technique (via gumroad_extract.py)
- Gumroad pages opened with the helper: usmanifahad.gumroad.com/l/NYKv; mitchelmd.gumroad.com/l/Bbmm; digitalmultiskills.gumroad.com/l/lbaXK; halite.gumroad.com/l/CooCk; luciaflare0.gumroad.com/l/dont-be-afraid-of-the-test; thesmartestguy.gumroad.com/l/cvlsqh; mindsetangel.gumroad.com/l/TestAnxiety; sujanm.gumroad.com/l/gzgywe; testtreasurepub.gumroad.com/l/fnp; gauravtiwari.gumroad.com/l/overcoming-anxiety (cover only)
- Search results only (not opened): AbeBooks Bar Exam Comeback listing; Wellsboro Bookstore NCLEX title; guilford.com Overcoming Test Anxiety; stan.store Educationalnurse retake plan; ACCA and ICAEW retake guides; PM Study Circle page (30 day refund wording)
- Local: manuscript.md, retake-exam-technique.epub, listing.json, qa-report.json, live_state.json
