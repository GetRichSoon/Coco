# Chapter 5. Email and customer communication

Email is where tone mistakes cost money. Use AI for structure and speed, then read every message as the customer would.

**The tone ladder.** Decide the tone before you prompt. Four settings cover most business email: *warm and brief* (routine replies), *formal and precise* (contracts, invoices), *firm and calm* (late payment, boundaries), and *apologetic and practical* (something went wrong). Put the chosen setting in the prompt in one line, for example "Tone: firm and calm; no threats; keep the deadline."

**Before and after (illustrative).**
Draft: "As per my previous email, you still have not paid. This is unacceptable."
Revised: "Hi Sam, invoice 1042 for £180 was due on 1 November and is still open. Could you pay by Friday 14 November, or tell me if there is a problem? Thank you."
What changed: the facts (invoice, amount, dates) stayed; the blame went; a clear next step appeared.

**One rule for every email:** the assistant may draft, but it never sends. You press send.

## Workflow 11. Welcome Email Sequence

**Problem:** New subscribers or customers hear nothing, or get one generic email.
**Outcome:** A 4-email welcome sequence with clear purpose per email.
**Tools:** ChatGPT, your email tool.

**Steps**
1. Paste your context block and your real offer.
2. Run the prompt.
3. Replace placeholders; add real links.
4. Load into your email tool and test-send to yourself.

**Prompt**
```
[PASTE BUSINESS CONTEXT BLOCK]
Write a 4-email welcome sequence for new [SUBSCRIBERS/CUSTOMERS]. For each: day to send, subject line (under 50 characters), purpose, body under 150 words, one call to action. Email 1: thank and set expectations. Email 2: useful tip. Email 3: how customers use our [PRODUCT]. Email 4: gentle offer: [REAL OFFER]. No fake urgency, no invented testimonials.
```

**Example output:** Four short emails, each with one CTA, e.g. "Subject: Your first order, simplified".

**Verify:** Links, offer terms and dates are real. Unsubscribe link and sender details are present as your local law requires.
**Mistakes:** Fake scarcity ("only 2 left") (fix: only say true things). Long emails (fix: one idea each).

## Workflow 12. Customer Email Reply Drafter

**Problem:** Inbox replies take hours.
**Outcome:** Accurate, polite draft replies in two minutes each.
**Tools:** ChatGPT, your policies.

**Steps**
1. Remove personal identifiers from the customer's email.
2. Paste with your facts (policy, price, dates).
3. Edit the draft, restore the name, send.

**Prompt**
```
[PASTE BUSINESS CONTEXT BLOCK]
Draft a reply to this customer email. Use ONLY these facts: [POLICY/PRICE/DATES]. If the email asks about something not in my facts, write "[NEED INFO: ...]" instead of guessing. Tone: warm, brief, under 120 words.
CUSTOMER EMAIL (names removed): [PASTE]
```

**Example input:** "Can I change my order date? It's for Saturday." Facts: changes free up to 48 hours before.
**Example output:** "Thanks for getting in touch. Yes, we can change the date free of charge up to 48 hours before collection. Which new date works? [NEED INFO: confirm availability]".

**Verify:** Every fact in the reply is from your list. NEED INFO tags are resolved.
**Mistakes:** Letting the assistant promise refunds or deadlines (fix: facts list only).

## Workflow 13. Newsletter from Rough Notes

**Problem:** You have notes but no time to write the newsletter.
**Outcome:** A structured newsletter draft in your voice.
**Tools:** ChatGPT.

**Steps**
1. Dump rough bullets: news, a tip, one offer.
2. Run the prompt.
3. Edit for voice and truth; add links.

**Prompt**
```
[PASTE BUSINESS CONTEXT BLOCK]
Turn my notes into a newsletter: subject line options (3), a 2-sentence opening, three short sections with headings, one call to action. Under 300 words. Use only the facts in my notes.
NOTES: [PASTE]
```

**Example output:** Three subject options, an opening, sections ("This month", "One tip", "Offer").

