# GLOBAL 9-BOOK DISTRIBUTION REPORT (2026-11-07)

## Headline
**Nothing has been uploaded or published on Amazon KDP, Google Play Books or Payhip, and no platform has confirmed anything.** All nine books are DRAFT READY: validated EPUBs, final PDFs, 1600x2560 covers and separate metadata for each retailer are built and packaged. The uploads are blocked by account access, not by file readiness:
- **Amazon KDP:** the browser session is not signed in (KDP shows its sign-in page). I do not sign in with passwords or deal with OTP/2FA.
- **Google Play Books Partner Center:** shows "Sign in / Get started": not signed in, and I did not register a seller account on your behalf.
- **Payhip:** the browser tool is not permitted to open payhip.com, so I could not even check whether you have an account.
Gumroad listings, prices and URLs were not touched. KDP Select was not used and must stay off.

## What was done
- Inspected all nine books and chose the latest finals: the improved original four (final PDF/EPUB) and the five new editions.
- Built EPUB 3 editions for the five new books (the original four already had them). **All nine pass EPUBCheck with 0 errors and 0 warnings.** Python code blocks keep their indentation; Retake Method question options are on separate lines.
- One fix found on the way: Book 7 (Python) had a raw `<urlopen error ...>` message in running text that broke the EPUB (and silently vanished from the PDF). I wrapped it in code formatting in the source and rebuilt the EPUB. **The published Gumroad PDF for Python still omits that one error line;** a corrected PDF can be re-uploaded if you want (not done: you asked to leave Gumroad unchanged).
- Covers: portrait covers upscaled to 1600x2560 JPEGs for KDP/Google/Payhip. The originals are 1024x1536 (new five) or 1800x2700 (original four); the five new covers are upscaled by about 1.6x and are soft at full size. KDP's recommended ideal is 2560x1600 (this is below it only for the five new books); re-export from the image tool at a higher resolution if you want them sharper.
- Metadata written per retailer for each book: `Global Distribution\<book>\metadata_amazon_KDP.txt`, `metadata_google_play.txt`, `metadata_payhip.txt`.
- Pricing and royalty comparisons (below, and in the workbook). Nothing was priced on any retailer.

## Distribution matrix (all nine; nothing is live)
| # | Book | Gumroad | Amazon status | Amazon URL | Amazon price/royalty | Google status | Google URL | Google price | Payhip status | Payhip URL | Payhip price |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | The 90-Day Clinical Licensing Exam Study Plan | $34.00 | DRAFT READY | none | not set | DRAFT READY | none | not set | DRAFT READY | none | not set |
| 2 | Keep Your Own Books | $29.00 | DRAFT READY | none | not set | DRAFT READY | none | not set | DRAFT READY | none | not set |
| 3 | The Retake Method | $29.00 | DRAFT READY | none | not set | DRAFT READY | none | not set | DRAFT READY | none | not set |
| 4 | Where Your AWS Bill Goes | $39.00 | DRAFT READY | none | not set | DRAFT READY | none | not set | DRAFT READY | none | not set |
| 5 | The AI Workflow Playbook | $14.00 | DRAFT READY | none | not set | DRAFT READY | none | not set | DRAFT READY | none | not set |
| 6 | The Client Acquisition Playbook | $19.00 | DRAFT READY | none | not set | DRAFT READY | none | not set | DRAFT READY | none | not set |
| 7 | Python Automation for Beginners | $14.00 | DRAFT READY | none | not set | DRAFT READY | none | not set | DRAFT READY | none | not set |
| 8 | The Practical Money System | $9.00 | DRAFT READY | none | not set | DRAFT READY | none | not set | DRAFT READY | none | not set |
| 9 | The Job Interview Playbook | $12.99 | DRAFT READY | none | not set | DRAFT READY | none | not set | DRAFT READY | none | not set |

Categories: PUBLISHED AND VERIFIED = Gumroad only (existing). UPLOADED AND UNDER REVIEW = none. DRAFT READY = all nine on all three retailers. BLOCKED = uploads (login/access). WAITING FOR YOUR ACTION = see the phone checklist.

## Amazon: royalty comparison (US, from the finished EPUB sizes)
Rule used: 35% royalty = 35% of list price (no delivery fee); 70% royalty = 70% of list price minus delivery fee of $0.15 per MB, available only inside the 70% price band. You said the band is $2.99 to $12.99; some 2026 sources say the band was extended to $12.99 on 7 July 2026 and older guides say $9.99, and I could not open KDP's own pricing page, so **confirm the band in KDP before choosing**. All nine EPUBs are about 0.4 to 1.4 MB, so delivery fees are $0.06 to $0.20.
| # | Book | EPUB MB | A) Keep Gumroad price | 35% royalty at A | 70% royalty at A | B) Amazon price in band | 70% royalty at B | 35% royalty at B |
|---|---|---|---|---|---|---|---|---|
| 1 | The 90-Day Clinical Licensing Exam Study Plan | 1.34 | $34.00 | 11.90 | n/a | $12.99 | 8.89 | 4.55 |
| 2 | Keep Your Own Books | 1.09 | $29.00 | 10.15 | n/a | $12.99 | 8.93 | 4.55 |
| 3 | The Retake Method | 1.0 | $29.00 | 10.15 | n/a | $12.99 | 8.94 | 4.55 |
| 4 | Where Your AWS Bill Goes | 0.81 | $39.00 | 13.65 | n/a | $12.99 | 8.97 | 4.55 |
| 5 | The AI Workflow Playbook | 0.4 | $14.00 | 4.90 | n/a | $12.99 | 9.03 | 4.55 |
| 6 | The Client Acquisition Playbook | 0.39 | $19.00 | 6.65 | n/a | $12.99 | 9.03 | 4.55 |
| 7 | Python Automation for Beginners | 0.45 | $14.00 | 4.90 | n/a | $12.99 | 9.03 | 4.55 |
| 8 | The Practical Money System | 0.45 | $9.00 | 3.15 | 6.23 | $9.00 | 6.23 | 3.15 |
| 9 | The Job Interview Playbook | 0.51 | $12.99 | 4.55 | 9.02 | $12.99 | 9.02 | 4.55 |

