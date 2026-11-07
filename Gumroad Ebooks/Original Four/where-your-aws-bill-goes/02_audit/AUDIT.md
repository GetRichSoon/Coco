# Audit: "Where Your AWS Bill Goes" (slug `where-your-aws-bill-goes`)

Audit date: 2026-11-07. Nothing live was changed. Live facts come from `..\..\live_state.json` and the live page (fetched 2026-11-07): price $39, category Other (not in Discover), 9 tags, EPUB only (53.5 KB, "25 sections"), summary field empty, no refund policy, 0 ratings, sales not visible, Pages attribute empty.

Evidence rule used throughout: "VERIFIED" = I opened the official AWS page named in the Sources section and the text supports it. "NOT VERIFIED" = I did not open a source that settles it. Competitor figures are only what the pages showed. Ratings are not sales. No sales figure exists in this document.

---

## 1. Verdict per area (one line each)

| Area | Verdict |
|---|---|
| Manuscript: structure and teaching idea | Strong. The "five shapes" frame, "delete before resize before clever" order, and the one-hour review are original and coherent. |
| Manuscript: AWS accuracy | Three confident statements are outdated or wrong (Cost Explorer history, tag activation, idle-only IPv4). Must be corrected before the price is defended. |
| Manuscript: practical usefulness | Weak for the buyer's actual moment. It never names S3, EC2, EBS, Lambda or CloudWatch, gives no console paths, no filters, no CLI, no templates. |
| EPUB build | Clean and valid, but no embedded cover, no chapter numbers while the text cross-references chapter numbers (and several are wrong), no images, minimal CSS. |
| Live cover (landscape poster) | Competent but generic dark tech look; right half empty; subtitle tiny; no reader benefit shown. |
| Square thumbnail | Legible title, but no benefit and nothing that says "reduce / understand cost"; "GOES" on its own line reads oddly. |
| Title and subtitle | Title is a good curiosity hook but carries none of the words buyers search ("reduce", "cost", "optimization"). Subtitle is in the file metadata and cover but not on the live name field. |
| Gumroad description | Well written, honest, but long, no bullets, no sample, leads with a story not with the buyer's problem, and tells the buyer the book has no prices (a deliberate and defensible choice that nonetheless needs reframing as "evergreen"). |
| Tags and keywords | Nine broad tags; missing the highest-intent terms (reduce aws bill, finops, aws billing, nat gateway). |
| Category | "Other" keeps it out of Discover. Must move. |
| Price ($39) | Not supported by what is delivered today (about 15k words, one EPUB, no tools). Supported only with a corrected edition plus templates. See section 7. |
| Product preview / purchase experience | Nothing to preview, no PDF, no page count, empty summary, no refund policy, no sample chapter. |

---

## 2. Ranked weaknesses (most severe first)

### W1. Three confident AWS statements are wrong or outdated (accuracy, trust)
Each is repeated several times, so a knowledgeable buyer will hit one in the first chapters.

1. **"Cost Explorer only accumulates history from the moment it is enabled."**
   Appears in "If you have just inherited the account" (manuscript line 41), the Permission section (lines 352-354, "turning it on during an incident gives you a tool with nothing in it") and the chapter checklist.
   AWS doc (VERIFIED, `ce-enable.html`): "After you enable Cost Explorer, AWS prepares the data about your costs for the current month and the previous 13 months, and then calculates the forecast for the next 12 months. The current month's data is available for viewing in about 24 hours. The rest of your data takes a few days longer."
   Fix: replace with "enable it today; the current month appears in about a day and about 13 months of history is prepared within a few days." The advice "do it before you need it" can stay, but the reason given is false.

2. **"Tag activation is not retrospective: data before activation stays untagged for ever."**
   Appears in the Tagging chapter (lines 419-422, 446-447, 457-459, checklist).
   AWS doc (VERIFIED, `cost-allocation-backfill.html`): management account users can request a backfill of cost allocation tags for up to twelve months; the resource tag must have been assigned to the resource historically; one request per 24 hours.
   Fix: "Activation is not automatically retrospective. You can request a backfill of up to 12 months, and it only works if the tag was already on the resource." The chapter's urgency argument ("too late to start") must be softened.

