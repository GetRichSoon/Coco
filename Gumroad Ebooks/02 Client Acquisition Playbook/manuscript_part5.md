# Appendix A. Ethics, consent, anti spam rules and platform rules

This appendix is general information, not legal advice. Rules on marketing messages and personal data differ by country, by the type of recipient (company or individual) and by channel. If you contact people in several countries, check each one or ask a qualified adviser.

## Principles for honest outreach

- Say who you are and why you are writing.
- Never use a false name, a fake "Re:" subject line, or a made up connection.
- Make claims you can prove. Label examples as examples.
- Write to people who plausibly have the problem, not to everyone.
- Make it easy to say no, and respect it immediately.
- Collect and keep only the personal data you need, and delete it when you no longer need it.

## United States: CAN-SPAM

The US Federal Trade Commission's compliance guide for business (accessed 2026-11-07) says the law applies to commercial email, and that it makes no exception for business to business email. It lists these requirements:

- Header information must be accurate and identify the sender.
- Subject lines must not be deceptive.
- The message must be identified as an advertisement.
- The message must include a valid physical postal address.
- The message must tell recipients how to opt out of future email.
- Opt out requests must be honoured within 10 business days, and the opt out mechanism must work for at least 30 days after sending.
- You remain responsible for email sent on your behalf by another company.

The page states penalties of up to 53,088 US dollars per separate email in violation. Read the full guide at the FTC link in Appendix E. A practical footer for a cold email:

```
Tom Reed, Reed Books, 12 Example Road, Anytown, AB1 2CD.
If you would rather not hear from me, reply "stop" and I
will not write again.
```

## European Union and United Kingdom

The European Commission's data protection page (accessed 2026-11-07) describes the General Data Protection Regulation as the EU's main data protection law. It covers any information relating to an identified or identifiable living individual, so a named business contact's email address is personal data. It says organisations must process personal data lawfully, fairly and transparently, for specified purposes, collect no more than needed, keep it only as long as necessary, keep it accurate and secure, and be accountable. Individuals have rights including to be informed, to access, correct and erase their data, to object, and to restrict processing. It applies to organisations in the EU and to organisations outside the EU that offer goods or services to people in the EU or monitor their behaviour. Small businesses must comply too, though some obligations can be lighter.

Separate rules govern electronic marketing messages in the EU and the UK. In the UK these are the Privacy and Electronic Communications Regulations (PECR), enforced by the Information Commissioner's Office (ICO). The ICO pages I tried to open (accessed 2026-11-07) returned an access error, so I cannot quote them. Search summaries of the ICO's business to business marketing guidance describe a difference between corporate subscribers (such as limited companies) and individual subscribers (such as sole traders and some partnerships), with stricter consent rules for individuals, and a recommendation to keep a suppression list of people who object. Treat that as a pointer, not a statement of the law. Read the current ICO guidance to PECR and direct marketing yourself before sending marketing email to anyone in the UK, and check the equivalent rules of each EU country before writing to EU recipients.

## Platform rules: LinkedIn

I opened two LinkedIn help pages (accessed 2026-11-07): "Prohibited software and extensions" and "Automated activity on LinkedIn". They say LinkedIn does not allow third party software, including bots and browser extensions, that scrapes data, changes how the site looks or automates activity, and that using such tools is a violation of the User Agreement. LinkedIn warns that accounts can be restricted or closed and that tools may stop working without notice. This book therefore recommends only manual outreach on LinkedIn and does not recommend scraping or automation tools, including ones that advertise themselves as safe.

Other platforms have their own rules. Read them before you use the platform for outreach, and follow community rules in forums and groups.

## Practical compliance checklist

- [ ] I identify myself truthfully in every message.
- [ ] I include a way to opt out and a postal address or business identification where required.
- [ ] I honour opt outs at once and keep a do not contact list.
- [ ] I know the rule for the country and type of recipient I am writing to.
- [ ] I store contact data securely and delete it when no longer needed.
- [ ] I do not use scraped or bought lists.
- [ ] I do not automate activity on platforms that forbid it.

# Appendix B. CRM spreadsheet structure

A spreadsheet is enough for a solo practice. It works in Excel and Google Sheets. Create four sheets: Leads, Dashboard, Lists and DoNotContact.

## Sheet 1: Leads

Row 1 holds headers. Data starts in row 2.

| Col | Header | Notes |
|---|---|---|
| A | ID | L001, L002, ... |
| B | Name | Contact person |
| C | Company | |
| D | Role | |
| E | Source | Validation list (below) |
| F | Stage | Validation list (below) |
| G | Date contacted | Date format |
| H | Date replied | |
| I | Date call held | |
| J | Date proposal sent | |
| K | Date won | |
| L | Deal value | Number |
| M | Next action | Short text |
| N | Next action date | Date |
| O | Fit score | Whole number 0 to 20 |
| P | Notes | |