How to read it: at $14, $19, $29, $34 and $39 the 70% option is not available (the price is above the band), so you would earn only 35%: $4.90, $6.65, $10.15, $11.90, $13.65. Pricing a book at $12.99 would earn about $8.9 to $9.0 at 70%. That is more than 35% of $14 ($4.90) or $19 ($6.65), so for the $14 and $19 books an Amazon price of $12.99 pays more per sale than keeping the Gumroad price. For the $29, $34 and $39 books, 35% of the full price ($10.15, $11.90, $13.65) is higher than the 70% royalty at $12.99 (about $8.9), so keeping the higher price pays more per sale, though it may sell less on Amazon (not tested). The $9 and $12.99 books already fit the 70% band. **India (Amazon.in): 70% reportedly requires KDP Select, which we are not using, so Indian sales would be at 35%.** Amazon can also match lower prices found elsewhere (not verified): a lower Gumroad/Payhip/Google price than your Amazon price may pull the Amazon price down. No price was changed; choose per book.

## Google Play Books (India)
Seller sign-up for ebooks is listed for India in Google's supported-countries table; payouts are by USD wire transfer to a local bank account (minimum balance reported as $100). EPUB (preferred) or PDF accepted; the EPUB must contain the full book and a cover; cover files should be at least 640 px (larger recommended). An ISBN is the normal identifier: whether Partner Center accepts a book without one for ebooks was not confirmed: this is a decision (buy ISBNs, or check in Partner Center). Sample PDFs were NOT put into the packs as books. Payment/tax/bank steps are in the manual checklist.

## Payhip
Plans (from Payhip's help page via search results): Free 5% transaction fee, Plus $29/month 2%, Pro $99/month 0%, all plus payment-processor charges. No upgrade was made. For India, Payhip documents **Razorpay** (Account > Settings > Payment Details); **PayU was not confirmed** by anything I opened, so check the gateway list in your dashboard. Razorpay/PayU KYC and onboarding are your personal steps. The Python bonus ZIP is included in the pack and the Payhip metadata, with the tested-on notes from the book (Windows 11, Python 3.14.4 full run, 3.12.12 partial).

## AI content record (for KDP and Google declarations)
- Manuscripts: written by an AI assistant (Claude) from research and prompts, checked with scripts and by the publisher; not human-written. **Declare text as AI-generated** on KDP.
- Covers: generated with ChatGPT Image Generation and adjusted in code; landscape/square versions composed in code. **Declare as AI-generated images.**
- Interior diagrams (original four): drawn in code by the AI assistant. Declare as AI-generated. The new five have no images inside their PDF/EPUB.
- Python book: scripts were written and tested by the AI assistant.
Do not describe any of this as human-created.

## Authors, rights, citations (decisions and checks)
- **Author:** no author name is approved. The original four show "The Velvet Foundry Editorial Team" as the author line; the new five show none. A retailer needs an author or contributor name: **decision required** (a pen name, your name, or the publisher name where the retailer allows it). I did not invent one.
- **Rights:** I cannot verify legal rights. You must confirm: rights to the text (AI-assisted authorship may affect copyright; take advice if this matters), rights to the ChatGPT cover art under OpenAI's current terms, and that nothing third-party is embedded (diagrams are original; the covers were checked by eye for stray text and trademarks, not by a legal search). Titles use "ASWB"/"AWS" descriptively with independence disclaimers (the ASWB and AWS books); a trademark review before KDP is advisable.
- **Citations:** each book lists only sources opened on 2026-11-07; some pages could not be opened and are not cited as read.

## Quality gate status (per your list)
Complete manuscript: yes. Accurate content: corrected for the original four, checked with scripts for the others; not human-edited line by line. Correct author metadata: NO (decision). Approved rights: NO (owner). AI disclosures: prepared. Valid EPUB: yes (9/9). Readable PDF: yes. Professional cover: yes (5 new covers are upscaled). Title/subtitle/description: prepared. Categories/keywords: prepared (category names must be confirmed in each retailer's picker; keyword demand not measured). Price reviewed: comparison done, NOT approved. Preview check: Kindle Previewer was not available here, so the Kindle preview and the Google preview are NOT done. So the full gate is not passed; nothing should be published until the author, rights and price decisions are made.

## Where everything is
`C:\Users\Lenovo\Good Space\Coco\Gumroad Ebooks\Global Distribution` (nine book folders with EPUB, PDF, cover, three metadata files), `C:\Users\Lenovo\Good Space\Coco\Gumroad Ebooks\THE_VELVET_FOUNDRY_RETAILER_DISTRIBUTION.xlsx`, `GLOBAL_9_BOOK_PHONE_UPLOAD_CHECKLIST.md`, `GLOBAL_9_BOOKS_RETAILER_UPLOAD_PACK.zip` (all in `C:\Users\Lenovo\Good Space\Coco\Gumroad Ebooks`).