3. **Idle Elastic IPs framed as the cost ("charged precisely because they are idle").**
   Lines 741-742 and the monthly sweep (line 1390).
   AWS sources (VERIFIED): the AWS blog announcement says that from February 1, 2024 there is a per-hour charge per public IPv4 address "whether attached to a service or not"; the EC2 on-demand pricing page says "All In-use and Idle Elastic IP addresses are charged"; the VPC pricing page says in-use public IPv4 addresses are charged.
   The book's "idle address" framing is now incomplete: attached public IPv4 addresses are the larger, newer line item and a modern bill audit must look for them. The word "IPv4" appears zero times in the manuscript.

### W2. The book is too abstract to act on in the buyer's moment (usefulness)
Counts from the manuscript: S3 0, EC2 0 (EBS 0), Lambda 0, CloudWatch 0, Spot 0, Graviton 0, Compute Optimizer 0, Trusted Advisor 0, Cost Anomaly (named) 0, IPv4 0, Data Exports 0, Kubernetes 0, CloudFront 0, FinOps 0. Services appear only as "object storage", "a managed queue", "managed database". Named: NAT gateway, Cost Explorer, Cost and Usage Report, CloudTrail, Pricing Calculator, Well-Architected, "savings plans" once.
A buyer who types "NAT gateway cost" or "S3 lifecycle" into search, or who opens Cost Explorer and sees "EC2-Other" and "DataTransfer-Regional-Bytes", cannot map the book to the screen. The "no prices" stance is defensible (and kept); the "no names" stance goes further than the price rationale requires and is the main reason the book will feel thin next to checklists that name services.

### W3. No practical tools in a "monthly routine" book (completeness, price)
The book says "No worksheets to print." The competitor set sells on tools: a 47-check checklist with a 30-minute audit ($9, 7-day guarantee), 270+ checklists, scripts. This book describes a one-hour review, a tag set, a budget design and a design-costing exercise but supplies no fill-in template for any of them. These are cheap to produce from existing text (see `03_improved\listing_improved.md`, optional companion pack).

### W4. Chapter cross-references do not match the EPUB (editing)
The EPUB has 25 files and no numbers in headings. References in the text: "chapter 5" (reading the bill, correct by file number), "chapter 6" (tagging, correct), "chapter 12" (provisioned capacity, correct), but "chapter 3" for the five shapes (file ch04), "chapter 4" for billing permissions (ch05), "chapter 7" for data transfer (ch08), "chapter 11" for the serverless crossing point (ch15), "chapter 17" for the log-shipping month (ch19), "chapter 16" for the monthly review (ch18). "Chapters 1 to 4 / 5 to 13 / 14 to 18" in the opening, and "Eighteen chapters" in the conclusion, do not match either numbering. The listing says "25 chapters"; the real count is 19 core chapters plus how-to-use, scope, conclusion, next steps, publisher and copyright pages.
Fix: add visible chapter numbers and correct every reference (list in `03_improved\listing_improved.md`, appendix).