### Example rows (fictional)

```
L001 | Priya Shah | Studio Arc  | Principal | Referral   | Won
  contacted 2026-09-01, replied 09-01, call 09-04,
  proposal 09-06, won 09-10 | 1800 | - | - | 17
L002 | Ellis Wong | Ridgeline   | Director  | Cold email | Proposal sent
  contacted 2026-10-05, replied 10-07, call 10-12,
  proposal 10-14 | 3600 | Follow up F6 | 2026-10-21 | 16
L003 | Hana Ito   | Northgate   | Manager   | LinkedIn   | Contacted
  contacted 2026-10-30 | 1200 | F1 nudge | 2026-11-03 | 11
```

## Sheet 3: Lists (for data validation)

Put one list per column, with a header in row 1.

- **Column A, Stage:** New, Contacted, Replied, Call booked, Call held, Proposal sent, Won, Lost, Nurture.
- **Column B, Source:** Referral, Past client, Cold email, LinkedIn, Community, Event, Content, Inbound.
- **Column C, Loss reason:** Price, Timing, Fit, No response, Chose other, Other.

## Data validation (both Excel and Google Sheets)

- **Stage (F2:F500):** list from range `=Lists!$A$2:$A$10`. In Excel: Data, Data Validation, Allow List. In Google Sheets: Data, Data validation, Dropdown from a range.
- **Source (E2:E500):** list from `=Lists!$B$2:$B$9`.
- **Fit score (O2:O500):** whole number between 0 and 20.
- **Date columns (G:K and N):** date validation, reject text.

## Sheet 2: Dashboard

Labels in column A, formulas in column B. The formulas below use only functions that exist with the same name and argument order in Excel and Google Sheets: COUNT, COUNTIFS, SUMIFS, IFERROR and TODAY.

| Cell | Label | Formula |
|---|---|---|
| B2 | Contacted | `=COUNT(Leads!G2:G500)` |
| B3 | Replied | `=COUNT(Leads!H2:H500)` |
| B4 | Calls held | `=COUNT(Leads!I2:I500)` |
| B5 | Proposals sent | `=COUNT(Leads!J2:J500)` |
| B6 | Won | `=COUNT(Leads!K2:K500)` |
| B7 | Reply rate | `=IFERROR(B3/B2,0)` |
| B8 | Reply to call | `=IFERROR(B4/B3,0)` |
| B9 | Call to proposal | `=IFERROR(B5/B4,0)` |
| B10 | Proposal win rate | `=IFERROR(B6/B5,0)` |
| B11 | Overall rate | `=IFERROR(B6/B2,0)` |
| B12 | Value won | `=SUMIFS(Leads!L2:L500,Leads!F2:F500,"Won")` |
| B13 | Overdue actions | see below |
| B14 | Average deal | `=IFERROR(B12/B6,0)` |
| B15 | Cold email reply rate | see below |

Overdue actions (B13):

```
=COUNTIFS(Leads!N2:N500,"<"&TODAY(),
 Leads!F2:F500,"<>Won",Leads!F2:F500,"<>Lost")
```

Cold email reply rate (B15):

```
=IFERROR(COUNTIFS(Leads!E2:E500,"Cold email",
 Leads!H2:H500,"<>")/COUNTIFS(Leads!E2:E500,
 "Cold email",Leads!G2:G500,"<>"),0)
```

Enter each formula on one line. Format B7 to B11 and B15 as percentages. Counting dates rather than stages means that a lead that moves on still counts at every earlier step.

**How I checked them:** I built a test workbook with five invented leads, entered these formulas, recalculated it in LibreOffice (not in Excel or Google Sheets) and compared the results with hand counts: contacted 5, replied 3, calls 2, proposals 2, won 1, reply rate 0.6, overall 0.2, value won 3,000, overdue 1, cold email reply rate 0.667. All matched. Excel and Google Sheets use the same function names and argument order for these functions, but I did not run them there. Test them on a few rows before relying on them. The data validation settings were not tested.

## Sheet 4: DoNotContact

Columns: name, email or profile, date asked to stop, channel. Check every new lead against this sheet before sending.

## Rules

- One row per person. Update the same day.
- Every open lead has a next action and a date.
- Do not delete lost rows; filter them out. They are your data.

# Appendix C. Templates index

