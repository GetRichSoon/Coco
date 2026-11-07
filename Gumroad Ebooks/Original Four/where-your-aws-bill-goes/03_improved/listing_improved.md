# Improved Gumroad listing: "Where Your AWS Bill Goes"

Status: proposal for owner review. Nothing was changed on Gumroad. Product URL slug stays `where-your-aws-bill-goes`. Current live price ($39) stays until approved.

Conditions: the text below matches the CURRENT manuscript. Lines marked [ONLY IF SHIPPED] describe additions (corrections, PDF, templates, diagrams) that do not exist yet; delete those lines if the edition is not built.

## Title and subtitle
- Gumroad product name: `Where Your AWS Bill Goes: Understand and Reduce Your AWS Costs`
- Subtitle (cover, first line of description, EPUB metadata): `The five shapes of cloud cost, the decisions that set them, and a monthly review that takes an hour` (unchanged from the manuscript, which is accurate)
- Trademark note: "AWS" is used nominatively to say which service the book is about; the disclaimer below and on the cover must stay. The owner may prefer "Amazon Web Services" in the product name; I judge nominative use acceptable but I am not a lawyer.

## Summary line (under 160 characters; Gumroad summary field)
`Plain-English guide to why your AWS bill is what it is: five pricing shapes, a 1-hour monthly review, and an order of operations for cutting cost.` (146 characters)

## Description (paste as plain text)

Somebody forwarded you the AWS bill and asked why it went up. This guide shows you how to read it, trace each line to the decision that caused it, and reduce the cost in the right order, without needing a dedicated FinOps team.

WHAT YOU WILL BE ABLE TO DO
• Trace any line on your AWS bill back to the decision that caused it
• Find the three things driving most of your spend in about an hour
• Read a cost graph's shape (a step, a ramp or a sawtooth) and know whether you are looking at a deploy, an accumulation or a scheduled job before you group anything
• Tell a cost that is a problem from a cost that is simply the price of running the thing
• Put one alarm, one monthly review and one written note in place so the next surprise reaches you in hours, not at month end

THE IDEA
Almost every AWS charge is one of five pricing shapes: time, storage, requests, data transfer and provisioned capacity. Learn the shapes and an unfamiliar service becomes readable from its pricing page in a couple of minutes. The book then gives you the order that matters: delete what nobody wants, then resize, then (only then) buy a discount.

WHAT IS INSIDE
19 core chapters, plus a how-to-use guide, a scope chapter, a conclusion and a next-steps page:
• Why cloud bills surprise people, and the five things you actually pay for
• Reading the bill as a structure: bills page, Cost Explorer, the Cost and Usage Report, daily versus monthly, amortised versus unblended
• Tagging and attribution; accounts, organisations and consolidated billing
• Data transfer, the cost nobody models; the NAT gateway and other per-gigabyte appliances
• Idle, forgotten and orphaned resources; storage, retention and lifecycle rules
• Provisioned capacity and commitments; right-sizing without guessing
• Managed databases and their five meters; serverless against always-on
• Non-production environments; budgets, alarms and anomaly detection
• The one-hour monthly cost review; a full month worked from a surprising bill to a fixed one
• Costing a design before you build it; when to stop optimising
Every chapter ends with "when it goes wrong" and a checklist.

[ONLY IF SHIPPED] 5 one-page diagrams (the five shapes, the why-did-it-go-up procedure, data-transfer boundaries, the right-sizing order, the one-hour review) and a template pack (monthly review sheet, tag policy, idle-resource sweep, budget plan, design-costing sheet).

WHO IT IS FOR
The engineer, tech lead or small team that owns an AWS bill they did not entirely design and would like to be able to explain it, including anyone who has just inherited an AWS account.

WHO SHOULD NOT BUY IT
Cloud financial management specialists with a dedicated team and a commitment portfolio; anyone who wants to be told which instance to buy without understanding why; anyone looking for a list of tricks without the reasoning.

HONEST LIMITS
This book contains no prices, rates or free-tier numbers. AWS prices change and differ by region, so any figure printed here would be stale. The book teaches what you are charged for and which decisions change how much you consume; AWS's own pricing pages and Pricing Calculator tell you how much. Other cloud providers are not covered.

FORMAT
Reflowable EPUB, about 15,000 words, readable on a phone or e-reader. [ONLY IF SHIPPED] PDF included.

This is general educational material about cloud cost mechanics, not financial, accounting or procurement advice. This book is independent. It is not affiliated with, endorsed by or sponsored by Amazon Web Services, Inc. or Amazon.com, Inc. "AWS" and the names of individual services are trademarks of their respective owners and are used only to identify the services described.

## 8 tags (each 2 to 19 characters)
1. aws (3)
2. aws cost (8)
3. cloud cost (10)
4. cost optimization (17)
5. aws billing (11)
6. finops (6)
7. devops (6)
8. cloud billing (13)
(Replaces: engineering, infrastructure, serverless, cloud computing, which are broad and low intent.)

