# Chapter 10. Reusable workflows and SOPs

A **standard operating procedure (SOP)** is a written way to do a recurring task so anyone can repeat it. AI is good at turning rough, spoken knowledge into clear steps. You supply the truth; it supplies the structure.

**The new-hire test.** An SOP is finished only when someone who has never done the task can follow it without asking you a question. Hand the draft to that person, watch (do not help), and mark every point where they hesitate. Each hesitation is a missing detail. Ask the assistant to rewrite only the unclear steps.

**Before and after (illustrative).**
Rough note: "Check the order and sort the allergy thing."
SOP step: "3. Open the order form. If the 'Allergies' box contains text, write the allergy in red on the kitchen board and move the order to the allergen-safe prep area. If the box is empty, continue to step 4."
What improved: one action per step, a clear condition, a named place, and a next step for both cases.

## Workflow 28. SOP Builder

**Problem:** Key tasks live in one person's head.
**Outcome:** A clear SOP with purpose, steps, owner, tools and quality check.
**Tools:** ChatGPT.

**Steps**
1. Do the task once and write rough notes of what you actually did.
2. Run the prompt.
3. Ask someone else to follow the SOP and note where they get stuck.
4. Fix and date the SOP.

**Prompt**
```
Turn my rough notes into an SOP. Sections: purpose, when to use, who does it, tools needed, numbered steps (one action per step), common mistakes, quality check, last reviewed date. Mark any step where my notes are unclear as "[CLARIFY]". Do not add steps I did not describe.
NOTES: [PASTE]
```

**Example input:** "Order comes in, check the allergy box, write it on the board, confirm by email, bake day before..."
**Example output:** Numbered SOP with "Step 2: Check the allergy box. If ticked, move to the allergen-safe prep area."

**Verify:** Someone new can follow it without asking you.
**Mistakes:** Steps with several actions (fix: one action per step).

## Workflow 29. Checklist and Quick-Training Guide

**Problem:** New helpers need training, and checklists get skipped.
**Outcome:** A one-page checklist plus a short training guide.
**Tools:** ChatGPT, your SOP.

**Steps**
1. Paste the SOP.
2. Run the prompt.
3. Test with a new person.

**Prompt**
```
From this SOP create: (1) a one-page checklist with checkboxes, (2) a 10-minute training outline for a new team member including 5 quiz questions with answers, (3) a list of 3 things that most often go wrong. Use only the SOP.
SOP: [PASTE]
```

**Example output:** Checklist plus quiz: "What do you do if the allergy box is ticked?"

**Verify:** Quiz answers match the SOP exactly.
**Mistakes:** Long checklists nobody uses (fix: keep to one page).

## Workflow 30. Workflow Audit: What Should I Automate?

**Problem:** You do not know which tasks deserve AI help.
**Outcome:** A ranked list of tasks by time saved, risk and effort.
**Tools:** ChatGPT, a list of your weekly tasks.

**Steps**
1. List weekly tasks with rough minutes.
2. Run the prompt.
3. Pick the top two and apply the matching workflow.
4. Re-run the audit after 30 days.

**Prompt**
```
Here are my recurring tasks with minutes per week. For each, rate: AI suitability (high/medium/low), risk if the output is wrong (low/medium/high), and effort to set up. Rank the top 5 to try first. Suggest a human check for each. Say which tasks should stay fully human.
TASKS: [PASTE]
```

**Example output:** "Reply to routine emails | 180 min | High | Medium | Low effort. Rank 1. Pricing decisions: keep human."

**Verify:** You agree with the risk ratings. High-risk tasks keep a person in charge.
**Mistakes:** Starting with the riskiest task (fix: start with low-risk drafting).

---

# Chapter 11. Safety, privacy, accuracy and human review

## Privacy rules of thumb

1. **Do not paste what you would not email to a stranger**: passwords, payment details, medical or other special-category data, confidential contracts, and customers' personal details.
2. **Anonymize first**: replace names with "Customer A", remove phone numbers and addresses.
3. **Know your settings.** Data controls, retention and training options differ by product and plan. Read the provider's privacy information and your account settings.
4. **Follow the law and contracts** that apply to you (for example data-protection rules and client confidentiality terms). Ask a qualified professional when unsure.

## What to check in your account (as documented 7 November 2026)

OpenAI's help pages describe these controls. Names and locations change, so look for the equivalent in your own settings.

