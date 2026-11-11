import sys,pathlib,shutil
sys.path.insert(0,str(pathlib.Path(__file__).parent))
import final4_listings_a as A
A.w('aswb-clinical-90-day-study-plan','The 90-Day Clinical Licensing Exam Study Plan: A Day-by-Day Schedule for the ASWB Clinical (LCSW) Exam',
 'A dated 90-day study plan for the ASWB Clinical (LCSW) exam: weekly schedule, spaced review and pacing for the 2026 format. Independent; no exam questions.',
 'Education (a Test Prep sub-option if the editor offers one)',['lcsw exam','aswb clinical','study plan','exam prep','social work','exam retake','licensing exam','90 day plan'],
"""A 90-DAY PLAN FOR THE ASWB CLINICAL (LCSW) EXAM, DAY BY DAY

You can download ASWB's free content outline and a blank study plan template. What is missing is the decision about what you study on day 14, and how you know by day 40 whether it is working. This book is that decision, written out for 90 days.

It is written first for candidates waiting out the 90-day gap before a retake. The method works for a first attempt too, and the book says which parts to adjust. It is for the Clinical (LCSW) licensing exam for social workers, not a medical exam.

WHAT YOU GET
• A phased 90-day schedule: a diagnostic week, a content phase, a pacing-and-repair phase and a final taper, with the days numbered
• How to read a score report without over-reading it, and how to turn the content outline into a priority order
• How to build the plan on a real calendar, and the shape of a study week with study blocks
• How to study a content area instead of reading about it, and how to write your own retrieval questions
• A spaced review schedule and week-by-week guidance for the content phase
• Pacing for 122 questions in four hours, including the optional break as described in ASWB's 2026 guidebook
• A way to reason through a decision question
• Three rules for changing the plan, and what to do when you are not on track
• Re-registering, the waiting period and the waiver, and a start-to-finish exam-day guide
• What to do after the examination, whichever way it goes
• Five diagrams: the phases timeline, a study block, the review schedule, the pacing checkpoints and the behind-schedule triage

WHAT YOU DOWNLOAD
A 6 x 9 inch PDF with a linked contents page and an EPUB for phones, tablets and e-readers (same text and diagrams). 22 numbered chapters, about 19,600 words, 105 pages.

CHECKED AGAINST ASWB'S OWN DOCUMENTS
Exam facts in the book (122 questions of which 110 are scored and 12 are pretest, two sections of 61, four hours, the 90-day wait with the waiver) were checked against ASWB's 2026 examination guidebook (08/2026) and ASWB web pages on 7 November 2026. A sources list with access dates is at the end of the book. A few points that could not be confirmed are worded cautiously.

WHO IT IS FOR
Social work candidates preparing for the ASWB Clinical exam, especially those waiting between attempts who want a structured plan rather than another pile of content.

WHO SHOULD NOT BUY IT
Anyone who wants practice questions, subject content or a promise of a pass. The book contains no examination questions and promises no result.

IMPORTANT
This is an independent guide. It is not affiliated with, endorsed by or approved by ASWB. It contains no examination questions and no pass is promised. Always rely on ASWB's current published information for exam rules.

FAQ
Q: Is this an official ASWB product?
A: No. It is independent and not affiliated with, endorsed by or approved by ASWB.

Q: Does it contain practice questions?
A: No. It is a plan and a method. You bring your own practice material.

Q: Can I use it for a first attempt?
A: Yes. It is written first for retakers, and the book explains what to adjust for a first attempt.

Q: Does it guarantee that I will pass?
A: No. No book can. It gives you a structured way to use 90 days.

Q: What formats do I get?
A: A PDF and an EPUB.""")
# organise folders
R=A.R
import json
for slug in ['aswb-clinical-90-day-study-plan','keep-your-own-books','retake-exam-technique','where-your-aws-bill-goes']:
    d=R/slug
    for n in ['01 ORIGINAL FILES','08 INTERIOR DIAGRAMS','11 FINAL QUALITY REPORT']: (d/n).mkdir(exist_ok=True)
    if not any((d/'01 ORIGINAL FILES').iterdir()):
        shutil.copytree(d/'00_original_backup',d/'01 ORIGINAL FILES',dirs_exist_ok=True)
    shutil.copytree(d/'02 FINAL MANUSCRIPTS'/'diagrams',d/'08 INTERIOR DIAGRAMS',dirs_exist_ok=True)
print('ok')
