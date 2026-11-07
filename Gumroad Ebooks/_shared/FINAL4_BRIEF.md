# Brief: produce the FINAL corrected manuscript for one of the original four Velvet Foundry books (2026-11-07)

The owner has approved all manuscript, factual, formatting, category and tag corrections identified in the review (`Original Four\<slug>\02_audit\AUDIT.md`). You produce the final corrected manuscript. Do NOT touch Gumroad, do NOT change prices, do NOT modify `00_original_backup` or any original file. Write only inside `C:\Users\Lenovo\Good Space\Coco\Gumroad Ebooks\Original Four\<slug>\02 FINAL MANUSCRIPTS\` (create it).

Inputs:
- Audit: `<slug>\02_audit\AUDIT.md` (read it fully: every weakness marked as a correction is in scope).
- Starting text: `<slug>\03_improved\manuscript_with_diagrams.md` (the original manuscript plus 5 image lines `![alt](diagrams/name.svg)`; diagrams are in `<slug>\03_improved\diagrams\` as SVG and PNG; each diagram has a README).
- Original untouched: `<slug>\00_original_backup\manuscript.md`.
- Proposed listing (for context only): `<slug>\03_improved\listing_improved.md`.

Deliverables (all in `02 FINAL MANUSCRIPTS\`):
1. `manuscript_final.md`: the full corrected manuscript, markdown, same conventions as the original: H1 for chapters and front/back matter. NUMBER THE CHAPTERS: write chapter headings as `# Chapter N. Title` for the main body chapters (decide the numbering so that the book's own existing cross-references such as "chapter 4 is the chart of accounts" are as consistent as possible), keep unnumbered H1 for "How to use this book", front notes, "Conclusion", "Recommended next steps and further resources", "About the publisher", "Copyright" (move "Copyright"/"About the publisher" notes to the END as before; the PDF builder adds its own copyright page). Update EVERY internal cross-reference ("chapter 7", "see the chapter on X", "the next chapter", "earlier in this book") so it is correct, verified by a script you write that lists every reference with the target heading it now resolves to; keep that listing as `crossref_check.md` (reference text, where it appears, target chapter number and title, ok/fixed). Keep all existing images lines, add a one-line italic caption under each image (`*Figure N. caption*`) where useful, and place each diagram next to the explanation it supports.
2. `CHANGELOG.md`: every correction made, with: location (chapter), the BEFORE text (short quote), the AFTER text, and the evidence (source URL or manuscript fact, with the date checked 2026-11-07). Group by: factual corrections, wording/overclaim fixes, structure/formatting fixes, cross-reference fixes, additions. Anything you could not verify must be softened or removed in the text and listed under "could not verify".
3. `references.md`: the final "Recommended next steps and further resources" / sources section text as it appears in the manuscript: only sources you actually opened, with URL and "accessed 2026-11-07" and what each supports. Also put this into the manuscript's last section.
4. Updated diagrams if a correction makes a diagram wrong: edit the SVG in a NEW folder `02 FINAL MANUSCRIPTS\diagrams\` (copy all five SVG+PNG there first, then fix; keep the original diagrams untouched), fix labels/spelling/accuracy, re-render the PNG with headless Chrome (`"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --headless=new --screenshot=<png> --window-size=1200,<h> file:///...`), view each final PNG with the Read tool and confirm. The final manuscript must reference images as `diagrams/<name>.png` (PNG) relative to the `02 FINAL MANUSCRIPTS` folder. Text in diagrams must be at least about 9 pt equivalent when the image is printed 4.8 inches wide; enlarge fonts if needed.
5. Report word count of manuscript_final.md (words excluding markdown symbols).

Rules:
- Do not invent facts, statistics, credentials, guarantees, pass promises or unsupported savings. Where the original makes an unverifiable claim, remove it or soften it and say so in the changelog.
- Keep the author voice and everything that is correct; do not rewrite for style beyond what corrections need. Remove obvious repetitive filler only if it is clearly redundant.
- Keep the independence/no-affiliation/no-tax-advice disclaimers the book already has.
- Verify claims against official sources you open now (WebFetch/WebSearch). If a page returns 403 or fails, say so and do not cite it as read.
- Check worked examples and arithmetic by running a script.
- No author name, no invented endorsements, no "bestseller".
- Final reply (max 12 lines): files, word count, number of corrections by group, what you could not verify, anything the owner must decide.