### W5. Other statements that need checking before relying on them
- "Cost Explorer stops at the service and usage type; per-resource detail only exists in the Cost and Usage Report" (line 369-370, 292-294). AWS doc (VERIFIED, `ce-granular-data.html`): Cost Explorer offers opt-in resource-level data at daily granularity and EC2-instance resource-level data at hourly granularity. Outdated as an absolute statement.
- "Anomaly alert ... reaches you in hours" (line 43, ch. 14). AWS doc (VERIFIED, `manage-ad.html`): Cost Anomaly Detection runs about three times a day, uses Cost Explorer data "which has a delay of up to 24 hours", so detection can take up to 24 hours; a new monitor can take 24 hours to begin. Budgets also refresh up to three times a day with notification delay (VERIFIED, `budgets-managing-costs.html`). "Within a day" is the defensible wording.
- Enabling Cost Explorer automatically configures a Cost Anomaly Detection AWS-services monitor and a daily summary alert subscription (VERIFIED, `ce-enable.html`). The book's "set up an anomaly alert" step should say "check what already exists, then add a subscription that reaches a person".
- Legacy vs new reports: the book names only the "Cost and Usage Report". AWS's backfill page names "Cost Explorer, Data Exports, and AWS Cost and Usage Report" as separate surfaces, and a competitor cover calls it "CUR 2.0 ... Data Exports". The book never mentions Data Exports. NOT VERIFIED beyond that (I did not open the Data Exports pages).
- "Interface endpoints charge hourly per endpoint per zone plus per gigabyte" (line 711-712). I did not open a page that states interface endpoint pricing (the VPC pricing page text I retrieved did not cover them). NOT VERIFIED.
- S3 Intelligent-Tiering "small monitoring fee per object" (line 823). NOT VERIFIED (S3 pricing page not opened).
- "Storage in most managed databases grows and does not shrink" (line 1055). NOT VERIFIED; hedged as "most", but engines differ and I did not check.
- Lambda: memory scales CPU, duration billed, provisioned concurrency billed for configured time, free tier not applying to provisioned concurrency (VERIFIED, `aws.amazon.com/lambda/pricing`). I could not confirm from that page whether on-demand billing includes initialisation time; the book does not claim either.
- "AWS's own recommendation tooling" (idle chapter, right-sizing chapter): unnamed, so unverifiable. The Billing console has "Rightsizing recommendations" pages (VERIFIED as a page name in `control-access-billing.html`), but I did not open a page describing Compute Optimizer behaviour, so the claim "it is biased towards resizing" is the author's judgement, NOT VERIFIED.

### W6. Claims verified as correct (so the owner knows what is safe)
- Hourly plus per-GB-processed structure of NAT gateways (VERIFIED, VPC pricing page).
- Gateway VPC endpoints for S3 and DynamoDB carry no additional charge (VERIFIED, `vpce-gateway.html`; the S3-only wording on the VPC pricing page is consistent).
- "Traffic in generally not charged; across a zone boundary typically charged; same zone free" (VERIFIED, AWS Architecture Blog: "There is no charge for inbound data transfer across all services in all Regions"; "Traffic that crosses an Availability Zone boundary typically incurs a data transfer charge"; same-AZ free). The book's "generally" hedge is right.
- CloudWatch Logs retention defaults to indefinite (VERIFIED, `Working-with-log-groups-and-streams.html`: "By default, log data is stored in CloudWatch Logs indefinitely"). New fact the book lacks: account-level retention policies (min 30 days, retroactive option, dry run) exist.
- Billing access: the root user must "Activate IAM Access" once, plus attach policies (VERIFIED, `control-access-billing.html`); for AWS Organizations member accounts it is on by default for created member accounts. Cost Anomaly Detection and the Billing SDK APIs sit outside that setting.
- Budgets: cost, usage, RI and Savings Plans utilisation/coverage budgets; actual and forecasted alerts; email and SNS; budget actions (VERIFIED). The book never names the utilisation/coverage budgets that directly serve its "commitment expiry" advice.
- S3 lifecycle small-object trap: since September 2024 objects under 128 KB do not transition by default, and early-transition to classes with minimum durations bills the remainder (VERIFIED, lifecycle transition page). Supports the book's "tier by size and access pattern" point; the book could cite it.

### W7. Cover and thumbnail (see COVER_CONVENTIONS.md)
Viewed both live images (1005x565 and 600x600). Strengths: strong title weight contrast, consistent publisher line, a disclaimer line on the poster. Weaknesses: all dark navy with low-contrast grey "WHERE YOUR"; subtitle and author line about 12 px at poster size and unreadable in a Gumroad card; right 45% of the poster empty; decorative bars suggest a chart but say nothing; no benefit line; no visual that says "bill" or "cost"; line break "AWS BILL / GOES" is awkward; thumbnail repeats the generic look and drops the subtitle. Competitors that appear in search use brighter blocks, numbers and feature lists on the cover.

