# THE AI WORKFLOW PLAYBOOK
## 30 Practical ChatGPT Systems for Small Business, Marketing, Sales & Daily Operations

*Edition 1 · Written 7 November 2026*

---

## Before you begin

This book is educational. It does not promise income, growth or any specific result. AI tools make mistakes, and their features change often. Every workflow here ends with a human check, and that check is part of the method, not an optional extra. Where this book mentions a feature, verify it in your own account. All example businesses, names and figures are **fictional and for illustration only**.

**Research and update note:** This edition was written on 7 November 2026 without live verification of current product features, pricing or limits. Workflows rely on plain chat and pasted text, which are the most stable parts of any AI assistant. Before relying on a feature (file upload, saved instructions, memory, web search), check the provider's current help pages.

---

## Table of contents

1. Practical AI for business: how to think about it
2. Prompts and reusable instructions (Workflows 1–3)
3. AI-powered market research (Workflows 4–6)
4. Marketing content and social media (Workflows 7–10)
5. Email and customer communication (Workflows 11–14)
6. Sales prospecting and lead generation (Workflows 15–18)
7. Customer service and FAQ automation (Workflows 19–21)
8. Business administration and documentation (Workflows 22–24)
9. Spreadsheets, reports and data organization (Workflows 25–27)
10. Reusable workflows and SOPs (Workflows 28–30)
11. Safety, privacy, accuracy and human review
12. Your 30-day implementation plan
- Appendix A: Prompt library
- Appendix B: Worksheets
- Appendix C: Glossary
- Appendix D: References and further learning

---

# Chapter 1. Practical AI for business: how to think about it

## What a chat assistant is good at

A chat assistant such as ChatGPT is strong at **language work on material you give it**: drafting, rewriting, summarizing, sorting, extracting, outlining, brainstorming, explaining and reformatting. It is fast, tireless and never bored by repetitive writing.

## What it is bad at

- **Facts it was not given.** It can state wrong things fluently. Never publish a claim you have not checked.
- **Knowing your business.** It knows only what you tell it in the conversation.
- **Judgment and accountability.** Prices, promises, legal wording, medical or financial advice and hiring decisions remain yours.
- **Staying consistent** unless you give it the same instructions each time. That is why this book uses reusable prompts.

## The one-line rule

> **AI drafts. You decide.**

Everything in this book applies it: a workflow produces a draft or a structure, and a person checks it before it is used.

## The five-part workflow

Each of the 30 workflows is a small version of the same loop:

1. **Input**: gather the real material (notes, reviews, product details).
2. **Prompt**: give the assistant a role, context, task and format.
3. **Draft**: read what comes back.
4. **Check**: use the verification checklist (facts, tone, privacy, promises).
5. **Save**: store the best prompt so next time takes two minutes.

## How to read this book

Do not read the 30 workflows in one sitting. Pick the three that match your biggest weekly time-sinks and run them this week. Chapter 12 gives a 30-day order. Appendix A collects every prompt in one place.

## How each workflow is laid out

**Problem · Outcome · Tools · Steps · Prompt · Example input · Example output · Verify · Mistakes and fixes.**

Square brackets like [PRODUCT] mean "replace this with your real information."

## What you need

A ChatGPT account (or similar assistant), a place to save prompts (a notes app or document), and your own business material. A spreadsheet app helps in Chapters 9 and 10.

---

# Chapter 2. Prompts and reusable instructions

A prompt is a written brief. A good brief has five elements: **role, context, task, format, limits.** Vague briefs produce generic work. The three workflows here are the foundation for the other 27.

## Workflow 1. The Business Context Block

**Problem:** Every new chat starts from zero, so answers are generic and you keep retyping who you are.
**Outcome:** One saved paragraph you paste at the start of any chat so outputs sound like your business.
**Tools:** ChatGPT, a notes app.

**Steps**
1. Write down answers to the questions in the prompt below.
2. Run the prompt to turn them into a tight block.
3. Save the block. Paste it at the top of future chats.
4. Review and update it every quarter.

