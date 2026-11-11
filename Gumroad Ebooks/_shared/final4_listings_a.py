import pathlib
R=pathlib.Path(r'C:\Users\Lenovo\Good Space\Coco\Gumroad Ebooks\Original Four')
def w(slug,title,summary,cat,tags,desc):
    d=R/slug/'10 SEO AND GUMROAD DESCRIPTION'; d.mkdir(exist_ok=True)
    for t in tags: assert 2<=len(t)<=19,(t,len(t))
    assert len(summary)<=160,(len(summary))
    (d/'description.txt').write_text(desc.strip()+'\n',encoding='utf-8')
    (d/'listing_final.md').write_text(f'# Final Gumroad listing ({slug})\n\nPrice and URL unchanged.\n\n## Title\n{title}\n\n## Summary ({len(summary)} chars)\n{summary}\n\n## Category\n{cat}\n\n## Tags\n{" | ".join(tags)}\n\n## Description (pasted into Gumroad)\n\n{desc.strip()}\n',encoding='utf-8')
    (d/'meta.json').write_text(__import__('json').dumps(dict(title=title,summary=summary,category=cat,tags=tags),indent=1),encoding='utf-8')
    print(slug,len(desc))
FOOT_FMT='WHAT YOU DOWNLOAD\nA 6 x 9 inch PDF with a linked contents page and an EPUB for phones, tablets and e-readers (same text and diagrams).'
w('retake-exam-technique','The Retake Method: Exam Technique After You Fail a Licensing Exam',
 'A method guide for retaking a multiple-choice licensing exam: diagnose your fail, answer FIRST and BEST questions, pace the clock. PDF and EPUB.',
 'Education (confirm the exact option in the editor)',['exam retake','failed exam','exam technique','licensing exam','test taking','exam anxiety','study skills','score report'],
"""FAILED A LICENSING EXAM? RE-READING THE SAME BOOKS MAY NOT FIX WHAT WENT WRONG.

A failed result can come from three different places: you did not know the material, you knew it but chose the wrong option, or the exam conditions got to you. Each has a different fix. This book helps you work out which one is costing you the most, then gives you a method for the exam room.

It does not teach your subject and it contains no exam questions. It teaches how to sit a multiple-choice exam, for any profession.

WHO IT IS FOR
• Adults who have failed a professional licensing exam once or more, in any field
• Anyone with a computer-based or paper multiple-choice retake booked or planned
• People who want a method for how to sit the exam, not another content review

WHO SHOULD NOT BUY IT
• Anyone who wants subject content or practice questions
• Anyone looking for a pass guarantee: no book can promise a result
• Candidates whose exam is oral, practical or essay-only

WHAT YOU WILL BE ABLE TO DO
• Read a failed score report word for word and turn it into clear diagnosis sentences
• Run a two-day diagnostic that separates knowledge gaps, method gaps and nerves
• Spot the qualifier in every question and apply a fixed rule for FIRST, NEXT, BEST and MOST LIKELY
• Break a tie between two plausible answers with a step-by-step sequence
• Eliminate options for named reasons, and change an answer only when you can state a reason
• Work out your own time per question, set checkpoints and use a skip rule
• Use word-for-word scripts for the moments you are stuck, blank or panicking
• Have the retake conversation with your employer and with family, using ready-to-adapt messages
• Keep a practice error log and follow a method-based study week
• Run an exam-day routine and a last-ten-minutes routine
• Plan the next 24 hours, week and month after the result, whichever way it goes

WHAT IS INSIDE
• 18 numbered chapters plus a conclusion, further resources and an about page: about 18,000 words, 97 pages
• Worked questions with each answer option on its own line, set in everyday scenes (kitchens, bicycles, journeys) so none can be mistaken for exam content
• Five diagrams: the two-day diagnostic, the reading routine, the four decision rules, the tie-breaker sequence and the pacing timeline
• Copy-and-adapt templates and scripts, and a practice error log
• Chapters: what a failed attempt tells you; why people fail a retake; reading your score report; method gap or knowledge gap; the anatomy of a question; FIRST, NEXT, BEST and MOST LIKELY; tie-breakers; elimination and changing answers; pacing; what to say to yourself; the employer and family conversations; the error log; a study week; the exam-day routine; the last ten minutes; after the result

"""+FOOT_FMT+"""

EXAM-AGNOSTIC BY DESIGN
You take your own exam's length, time limit and rules from your exam body's published information, and the book shows you how to apply each technique to them. Examples are hypothetical; outcomes are not promised.

IMPORTANT
This is general educational material about exam technique. It does not guarantee any examination result. It is not clinical, legal, tax or financial advice. It is not affiliated with, endorsed by or approved by any examination body, licensing authority or professional body.

FAQ
Q: Is this for one particular exam?
A: No. It works for any multiple-choice licensing exam. It contains no content for any specific exam.

Q: Does it guarantee that I will pass?
A: No. No book can. It gives you a method for diagnosing what went wrong and for sitting the exam.

Q: I have already studied the content. Is it still useful?
A: That is the point. The book is about the method of sitting the exam, which is where many retakers lose marks.

Q: Is it only for people who failed?
A: It is written for retakers, but the question and pacing method works for a first attempt too.

Q: What formats do I get?
A: A PDF and an EPUB.""")
w('keep-your-own-books','Keep Your Own Books: Bookkeeping for Freelancers and Sole Traders',
 'Learn bookkeeping for freelancers and sole traders: record, reconcile and close a month in about an hour. No tax rules, so it works anywhere. PDF and EPUB.',
 'Business & Money > Accounting',['bookkeeping','freelancer','sole trader','small business','double entry','self employed','reconciliation','month end'],
"""Keep Your Own Books is a plain-English bookkeeping guide for freelancers, sole traders and other one-person businesses.

You work for yourself, somebody told you to "keep your books", and nobody explained what that means. You have a business bank account, a folder of receipts and a worry that you are doing it wrong. This book teaches you one system, the double-entry method accountants use, so you can record your business properly, check it against your bank, and understand your own numbers.

WHAT YOU WILL BE ABLE TO DO
• Record any transaction your business produces, using both halves of the entry
• Prove your records against your bank statement with a monthly reconciliation
• Close a month in about an hour with a seven-step routine
• Read your own profit and loss and balance sheet
• Tell the difference between profit and cash, and see why your bank balance is not your profit
• Keep records your accountant can use, so you pay for advice instead of tidying

WHAT IS INSIDE
• 16 numbered chapters plus a conclusion and further resources: about 15,800 words, 88 pages
• The five kinds of account, and a test that sorts almost every transaction
• Double entry without the jargon, with worked transactions
• A working chart of accounts for a one-person business
• Recording money in and money out, including deposits, refunds, discounts and part payments
• Cash basis and accrual explained with the same December, both ways
• The bank reconciliation, with the three piles and what to do with each
• Drawings and owner's money, and untangling personal and business spending
• The one-hour month-end close, and how to read your profit and loss and balance sheet
• A full month worked end to end, with every figure checked
• What records to keep, what your accountant actually wants, and when to stop doing it yourself
• Five diagrams: the five kinds of account, the life of a sale and a bill, the bank reconciliation, the month-end close and why profit is not cash
• Every chapter ends with a checklist; the first fifteen also end with "When it goes wrong"

"""+FOOT_FMT+"""

WHAT MAKES IT DIFFERENT
This book contains no tax rates, thresholds, deadlines or filing rules. That is deliberate. Those rules depend on your country, change often, and are not what you need first. This book teaches how to record what happened, which is the same everywhere. It names the questions only a local professional can answer and tells you to ask them.

WHO IT IS FOR
Sole traders, sole proprietors, freelancers, independent contractors and single-owner businesses doing their own books. No accounting background needed.

WHO SHOULD NOT BUY IT
If you have employees and need payroll, run a limited company or corporation with filing duties, or want to be told your tax rates and deadlines, this is the wrong book. It says so early in the text.

GOOD TO KNOW
• Examples use round numbers and no currency.
• Spelling and terms are British (sole trader, drawings, receivables).
• It is not a spreadsheet or template pack: the chart of accounts and worked month are in the text.

General educational material about bookkeeping method. Not accounting, tax, legal or financial advice. Not affiliated with or endorsed by any tax authority, accounting standard setter, professional body or software vendor.

FAQ
Q: Do I need an accounting background?
A: No. The book starts from what bookkeeping is.

Q: Does it tell me what tax I owe?
A: No. It contains no tax rates, thresholds, deadlines or filing steps. It teaches the records your accountant or tax authority will ask for.

Q: Will it work in my country?
A: The recording method is the same everywhere. Country-specific rules are named as questions for a local professional.

Q: Is there a spreadsheet?
A: No. It is a guide with a chart of accounts, worked examples and checklists in the text.

Q: What formats do I get?
A: A PDF and an EPUB.""")
w('where-your-aws-bill-goes','Where Your AWS Bill Goes: Understand and Reduce Your AWS Costs',
 'Plain-English guide to why your AWS bill is what it is: five pricing shapes, a one-hour monthly review and an order for cutting cost. PDF and EPUB.',
 'Software Development (closest sub-option to be confirmed in the editor)',['aws','aws cost','cloud cost','cost optimization','aws billing','finops','devops','cloud billing'],
"""Somebody forwarded you the AWS bill and asked why it went up. This guide shows you how to read it, trace each line to the decision that caused it, and reduce the cost in the right order, without needing a dedicated FinOps team.

WHAT YOU WILL BE ABLE TO DO
• Trace any line on your AWS bill back to the decision that caused it
• Read a cost graph's shape (a step, a ramp or a sawtooth) and know whether you are looking at a deploy, an accumulation or a scheduled job
• Tell a cost that is a problem from a cost that is simply the price of running the thing
• Understand data transfer, public IPv4 addresses, NAT gateways, idle and orphaned resources, storage retention, commitments and managed databases in plain language
• Set up one alarm, one monthly review and one written note, so the next surprise reaches you in days rather than at month end

THE IDEA
Almost every AWS charge is one of five pricing shapes: time, storage, requests, data transfer and provisioned capacity. Learn the shapes and an unfamiliar service becomes readable from its pricing page in a couple of minutes. The book then gives you the order that matters: delete what nobody wants, then resize, then (only then) buy a discount.

WHAT IS INSIDE
• 20 numbered chapters plus a conclusion and sources: about 18,000 words, 68 pages
• Why cloud bills surprise people, and the five things you actually pay for
• Reading the bill as a structure: the billing pages, Cost Explorer, Data Exports and the Cost and Usage Report
• Tagging and attribution; accounts, organisations and consolidated billing
• Data transfer, the cost nobody models; the NAT gateway and other per-gigabyte appliances
• Idle, forgotten and orphaned resources; storage, retention and lifecycle rules
• Provisioned capacity and commitments; right-sizing without guessing
• Managed databases and serverless against always-on; non-production environments
• Budgets, alarms and anomaly detection; the one-hour monthly cost review
• A full month worked from a surprising bill to a fixed one; costing a design before you build it; when to stop optimising
• Five diagrams: the five pricing shapes, the why-did-it-go-up procedure, data-transfer boundaries, the right-sizing order and the monthly review
• Checked against AWS documentation on 7 November 2026, with a dated sources list

"""+FOOT_FMT+"""

WHO IT IS FOR
The engineer, tech lead or small team that owns an AWS bill they did not entirely design and would like to be able to explain it, including anyone who has just inherited an AWS account.

WHO SHOULD NOT BUY IT
Cloud financial management specialists with a dedicated team and a commitment portfolio; anyone who wants to be told which instance to buy without understanding why; anyone looking for tricks without the reasoning.

HONEST LIMITS
This book contains no prices, rates or free-tier amounts. AWS prices change and differ by region, so any figure printed here would be stale. The book teaches what you are charged for and which decisions change how much you consume; AWS's own pricing pages and Pricing Calculator tell you how much. Some statements about AWS behaviour could not be confirmed against current documentation and are worded cautiously in the text. Other cloud providers are not covered.

This is general educational material about cloud cost mechanics, not financial, accounting or procurement advice. This book is independent. It is not affiliated with, endorsed by or sponsored by Amazon Web Services, Inc. or Amazon.com, Inc. "AWS" and the names of individual services are trademarks of their respective owners and are used only to identify the services described.

FAQ
Q: Does the book give me prices or example dollar amounts?
A: No, on purpose. AWS prices change and differ by region. The book teaches where the money goes and which decisions change the quantity you consume.

Q: Do I need to be an AWS expert?
A: No. You need access to your account's billing data (the book explains the permission step) and some familiarity with terms like instance, bucket and region.

Q: Is this the same as the AWS documentation?
A: It covers ground that AWS documents, organised around five pricing shapes, an order of operations and a monthly routine, with sources so you can check each point.

Q: Does it cover other clouds?
A: No, only AWS.

Q: What formats do I get?
A: A PDF and an EPUB.""")