### W8. Listing text
- Product name field is the short title only; no search words.
- Description opens with a story, not the buyer's problem, and is a wall of text; headings are inline caps with colons.
- "25 chapters" is inaccurate; the first claim a buyer can check is wrong.
- The no-prices feature is positioned as a feature, which is honest, but there is no complementary promise of what the buyer does get (named services, review template).
- Disclaimer present and good; keep it.
- Summary field empty (search result and card text).
- No refund policy; the cheapest competitor shows one (7-day money back, Demarko).

### W9. EPUB and format
Single EPUB. Many buyers of technical guides expect PDF (every Gumroad competitor I opened lists PDF: Cut Cloud Costs "PDF", Cloud Audit "PDF", sidehustle0 "PDF", Demarko "PDF"; Cookbook is ZIP). EPUB is poor on desktop for a book with a repeating checklist; a PDF is not available. No cover embedded in the EPUB (no cover image item in `content.opf`), `nav.xhtml` present and valid, NCX present, no images, CSS only 611 bytes, body font "serif", tables defined but unused. Metadata dc:subject lists 7 keywords; fine.

### W10. Editing quality (small)
- Typo/grammar: "the vendor own framework" (line 53, missing apostrophe-s). "the chattiest paths crossing them is a cost" (line 612, agreement). "Four or five tags" then lists three required plus two optional, consistent.
- The "recommended next book" (lines 1735-1740) points to a book that does not exist in the store and, in the same paragraph, re-points to chapters 7 and 11 (both wrong by file numbering). The scope chapter mentions "the companion volume on bookkeeping" (line 96), which is a different product (Keep Your Own Books); confirm cross-link or remove.
- Repetition: the "four habits" conclusion, "the thing worth remembering above all" appears in two chapters (lines 1648 and 1687), the five meters of databases and the five shapes both use the number five, and several "When it goes wrong" bullets restate the chapter 5 procedure. Not harmful; trimming would not hurt.

---

## 3. Competitor table (cover and listing evidence, seen 2026-11-07)

Gumroad pages were read from the page JSON (price, ratings, formats, pages). All Gumroad rows showed ratings count 0 and sales not visible. Buyer complaints were not reachable (no reviews on any of them; Leanpub/Packt/Manning review text not reachable with my tools).