**Prompt**
```
I run a business. Turn my notes into a "Business Context Block" of no more than 200 words that I can paste at the start of future chats.
Include: what we sell, who buys, what makes us different, brand voice (3 adjectives plus 2 words we never use), pricing level (budget/mid/premium, no exact prices), and rules the assistant must follow (e.g. never invent facts, ask when unsure).
My notes:
- Business: [WHAT YOU DO]
- Customers: [WHO BUYS AND WHY]
- Different because: [POINTS]
- Voice: [ADJECTIVES / WORDS TO AVOID]
- Rules: [ANY RULES]
```

**Example input (fictional):** Business: small bakery in Leeds selling custom celebration cakes. Customers: parents and office managers. Different because: gluten-free options, 48-hour turnaround. Voice: warm, honest, plain. Avoid: "artisanal", "indulge".

**Example output (shortened):** "Brightleaf Bakery makes custom celebration cakes for parents and office teams in Leeds. Our edge: gluten-free options and 48-hour turnaround. Voice: warm, honest, plain; never use 'artisanal' or 'indulge'. Mid-priced. Rules: never invent facts, prices or opening hours; ask if information is missing."

**Verify:** Every claim is true today. No private data (customer names, bank details). Under 200 words.
**Mistakes:** Writing marketing slogans instead of facts (fix: facts only). Pasting a 2-page block that dilutes instructions (fix: keep it short).

## Workflow 2. The Prompt Improver

**Problem:** Your prompt gives weak results and you do not know why.
**Outcome:** A clearer rewritten prompt plus a list of what was missing.
**Tools:** ChatGPT.

**Steps**
1. Copy the prompt that disappointed you.
2. Run the prompt below with your prompt and a sample of the poor output.
3. Test the rewritten version once and compare.
4. Save the better version.

**Prompt**
```
Act as a prompt coach. Here is a prompt I used and the output I got.
MY PROMPT: [PASTE]
OUTPUT I GOT: [PASTE A SHORT SAMPLE]
What I actually wanted: [DESCRIBE]
1) List what was missing or unclear in my prompt (role, context, task, format, limits).
2) Ask me up to 3 questions if you need information.
3) Rewrite my prompt so it is specific and reusable, with [BRACKETS] for the parts I change each time.
```

**Example input:** "Write a post about our cakes." Output was a generic 5-emoji caption.
**Example output:** Missing: audience, platform, length, tone, call to action. Rewritten prompt: "Write one Instagram caption (max 60 words) for [CAKE TYPE] aimed at parents ordering birthday cakes. Warm, plain tone, no emojis, end with a call to order 48 hours ahead."

**Verify:** The new prompt includes real constraints; one test gave a better result.
**Mistakes:** Accepting the rewrite untested (fix: run it once). Adding so many rules that they conflict (fix: keep 5 to 7).

## Workflow 3. The Output Format Library

**Problem:** Answers come as long paragraphs when you need tables, lists or fixed templates.
**Outcome:** A small set of format instructions you add to any prompt.
**Tools:** ChatGPT, notes app.

**Steps**
1. Decide the three formats you use most (table, checklist, email, bullet summary).
2. Run the prompt to generate reusable format lines.
3. Append the matching line to future prompts.

**Prompt**
```
Create a library of 8 reusable "format instructions" I can append to any prompt. Each is one or two sentences. Cover: a comparison table, a checklist with checkboxes, a plain email under 120 words, a 5-bullet summary, a step-by-step numbered procedure, a table with columns I name, a "pros, cons, recommendation" block, and a JSON-free plain list. Label each with a short name.
```

**Example output:** "TABLE: Present the answer as a table with columns [A], [B], [C]. No text outside the table." "EMAIL: Write a plain email under 120 words with a subject line and one clear call to action."

**Verify:** Each line produces the format when tested once.
**Mistakes:** Asking for a table and a story together (fix: one format per request).

---

# Chapter 3. AI-powered market research

An assistant cannot browse your market for you reliably. It can **analyze material you collect**: your own customer messages, reviews, public web page text that you copy in, and your sales notes. This keeps the work grounded and avoids invented facts.

