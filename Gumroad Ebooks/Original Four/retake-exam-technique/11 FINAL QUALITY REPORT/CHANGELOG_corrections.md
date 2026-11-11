# CHANGELOG: The Retake Method, final manuscript (checked 2026-11-07)

Source text: `03_improved\manuscript_with_diagrams.md`. Output: `manuscript_final.md`. No original file was changed. Evidence "manuscript fact" means verified by reading the manuscript or running a script (arithmetic: 150 minus 10 buffer = 140 minutes, 140 / 100 = 1.4 minutes = 84 seconds; checkpoints 35/70/105/140 used, 115/80/45/10 remaining: confirmed by script).

## A. Factual corrections

1. Chapter 9 intro. BEFORE: "Changing answers is the most dangerous." AFTER: "Changing answers is where feeling most easily takes over from evidence." Also added to the "when to change an answer" section: "Research on answer changing generally finds that changes more often turn wrong answers into right ones than the other way round ... The rule guards against changes made on a feeling alone." Evidence: Kruger, Wirtz & Miller (2005), https://www.gsb.stanford.edu/faculty-research/publications/counterfactual-thinking-first-instinct-fallacy (summary page opened 2026-11-07). The rule itself (change only with a stated reason) is kept.
2. Chapter 9. BEFORE: "The first time you answered, you read the question fresh and applied your method. On review, you are tired and anxious..." AFTER: "On review you may be tired and anxious, and a question you have already read can start to seem strange." Evidence: unsupported psychological assertion softened.
3. Chapter 17 intro. BEFORE: "...changing right answers to wrong ones." AFTER: "...can end up changing answers on a feeling rather than a reason." Same evidence as item 1.
4. Chapter 15. BEFORE: retrieval practice "tends to do more for later recall than rereading the same pages." AFTER: adds "In one well-known study, rereading gave better recall on a test five minutes later, but practice tests gave better recall two days and one week later." Evidence: Roediger & Karpicke (2006), https://www.psychologicalscience.org/journals/psychological-science/j.1467-9280.2006.01693.x/ (opened 2026-11-07).
5. Chapter 15. BEFORE: spaced repetition "with harder material reviewed more often and easier material less often". AFTER: clause removed; added "the best gap between reviews depends on how long you need to remember the material". Evidence: Cepeda et al. (2006), https://digitalcommons.usf.edu/psy_facpub/1771/ (abstract page opened 2026-11-07). The harder/easier-cards clause was not supported by a source I opened.
6. Chapters 3 and 11 (test anxiety). Chapter 3 BEFORE "Test anxiety is generally described as a mix of two things" AFTER "Researchers commonly describe test anxiety as having two parts: bodily over-arousal... and mental worry". Evidence: Minihan et al. (2021), https://pmc.ncbi.nlm.nih.gov/articles/PMC7611905 (opened 2026-11-07; worry and emotionality described as the two consensus dimensions). Chapter 11 wording left as written (same description, "generally described").
7. Chapter 10 and Conclusion. BEFORE "A difficult question is worth the same as an easy one." AFTER "In most exams a difficult question is worth the same as an easy one; check your exam's scoring rules." (Conclusion: "In most exams a hard question..."). Evidence: scoring differs between exams; not verified for any exam, so hedged.

## B. Wording and overclaim fixes

1. Chapter 1. Heading "The promise" renamed "What you will be able to do". Added: "It does not promise or guarantee any examination result."
2. Chapter 1. Added independence sentence: "This book is independent: it is not affiliated with, endorsed by or approved by any examination body, licensing authority or professional body." (The Copyright page disclaimer is kept unchanged.)
3. Chapters 7 and 10, Dana. BEFORE "Her practice scores on those questions rose within a fortnight." / "By her fourth practice set she was finishing with eight minutes to spare". AFTER: prefixed "In this hypothetical story," and followed by "That is an invented illustration, not a typical or promised outcome." Evidence: audit item (skimming reader could read these as outcomes).
4. Chapter 2, chapter 4, chapter 9: "Many reports break performance down", "Many exam bodies publish a guide", "Many computer-based exams let you strike out" changed to "Some". Chapter 4: "usually says how much of the exam each area makes up" to "may say"; "note the areas with the biggest shares" to "...if it gives them". Evidence: none could be verified for any exam; hedged.
5. Chapter 16. BEFORE "Last-minute cramming adds anxiety more than knowledge." AFTER "can add anxiety without adding much knowledge."
6. Chapter 8 intro. Added: "These steps are habits of careful thinking, not rules of any exam. Where your exam's own instructions or conventions differ, they take precedence." (audit item 11).
7. Chapter 7 intro. Added a line explaining how the worked questions are laid out and that the answer follows from the rule.
8. Chapter 14. "a short paragraph" changed to "a short entry" (the template is now a labelled block).
9. Planning companion (end of book). BEFORE: described the sibling book as "written for one particular clinical licensing exam... four phases, schedules spaced review on named days, rehearses pacing, and explains how to read a failed score report", "structured, independent". AFTER: "a separate, independent preparation schedule written for one particular licensing exam" with the no content / no affiliation lines kept. Reason: the manuscript should not describe another exam or product in detail; the detail was not re-verified here.
10. Publisher line. BEFORE "Poppy Ebooks is an imprint of The Velvet Foundry" and "Published by Poppy Ebooks, an imprint of The Velvet Foundry." AFTER "The Velvet Foundry publishes..." and "Published by The Velvet Foundry." Evidence: store and cover say The Velvet Foundry only (audit item 10). OWNER DECISION (see report).

