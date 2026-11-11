# Amazon KDP upload pack — TVF-EXAM-0001

**Why this is a manual step.** KDP has no public publishing API. `os/publishing-platforms.json`
marks it `FOUNDER_UPLOAD_REQUIRED`, and nothing in Coco can or should pretend otherwise. Everything
below is prepared; a founder does the upload.

**This is also the platform the buyers actually use.** Report 002 measured it: "aswb study guide"
scores 0.1 on Google Trends while being a live Amazon book-search suggestion, and Amazon returns 30
distinct year-dated queries for this lane. Gumroad was chosen because it is the only store the cloud
can publish to, not because it is where demand is. If only one store gets attention, make it this one.

---

## 1. Files

| What | Where |
|---|---|
| Manuscript (EPUB, reflowable) | `aswb-clinical-90-day-study-plan.epub` (61,055 bytes) |
| Machine-readable QA verdict | `qa-report.json` — verdict PASS, production_ready true |
| Full field pack | `upload/amazon_kdp/listing.json` |
| Source manuscript | `manuscript.md` — 28 chapters, ~17,100 words |

KDP accepts EPUB for reflowable ebooks. The manuscript cuts chapters at `# ` headings, which is the
KDP Heading-1 convention, so the same source uploads as DOCX if the EPUB is ever rejected.

## 2. Metadata, exactly as it should be entered

| Field | Value |
|---|---|
| Title | The 90-Day Clinical Licensing Exam Study Plan |
| Subtitle | A structured, independent preparation schedule for the 2026 ASWB Clinical (LCSW) examination |
| Series | none for the first title |
| Edition number | 1 |
| Author | The Velvet Foundry Editorial Team |
| Publisher | The Velvet Foundry |
| Language | English |
| Publication date | leave as the upload date |
| ISBN | none needed for a Kindle ebook; KDP assigns an ASIN |

**Keywords — seven, as KDP allows:**

1. lcsw exam study plan
2. clinical social work licensing exam
3. aswb clinical exam preparation
4. social work licensing exam 2026
5. lcsw study schedule
6. 90 day study plan
7. social work exam retake

These are search phrases, correct for KDP. They are **not** the Gumroad tags: Gumroad refuses any
tag of 20 characters or more, so that store has its own short list in `book.json` under
`tags_by_platform`. Do not copy one into the other.

**Categories.** KDP asks for BISAC-based categories. Sources disagree on whether the current limit
is two or three, and I could not confirm it from KDP's own pages — **check the number of slots the
dashboard actually offers.** In priority order:

1. Education & Teaching > Studying & Workbooks > Study Guides
2. Politics & Social Sciences > Social Sciences > Social Work
3. Education & Teaching > Studying & Workbooks > Test Preparation

## 3. Description

Use the description in `upload/amazon_kdp/listing.json` verbatim. It already carries the two
sentences that must not be dropped:

> Contains no examination questions and no confidential examination material. Not affiliated with,
> endorsed by or approved by ASWB.

Those are not marketing copy. They are the disclaimer, and they belong on the listing as well as in
the book — see §13 of the spec.

## 4. Price

**US$12.99**, which is the top of the 70% royalty band.

| | |
|---|---|
| List price | $12.99 |
| Royalty option | 70% |
| Delivery cost | ~$0.01 (file is 0.06 MB) |
| **Royalty per sale** | **$9.09** |

Amazon.com pays 70% between $2.99 and $12.99, the ceiling having risen from $9.99 on 7 July 2026.
At $12.99 the 70% option pays far better than 35%, so select 70%.

**Do not price this at the Gumroad price.** Gumroad is $34 for a bundle; this is the book alone. The
difference has to be visible in what each listing offers or it reads as arbitrary.

**If a print edition is ever added:** the 70% option requires the ebook to be at least 20% below the
print list price, so print would have to be $16.24 or more.

## 5. Rights and territories

