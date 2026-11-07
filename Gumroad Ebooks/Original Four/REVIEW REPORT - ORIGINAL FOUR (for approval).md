# THE VELVET FOUNDRY: ORIGINAL FOUR BOOKS, REVIEW REPORT FOR YOUR APPROVAL
Prepared 2026-11-07. **Nothing on Gumroad was changed.** No live listing, file, cover, thumbnail, price, tag, category or URL was edited. The five new books were not touched. All originals are backed up untouched in each book's `00_original_backup` folder.

## 1. The four books (verified from the Gumroad dashboard, the public pages and the project folders)
| # | Title (as live) | Live URL | Price | Category | Tags | File | Views / sales (lifetime) |
|---|---|---|---|---|---|---|---|
| 1 | The 90-Day Clinical Licensing Exam Study Plan | https://thevelvetfoundry.gumroad.com/l/aswb-clinical-90-day-study-plan | $34 | Education | 9 | EPUB only, 28 sections (published 2026-10-29) | 13 / 0 |
| 2 | Keep Your Own Books | https://thevelvetfoundry.gumroad.com/l/keep-your-own-books | $29 | **Other** | 9 | EPUB only, 22 sections (live 2026-10-30) | 3 / 0 |
| 3 | The Retake Method: Exam Technique for Candidates Retaking a Professional Licensing Exam | https://thevelvetfoundry.gumroad.com/l/retake-exam-technique | $29 | **Other** | **1** | EPUB only, 22 sections (publication date not recorded) | 1 / 0 |
| 4 | Where Your AWS Bill Goes | https://thevelvetfoundry.gumroad.com/l/where-your-aws-bill-goes | $39 | **Other** | 9 | EPUB only, 25 sections (publication date not recorded) | 2 / 0 |

All four: no sales, no ratings, no reviews, no refund policy, empty summary field, no Pages detail. A fifth manuscript, "First Apartment Repair Basics", was built but never published and is not part of this review.
**Unresolved anomaly:** the public page metadata for The Retake Method lists the Job Interview Playbook's thumbnail, while the editor shows no thumbnail of its own for it. I did not touch it and could not determine why. It should be fixed with a proper thumbnail when you approve the updates.

## 2. Key findings across all four (most important first)
1. **Accuracy problems inside live books (fix these first, they cost trust):**
   - *Where Your AWS Bill Goes:* three confident AWS statements are wrong or out of date, each repeated several times (Cost Explorer history "only from when enabled" vs AWS documenting about 13 months prepared; tag activation "never retrospective" vs AWS's up-to-12-month backfill; idle Elastic IPs presented as the cost while AWS now charges for in-use public IPv4 addresses too, and the book never mentions IPv4). Six chapter cross-references are wrong; "25 chapters" is really 19 core chapters; it names a "next book" that does not exist. Checked against about 15 official AWS pages (details in its AUDIT.md).
   - *Keep Your Own Books:* chapters are unnumbered but the text says "chapter N"; about 21 of roughly 36 references point at the wrong chapter. The description claims 21 chapters and a checklist in every chapter; only 15 chapters have both. The worked-month arithmetic was recomputed and is correct; no tax rules appear anywhere (the "no tax rules" claim is honest).
   - *The 90-Day Study Plan:* one unsourced sentence ("roughly a quarter of first-time candidates do not pass") contradicts the book's own "no claim about pass rates"; the optional 10-minute break after section one is missing (checked against ASWB's 08/2026 guidebook). Verified against that guidebook: 122 questions (110 scored, 12 pretest), two sections of 61, four hours, $260 fee, 90-day wait with waiver. "First title in the series" conflicts with The Retake Method in the same store.
   - *The Retake Method:* the EPUB collapses the A/B/C/D answer options into one run-on paragraph, which breaks the worked questions in chapters 6 to 9.
2. **Category and discoverability:** three of four are in "Other" (cannot be browsed or appear in Discover), The Retake Method has one tag, titles contain few search words, summaries are empty.
3. **Product format:** all four are EPUB only, no cover or images inside, no PDF, no printable tools. In every niche the competitors' products are tools, templates, PDFs or page-counted guides.
4. **Covers and thumbnails:** all four are dark text-only covers with tiny low-contrast type and no reader benefit or format signal; The Retake Method's cover title is chopped to "RETAKE METHOD: EXAM".
5. **Prices:** $29 to $39 against visible competitors that are mostly lower, with zero ratings on every competitor and every product (so no price is proven either way): see each AUDIT.md section 6/7. Price changes were not made.
6. **Traffic:** 19 lifetime views across all nine books, probably mostly the owner's. The first problem is traffic, then conversion.