## Workflow 4. Customer Persona from Your Own Data

**Problem:** You describe customers vaguely ("everyone") so marketing is unfocused.
**Outcome:** One to three evidence-based customer profiles with needs, objections and wording.
**Tools:** ChatGPT, 10 to 30 real customer messages or order notes (names removed).

**Steps**
1. Collect real material: emails, DMs, order notes. Remove names and contact details.
2. Paste into the prompt.
3. Read the personas and cross out anything the data does not support.
4. Save to your notes.

**Prompt**
```
Below are anonymized customer messages and order notes for [BUSINESS]. Identify up to 3 customer types. For each: who they are, what they are trying to achieve, top 3 objections, the words they use, and the evidence (quote a short phrase). Mark anything you are inferring rather than reading directly as "INFERRED". Do not invent demographics.
DATA:
[PASTE]
```

**Example input:** 12 anonymized messages such as "Need a gluten-free cake for Saturday, is that possible?"
**Example output:** Type 1: Last-minute parents. Goal: a safe cake for a child's party. Objections: lead time, allergy safety. Words: "Saturday", "is that possible". Evidence: quoted phrases. INFERRED: likely time-pressed.

**Verify:** Each point links to quoted evidence. No stereotypes. No personal data pasted.
**Mistakes:** Pasting too few messages (fix: 10 or more). Treating INFERRED lines as facts (fix: test them with real customers).

## Workflow 5. Competitor Comparison from Pasted Pages

**Problem:** You do not know how your offer compares.
**Outcome:** A side-by-side table of what competitors publicly state, with gaps you can use.
**Tools:** ChatGPT, copied text from 3 to 5 public competitor pages.

**Steps**
1. Copy the visible text of competitor pages (offers, pricing text, guarantees). Respect each site's terms; copy only what is public and for your own analysis.
2. Paste with your own details.
3. Review the table, then verify any price or claim on the live page.

**Prompt**
```
Compare my business with these competitors using ONLY the text below. Create a table: Business | Offer | Price shown | Promise/guarantee | Who it seems aimed at | Weakness visible in the text. Then list 3 gaps where my business could stand out, and say which are supported by the text and which are guesses.
MY BUSINESS: [DETAILS]
COMPETITOR 1: [PASTE]
COMPETITOR 2: [PASTE]
```

**Example output:** Table row: "Cake Corner | Custom cakes | From £45 | 72-hour notice | Corporate | No gluten-free mentioned." Gap: "Fast-turnaround gluten-free (supported by text)."

**Verify:** Open each page and confirm prices and claims. Note the date.
**Mistakes:** Asking it to "find competitors" without sources (fix: you supply the pages). Copying competitor wording (fix: use it for insight only).

## Workflow 6. Review and Feedback Theme Analysis

**Problem:** Dozens of reviews and comments, no clear pattern.
**Outcome:** Ranked themes with example quotes and suggested actions.
**Tools:** ChatGPT, exported reviews or survey answers.

**Steps**
1. Export 20 to 100 reviews or answers; remove names.
2. Paste in batches if long.
3. Check counts by hand for the top two themes.
4. Choose one improvement to test.

**Prompt**
```
Analyze these customer reviews for [BUSINESS]. Group them into themes. For each theme: a name, how many reviews mention it (count carefully), 2 short example quotes, and whether it is positive or negative. Rank by frequency. Then suggest 3 practical actions. If counts are uncertain, say so.
REVIEWS:
[PASTE]
```

**Example output:** "Theme: Fast delivery (positive), 9 of 30. Quote: 'arrived next day'. Theme: Packaging damaged (negative), 4 of 30. Action: test sturdier boxes."

**Verify:** Re-count two themes yourself. Confirm quotes exist.
**Mistakes:** Trusting counts blindly (fix: spot-check). Mixing different products in one batch (fix: separate them).

---

# Chapter 4. Marketing content and social media

AI helps with volume and structure. Your job is truth, taste and brand voice. Always include your Business Context Block (Workflow 1).