**Verify:** Dates, prices and links. Remove anything you did not say.
**Mistakes:** Adding extra claims (fix: "use only my notes").

## Workflow 14. Difficult Message Tone Check

**Problem:** A complaint, late payment or refusal needs care.
**Outcome:** A calm, firm message that protects the relationship.
**Tools:** ChatGPT.

**Steps**
1. Write your honest first draft, even if blunt.
2. Run the prompt.
3. Read the final aloud.
4. Check with a second person for serious cases.

**Prompt**
```
Here is my draft message and the situation. Rewrite it to be polite, clear and firm. Keep all factual statements and deadlines unchanged. Do not add apologies I did not intend or promises I did not make. Then list any sentences that could be read as threatening or legally risky.
SITUATION: [SHORT]
DRAFT: [PASTE]
```

**Example output:** A calmer version plus a note: "'We will take action' may sound like a threat; consider naming the exact step."

**Verify:** Facts, amounts and dates unchanged. Legal or contractual issues go to a qualified professional.
**Mistakes:** Letting AI soften a deadline (fix: check dates). Sending in anger (fix: wait an hour).

---

# Chapter 6. Sales prospecting and lead-generation workflows

Use these for **genuine, relevant outreach** to people who plausibly need your service. Follow the rules that apply to you for email, messaging and data protection in your country. Never scrape personal data in ways a platform forbids.

**Keep a simple tracker.** Outreach only works when you can see what you did. Use one spreadsheet with these columns: *Name or company | Role | Source of the real detail | Date first contacted | Message version | Follow-up 1 date | Follow-up 2 date | Follow-up 3 date | Reply (yes/no/stop) | Next action*. Set a daily cap you can personally review, for example five to ten messages. If you cannot read every message before it goes, you are sending too many.

**Measure what you can.** After 30 messages, count how many replied and which message version they replied to. Ask the assistant to compare two versions only using your counts, and treat small numbers as a hint, not a conclusion.

## Workflow 15. Ideal Lead Profile and Search Criteria

**Problem:** You contact random people, so replies are rare.
**Outcome:** A one-page lead profile and a checklist for qualifying leads.
**Tools:** ChatGPT, your best past customers.

**Steps**
1. Describe 3 to 5 of your best customers (no private data).
2. Run the prompt.
3. Turn the result into a spreadsheet checklist.

**Prompt**
```
From these descriptions of my best customers, create an ideal lead profile: industry, size, trigger events that create need, roles to contact, signs they are a good fit, signs to avoid. Then give 10 qualifying questions. Mark anything you assumed as "ASSUMED".
CUSTOMERS: [DESCRIBE]
```

**Example output:** Profile: "Offices of 10 to 50 staff, event trigger: staff birthdays or client visits. Contact: office manager. Avoid: one-off buyers without repeat potential."

**Verify:** Compare with your real sales history. Remove ASSUMED lines you cannot support.
**Mistakes:** Profile too broad (fix: add one more filter).

## Workflow 16. Personalized Outreach Draft

**Problem:** Templates feel spammy; fully custom messages take too long.
**Outcome:** A short message personalized with one real detail.
**Tools:** ChatGPT, a real fact about the prospect from their public page.

**Steps**
1. Find one relevant public fact (recent post, new location).
2. Paste with your offer.
3. Edit so it sounds like you; send manually.

**Prompt**
```
Write a first outreach message, under 90 words, to [ROLE] at [COMPANY TYPE]. Use this real detail about them: [FACT]. Offer: [WHAT I DO AND WHY IT MIGHT HELP]. One clear low-pressure question at the end. No flattery, no false claims, no pretending we have met.
```

**Example output:** "Hi Priya, I saw your team just moved to a new office. We make boxed celebration cakes for small teams. Would a sample box for your move-in week be useful?"

**Verify:** The detail is accurate. The message is honest and relevant. You comply with local rules on unsolicited messages.
**Mistakes:** Fake familiarity (fix: only real details). Mass-sending without review (fix: send in small batches).