## C. Structure and formatting fixes

1. Worked multiple-choice questions, chapters 6 to 9 (kitchen oil, bicycle tyre, train, bread, plus the bicycle ticking question in chapter 6 and the tie question in chapter 8): each option was on its own line inside one italic quoted paragraph and collapsed into one run-on paragraph in EPUB. AFTER: blockquote with `**Question.**` stem, blank line, then `- **A.** ...` list per option; each followed by a bold `**Answer: X.**` line starting the explanation. Chapter 6's stem and option list stay as two blocks around the prediction text.
2. Chapter 4 email to candidate services (collapsed in EPUB): now a fenced code block, wrapped at 64 characters.
3. Chapter 12 formal and casual email templates: fenced code blocks.
4. All other fill-in templates (chapter 4 report sentences x9, chapter 14 log entry and weekly summary, chapter 15 week plan, chapter 16 routine, chapter 18 decision paragraph): fenced code blocks. 17 fenced blocks in total. Spoken scripts and self-talk lines remain blockquotes (single paragraphs, no collapse risk).
5. Chapter 7 four rule lines ("FIRST: danger, then information." etc.): four consecutive quote lines would collapse into one paragraph; now a bulleted list.
6. Chapter 10 checkpoints: prose replaced by a four-column table (checkpoint, question, time used, time left). Numbers unchanged.
7. Chapter 5: added "Ask all five in order, and stop at the first yes, as on day one" to remove ambiguity on day two.
8. Chapters numbered `# Chapter N. Title` for chapters 1 to 18; Conclusion, Recommended next steps, About the publisher, Copyright stay unnumbered; copyright material stays at the end. "Introduction: how to use this book" is now "Chapter 1. How to use this book" (see owner decision).
9. Diagram 04 (tie-breaker sequence) moved from chapter 6 (where it appeared before the tie-breakers were taught) to chapter 8 after the eight-line list. All five images now reference `diagrams/<name>.png`, each with `*Figure N. caption*`.
10. Diagrams rebuilt in `diagrams\` (SVG + PNG, 800 px canvas): all text is 22 px or larger, which prints at about 9.5 pt at 4.8 inches wide (the old 1200 px diagrams had 19 to 38 px text, as small as 5.5 pt). Content unchanged except one wording tidy in diagram 03 ("ignores another" for "ignores one") and the labels follow the manuscript. Colours darkened for contrast (copper and teal). Each PNG viewed after rendering.
11. `epub_notes.md` written (exact constructs for the builder).

## D. Worked question logic checks (audit against the book's own rules)

| Question | Stated answer | Check |
|---|---|---|
| Ch 6 bicycle ticking, MOST LIKELY | B | Fits all facts (back wheel, tied to pedalling speed, nothing in spokes); A contradicted by "back wheel"; D cannot tick in time with the wheel. Correct. |
| Ch 7 oil, FIRST | B | Danger in stem, so remove the cause first; matches the FIRST rule and test question. Correct. |
| Ch 7 tyre, NEXT | B | Stem: wheel and tube already out; D already done; patching needs the hole found. Correct under the NEXT rule. |
| Ch 7 train, BEST | B | Meets goal (arrive tonight) and limit (cannot afford new ticket); A breaks the limit, C breaks the goal. Correct. |
| Ch 7 bread, MOST LIKELY | B | Uses the planted fact (old yeast), A cannot cause a failure before baking, D contradicted. Correct. |
| Ch 8 tie example | A | FLAWED in the original: option B ("check the forecast again") was not a real second candidate and left the goal open, so it did not test the tie-breakers. REPLACED with a genuine tie (two options with the same morning walk; B adds an afternoon walk that conflicts with the stated rain and closed path). It breaks at step three (use every fact), step seven is shown as a check, and the step four guideline is explained as holding only within the stem's facts. |
| Ch 14 two example log entries | n/a | Consistent with chapter 7 (kitchen FIRST, bicycle NEXT, causes decision and reading). Correct. |

## E. Cross reference fixes

None needed: every reference resolves correctly because the opening chapter is counted as chapter 1, as the original text assumed. 53 references listed and verified in `crossref_check.md`. Figure order and numbering checked.

## F. Additions

1. Sources: "A note on sources" rewritten and a "Sources" list of four opened sources added (see `references.md`).
2. Answer line for every worked question; Figure captions; checkpoint table; rule line list; the replacement tie example; the chapter 8 and chapter 1 disclaimers noted above.

## Could not verify (softened or left as general statements)

- Whether exam bodies "publish score report guides", "allow striking out options on screen", "publish outlines with weights", and "scoring weight per question" for any particular exam: hedged to "some" or "may", not tied to any exam.
- "One night of poor sleep is something you can work through" (chapter 16), "bank the spare time for review", and the ten minute buffer being "sensible": practical advice with no source; left as the author's advice.
- Claims inside the sibling book description: removed rather than re-verified.
- PubMed pages for Roediger/Karpicke and Cepeda returned a cookie error; the same papers were verified from the journal society page and a university repository abstract page instead. Only abstract or summary pages were read, not full texts. Minihan et al. (2021) is cited only for how test anxiety is described.
- The audit's remaining items (thumbnail, category, tags, price, PDF, tools pack, drills, spelling variant) are not manuscript corrections and were not touched. The audit's request for 10 to 15 more practice drills was not done: it would add invented content beyond the approved corrections.
