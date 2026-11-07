# Diagrams for Keep Your Own Books

Five self-contained SVGs (Georgia, brand palette navy #0f2238 / cream #f4efe6 / copper #b87333 / teal #3aa6a0), each with a PNG render made with headless Chrome and checked by eye. Width 1200 units; text is at least 22 units, readable at a 6 inch page width. Each explains something the text already says.

| File | Shows | Inserted after | Why it helps |
|---|---|---|---|
| five_account_types.svg | The five account types, snapshot versus performance, which side increases each, and Assets = Liabilities + Equity | Chapter "The five kinds of account", after the paragraph ending "an asset that gets consumed gradually" | The debit/credit pattern and the two groups are the idea readers find hardest; one picture replaces re-reading |
| life_of_a_sale_and_a_bill.svg | Agreed/Invoiced/Paid for a sale and Committed/Incurred/Paid for a bill, with the entry at each step | Chapter "Recording money coming in", after "let it be that" | Shows the book's key rule, income recorded once at invoice, and the mirror for expenses |
| bank_reconciliation.svg | The three piles of unmatched items and the proving calculation | Chapter "The bank reconciliation", after the proving formula | Turns a procedure into a visual checklist |
| month_end_close.svg | The seven-step routine with the minutes per step (15+20+2+10+5+5+3 = 60) | Chapter "The month-end close, in one hour", after step 7 | The routine the book is sold on, one screenshot-able page |
| profit_is_not_cash.svg | June in the worked month: profit 3,675 to a bank increase of 875 through receivables (-1,500), the deposit (-600), payables (+500) and drawings (-1,200) | Chapter "A month, worked end to end", after the "profit is not cash" lesson | The book calls this its most important lesson; the bridge uses only the book's own figures and I recomputed that it sums to 875 |

Notes for the editor. (1) The bridge in profit_is_not_cash is derived arithmetic from the worked month; the chapter text attributes the gap to drawings and to "accounts payable", which should read receivables (see AUDIT.md weakness 9). Approve the bridge before use. (2) manuscript_with_diagrams.md is an exact copy of manuscript.md (same CRLF line endings) with five image lines added; removing them reproduces the original byte for byte. (3) The EPUB builder must copy `diagrams/*.svg` (or the PNGs) into the package and manifest.

Possible extra diagrams not made: a depreciation timeline and a cash versus accrual December timeline. Both would help but the text covers them in a few lines; I kept to what changes comprehension most.