## Workflow 17. Follow-Up Sequence

**Problem:** You send one message and give up.
**Outcome:** Three polite follow-ups at sensible intervals.
**Tools:** ChatGPT, spreadsheet.

**Steps**
1. Paste your first message.
2. Run the prompt.
3. Record send dates in your tracker; stop if they decline.

**Prompt**
```
Based on my first message below, write 3 follow-ups: day 3, day 7, day 14. Each under 60 words, each adds something new (a helpful tip, a question, a graceful close). The last one makes it easy to say no. No guilt, no fake deadlines.
FIRST MESSAGE: [PASTE]
```

**Example output:** Follow-up 3: "Last note from me. If this isn't a priority, no problem at all, and I'll leave it there."

**Verify:** Honors opt-outs. No new claims you cannot support.
**Mistakes:** Continuing after "no" (fix: stop immediately).

## Workflow 18. Call Prep Brief and Post-Call Summary

**Problem:** You go into calls unprepared and forget follow-ups.
**Outcome:** A one-page brief before and a clean summary after.
**Tools:** ChatGPT, your call notes.

**Steps**
1. Before: paste what you know; get questions and risks.
2. After: paste your rough notes.
3. Send the summary to the client after checking.

**Prompt (before)**
```
I have a call with [ROLE/COMPANY TYPE]. Known: [NOTES]. Give me: goal for the call, 8 discovery questions, 3 likely objections with honest answers, and what I should not promise.
```
**Prompt (after)**
```
Turn these call notes into a summary email: what was discussed, what was agreed, next steps with owners and dates, open questions. Use only my notes. Mark gaps as [CONFIRM].
NOTES: [PASTE]
```

**Example output:** Summary with "Next step: send sample list by Friday (me)" and "[CONFIRM: delivery address]".

**Verify:** Agreed items match what was actually said. Confirm all [CONFIRM] tags.
**Mistakes:** Recording calls without consent (fix: ask first and follow local law).

---

# Chapter 7. Customer service and FAQ automation

"Automation" here means faster, more consistent human replies, not an unsupervised bot. If you do use an automated chat on your site, test it heavily and tell users they are talking to automation where required.

**Where AI should not answer customers alone.** Keep a person in charge of refunds and compensation, safety, allergy, health or legal questions, complaints that mention a regulator or lawyer, and any message from someone who seems distressed. Write this list down in your reply macros so a helper knows when to stop and escalate.

**Maintain the knowledge base.** An FAQ or macro library goes out of date quickly. Once a month, spend 20 minutes: paste the last month's new questions, ask the assistant which are not covered by your FAQ, add approved answers yourself, and update the "last reviewed" date.

## Workflow 19. FAQ Builder

**Problem:** The same questions arrive daily.
**Outcome:** A clear FAQ page with approved answers.
**Tools:** ChatGPT, your last 30 customer questions.

**Steps**
1. List repeated questions (anonymized).
2. Add the true answer for each.
3. Run the prompt.
4. Publish after review.

**Prompt**
```
Create an FAQ for [BUSINESS] from these questions and my approved answers. Group by topic. Keep each answer under 60 words, plain English, using only my answers. If an answer is missing, write "[NEED ANSWER]".
QUESTIONS AND ANSWERS: [PASTE]
```

**Example output:** "Delivery. How fast? Orders ship within 2 working days."

**Verify:** Each answer matches your current policy. Update the date.
**Mistakes:** Letting AI fill missing answers (fix: NEED ANSWER tags).

## Workflow 20. Reply Macro Library

**Problem:** Support replies vary in quality.
**Outcome:** 10 to 15 reusable reply templates with variables.
**Tools:** ChatGPT, helpdesk or notes app.

**Steps**
1. List the 10 most common reply situations.
2. Run the prompt.
3. Store templates; fill variables each time.

**Prompt**
```
Create reply templates for these situations: [LIST]. Each: name, when to use, template under 100 words with [VARIABLES], and a "check before sending" line. Use my policies only: [POLICIES].
```