- Worldwide rights: we hold them; this is original work.
- Select "all territories".
- KDP Select / Kindle Unlimited: **a founder decision, not a default.** It requires 90 days of
  exclusivity, which would prevent selling the same book on Gumroad. Given that Gumroad already has
  the draft, enrolling would conflict. Recommend **no** for this title.

## 6. Before you press publish — checklist

- [ ] `qa-report.json` reads verdict PASS and production_ready true
- [ ] `listing.json` reads ready_for_upload true with an empty problems list
- [ ] The EPUB opens in the KDP previewer and the 28-chapter table of contents navigates
- [ ] Title and subtitle match §2 exactly, with no "official", "approved" or "endorsed"
- [ ] The description still contains both disclaimer sentences
- [ ] Price is 12.99 and the 70% option is selected
- [ ] KDP Select is **off**
- [x] A cover is attached and meets §7 (cover.jpg, validated)
- [ ] The founder has decided the trademark question in §8

## 7. Cover — DONE

`cover.jpg`, 1,600 x 2,560 px, JPEG, RGB, 300 DPI, ratio 1.600, about 300 KB. Built by
`studio/ebooks/build_cover.py` from this title's own `book.json`, so it cannot drift from the
metadata, and validated by `studio/ebooks/check_cover.py` (report in `cover-report.json`).

KDP's requirements, and where we land:

| Requirement | This cover |
|---|---|
| 1.6:1, portrait, 2,560 px on the long edge | 1,600 x 2,560, ratio 1.600 |
| JPEG or TIFF, RGB, under 50 MB | JPEG, RGB, 0.3 MB |
| Legible as a thumbnail | measured: title-band contrast 55.6 at 160 px wide, against a floor of 28 |

Note the orientation, because it is the commonest rejection of all: **1,600 wide by 2,560 tall.**
1.6 is height over width. An earlier draft of this file wrote it the other way round.

Everything on it is ours outright: geometry plus Cinzel, which sits in this repository under the
SIL Open Font Licence (`studio/moonveil/assets/fonts/OFL-cinzel.txt`). No stock photography, no
licence to track, nothing to re-clear if the title changes.

**What it deliberately does not do**, each enforced by `check_cover_test.py` rather than promised:

- no ASWB logo, wordmark, seal, colour scheme or trade dress, and nothing shaped like one. The
  mark appears as four plain letters in the book's own typeface, which is the second prong of the
  nominative-use test in `research/ebooks/aswb-title-legal-review-001.md`.
- no "official", "approved", "endorsed", "accredited" or "guaranteed", anywhere.
- the disclaimer is part of the artwork: "Not affiliated with, endorsed by or approved by ASWB."
  and "Contains no examination questions."

The motif is the product: ninety marks banded into the four phases the book assigns, so the thing
on the cover is the schedule inside it.

## 8. Open decisions a founder must make first

1. **Price.** $12.99 here and $34 on Gumroad both sit above the `$3.99–$7.99` band configured in
   `os/structure-plans/ebooks.json`. The band is wrong for this category — the measured incumbent
   prices are $30–$95 — but changing it is a founder call.
2. **The trademark position.** The spec marks it **NOT VERIFIED**: ASWB publishes no third-party
   name-use policy I could find and its terms-of-use URL returns 404, so the title rests on
   nominative-use practice plus the disclaimer. On KDP the title is permanent and indexed, which is
   a bigger exposure than a Gumroad draft. **Worth a lawyer's twenty minutes before this upload**,
   and it is the one item I would not wave through.
3. **KDP Select.** Recommend no, see §5.

**The trademark item now has its own file:** `research/ebooks/aswb-title-legal-review-001.md`.
Short version: the TITLE carries no mark and needs no change; the SUBTITLE does, and KDP holds a
subtitle to the title rule, which prohibits "unauthorized reference to a trademarked term". The
recommendation is to ship the mark-free subtitle on KDP and keep the current one on Gumroad. That
file stays at LEGAL REVIEW REQUIRED until a lawyer reads it.