## 3. Weaknesses and recommended changes per book (all proposals; detail in each `02_audit\AUDIT.md`)
| Book | Worst three weaknesses | Recommended category | Price view (no change made) |
|---|---|---|---|
| 90-Day Plan | Unsupported or contradictory exam claims; cover and title speak to everyone while the text speaks to retakers and never say LCSW/ASWB; no tools (blank calendar, scorecard) and EPUB only | Education > Test Prep (confirm path in editor) | Keep $34 until approved; option $24-27 until 3-5 ratings exist; no data supports either |
| Keep Your Own Books | Category "Other"; wrong chapter cross-references, no tools in a market of templates; text-only cover | Business & Money > Accounting | $29 is the top of the range for an EPUB with no tools: $15-19 as is, or $24-29 only with a PDF plus a starter template pack |
| The Retake Method | Wrong live thumbnail; cover title chopped and unreadable; category Other with one tag; EPUB breaks the worked questions | Education (or Education > Test Preparation) | Test $14-19 until reviews exist, or keep $29 only with a printable tools pack and PDF |
| Where Your AWS Bill Goes | Three wrong or outdated AWS claims; too abstract to act on (S3, EC2, Lambda etc. appear nowhere, no console paths or templates); wrong cross-references and weak listing | Software Development (sub-option to confirm), second candidate Business & Money | $39 only defensible with a corrected edition plus PDF and template pack; otherwise $24-29 |