- **Data controls:** a setting that decides whether your conversations may be used to improve the models. Turning it off does not delete your saved chats.
- **Temporary Chat:** conversations that OpenAI says are not used for training while they remain temporary. Use these for anything you would rather not keep. If you save one, it becomes a normal chat under your normal settings.
- **Memory:** information the assistant can keep between chats. You can review and delete it, and turn it off.
- **Chat and file retention:** files uploaded in a chat are kept as long as that chat is kept; OpenAI states that files from deleted chats are removed within 30 days, with exceptions.
- **Account type:** personal, team, business and enterprise accounts can have different data terms. If you work with client or employee data, confirm which terms apply to you.

Write the date you checked these on Worksheet 4 and check again every quarter.

## A one-page AI use policy for a small business (template)

Copy this into a document, edit it, and share it with anyone who helps you.

```
AI USE POLICY - [BUSINESS] - Reviewed [DATE]
1. We use AI to draft and organize. A person approves everything before it is sent or published.
2. We never paste: passwords, payment details, health information, identity documents, or customers' personal details.
3. We anonymize examples (Customer A, Supplier B) before pasting them.
4. We check every number, date, price, name and claim against our records.
5. We never publish invented testimonials, reviews or case studies.
6. We do not use AI for final decisions on pricing, hiring, legal, tax, medical or safety matters.
7. We tell customers when they are talking to an automated tool, where required.
8. Questions or mistakes go to: [NAME]. We review this policy every quarter.
```

This template is a starting point, not legal advice. If you employ people or hold sensitive data, ask a qualified adviser to review it.

## Accuracy rules

- Treat every number, date, price, quote, law, citation and statistic as **unverified until you check it**.
- Ask the assistant to mark uncertainty, but do not rely on its self-assessment.
- Never publish invented testimonials, case studies or reviews.
- Keep a source for each factual claim in marketing.

## The human review ladder

| Risk level | Examples | Review |
|---|---|---|
| Low | Brainstorming, internal outlines | Quick read |
| Medium | Social posts, routine customer replies | Read fully, check facts |
| High | Pricing, contracts, legal, health, finance, HR, safety | Professional or second-person review; AI only for structure |

## Honesty with customers

Check the rules that apply to you about disclosing AI use, advertising claims and endorsements. Where a customer talks to an automated tool, do not pretend it is a person.

## A personal pre-send checklist

- [ ] Facts correct and sourced
- [ ] Nothing promised that I cannot deliver
- [ ] No private data included
- [ ] Sounds like me
- [ ] I would be comfortable if the customer knew AI helped

---

# Chapter 12. Your 30-day implementation plan

The aim is **one new habit at a time**. Spend 20 to 40 minutes a day.

**Week 1: Foundations**
- Day 1: Workflow 1 (Business Context Block). Save it.
- Day 2: Workflow 3 (format library).
- Day 3: Workflow 30 (audit your tasks).
- Day 4: Read Chapter 11. Write your own privacy rules.
- Day 5: Workflow 2 (improve one prompt that failed).
- Day 6–7: Rest and review. Pick your three biggest time-sinks.

**Week 2: Communication**
- Day 8: Workflow 12 (reply drafter) for five real emails.
- Day 9: Workflow 20 (reply macros).
- Day 10: Workflow 19 (FAQ builder).
- Day 11: Workflow 13 (newsletter).
- Day 12: Workflow 14 (difficult message).
- Day 13–14: Review time saved and errors caught.

**Week 3: Marketing and research**
- Day 15: Workflow 6 (review themes).
- Day 16: Workflow 4 (customer personas).
- Day 17: Workflow 7 (content calendar).
- Day 18: Workflow 9 (voice and post batch).
- Day 19: Workflow 8 (one piece, five formats).
- Day 20–21: Publish a small batch; note what you edited most.

**Week 4: Sales, admin and systems**
- Day 22: Workflow 15 (lead profile).
- Day 23: Workflow 16 and 17 (outreach and follow-ups) to a small, relevant list.
- Day 24: Workflow 22 (meeting actions).
- Day 25: Workflow 27 (monthly numbers).
- Day 26: Workflow 28 (one SOP).
- Day 27: Workflow 29 (checklist and training).
- Day 28: Workflow 30 again; compare with Day 3.
- Day 29: Update your Business Context Block and prompt library.
- Day 30: Decide what to keep, drop or expand. Write your next 30-day goal.

Workflows 5, 10, 11, 18, 21, 23, 24, 25 and 26 are on-demand: use them when the need arises.

## A worked example of week 1 (fictional)

Brightleaf Bakery has two people and a shared inbox. The owner, Dana, has about 90 minutes a week she wants back from email.