| # | Product (seller / marketplace) | Price seen | Format / length | Ratings | Description / cover notes |
|---|---|---|---|---|---|
| 1 | Cut Cloud Costs! #1 ULTIMATE Cloud Cost Savings Guide (850+ pgs. for AWS cloud), Systems Architect (Gumroad) | $29.95 | PDF, 850+ pages | 0 | Three-panel cover collage: feature list at left, big title with scissors icon, yellow block with "1,000+ Cost Savings Tips", real console screenshot at right. Claims "#1" (self-claim). Description pitches promotions and consulting income. |
| 2 | Cloud Audit Best Practices: 21 Essential AWS Services (2025, 900+ pgs.), Systems Architect (Gumroad) | $29.99 | PDF, 800+ pages (title says 900+) | 0 | 275+ checklists; bonuses listed (EC2 Spot cost optimisation, IAM checklist, DynamoDB modelling); dated "new edition Aug 12 2025". Same three-panel cover with orange tile background and black check mark. |
| 3 | Cut Cloud Costs/Audit 2-Pack, Systems Architect (Gumroad) | $39.99 | bundle | 0 | Yellow/black bundle cover showing both book covers. Price anchor: two books for the price of ours. |
| 4 | 4-Pack Cloud Audit Essentials + Big Data + Cut Cloud Costs + Cloud Metrics, Systems Architect (Gumroad) | $79 | bundle | 0 | No cover image in page JSON. |
| 5 | The Ultimate Guide to AWS Cost Savings and Kubernetes Optimization, sidehustle0 (Gumroad) | $49 | PDF, 30 pages | 0 | Cartoon cover: yellow background, game console clip art, AWS and Kubernetes logos on a monitor. Summary: "slash your AWS costs and supercharge your Kubernetes infrastructure". Highest price among single Gumroad cost guides, with the shortest length. |
| 6 | AWS Cost Optimization Checklist, Demarko Little / DemarkoCloud (Gumroad) | $9 | PDF (pages not shown) | 0 | 47 checks, 30-minute audit, EC2/Auto Scaling, S3/EBS, RDS/DynamoDB, Lambda, networking, tagging, RI/Savings Plans; 7-day money-back guarantee shown; "without blindly making changes that could impact production". Dark photo-style cover with AWS logo, big orange AWS and white title, "47 actionable checks", eight icon tiles. Closest direct substitute for "what do I do this week". |
| 7 | AWS Cost Audit Kit (Waste Finder script and monthly 15-minute review), fuzailahmed (Gumroad) | about $6 | not stated | not visible | Seen only in a search result snippet (30-day money-back, "20-40% lower bill" marketing claim, unverified); the page itself returned an empty shell to my fetch. Treat as partially unverified. |
| 8 | Anybody Can AWS, thekomoqo (Gumroad) | $39 | not stated | 0 | General AWS beginner guide (not cost-specific); pastel green cover with clip-art desk illustration. Price anchor: another $39 AWS guide with no ratings. |
| 9 | AWS Projects: From Beginner to Pro, codewithdhanian (Gumroad) | $6.99 | PDF | 0 | AWS logo plus clip art cover. Adjacent, not a cost book. |
| 10 | AWS Serverless: Build Cloud Applications without worries, Omar Toledo (Gumroad) | $1+ (pay what you want) | PDF about 44 pages (per search snippet) | 0 | Blue gradient cloud cover with a typo ("WHITOUT"); amateur example. |
| 11 | The Serverless Cookbook (Plus), Moonrise Labs (Gumroad) | $125 | ZIP | 0 | Plain navy cover with large pale title; code projects included. Price ceiling for AWS-related products. |
| 12 | Efficient Cloud FinOps, Packt (Leanpub) | $43.99 minimum and suggested | PDF and EPUB | not shown | End-to-end FinOps practice across AWS, Azure, GCP; page count and ratings not shown. Packt's own store lists the ebook at about EUR 31.49 (retailer page via search; not re-opened). |
| 13 | Practical FinOps, Manning (via Booktopia listing) | $44.99 | ebook, listed as preorder with a 21 April 2026 release date | not shown | Covers visibility, tagging, compute/storage/Kubernetes. Current availability not checked. |
| 14 | FinOps: RoadMap to Cloud Efficiency, BPB | $29.95 on BPB site | ebook | not shown | Seen in a search snippet; not opened. |
| 15 | AWS ebook "10 ways you can reduce costs", UST free ebook, CloudVisor "10 Hacks to Save Up to 40% on Your AWS Bill", AWS Well-Architected Cost Optimization Pillar | free | PDF/web | n/a | Free vendor and agency content sets the floor: a buyer can always find a free list of tricks. The "40%" is a marketing claim I did not verify. |
| 16 | Cost Savings Custom Report (Systems Architect, Gumroad) | $699 | service | 0 | Personalised consulting package; shows the ceiling for done-for-you help. |