## 4. Competitor research (10 or more competing products per book where reachable)
Done per book in `02_audit\AUDIT.md` (competitor tables) and `02_audit\COVER_CONVENTIONS.md` (competitor cover analysis; covers saved in `02_audit\competitor_covers\`): 13 products (90-Day Plan), 13 (Keep Your Own Books), 14 with 10 opened (Retake), 16 (AWS). Limits: reviews were not reachable (every Gumroad competitor shows zero ratings), a few competitor figures come from search snippets, Etsy returned 403 for one niche, and no competitor sales were visible, so no sales or bestseller claim is made.

## 5. Cover and thumbnail concepts (3 concepts per book, tested side by side)
Each book has three concepts: A and B follow its category's cover conventions (from the competitor covers), C is the old navy baseline kept for comparison. Files: `<book>\03_improved\covers_v3\concept_A|B|C\` (portrait 1600x2560, poster 1280x720, thumbnail 600x600). Side-by-side sheets with the live cover and phone-size previews (120 px and 70 px): `<book>\04_cover_tests\compare_original_vs_concepts.png`.

| Book | A | B | C (baseline) |
|---|---|---|---|
| 90-Day Plan | **Bold exam-prep blue, "2026 ASWB CLINICAL (LCSW) EXAM", heavy sans title, feature pills (recommended)** | Clean light planner, orange exam day | Navy and copper |
| Keep Your Own Books | **Ledger page, light cream, green band, "Close your month in one hour" badge (recommended)** | Solid teal guide, coral accents | Navy and copper |
| The Retake Method | **Annotated score report (cream, navy, copper), "For any multiple-choice licensing exam" (recommended)** | Two bubbles, white and teal | Deep blue "badge and proof" with page mockups |
| Where Your AWS Bill Goes | **The bill, opened: light paper, circled line (recommended; stands out among dark covers)** | Five meters: dark navy with five cost tiles (matches the tech convention) | Cut the spike: bold yellow and black |

Objective checks (computed, not taste; also in `cover_test_metrics.json`): title/background contrast ratio, kicker contrast and the title's pixel height at phone-thumbnail size.
| Book | Concept | Title contrast | Title height at 160 px wide cover | Notes |
|---|---|---|---|---|
| 90-Day Plan | A blue | 6.9:1 | 51 px | exam name and year on cover; ok (above 4.5:1) |
| 90-Day Plan | B light | 12.5:1 | 51 px | kicker (orange on cream) weak at 2.7:1 |
| Keep Your Own Books | A ledger | 14.6:1 | 42 px | benefit and format-free claims only |
| Keep Your Own Books | B teal | 5.5:1 | 42 px | kicker 3.7:1, lowest of the set |
| The Retake Method | A score report | 14.0:1 | 38 px | kicker 3.3:1 |
| The Retake Method | B bubbles | 16.1:1 | 38 px | highest title contrast |
| Where Your AWS Bill Goes | A bill | 16.0:1 | 51 px | kicker 3.3:1 |
| Where Your AWS Bill Goes | B tiles | 14.6:1 | 51 px | lower third of the cover is empty |
| Where Your AWS Bill Goes | C spike | 11.7:1 | 51 px | strongest "cost" imagery |
Category recognition, buyer relevance and brand fit are judgements based on the competitor covers; they are listed in each book's COVER_CONVENTIONS.md and are not proven to affect sales. A real test would be to show the three versions to a handful of people in each niche; that was not done.
The five new books' covers were not redesigned.

## 6. Interior and PDF
- **Interior diagrams:** 5 per book (20 in total) as SVG plus PNG, each explaining something the text already says, in `<book>\03_improved\diagrams\`; `manuscript_with_diagrams.md` is the original text with only image lines inserted (verified by stripping them back to the original).
- **Improved PDF editions (draft, using concept A covers):** `<book>\03_improved\pdf\<slug>.pdf`, 6 x 9 in, cover, title page, copyright and notice, contents with page numbers, the original text plus diagrams. Checked: 97 pages (90-Day Plan), 86 (Keep Your Own Books), 91 (The Retake Method), 87 (Where Your AWS Bill Goes); every contents link resolves; paragraphs flow correctly. The chapters stay unnumbered, as in the live books, so the wrong "chapter N" cross-references are still wrong in these drafts. These contain **no text corrections yet**: the accuracy fixes listed in section 2 are proposals and need your approval, because they change what customers read.
- Diagram check: AWS and Keep diagrams were viewed; the Keep "profit to bank" bridge calls the gap "accounts payable" where the chapter text should say receivables, so it needs your approval before use. Diagram text prints at about 6.6 pt on a 6-inch page in the Retake set (noted in its README).
- A script collision occurred between two research agents (one regenerated the Keep diagrams with another agent's script); the Keep diagrams were re-checked afterwards and look correct.

## 7. Scores out of 10 (judgements with the evidence in each AUDIT.md; where evidence is missing the score is not used to hide it)
| Book | Market positioning | Cover | Thumbnail | Interior | Editorial | Description | SEO readiness | Buyer relevance | Brand fit |
|---|---|---|---|---|---|---|---|---|---|
| 90-Day Plan | 5 | 4 | 3 | 4 | 6 | 4 | 4 | 6 | 7 |
| Keep Your Own Books | 5 | 3 | 3 | 4 | 6 | 5 | 3 | 7 | 7 |
| The Retake Method | 6 | 2 | 1 | 4 | 6 | 5 | 2 | 7 | 6 |
| Where Your AWS Bill Goes | 5 | 3 | 3 | 4 | 4 (accuracy) | 4 | 3 | 6 | 6 |
Reasoning in one line each: covers and thumbnails score low because they are quiet, text-only and unreadable at phone size (Retake lowest because of the wrong thumbnail and chopped title); interior scores 4 because EPUBs have no cover or images, collapsed lists or tables and no PDF; editorial is held back by cross-reference and accuracy errors (AWS lowest); SEO is low because three are in "Other", one has a single tag and titles lack search words; brand fit is fair because the publisher mark and palette are consistent. These are not sales predictions: no book has a sale yet.

## 8. What I recommend you approve (in this order)
1. Fix the accuracy problems first (AWS claims, Keep chapter numbers, ASWB sentence, Retake question formatting) and re-upload corrected files as new versions (customers keep access; no one has bought yet).
2. Move the three "Other" products into proper categories and fill the tags and summary fields.
3. Replace the Retake Method thumbnail and all four covers/thumbnails/posters with the approved concepts.
4. Add the PDF editions (and, if you want to keep the higher prices, small tools packs); update the descriptions from each `listing_improved.md`.
5. Decide prices last, after the products are fixed.
Nothing is applied until you say so. Tell me which concept letter you choose per book (or "all A"), whether the corrections may be made to the manuscripts, and whether price changes are wanted.

## 9. File map (everything under `C:\Users\Lenovo\Good Space\Coco\Gumroad Ebooks\Original Four\<book-slug>\`)
`00_original_backup\` untouched originals; `01_live_assets_as_found\` the live cover and thumbnail as downloaded; `02_audit\` AUDIT.md, COVER_CONVENTIONS.md, competitor_covers; `03_improved\` listing_improved.md, cover_brief.md, covers (first round), covers_v3 (A/B/C concepts), diagrams, manuscript_with_diagrams.md, pdf; `04_cover_tests\` comparison sheet. Also `live_state.json`, `cover_test_metrics.json`, and the business analytics in `..\Velvet Foundry Business\STAGE 1 - ANALYTICS SNAPSHOT 2026-11-07.md`.

## 10. Not done yet (so you are not misled)
The nine-book brand guide, five-new-books audit, dashboard workbook, free organic marketing plans, free samples for all nine, revenue scenarios and the 30-day plan from your master brief have not been produced; this report covers Stage 1 (analytics) and Stage 3 (the original four) only.
