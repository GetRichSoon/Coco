# CHANGELOG: Where Your AWS Bill Goes, final manuscript (2026-11-07)

Source text: `03_improved\manuscript_with_diagrams.md`. Output: `manuscript_final.md`. Every source below was opened on 2026-11-07 (source tags S1 to S32 are the ones used in the manuscript; full URLs are in `references.md`). No prices, rates or cost figures were added. The only numbers added are documented time windows and size limits (13 months, 24 hours, 48 hours, 14 days, 30 days, 128 KB, 5,000 resources, 12 months backfill).

Disclaimers kept unchanged: independence / "not affiliated with, endorsed by, approved by or sponsored by Amazon Web Services, Inc."; no financial, accounting or professional advice; no-prices statement; fictional worked month.

Counts: factual corrections 26, wording/overclaim fixes 12, structure/formatting fixes 9, cross-reference fixes 13 (plus 4 new references), additions 11.

## True chapter count

20 numbered body chapters (the original "What this book does not do" is numbered Chapter 1, so the book's own "Chapters 1 to 4 are the foundation" and "chapter 3 = five shapes", "chapter 7 = data transfer" are correct). Plus unnumbered: How to use this book, Conclusion, Recommended next steps and further resources, About the publisher, Copyright. The conclusion said "Eighteen chapters"; the audit's "19 core chapters" counted without the scope chapter. The listing's "25 chapters" claim (not in the manuscript text) is wrong: use 20. Chapter map: 1 What this book does not do, 2 Why cloud bills surprise people, 3 Five things, 4 Reading the bill, 5 Tagging, 6 Accounts, 7 Data transfer, 8 NAT appliance, 9 Idle, 10 Storage, 11 Provisioned capacity and commitments, 12 Right-sizing, 13 Databases, 14 Serverless, 15 Environments, 16 Budgets, 17 Monthly review, 18 Worked month, 19 Costing a design, 20 When to stop.

## 1. Factual corrections

| # | Chapter | BEFORE | AFTER | Evidence (checked 2026-11-07) |
|---|---|---|---|---|
| F1 | How to use (inherited account) | "it only accumulates history from the moment it is enabled and you want that clock started today" | AWS prepares the current month and previous 13 months; current month in about 24 hours, rest a few days longer | S1: "AWS prepares the data about your costs for the current month and the previous 13 months... current month's data is available for viewing in about 24 hours. The rest of your data takes a few days longer." |
| F2 | Ch 4 (Permission) | "Cost Explorer starts accumulating history when it is switched on, so turning it on during an incident gives you a tool with nothing in it" | Paragraph rewritten: Cost Explorer does not start empty; enabling still worth doing before an incident because of the wait | S1 (as F1) |
| F3 | Ch 4 (When it goes wrong) | "the period you chose predates enablement" | data still being prepared; older than previous 13 months; account joined or left an organisation | S1: status within an organisation determines what data is visible; "Cost Explorer updates your cost data at least once every 24 hours" |
| F4 | Ch 4 checklist / Next steps | (no false statement in checklist; the "do it before you need it" advice kept) | Reason corrected as above | S1 |
| F5 | Ch 5 (Tags not activated) | "activation is not retrospective: data before activation stays untagged for ever" | Not automatically retrospective; management account can request a backfill of up to 12 months, once per 24 hours; only helps where the resource already carried the tag | S2: "Management account users can request a backfill of cost allocation tags for up to twelve months"; "The resource tag must be historically assigned"; "once every 24 hours" |
| F6 | Ch 5 (When it goes wrong, 1) | "historical data will not be recovered" | probably not activated, or activated under 24 hours ago; request a backfill | S2, S3 ("All tags can take up to 24 hours to appear") |
| F7 | Ch 5 (When it goes wrong, 4) | "exactly when it is too late to start, because activation is not retrospective" | "exactly when you will wish you had started": urgency softened; months before the tag was on the resource cannot be attributed even with a backfill | S2 |
| F8 | Ch 5 checklist | "activated ... the day it is introduced" | same, plus "(and backfilled if you were late)" | S2 |
| F9 | Ch 5 | (silent on who can activate) | Only the management account or a standalone account can manage cost allocation tags | S3 notes |
| F10 | Ch 9 (inventory) | "Reserved addresses not attached to anything. Charged precisely because they are idle; holding a scarce resource you are not using is the thing being priced." | "Public IPv4 addresses, attached or not": idle Elastic IPs charged, and since 1 February 2024 in-use public IPv4 addresses are charged too | S4: "Effective February 1, 2024 there will be a charge"; applies "whether attached to a service or not"; "all AWS services including" EC2, RDS, EKS. S5: "There is a charge for all Elastic IP addresses whether they are in use ... or idle". S6: in-use and idle public IPv4 charged (rate on that page, not copied) |
| F11 | Ch 3 (Time shape) | "reserved addresses" | "public IPv4 addresses" | S4, S5 |
| F12 | Ch 2 | "the address it kept while it was switched off" | "the public address it kept while it was switched off" | S23: Elastic IP associated with a stopped instance is charged |
| F13 | Ch 17 step 5, checklist ch 9, Next steps, diagram | "idle addresses" | "public IPv4 addresses (attached or not)" | S4, S5 |
| F14 | Ch 4 (When it goes wrong) | "Cost Explorer stops at the service and usage type. Per-resource detail only exists in the Cost and Usage Report." | By default stops at service and usage type; opt-in resource-level daily data (past 14 days, available within 48 hours, top 5,000 resources per service) and EC2 hourly resource data; Data Export for everything | S8 (ce-granular-data, ce-resource-daily) |
| F15 | Ch 4 (three views) + diagram "Per-resource truth lives in the Cost and Usage Report" | "The Cost and Usage Report ... the only place where per-resource truth lives" | Data Exports named; CUR 2.0 recommended, legacy CUR a legacy export type; "most granular data"; diagram text changed | S12: "Cost and Usage Report 2.0 (CUR 2.0) is the new and recommended way to receive your detailed AWS cost and usage data"; legacy data export; exports stored in S3 |
| F16 | How to use, Ch 2, Ch 16, Ch 18, Next steps | "reaches you in hours", "arrives in hours instead of weeks", "hearing it in hours", "converts a month of delay into hours" | "within a day or so"; anomaly detection described with its documented delay | S9: runs about three times a day; Cost Explorer data "has a delay of up to 24 hours. As a result, it can take up to 24 hours to detect an anomaly"; new monitor can take 24 hours |
| F17 | Ch 16 | "Set an anomaly alert" (implied nothing exists) | Check existing monitors: enabling Cost Explorer sets up an AWS services monitor and daily summary subscription; new service needs 10 days of history | S1, S9 |
| F18 | Ch 16 | Budgets described generically | Cost, usage, RI and Savings Plans utilisation and coverage budgets; actual and forecast alerts; email/SNS; budget actions; update up to three times a day; notification delay | S10 |
| F19 | Ch 4 (Permission) | "The account root must explicitly allow IAM access to billing data before any policy grants it" | Kept and made precise: root user "Activate IAM Access" once, policies still required, default on for created member accounts, Cost Anomaly Detection pages and billing APIs outside the setting; Cost Explorer cannot be enabled via API, management account can deny members | S11, S1 |
| F20 | Ch 9 and Ch 12 | "AWS's own recommendation tooling ... is biased towards resizing"; "it recommends resizing, because that is what it can see" | Compute Optimizer named; it also identifies idle resources and covers EC2, EBS, Lambda, RDS, NAT gateway etc.; opt-in; 14 day default window. Blind spot restated as "sees utilisation, not purpose" | S27. The old bias claim was contradicted by this page. |
| F21 | Ch 8 | "'processed' means everything through it, in both directions" | "every gigabyte that passes through it" ("both directions" removed, not documented) | S6: "Data processing charges apply for each gigabyte processed through the NAT gateway" |
| F22 | Ch 8 | "Interface endpoints have their own hourly and per-gigabyte charge"; "gateway endpoints for object and table storage" | Hourly per zone provisioned plus per gigabyte processed; gateway endpoints exist for S3 and DynamoDB, no additional charge | S14, S30, S6 |
| F23 | Ch 7 | "the ordering is stable: within a zone is cheapest, across zones costs, across regions costs more, out to the internet costs most" (diagram: "The ordering is stable even though prices are not") | "usually stable ... rule of thumb, not a guarantee"; AWS statements quoted; diagram subtitle changed to "usually stable; check prices for your regions" | S13 supports: inbound not charged, same-AZ free, cross-AZ and cross-Region typically charged, internet egress per service at Region-specific rates. It does not rank cross-Region against internet, so the ranking is softened |
| F24 | Ch 10 | "Classes that are cheaper to store are more expensive and slower to retrieve, and most have a minimum billable ... duration and ... object size" | S3-specific: IA classes 128 KB billed minimum and 30 days; archive classes longer; retrieval fees; transitions cost a request per object and objects under 128 KB do not transition by default | S16, S15 |
| F25 | Ch 10 | Intelligent tiering "a poor one for huge numbers of tiny ones"; "small monitoring fee per object" | Small monthly monitoring and automation fee, no retrieval charges, objects under 128 KB not monitored | S17, S16. The "poor for tiny objects" judgement was not sourced and was replaced with the documented 128 KB behaviour |
| F26 | Ch 10 | multipart uploads "invisible in the normal listing" | parts stay stored until aborted; AWS recommends an AbortIncompleteMultipartUpload lifecycle rule | S18 ("invisible in listing" not documented in pages opened, removed) |

Also corrected as part of the above: Ch 10 and Ch 9 "defaults in several services keep data indefinitely" now names CloudWatch Logs (S20: "By default, log data is stored in CloudWatch Logs indefinitely") and adds account-level retention policies (minimum 30 days, retroactive mode, dry run, overrides log group setting, 24 hours to take effect). Ch 9 AMI line now says "by default" and mentions the delete-snapshots option (S25). Ch 13 deleted-database snapshots line adds retained automated backups (S28).

## 2. Wording and overclaim fixes (softened)

| # | Where | BEFORE | AFTER | Reason |
|---|---|---|---|---|
| W1 | How to use | "you will be able to take any line on your bill and trace it to the decision that caused it, find the three things driving most of your spend in about an hour" | method / routine "designed to fit in about an hour", "most likely caused" | outcome promise, not verifiable |
| W2 | Ch 12 | "moving to a memory-optimised ... family can halve the cost" | "can cut the cost materially" | figure not sourced |
| W3 | Ch 12 | "Newer instance generations are routinely better value" | "often better value ... (check the pricing page; this book gives no rates)" | not sourced |
| W4 | Ch 12 | "Deletion is the largest saving and this is the second largest" | "usually ... often" | author judgement |
| W5 | Ch 8 | "frequently the largest surprise on a small team's bill" | "can be the largest surprise" | not sourced |
| W6 | Ch 8 | "Resilience guidance says one per zone" | "Resilient designs commonly put one in each zone" | no AWS source opened |
| W7 | Ch 13 | "Databases are frequently the largest single line" | "can be among the largest lines" | not sourced |
| W8 | Ch 13 | storage "grows and does not shrink" in most managed engines; "High availability doubles the instance cost"; "Commercial engines carry licence cost"; "Connection limits frequently scale" | "can be increased but not reduced in place ... check what your engine allows"; "roughly means paying for a second instance"; "Depending on the licensing option"; "can scale" | engine specifics not verified (see could-not-verify) |
| W9 | Ch 15 | "For a great many organisations the single largest avoidable cost is not production" | "a large avoidable share of the bill" | not sourced |
| W10 | Ch 7 | "This is real and worth doing ... saves a fraction" | "can be worth doing ... usually saves a fraction" | not sourced |
| W11 | Ch 1, Conclusion | Pricing pages and calculator "both free" / "they are free, and they are right" | "published by AWS" / "current" | "free" not verified for the Calculator |
| W12 | Ch 14 | "API gateway charged per request, the queue charged per message" | "typically charged" | not opened |

## 3. Structure and formatting fixes

- S1. Chapter headings numbered `# Chapter N. Title` for chapters 1 to 20; front/back matter unnumbered (How to use, Conclusion, Recommended next steps, About the publisher, Copyright last).
- S2. "Chapters 1 to 4 / 5 to 13 / 14 to 18" regrouped to 1 to 4 (foundation), 5 and 6 (attribution), 7 to 15 (where the money is), 16 to 20 (practice).
- S3. "Eighteen chapters" to "Twenty chapters" in the conclusion.
- S4. Five image lines now point to `diagrams/<name>.png`; one-line italic captions Figure 1 to 5 added under each; each stays next to the text it supports.
- S5. Diagram edits (copies in `02 FINAL MANUSCRIPTS\diagrams\`, originals untouched; PNGs re-rendered with headless Chrome and viewed): `boundary_ladder` subtitle softened (F23); `monthly_review` step 5 "idle addresses" to "public IPv4" (F13); `why_did_it_go_up` step 5 title and text changed (F15). `five_shapes` and `right_sizing_tree` unchanged copies. All diagram text is 24 px or larger on a 1200 px canvas (about 9 pt or more at 4.8 in; the originals were built at 24 px and up, and the edited strings keep the same font size).
- S6. Typos: "the vendor own framework" to "the vendor's own framework"; "the chattiest paths crossing them is" to "are".
- S7. Removed the repeated "The thing worth remembering above all" heading in the Conclusion (kept in Chapter 20); now "The idea underneath all four".
- S8. "A recommended next book" section removed (the book does not exist) and replaced by "If you reread two chapters".
- S9. "the companion volume on bookkeeping" removed (different product, not confirmed).

## 4. Cross-reference fixes

Full script listing in `crossref_check.md`. Fixed (original number to new): Chapter 6 (tags) to 5; chapter 5 (reading the bill) to 4, six places (How to use, Ch 2 twice, Ch 6, Ch 16, Ch 17); Chapter 12 (commitments) to 11; chapter 11 (serverless crossing point) to 14; chapter 17 (worked month, conclusion) to 18; chapter 16 (review, next steps) to 17; "Chapters 5 to 13" to "7 to 15"; "Chapters 14 to 18" to "16 to 20". Already correct under the new numbering and kept: chapter 3 (shapes, scope chapter), chapter 7 (data transfer, two places), chapter 4 (permissions, How to use), "Chapters 1 to 4". New references added (4 in the script listing): chapters 5 and 6 (attribution), chapter 17 (IPv4 sweep), chapters 7 and 14 (reread). Nine textual references ("the next chapter", "the tagging chapter", "the chapter on idle resources" and so on) were checked by hand and are correct.

## 5. Additions (each sourced; none contains a price)

- A1. "How the facts in this book were checked" (dated 2026-11-07) with source tags, and "Sources checked on 2026-11-07" at the end (also `references.md`).
- A2. New section "Public IPv4 addresses, in use or not" in Chapter 9: what changed on 1 February 2024, Public IP Insights (S4), releasing idle Elastic IPs (S5), unassigning an instance's public IP (S7), pointer to the rate page without quoting it.
- A3. S3 (Ch 3, 10): storage classes, 128 KB and 30 day minimums, lifecycle, noncurrent versions, abort incomplete multipart uploads, Intelligent-Tiering (S15 to S19).
- A4. EC2 and EBS (Ch 3, 9, 15): per-second billing, EBS storage charged by GB provisioned, stopped instances keep EBS and Elastic IP charges, AMI snapshots, scheduling options (S23 to S26, S31).
- A5. Lambda (Ch 14): duration and memory, proportional CPU, provisioned concurrency, data transfer, Compute Optimizer for Lambda (S22, S27).
- A6. CloudWatch (Ch 3, 10, 14, 16): log charges (collection, storage, analysis), retention per log group and account-level policies, alarms are charged (S20, S21).
- A7. Data Exports and Compute Optimizer named (Ch 4, 9, 12; S12, S27).
- A8. Budgets utilisation and coverage budgets linked to the commitment-expiry advice (Ch 11, 16; S10).
- A9. Savings Plans definition and Compute Savings Plans flexibility (Ch 11; S29).
- A10. Ch 1 and How to use: note that services are named and that a few documented limits and windows appear, so the "no prices" rule stays truthful.
- A11. Copyright page: "checked against AWS documentation on 2026-11-07" line.

## 6. Verified-claims table (opened 2026-11-07)

| Claim in the book | Status | Source |
|---|---|---|
| Cost Explorer prepares current month plus previous 13 months; current month in about 24 hours | VERIFIED | S1 |
| Cost Explorer cannot be enabled via API; management account can deny members; history does not follow organisation changes | VERIFIED | S1 |
| Enabling Cost Explorer auto-configures Cost Anomaly Detection (AWS services monitor, daily summary) | VERIFIED | S1 |
| Tag activation needed; up to 24 hours to appear | VERIFIED | S3 |
| Tag backfill up to 12 months, management account, tag must be on resource, once per 24 hours | VERIFIED | S2 |
| Public IPv4 charged from 1 Feb 2024 attached or not, across AWS services | VERIFIED | S4 |
| Elastic IPs charged in use or idle; charged on a stopped instance | VERIFIED | S5, S23 |
| In-use and idle public IPv4 charged (VPC pricing) | VERIFIED | S6 |
| Public IP Insights is a no-cost VPC IPAM feature | VERIFIED (per AWS blog) | S4 |
| Resource-level data opt-in: daily (past 14 days, 48 hours, top 5,000) and EC2 hourly | VERIFIED | S8 |
| Cost Anomaly Detection about three times daily, up to 24 hours delay, new monitor 24 hours, 10 days history for new service | VERIFIED | S9 |
| Budgets types, forecast alerts, email/SNS, actions, 3 updates a day, notification delay | VERIFIED | S10 |
| Activate IAM Access by root, policies also needed, member account default, exclusions | VERIFIED | S11 |
| Data Exports, CUR 2.0 recommended, legacy export, S3 delivery | VERIFIED | S12 |
| Inbound free; same-AZ free; cross-AZ and cross-Region typically charged; internet egress per service | VERIFIED | S13 |
| NAT gateway hourly plus per GB processed | VERIFIED | S6 |
| Interface endpoints hourly per zone plus per GB; gateway endpoints (S3, DynamoDB) no additional charge | VERIFIED | S14, S30, S6 |
| S3: IA 128 KB and 30 day minimums; Glacier minimum durations; transition request per object; 128 KB default no-transition | VERIFIED | S15, S16 |
| S3 Intelligent-Tiering small monthly fee per object, no retrieval charges, under 128 KB not monitored | VERIFIED | S16, S17 |
| Incomplete multipart upload parts stored until aborted; lifecycle rule recommended | VERIFIED | S18 |
| Versioned buckets: noncurrent versions need a lifecycle rule; delete adds a delete marker | VERIFIED | S19 |
| CloudWatch Logs indefinite by default; per-group and account-level retention (30 day minimum, retroactive, dry run, 24 hours) | VERIFIED | S20 |
| CloudWatch charges for log collection, storage, analysis; alarms and metrics charged | VERIFIED (first 100,000 of 154,000 characters of the page read; no rates used) | S21 |
| Lambda: requests and duration, memory with proportional CPU, provisioned concurrency billed for amount and period, transfer at standard rates | VERIFIED | S22 |
| Stopped EC2 instance: no instance charge, EBS charged | VERIFIED | S23 |
| EC2 scheduling options incl. Auto Scaling terminates | VERIFIED | S24 |
| AMI deregistration leaves snapshots (default) | VERIFIED | S25 |
| EBS volumes charged by GB provisioned until released | VERIFIED (page does not say "unattached" outright) | S31, S26 |
| Compute Optimizer identifies idle resources, covers EC2/EBS/Lambda/RDS/NAT, opt-in, 14 days | VERIFIED | S27 |
| Deleted RDS instance leaves manual snapshots; retained backups billed | VERIFIED | S28 |
| Savings Plans: per-hour commitment, 1 or 3 years; Compute SP covers EC2, Fargate, Lambda | VERIFIED | S29 |
| Well-Architected Cost Optimization pillar exists | VERIFIED | S32 |

### Could not verify (softened or flagged in the text)

- Storage in managed databases cannot shrink in place; HA roughly doubles cost; licence cost in hourly rate; connection limits scale with instance size; backup allowance (all hedged, Ch 13). No RDS pricing or storage pages were opened.
- NAT gateway "one per zone" resilience guidance (hedged to "commonly").
- Ranking of cross-Region against internet egress (softened to rule of thumb).
- Commitments (reserved instances, Savings Plans) "can apply across the organisation" under consolidated billing (Ch 6, Ch 11): not opened this session; kept as "can". Owner may want it checked before relaunch.
- Throttling "per partition or per shard" (Ch 11, 13): general DynamoDB-style behaviour, no page opened; wording left as the author's general pattern.
- "Some managed services cannot be stopped, only deleted" (Ch 15), "burst credits" (Ch 12): not opened; hedged by "some".
- API gateway per-request and queue per-message charging (Ch 14): marked "typically".
- AWS Pricing Calculator: not opened (only that a Billing console page lists it); mentioned as a tool with no claims.
- Whether the EBS pricing page says "attached or not": it does not; the text relies on "charged by provisioned GB until released" plus the "available" state wording.

## 7. Items the owner must decide

- Listing text outside this book still says "25 chapters"; the true figure is 20 numbered chapters.
- The new Sources section adds roughly 1,000 words and 32 external links; confirm the PDF/EPUB builder handles URLs, or drop the section but keep the [S] tags (the table is in `references.md`).
- Commitments across the organisation (see could-not-verify) and the RDS statements could be verified in a short follow-up pass.