**Example output:** "Late delivery | Use when courier delay | 'Sorry your order is late...' | Check: tracking status."

**Verify:** Every promise in a template is one you can keep.
**Mistakes:** Templates that sound robotic (fix: add one personal line each time).

## Workflow 21. Complaint Triage and Response Plan

**Problem:** Angry messages are stressful and easy to mishandle.
**Outcome:** A calm analysis, a draft reply and an internal action list.
**Tools:** ChatGPT.

**Steps**
1. Remove names; paste the complaint and facts.
2. Run the prompt.
3. Decide the remedy yourself.
4. Send, then log the lesson.

**Prompt**
```
Analyze this complaint. 1) What happened, what the customer wants, severity (low/medium/high) with a reason. 2) A draft reply under 130 words that acknowledges the issue without admitting facts I have not confirmed. 3) Internal actions. Facts I confirmed: [FACTS]. Remedy I am willing to offer: [REMEDY].
COMPLAINT: [PASTE]
```

**Example output:** Severity medium; reply offers the confirmed remedy; internal action: check packaging process.

**Verify:** Reply offers only what you decided. Serious safety, legal or health matters go to a professional.
**Mistakes:** Admitting liability by accident (fix: stick to confirmed facts).

---

# Chapter 8. Business administration and documentation

Admin work is full of documents that follow a pattern: minutes, proposals, role descriptions, policies. Patterns are where AI helps most. The risk is that documents carry commitments (money, dates, legal duties), so numbers and terms must always come from you. A good habit is to give every document a consistent name and a version date (for example "Proposal Brightleaf v2 2026-11-07") and to save the prompt that produced it beside it, so you can reproduce or improve it later.

## Workflow 22. Meeting Notes to Action Items

**Problem:** Meetings end with no clear owners.
**Outcome:** A summary with decisions, actions, owners and dates.
**Tools:** ChatGPT, notes or a transcript you have permission to use.

**Steps**
1. Paste notes (no confidential content beyond what is needed).
2. Run the prompt.
3. Send for correction by attendees.

**Prompt**
```
From these notes produce: decisions made, action items (task | owner | due date), open questions, next meeting topics. If an owner or date is missing, write [UNASSIGNED] or [NO DATE]. Do not guess.
NOTES: [PASTE]
```

**Example output:** "Order new boxes | Sam | 14 Nov", "Review pricing | [UNASSIGNED] | [NO DATE]".

**Verify:** Attendees confirm decisions.
**Mistakes:** Guessing owners (fix: keep UNASSIGNED tags).

## Workflow 23. Proposal and Quote Draft

**Problem:** Proposals take too long and vary in quality.
**Outcome:** A clear, structured proposal with scope and exclusions.
**Tools:** ChatGPT.

**Steps**
1. List client needs, scope, price and terms from your own decisions.
2. Run the prompt.
3. Check numbers; have contract terms reviewed where needed.

**Prompt**
```
Draft a proposal. Sections: summary of the client's need, what I will deliver, what is not included, timeline, price as given, next step. Plain, professional tone, under 500 words. Use only these facts: [FACTS]. Do not add legal terms or guarantees.
```

**Example output:** A one-page proposal with an "Not included" section.

**Verify:** Price, dates and scope are exactly yours. Legal terms come from a qualified source.
**Mistakes:** Vague scope (fix: list exclusions).

## Workflow 24. Job Description and Policy Drafts

**Problem:** You need written role descriptions or simple internal policies.
**Outcome:** A clean first draft to review.
**Tools:** ChatGPT.

**Steps**
1. List real duties, requirements and hours.
2. Run the prompt.
3. Check local employment rules before use; policies affecting staff rights need professional review.

**Prompt**
```
Draft a job description for [ROLE] at [BUSINESS]. Sections: summary, responsibilities (6 to 8), requirements split into "must have" and "nice to have", working pattern, how to apply. Use only my facts: [FACTS]. Avoid requirements that are not truly needed. Do not mention salary unless I give it.
```