- **Day 1 (25 minutes).** Dana runs Workflow 1 and saves a 150-word context block. She checks her data settings and decides to use Temporary Chat for anything that mentions a customer's order.
- **Day 2 (30 minutes).** She lists her tasks for Workflow 30. Email replies take about 180 minutes a week, so they rank first.
- **Day 3 (30 minutes).** She runs Workflow 12 on four anonymized emails. She changes two drafts: one promised a delivery time she had not given, one used the banned word "indulge". She adds both to her context block as rules.
- **Day 4 (20 minutes).** She runs Workflow 3 and saves two format lines: "plain email under 120 words" and "5-bullet summary".
- **Day 5 (30 minutes).** She runs Workflow 2 on a social-post prompt that gave generic results, and saves the improved version.
- **Day 6 (15 minutes).** She records, on Worksheet 3, time before and after for each workflow, and what she edited.

At the end of week 1 she has a context block, three saved prompts, two new rules and an honest note of what saved time and what did not. She has not published anything she has not read, and she has not pasted any private data. That is the standard this plan is built to teach.

---

# Appendix A. Prompt library index

Keep every prompt you use in one document with a name, date and "last tested" note. Suggested folders:

| Folder | Workflows |
|---|---|
| Foundations | 1, 2, 3 |
| Research | 4, 5, 6 |
| Marketing | 7, 8, 9, 10 |
| Email | 11, 12, 13, 14 |
| Sales | 15, 16, 17, 18 |
| Customer service | 19, 20, 21 |
| Admin | 22, 23, 24 |
| Data and reports | 25, 26, 27 |
| Systems | 28, 29, 30 |

**Naming format:** `[Folder] Name v1 – tested 2026-11-07`

**Prompt template (use for any new task):**
```
ROLE: Act as [role].
CONTEXT: [Business Context Block + situation]
TASK: [one clear task]
INPUT: [material, anonymized]
FORMAT: [format instruction]
LIMITS: Use only the facts given. Mark unknowns as [NEED INFO]. Do not invent statistics, quotes or testimonials.
```

---

# Appendix B. Worksheets

## Worksheet 1. Weekly task audit
| Task | Minutes/week | AI suitable? | Risk if wrong | Workflow # | Owner |
|---|---|---|---|---|---|

## Worksheet 2. Business context notes
- What we sell:
- Who buys and why:
- What makes us different (facts only):
- Voice: 3 adjectives / 2 words never used:
- Rules for the assistant:

## Worksheet 3. Workflow test log
| Date | Workflow | Time before | Time after | Edits needed | Errors caught | Keep? |
|---|---|---|---|---|---|---|

## Worksheet 4. Privacy rules
- Data I never paste:
- How I anonymize:
- Who may use AI in my business:
- Settings checked on (date):

## Worksheet 5. Review ladder
| Output type | Risk (L/M/H) | Who reviews | Checklist used |
|---|---|---|---|

## Worksheet 6. 30-day scorecard
| Week | Workflows tried | Hours saved (estimate) | Biggest lesson | Next step |
|---|---|---|---|---|

---

# Appendix C. Glossary

- **Assistant / chatbot:** software you talk to in plain language.
- **Prompt:** the instruction and material you give the assistant.
- **Context:** the information the assistant can use in the current conversation.
- **Hallucination:** a confident statement that is false or unsupported.
- **Anonymize:** remove details that identify a person.
- **SOP:** standard operating procedure; a written repeatable method.
- **Workflow:** a repeatable sequence from input to checked output.
- **Verification checklist:** the human checks done before output is used.
- **Placeholder:** text in [BRACKETS] you replace.
- **Human in the loop:** a person reviews and approves before use.

---

# Appendix D. References and further learning

Research dates: 7 November 2026. Web pages change; check the current version before relying on a detail. No statistics are quoted in this book.

**OpenAI Help Center (features, data controls, privacy)**
- Data controls in ChatGPT: https://help.openai.com/en/articles/7730893-data-controls-in-chatgpt
- How your data is used to improve model performance: https://help.openai.com/en/articles/5722486-how-your-data-is-used-to-improve-model-performance
- Memory in ChatGPT: https://help.openai.com/en/articles/8590148-memory-in-chatgpt
- File uploads FAQ: https://help.openai.com/en/articles/8555545-file-uploads-faq
- Projects in ChatGPT: https://help.openai.com/en/articles/10169521-projects-in-chatgpt

**Other guidance to read in your own country**
- Your national data protection authority (for example the UK Information Commissioner's Office) for personal data rules.
- Your advertising standards or consumer protection body for rules on advertising claims, endorsements and reviews.
- Your email and messaging regulations for marketing communications.
- Your accountant, lawyer or HR adviser for contracts, tax, employment and compliance questions.

*Note: the OpenAI pages above were reached through search results on 7 November 2026; some could not be opened directly by the author's tool (access blocked), so details such as limits and menu names should be confirmed in your own account.*