| Code | Name | Chapter |
|---|---|---|
| O1 | Referral ask to a happy client | 6 |
| O2 | Warm introduction request | 6 |
| O3 | Forwardable introduction blurb | 6 |
| O4 | Past client reactivation | 6 |
| O5 | Community reply that offers help | 6 |
| O6 | Event or meeting follow up | 6 |
| O7 | Trigger based opener | 7 |
| O8 | Observation about a visible problem | 7 |
| O9 | Mini audit offer | 7 |
| O10 | Short case note | 7 |
| O11 | Permission question | 7 |
| O12 | Partner or agency to agency note | 7 |
| O13 | Genuine mention of a shared connection | 7 |
| O14 | Hiring signal opener | 7 |
| O15 | LinkedIn connection note | 8 |
| O16 | Follow up after connection accepted | 8 |
| O17 | Comment to message bridge | 8 |
| O18 | Post event note | 8 |
| O19 | Reply to a buyer signal post | 8 |
| O20 | Move to a call, politely | 8 |
| C1 | Inbound lead call | 10 |
| C2 | Referral call | 10 |
| C3 | Cold reply call | 10 |
| C4 | Price first buyer | 10 |
| C5 | Existing client expansion | 10 |
| C6 | Networking contact | 10 |
| C7 | Multiple decision makers | 10 |
| C8 | Burned by a previous provider | 10 |
| C9 | Early stage "just exploring" | 10 |
| C10 | Reactivated past client | 10 |
| P1 | One page proposal | 12 |
| P2 | Three option proposal | 12 |
| P3 | Problem, solution, proof proposal | 12 |
| P4 | Phased proposal with paid first step | 12 |
| P5 | Retainer proposal | 12 |
| F1 | First gentle nudge | 14 |
| F2 | Value add follow up | 14 |
| F3 | Breakup message | 14 |
| F4 | After call, before proposal | 14 |
| F5 | Two days after proposal | 14 |
| F6 | Seven days after proposal | 14 |
| F7 | Revive a silent proposal | 14 |
| F8 | Verbal yes, awaiting signature | 14 |
| F9 | After a no | 14 |
| F10 | Scheduled resurface after "not now" | 14 |

Worksheets: ICP worksheet (Chapter 3), offer statement (Chapter 4), case note (Chapter 5), qualification worksheet (Chapter 11), pricing calculations (Chapter 13), lead tracking system (Chapter 14), CRM structure (Appendix B), 30 day roadmap (Chapter 15).

# Appendix D. Glossary

**Authority:** the power to approve and pay for a purchase.

**Breakup message:** a final polite follow up that closes a sequence.

**Buyer:** the person who pays or approves the budget; may differ from the user.

**CAN-SPAM:** the United States law on commercial email.

**Cold outreach:** a first message to someone who has not asked to hear from you.

**Conversion rate:** the share of people who move from one pipeline stage to the next.

**CRM:** customer relationship management; here, a spreadsheet that tracks leads and next actions.

**Discovery call:** a conversation to understand a prospect's problem, budget and fit.

**GDPR:** the EU General Data Protection Regulation.

**ICP:** ideal customer profile; the written description of the best fit buyer.

**Inbound lead:** a prospect who contacted you first.

**Lead:** a named person at a business who fits your ICP and can be contacted honestly.

**Lead magnet:** a free resource offered in exchange for contact details.

**Niche:** a specific group of buyers sharing a problem you can solve.

**Nurture:** keeping contact with a lead who is not ready, on a dated schedule.

**Offer:** a specific result, scope, timeline and price structure for a defined buyer.

**Opt out:** a request to stop receiving messages.

**Pipeline:** the set of leads at each stage between first contact and a signed deal.

**Productised service:** a service sold with a fixed scope and price.

**Proposal:** a document or presentation that sets out the approach, scope, price and terms.

**Qualification:** judging whether a lead is a good fit before investing in a proposal.

**Retainer:** a recurring fee for ongoing work or availability.

**Scope creep:** work expanding beyond what was agreed without a change in price.

**Trigger:** an observable event that makes a problem urgent.

**Value pricing:** setting a fee relative to the benefit the client expects.

# Appendix E. References and further reading

All pages below were opened on 2026-11-07 unless noted.

- Federal Trade Commission, CAN-SPAM Act: A Compliance Guide for Business. https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business (accessed 2026-11-07). Supports the CAN-SPAM requirements, the B2B statement and the penalty figure in Appendix A.
- European Commission, Data protection explained. https://commission.europa.eu/law/law-topic/data-protection/data-protection-explained_en (accessed 2026-11-07). Supports the description of GDPR scope, principles and individual rights.
- LinkedIn Help, Prohibited software and extensions. https://www.linkedin.com/help/linkedin/answer/a1341387 (accessed 2026-11-07). Supports the statement that LinkedIn prohibits bots and browser extensions that scrape or automate.
- LinkedIn Help, Automated activity on LinkedIn. https://www.linkedin.com/help/linkedin/answer/90586 (accessed 2026-11-07). Supports the same rule and the account restriction process.

Not opened: the UK ICO guidance pages (https://ico.org.uk) returned an access error on 2026-11-07. Readers should read the ICO's current PECR and direct marketing guidance directly.