## Workflow 7. Monthly Content Calendar

**Problem:** You post inconsistently because you never plan.
**Outcome:** A 4-week calendar with topics, formats and goals.
**Tools:** ChatGPT, spreadsheet.

**Steps**
1. Paste your context block and list real events, offers and launches this month.
2. Run the prompt.
3. Edit out ideas you cannot deliver.
4. Paste the final table into your spreadsheet.

**Prompt**
```
[PASTE BUSINESS CONTEXT BLOCK]
Create a 4-week content calendar for [PLATFORMS]. I can post [NUMBER] times per week. Real events this month: [LIST]. Table columns: Week | Day | Platform | Topic | Format | Goal (awareness/trust/sale) | Call to action. Mix education, behind-the-scenes, customer proof I actually have, and offers. Do not invent customer stories or statistics.
```

**Example output:** "Week 1 | Tue | Instagram | How we make gluten-free sponge | Short video | Trust | Order 48 hours ahead."

**Verify:** Every item is doable. Nothing claims proof you do not have.
**Mistakes:** Too many posts per week (fix: set a realistic number). Generic topics (fix: add real events).

## Workflow 8. One Piece, Five Formats

**Problem:** Making new content every time is exhausting.
**Outcome:** One idea turned into email, social posts, a short script and a FAQ.
**Tools:** ChatGPT.

**Steps**
1. Choose one source (a blog post, a tip, a product story).
2. Paste it with the target formats.
3. Edit each output for the platform and your voice.

**Prompt**
```
[PASTE BUSINESS CONTEXT BLOCK]
Turn the source below into: (1) a 100-word email, (2) a LinkedIn post of 120 words, (3) three short social captions, (4) a 30-second video script, (5) two FAQ entries. Keep facts exactly as in the source; add none.
SOURCE: [PASTE]
```

**Example output:** Five short pieces with consistent facts and a different tone per channel.

**Verify:** Facts match the source word for word where it matters (dates, prices, claims).
**Mistakes:** Posting all five on one day (fix: schedule across the week).

## Workflow 9. Social Post Batch in Your Voice

**Problem:** Posts sound generic or like AI.
**Outcome:** A batch of drafts matched to your real voice samples.
**Tools:** ChatGPT, 3 examples of your best past writing.

**Steps**
1. Paste 3 samples of writing you like.
2. Ask the assistant to describe your voice first.
3. Generate posts using that description.
4. Edit lightly and add your own details.

**Prompt**
```
Here are 3 samples of my writing: [PASTE]. First describe my voice in 5 bullets (sentence length, vocabulary, humor, openings, endings). Then write 6 posts about [TOPIC] for [PLATFORM] in that voice. Under 70 words each. No hashtags unless I ask. Do not add facts I have not given.
```

**Example output:** Voice: short sentences, dry humor, starts with a question. Then six drafts.

**Verify:** Would you say this out loud? Remove clichés and unsupported claims.
**Mistakes:** Skipping the voice description (fix: it is the main quality driver).

## Workflow 10. Blog or Guide Brief and Draft

**Problem:** Blank page, vague outline.
**Outcome:** A search-friendly brief, then a first draft you rewrite.
**Tools:** ChatGPT, your expertise.

**Steps**
1. Choose a question customers really ask.
2. Run the brief prompt and adjust the outline.
3. Run the draft prompt section by section.
4. Add your own examples and verify facts.

**Prompt**
```
[PASTE BUSINESS CONTEXT BLOCK]
Brief for an article answering: "[CUSTOMER QUESTION]". Give: working title, search intent in one sentence, reader level, outline with 5 to 7 headings, points that need my own expertise (mark "ADD MY EXAMPLE"), and facts that must be checked (mark "VERIFY"). Then wait for me to approve before drafting.
```

**Example output:** Outline with "ADD MY EXAMPLE" and "VERIFY: allergen labelling rules in the UK".

**Verify:** Every VERIFY item is checked against an official source. Add your real examples.
**Mistakes:** Publishing the raw draft (fix: AI text should be a starting point only).