Total relevant products reviewed: 16 rows (11 on Gumroad). Covers downloaded and viewed: rows 1, 2, 3, 5, 6, 8, 9, 10, 11 (saved in `competitor_covers\`).

Pattern across the set:
- Titles lead with the verb and the platform ("Cut Cloud Costs", "AWS Cost Optimization", "Cost Optimization Checklist"); ours leads with a curiosity phrase.
- Competitors sell quantity and tools (850+ pages, 1,000+ tips, 270+ checklists, 47 checks, a script). Ours sells understanding and sells it against a no-numbers stance.
- Every Gumroad item is PDF; ours is EPUB only.
- All but two (Demarko, Cloud Audit "recent edition") show no refund policy and no ratings, so reviews are not a moat for anyone yet.
- Several use the AWS logo or "aws" wordmark prominently (Demarko, sidehustle0, AWS Projects); this is a trademark risk we should not copy.

---

## 4. Market positioning

**Target customer.** The engineer, tech lead or small-team owner who owns an AWS bill they did not design: startup CTO, DevOps or platform engineer at a small company, freelancer or agency running clients' accounts, someone newly handed an inherited account. Not the FinOps specialist and not the procurement buyer (the book says so itself).

**The problem.** Somebody asked "why did the bill go up?" and the console does not answer in plain terms. Cost shows up as unfamiliar usage types (data transfer, NAT processing, log ingestion) generated by decisions that looked unrelated to cost.

**What makes them willing to pay.** Urgency (a bill spike or a request from finance), the wish to look competent, and the cost of getting it wrong (a charge that recurs monthly). Competitors' own pitches confirm it: "your AWS bill shouldn't be a mystery", promotions and consulting income, "lower their cloud spend this week".

**What competitors offer.** Volume (hundreds of tips and checklists), tools (checklists, scripts), service-by-service lists, bundles and low entry prices ($6 to $9), a refund promise on the cheap ones, and PDF delivery. Free vendor guides cover the basics.

**What they fail to provide (as far as their listings show).** A reasoning framework that carries over to services the buyer has not met; an order of operations (delete, then resize, then commit); the "why did it change" investigation routine; attribution (tags, accounts, ownership); an operating habit; honesty about what not to optimise. Several list-style products also tell the reader to change things "without breaking production" but do not teach a stop-before-delete practice.

**What would make this the better purchase (and what must be true first).**
1. Correct the three inaccuracies (W1) and state "checked against AWS documentation in [month year]" with the actual date and sources. A book that sells trust cannot be wrong on page 1.
2. Name the services and the console surfaces the reader will see (S3, EC2, EBS, Lambda, CloudWatch, VPC endpoints, Cost Explorer filters, Cost Anomaly Detection, Budgets actions) while keeping the no-prices rule. That removes W2 without breaking the book's identity.
3. Ship the one-hour monthly review, the tag policy, the idle sweep, the budget design and the design-costing questions as fill-in templates (CSV/Google Sheet-style or printable pages) so the book out-tools a $9 checklist at the point of use.
4. Provide PDF alongside EPUB.
5. Show the five diagrams in `03_improved\diagrams\` so the framework is visible on the cover page of the listing.
6. Add a short "what changed in AWS billing since this book was written" page and a free sample chapter.

---

## 5. Product content check

**Completeness.** All promised topics are present (five shapes, bill structure, tagging, accounts, data transfer, NAT gateway, idle resources, storage, commitments, right-sizing, databases, serverless, environments, budgets, monthly review, worked month, design costing, when to stop). Missing for a 2026 AWS cost book: public IPv4 charges; Spot and Graviton/instance generation options (the book says "newer generation" generically); Compute Optimizer and Trusted Advisor by name; Cost Anomaly Detection and Budgets actions by name; Cost Categories; Data Exports; S3 Storage Lens/Intelligent-Tiering details; EBS/EC2 names; CloudFront; Kubernetes/EKS and container costs; AI/GPU workloads; Savings Plans types (only one lower-case mention); RI/SP utilisation budgets; account-level log retention policy; tag backfill; Cost Explorer resource-level data.

**Depth.** Good conceptual depth, thin on procedure. The procedure for investigating a spike is excellent but has no screenshot, no filter names, no example usage type string (the book explains that "the usage type name encodes the boundary" without showing one). The worked month is plausible and well built but is only prose.

**Accuracy.** See W1, W5, W6.

**Practical usefulness.** High for readers who already know the console; limited for beginners. No templates, no checklist sheet beyond per-chapter bullets, no sample tag policy, no sample budget, no sample alarm text.

**Originality.** The five-shape taxonomy, the "delete before resize before clever" ordering, the three-line monthly note, and the stop-optimising chapter are distinctive and genuinely useful. This is the strongest asset.

**Examples.** One extended fictional example (the log-shipping step through NAT). Excellent but alone. A second worked example (storage ramp or an expired commitment) would double the proof.

**References.** Only generic (pricing pages, Pricing Calculator, Well-Architected cost pillar). No links, no dated sources. For an AWS book, add dated source links per chapter.

**Editing quality.** Clean, consistent British spelling, direct voice. Cross-reference numbers wrong, a few small grammar slips, a nonexistent "next book".

**Concrete gaps list**
1. Public IPv4 address charge and how to find them.
2. Cost Explorer history and resource-level data corrections.
3. Tag backfill.
4. Service names and console labels for each chapter.
5. Templates: monthly review sheet, tag policy, idle sweep list, budget plan, design-costing sheet.
6. Spot, Graviton and generation upgrades; Savings Plans types.
7. Kubernetes/container cost note (the $49 competitor sells on it).
8. A sample "usage type" reading table.
9. Dated sources and a "verified on" line.
10. Correct chapter numbering and delete or replace the "next book" pointer.

---

## 6. Search visibility (what buyers type; what Gumroad and Google show)

Likely buyer queries (hypotheses, no volume data; derived from competitor titles and the free articles search returned): "reduce aws bill", "aws cost optimization", "aws cost optimization guide", "aws cost optimization checklist", "why is my aws bill so high", "aws bill explained", "nat gateway cost", "aws data transfer cost", "cloud cost optimization ebook", "finops for engineers".

What I saw: a web search for "gumroad AWS cost optimization ebook" returned Gumroad listings from Systems Architect (Cut Cloud Costs, $29.95) and sidehustle0 ($49) at the top, plus vendor blogs. A search for Demarko's checklist surfaced his DEV.to post. Our product did not appear in those two searches (not proof of absence in general).

Why ours is weak: the product name has no "reduce/cost/optimization"; the category is Other so Gumroad Discover does not list it; tags are nine and broad; summary empty; Google snippet is the story-opening text ("Somebody forwarded you the AWS invoice..."). Gumroad's own `<meta description>` is the first 160 characters of the description, so the first sentence is the search snippet; the first sentence should state the problem and the solution.

Improvements (in `03_improved\listing_improved.md`): name "Where Your AWS Bill Goes: Understand and Reduce Your AWS Costs"; summary under 160 characters; eight tags; opening paragraph rewritten with the main search phrases; category moved out of Other.

---

## 7. Price ($39) with evidence

Evidence seen (Gumroad, 2026-11-07): single-book AWS cost guides at $29.95 (850+ pages PDF), $29.99 (800+ pages PDF), $49 (30 pages PDF), and a $9 checklist; bundles $39.99 and $79; adjacent AWS guides at $39 (Anybody Can AWS), $6.99 and $1+; Serverless Cookbook Plus $125. Off Gumroad: Efficient Cloud FinOps $43.99 on Leanpub (full publisher book, PDF and EPUB), Practical FinOps $44.99 pre-order listing, FinOps RoadMap $29.95; free vendor ebooks.
Delivered today: about 15,000 words (roughly 50 pages), EPUB only, no templates, no screenshots. Next to that, $39 sits above two 800+ page Gumroad products and above the $9 checklist, level with a $39 non-cost AWS guide and a bit under a full publisher FinOps book. No sales or reviews are visible for any of them, so I cannot say what buyers accept.
Hypothesis-based recommendation (do not change until approved): keep $39 only if the improved edition ships with corrected content, PDF and a template pack and a sample; otherwise a launch price of $24 to $29 is easier to support against the $29.95 and $29.99 books and the $9 checklist. A test of $29 versus $39 with 20 visitors each is not statistically meaningful; use the buyer feedback and ratings as the real signal.

---

## 8. Audit of every item on the owner's list

1. Original cover: see W7 and COVER_CONVENTIONS.md.
2. Landscape poster: same; the 45% empty area is the main loss.
3. Square thumbnail: same; make the reader benefit and a number or keyword visible at 600 x 600 and at the card size.
4. Interior design (EPUB): W9, W4. Add cover, chapter numbers, diagrams, callout boxes (style.css has an unused `p.note`), a checklist style.
5. Manuscript quality: sections 2 and 5.
6. Title and subtitle: W8.
7. Gumroad description: W8; improved text provided.
8. SEO keywords and tags: section 6; improved lists provided.
9. Category: "Other" must change. Recommended: Software Development (sub-category to be confirmed in the Gumroad editor; my internal book.json file says `software-development/web-development/aws`, which looks like a path from the company's own mapping, not confirmed from Gumroad). Second candidate: Business & Money (for the budgeting and attribution angle). Confirm in the editor which sub-options exist.
10. Pricing: section 7.
11. Product preview: nothing to preview; add a free sample chapter (suggested: "The five things you actually pay for", about 1,400 words) or a PDF excerpt.
12. Customer purchasing experience: EPUB only, no PDF, no page count, no summary, no refund policy, no changelog, no "last verified" date; fix all of these.

---

## 9. Sources (opened 2026-11-07)

AWS documentation and official pages:
- https://docs.aws.amazon.com/cost-management/latest/userguide/ce-enable.html (enable Cost Explorer: 13 months of data, anomaly detection auto-configured)
- https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-allocation-backfill.html (tag backfill up to 12 months)
- https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-alloc-tags.html (activation, up to 24 hours)
- https://docs.aws.amazon.com/cost-management/latest/userguide/ce-granular-data.html (resource-level data)
- https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html (Cost Anomaly Detection timing and delivery)
- https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html (budget types, forecasted alerts, update frequency)
- https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/control-access-billing.html (Activate IAM Access)
- https://docs.aws.amazon.com/cur/latest/userguide/what-is-cur.html (CUR to S3)
- https://aws.amazon.com/blogs/aws/new-aws-public-ipv4-address-charge-public-ip-insights/ (IPv4 charge from February 1, 2024, attached or not)
- https://aws.amazon.com/vpc/pricing/ and https://aws.amazon.com/ec2/pricing/on-demand/ (NAT gateway structure; in-use and idle addresses charged; per-second billing)
- https://docs.aws.amazon.com/vpc/latest/privatelink/vpce-gateway.html (gateway endpoints S3 and DynamoDB, no additional charge)
- https://aws.amazon.com/blogs/architecture/overview-of-data-transfer-costs-for-common-architectures/ (inbound free; cross-AZ)
- https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Working-with-log-groups-and-streams.html (default indefinite retention; account-level policies)
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-transition-general-considerations.html (128 KB default; minimum durations)
- https://aws.amazon.com/lambda/pricing/ (memory/CPU, provisioned concurrency)

Competitors and market:
- https://systemsarchitectio.gumroad.com/l/cut-cloud-costs, /l/cloud-audit-essentials, /l/bundle-cut-costs-audit-bigdata, /l/4pack-pro-cloud-architect, /l/report-cost-savings
- https://sidehustle0.gumroad.com/l/aws-cost-optimization
- https://demarkocloud.gumroad.com/l/kfxoi
- https://thekomoqo.gumroad.com/l/pZjWb, https://codewithdhanian.gumroad.com/l/hfcxck, https://omartoledodev.gumroad.com/l/serverless-aws, https://moonriselabs.gumroad.com/l/serverless-cookbook-plus
- https://leanpub.com/efficientcloudfinops (price and formats seen on page); Packt, Booktopia and BPB prices came from search results only and were not re-opened (Packt page returned 403)
- fuzailahmed Gumroad kit: search snippet only

Not reachable: reviews or complaints for any product (all Gumroad pages showed 0 ratings; no review text available elsewhere with my tools). Not opened: Data Exports, Compute Optimizer, Savings Plans documentation, S3 and RDS pricing pages, interface endpoint pricing.