**Example output:** A one-page description with must-have and nice-to-have separated.

**Verify:** No discriminatory wording. Complies with local employment law. Pay and hours are exact.
**Mistakes:** Copying a policy that does not match local law (fix: professional review).

---

# Chapter 9. Spreadsheets, reports and data organization

Do not paste sensitive data. Use sample rows or anonymized columns. Always test formulas on a copy.

**Safe data habits for spreadsheets.**
1. Work on a duplicate of the file and keep the original untouched.
2. Share only a handful of sample rows with the assistant, with names and contact details removed. The assistant needs the shape of your data, not all of it.
3. Check totals by hand. Pick three rows or one subtotal and calculate it yourself before trusting a formula or a summary.
4. Write down what you changed (the rule, not every cell) so you can repeat it next month.

**Worked check (illustrative).** The assistant says orders grew from 80 to 92. Check: 92 − 80 = 12; 12 ÷ 80 = 0.15, which is 15%. If the assistant had said 12%, you would catch the error because you did the sum yourself.

## Workflow 25. Messy List Cleaner

**Problem:** A contact or product list has inconsistent formatting.
**Outcome:** A cleaning plan and a cleaned sample.
**Tools:** ChatGPT, spreadsheet.

**Steps**
1. Paste 20 anonymized sample rows.
2. Run the prompt to get rules.
3. Apply rules in the spreadsheet (find and replace, formulas).
4. Spot-check 20 rows.

**Prompt**
```
Here are sample rows from a spreadsheet. Identify formatting problems (case, spaces, date formats, duplicates, mixed units). Propose cleaning rules and show the cleaned version of the sample. Do not change values unless the rule is stated.
SAMPLE: [PASTE]
```

**Example output:** "Rule: trim spaces and convert 'LEEDS', 'leeds' to 'Leeds'."

**Verify:** Compare before and after on a copy. Keep the original.
**Mistakes:** Cleaning the only copy (fix: duplicate first).

## Workflow 26. Spreadsheet Formula Helper

**Problem:** You know what you need but not the formula.
**Outcome:** A working formula with an explanation and tests.
**Tools:** ChatGPT, your spreadsheet app.

**Steps**
1. Describe columns and goal.
2. Run the prompt.
3. Test on 3 rows you can check by hand.

**Prompt**
```
I use [EXCEL/GOOGLE SHEETS]. Columns: A = [..], B = [..], C = [..]. Goal: [DESCRIBE]. Give the formula for cell [CELL], explain it in plain English, and give 3 test cases with expected results. Note if functions differ between apps.
```

**Example input:** Excel. Columns: A = City, B = Order date, C = Amount. Goal: total amount for Leeds orders from 1 November 2026 onwards, in cell E2.
**Example output:** `=SUMIFS(C:C, A:A, "Leeds", B:B, ">="&DATE(2026,11,1))`, explained as "add column C where column A is Leeds and column B is on or after 1 Nov 2026", plus three test rows with the expected totals.

**Verify:** Run the 3 tests. Check edge cases such as blanks.
**Mistakes:** Trusting a formula untested (fix: test cases).

## Workflow 27. Monthly Numbers to Plain-English Report

**Problem:** You have numbers but no narrative.
**Outcome:** A one-page summary of what changed and what to check.
**Tools:** ChatGPT, your monthly figures.

**Steps**
1. Paste a small table of figures.
2. Run the prompt.
3. Check every number against the table.

**Prompt**
```
Here are this month's and last month's figures. Write a one-page summary: key changes (with exact numbers and percentage change calculated step by step), possible reasons clearly labeled as hypotheses, questions to investigate, and 3 next steps. Do not state causes as facts.
FIGURES: [PASTE]
```

**Example output:** "Orders rose from 80 to 92 (+15%). Hypothesis: seasonal events. Question: which products drove it?"

**Verify:** Recalculate each percentage yourself.
**Mistakes:** Accepting causes as facts (fix: they are hypotheses).