## 10 related keywords
reduce aws bill; aws cost optimization; aws billing explained; aws cost explorer guide; cloud cost management; finops for engineers; aws data transfer costs; nat gateway cost; aws cost review checklist; understand aws invoice

## 15 long-tail phrases (hypotheses; no volume data exists)
1. why is my aws bill so high
2. how to read an aws bill
3. how to reduce aws costs for a small team
4. aws cost explorer why did cost go up
5. what is aws data transfer cost
6. nat gateway cost too high
7. aws monthly cost review process
8. aws cost allocation tags how to
9. inherited aws account what to check first
10. aws idle resources to delete
11. aws cost anomaly alert setup
12. right-size ec2 without guessing
13. serverless vs always on cost
14. aws budgets forecast alerts for teams
15. aws cost guide for startups

(The book text itself does not use "EC2", "S3" or "Lambda"; phrases 12 and 13 describe topics the book covers in general terms. If the service names are added to the book, as recommended, these phrases become honest matches.)

## Category
Recommended: Software Development (pick the closest sub-option in the editor; likely candidates are Software Engineering or Web Development; the sub-list was not visible to me and must be confirmed in the Gumroad editor). Second candidate: Business & Money (use only if no Software Development sub-category fits; the angle would then be budgeting and cost control). The company's own mapping file says `software-development/web-development/aws`, which is a company-side path and not proof the Gumroad option exists.

## 5 FAQs
Q: Does the book give me prices or example dollar amounts?
A: No, on purpose. AWS prices change and differ by region, so the book teaches where the money goes and which decisions change the quantity you consume. You look up the current rate for free on AWS's pricing pages.

Q: Do I need to be an AWS expert?
A: No. You need access to your account's billing data (the book explains the permission step) and some familiarity with terms like instance, bucket and region. It is written for engineers and small teams, not for finance specialists.

Q: Is this the same as the AWS documentation or a free checklist?
A: It covers ground that AWS documents, but organises it around five pricing shapes, an order of operations and a monthly routine. It does not replace AWS documentation; it tells you which documentation to read and why.

Q: What format is it? Can I read it on my phone?
A: Reflowable EPUB (about 15,000 words) that works on phones and e-readers. [ONLY IF SHIPPED] A PDF is included.

Q: Is it affiliated with Amazon Web Services?
A: No. It is independent and not affiliated with, endorsed by or sponsored by Amazon Web Services, Inc.

## Refund policy wording (suggestion; the owner decides whether to offer one)
"30-day refund. If this book is not useful for your AWS account, email us within 30 days of purchase and we will refund you in full." (Competitor evidence: Demarko shows a 7-day money-back guarantee on a $9 checklist; Anybody Can AWS shows no policy on its page data. A longer window on a higher price is a trust signal; the cost is refund exposure on a digital file.)

## Price view (current price stays until approved)
- Today's evidence (2026-11-07): single Gumroad AWS cost guides at $29.95 and $29.99 (850+ and 800+ page PDFs), $49 for a 30-page PDF, $9 for a 47-check checklist; bundles $39.99 and $79; Leanpub Efficient Cloud FinOps $43.99. All Gumroad rows have 0 ratings; sales are not visible.
- Recommendation: if the current EPUB ships as is, $24 to $29 is easier to defend. If the corrected edition with PDF, diagrams and a template pack ships, $39 is defensible and bundling the pack as the reason is better than a lower price. Do not claim savings percentages or bestseller status either way.

## Appendix: manuscript corrections to apply before relaunch (do not edit the original; apply in a new edition)
1. Cost Explorer: replace "only accumulates history from the moment it is enabled" (three places) with the AWS-documented behaviour: current month in about 24 hours, about 13 months prepared within days. Keep "enable it before you need it".
2. Tags: replace "activation is not retrospective ... for ever" with "not automatically retrospective; a backfill of up to 12 months can be requested, and only helps if the tag was already on the resource". Keep "activate the day you introduce them".
3. IPv4: add that public IPv4 addresses are charged hourly whether attached or not (since 1 February 2024); extend the idle address sweep to attached addresses.
4. Cost Explorer resource-level daily data exists (opt-in); soften "Cost Explorer stops at service and usage type".
5. Anomaly alerts: "within a day", not "in hours"; note an AWS-services monitor and daily summary are auto-created when Cost Explorer is first enabled; mention Cost Anomaly Detection and budget actions by name.
6. Chapter numbers: add visible numbers and correct references: shapes (file ch04, text says 3), permissions (ch05, text says 4), data transfer (ch08, text says 7), serverless crossing point (ch15, text says 11), log-shipping month (ch19, text says 17), monthly review (ch18, text says 16); fix "Chapters 1 to 4 / 5 to 13 / 14 to 18" and "Eighteen chapters" (19 core chapters).
7. Replace the nonexistent "recommended next book" or link to a real product; confirm the "companion volume on bookkeeping" reference.
8. Small edits: "the vendor own framework" to "the vendor's own framework"; "the chattiest paths crossing them is a cost" to "are".
9. Add: service names and console labels, one usage type example, dated source links, a "checked against AWS documentation on [date]" line.
