# Introduction

Most money guides teach one skill and leave you to guess how it connects to the rest. You learn to budget, but not what to do with the surplus. You learn to invest, but not whether to do it while carrying a credit card balance. This book puts the whole sequence in one place and in order: understand your cash flow, build a budget that survives real life, set aside an emergency fund, deal with debt, create saving systems, understand compound interest, and only then learn the basics of investing, risk, scams and long-term planning.

It is written for people who are starting out or starting over: students, young professionals, freelancers with uneven income, and anyone who never had these things explained clearly. It works in any currency. Every example uses the neutral unit **CU** (currency unit), so 1,000 CU can be dollars, euros, rupees or pounds. Swap in your own numbers.

## Important: education, not advice

This book is general education. It is not personalised financial, tax, legal or investment advice, and the author does not know your circumstances. It does not recommend any investment, fund, broker, bank, app or product, and it does not tell you what to buy or sell. Nothing here guarantees any result. Investments can lose value, and past results do not predict future results. Every interest rate, return and price in this book is an **assumption chosen for illustration**, not a forecast and not a current market figure.

Rules differ by country: tax-advantaged accounts, deposit protection, consumer credit law, debt relief processes, insurance and inheritance rules are all local. Where this book gives a country example, it is labelled and sourced. For everything else, check your own country's financial regulator or consumer protection agency, and consider a qualified adviser before making a large decision.

## How the book is organised

Chapters 1 to 3 give you the foundation: a clear view of your money and a budget. Chapters 4 to 7 cover protection and saving: the emergency fund, debt, repayment strategies and saving systems. Chapters 8 to 10 explain compound interest, investing and risk. Chapter 11 covers scams, and Chapter 12 covers long-term planning. The Conclusion gives you a 90-day plan, and the appendices hold the worksheets and glossary in copyable form.

## How to use it

Read one chapter, then do its exercise before moving on. Worksheets are in fenced text blocks so you can copy them into a spreadsheet, a notebook or a notes app. The worked examples show every step so you can check the arithmetic yourself, and you can repeat them with your own figures.

**Rounding convention:** money is rounded to two decimals (half up); where interest is added monthly, it is rounded to the cent each month. Percentages are shown to two decimals when precision matters.

## What this book does not do

It does not pick investments, promise returns, offer credit repair, or replace a debt adviser, accountant, lawyer or financial planner. It does not assume you live in a particular country.

## How this book was researched

On 2026-11-07 the book was planned against a review of listings for competing budgeting, debt and money guides, to see what they leave out (most are single-topic workbooks or short guides), and official consumer-protection pages were read for the emergency fund, debt and scam chapters (listed in Appendix D). Every calculation was produced and checked with a Python script (`verify_math.py`), and each worked example matches the script's output exactly.

# Chapter 1. Understanding personal money management

## What a money system is

A money system is a small set of repeating actions that decide where each unit of income goes before you are tempted to spend it. It has four jobs:

1. **See:** know what comes in, what goes out and what you owe.
2. **Plan:** give every unit of income a job (a budget).
3. **Protect:** hold a cushion so a bad month does not become a debt.
4. **Grow:** reduce costly debt, then save and invest for later goals.

The order matters. Investing before you have a cushion often means selling at a bad time to cover an emergency. Saving aggressively while paying 25 percent interest on a card usually loses ground. The sequence in this book is a common logical order, not a law. Your situation may justify changing it.

## The five numbers that matter

You can run a sound system on five figures. Calculate them in Chapter 2 and update them monthly.

- **Net income:** money that actually arrives after tax and deductions.
- **Essential spending:** what you must pay to live and work (housing, food, transport, utilities, insurance, minimum debt payments).
- **Savings rate:** savings divided by net income.
- **Debt balance and its interest cost:** what you owe and what it costs you per month.
- **Net worth:** assets minus liabilities.

## Cash flow versus wealth

Cash flow is money moving through a period (a month). Wealth is what is left standing at a point in time (net worth). People confuse the two. A high income with high spending creates a lot of cash flow and little wealth. A modest income with a steady surplus builds wealth slowly. The rest of the book is about turning cash flow into protection, then into net worth.

## Needs, wants and the grey zone

Needs are costs you cannot reasonably avoid; wants are optional. Many items are in between: a phone plan is a need, the premium tier is a want. A useful habit is to split each category into a floor (the cheapest acceptable version) and an upgrade. Budget the floor as essential and the upgrade as personal spending.

## Money and behaviour

Most budget failures are not arithmetic failures. Common causes:

- **Plans made for a perfect month.** The budget has no room for irregular costs.
- **Invisible spending.** Small repeated purchases and subscriptions are not tracked.
- **All-or-nothing rules.** One overspend leads to abandoning the system.
- **Social spending pressure.** Costs set by friends, family or status.

The fixes are practical: include a buffer line, track for a month before judging, expect a bad week and adjust rather than quit, and decide in advance how much you will spend on social life.

## Exercise 1: Write your starting statement

```
MY STARTING STATEMENT (date: ________)
1. Money I received last month (after tax): ______ CU
2. Money I spent last month (best estimate): ______ CU
3. Debts I owe (total): ______ CU
4. Cash and savings I hold: ______ CU
5. What worries me most about money: ______________________
6. One money goal for the next 90 days: ______________________
```

Do not try to be exact yet. The aim is an honest starting line.

# Chapter 2. Income and expenses

## Step one: list your income

Write every source of money, in the form it arrives (net).

- **Salary or wages:** use take-home pay, not the headline figure.
- **Self-employment or freelance income:** use what you receive after you set aside tax (see below).
- **Other income:** allowances, side work, benefits, rental income, interest.

If income varies, do not use your best month. Use the method for irregular income later in this chapter.

## Step two: list your expenses

Group expenses by how they behave.

**Fixed expenses** stay about the same each month: rent or mortgage payment, insurance premiums, loan minimums, subscriptions, phone contract.

**Variable expenses** change: groceries, transport, utilities, eating out, clothes, entertainment.

**Irregular expenses** are real but do not arrive monthly: annual insurance, car repairs, medical costs, gifts, travel, replacement of devices. These are the main reason budgets fail, because a monthly view hides them. Chapter 7 covers sinking funds, which turn them into small monthly amounts.

## Cash flow in one line

```
Monthly cash flow = net income received - total spending
```

Positive means you have a surplus to allocate. Negative means you are funding spending with savings or debt, which is the first thing to fix.

## Tracking: three methods

1. **Bank statement review.** Download the last two or three months of statements and categorise each line. Fastest way to start.
2. **Running log.** Record each purchase when it happens, in a notes app or spreadsheet.
3. **Envelope or cash method.** Withdraw cash for variable categories and spend only that. Works well for people who overspend on cards, but is less practical where cash is rarely used.

Pick one and run it for at least 30 days before you decide how to budget.

## Building the tracker in a spreadsheet

Use a sheet with these columns:

```
Date | Description | Category | Amount | Type | Payment method
```

Rules for building it:

- Enter income as positive and spending as negative, or use the Type column (Income, Fixed, Variable, Irregular). Be consistent.
- Keep a short list of categories (10 to 12 is enough) in a separate sheet and use a dropdown for the Category column so spellings stay identical.
- Create a summary sheet with a pivot table or SUMIF formulas that total each category by month, for example `=SUMIFS(Amount, Category, "Groceries", Month, "2026-11")`.
- Add a Month column computed from the date so you can group by month.
- Review weekly for 10 minutes. A tracker you never open is a hobby.

## Income and expense tracker layout

Copy this table into your spreadsheet as the summary view.

```
Category        | Type     | Planned | Actual | Difference
----------------|----------|---------|--------|-----------
Income (net)    | Income   |         |        |
Housing         | Fixed    |         |        |
Utilities       | Fixed    |         |        |
Groceries       | Variable |         |        |
Transport       | Variable |         |        |
Insurance       | Fixed    |         |        |
Debt minimums   | Fixed    |         |        |
Eating out/fun  | Variable |         |        |
Subscriptions   | Fixed    |         |        |
Irregular fund  | Irregular|         |        |
Savings         | Savings  |         |        |
TOTAL SPENDING  |          |         |        |
LEFT OVER       |          |         |        |
```

## Irregular income for freelancers and gig workers

If income swings month to month, a normal monthly budget fails in the low months. Use this method instead.

1. **Separate tax first.** Move a fixed percentage of every payment into a tax account the day it arrives. The right percentage depends on your country and situation; ask your tax authority or an accountant. The worked example in Chapter 3 uses 20 percent as an **assumption only**.
2. **Find your baseline.** List the last 12 months of net income. Take the average of the lowest six months after tax set-aside, rounded down. This is the cautious baseline: budget on it, not on the average of all months. You may choose a somewhat higher salary only if a buffer in the holding account covers the low months, as Chapter 3 shows.
3. **Pay yourself a salary.** Keep income in a holding account and transfer a fixed amount to your everyday account on the same date each month.
4. **Fill the buffer first.** In good months the surplus stays in the holding account until it covers about one month of your salary, then moves on to the emergency fund and goals.
5. **Review quarterly,** and raise your salary only after the holding account has stayed above the buffer for several months.

## Spending analysis exercise

After a month of tracking, calculate each category's share of total spending. Here is an illustrative example with total spending of 2,600 CU:

| Category | Amount (CU) | Share of total |
|---|---|---|
| Housing | 1,100 | 42.31% |
| Food at home | 420 | 16.15% |
| Eating out | 230 | 8.85% |
| Transport | 260 | 10.00% |
| Subscriptions | 64 | 2.46% |
| Other | 526 | 20.23% |
| **Total** | **2,600** | **100.00%** |

Calculation: each share is the category amount divided by 2,600, times 100 (for example 230 / 2,600 = 8.85%). The shares add to 100.00%.

Now answer these for your own figures:

```
SPENDING ANALYSIS
1. Which three categories are the biggest? ____________
2. Which category surprised me (more than I guessed)? ____________
3. Which spending gave me the most value? ____________
4. Which spending gave me the least value? ____________
5. Which single category can I cut by 10 percent without pain? ______
6. What is 10 percent of that category in CU? ______
7. Which subscriptions have I not used in 60 days? ______
```

Look at the "Other" line in the example: 20.23 percent of spending that is uncategorised. If a catch-all category exceeds 10 percent, split it, because you cannot manage what has no name.

## Common mistakes and fixes

| Mistake | Fix |
|---|---|
| Using gross income | Use take-home pay only |
| Ignoring irregular costs | List them for the year, divide by 12 |
| Too many categories | Cap at 10 to 12 |
| Tracking for one week then judging | Track at least 30 days |
| Budgeting freelance income on the best month | Use the lowest-six-month average |

# Chapter 3. Building a realistic budget

## The method: zero-based with a buffer

A zero-based budget assigns every unit of net income to a line, so that income minus all assigned amounts equals zero. Savings and debt payments are lines too. This is not a promise to spend everything: "assigned to savings" counts.

**Steps:**

1. Write your net monthly income (the baseline, if it varies).
2. List fixed costs first (housing, utilities, insurance, debt minimums).
3. Add variable essentials (groceries, transport) using your tracked average.
4. Add annual and irregular costs divided by 12.
5. Add savings: emergency fund, then goals.
6. Add personal spending (fun, eating out).
7. Add a buffer line for small overruns (the budget should have one).
8. Check that the total equals income. Adjust personal spending first, then variable essentials. Do not cut the emergency fund to zero.

Percentage rules of thumb (such as splitting income into needs, wants and savings) are only starting points. Use them to sense-check, not to override your actual costs, which vary with city, family size and income.

## Worked example A: low income

**Assumptions (fictional):** net income 1,800 CU per month, single person, shared housing.

| Line | CU per month |
|---|---|
| Housing | 620 |
| Utilities and phone | 140 |
| Food (groceries) | 330 |
| Transport | 130 |
| Insurance and health | 60 |
| Minimum debt payments | 90 |
| Personal and fun | 100 |
| Emergency fund | 80 |
| Other goals | 50 |
| Buffer | 200 |
| **Total** | **1,800** |

Check: 620 + 140 + 330 + 130 + 60 + 90 + 100 + 80 + 50 + 200 = 1,800, so income minus total = 0. Fixed costs (housing, utilities, insurance, minimums) are 620 + 140 + 60 + 90 = 910 CU, which is 50.56% of income. That is high, which is why the buffer is large: there is little room to absorb a surprise. Whatever is left in the buffer at month end moves to the emergency fund.

## Worked example B: middle income

**Assumptions (fictional):** net income 3,600 CU per month, one adult.

| Line | CU per month |
|---|---|
| Housing | 1,100 |
| Utilities and phone | 220 |
| Food (groceries) | 480 |
| Transport | 260 |
| Insurance and health | 150 |
| Minimum debt payments | 250 |
| Personal and fun | 300 |
| Emergency fund | 300 |
| Other goals | 250 |
| Buffer | 290 |
| **Total** | **3,600** |

Check: 1,100 + 220 + 480 + 260 + 150 + 250 + 300 + 300 + 250 + 290 = 3,600. Fixed costs: 1,100 + 220 + 150 + 250 = 1,720 CU, which is 47.78% of income. Savings and goals (emergency fund plus other goals) are 550 CU, or 15.28% of income (550 / 3,600).

## Worked example C: irregular freelance income

**Assumptions (fictional):** twelve months of gross receipts, in CU: 2,400; 3,900; 1,700; 3,100; 2,600; 4,200; 1,500; 3,300; 2,900; 3,600; 2,000; 3,800. A tax set-aside of 20 percent is assumed (illustration only; your real rate depends on your country and situation).

- Total received: 35,000 CU. Average month: 2,916.67 CU.
- Tax set aside (20%): 7,000.00 CU. Left after tax: 28,000.00 CU, average 2,333.33 CU per month.
- Lowest six months, sorted: 1,500; 1,700; 2,000; 2,400; 2,600; 2,900. Average = 13,100 / 6 = 2,183.33 CU gross.
- The cautious baseline is the lowest-six average after the 20% set-aside: 13,100 x 0.80 / 6 = 1,746.67 CU, which rounds down to 1,700 CU. This example deliberately chooses a higher salary of **2,000 CU per month**, between the cautious baseline (1,746.67) and the all-month after-tax average (2,333.33). That choice is only safe because a buffer exists, as the test below shows. A reader with no buffer should start at 1,700 CU and raise it later.

Budget on the 2,000 CU salary:

| Line | CU per month |
|---|---|
| Housing | 800 |
| Utilities and phone | 150 |
| Food (groceries) | 350 |
| Transport | 120 |
| Insurance and health | 110 |
| Minimum debt payments | 100 |
| Personal and fun | 120 |
| Emergency fund | 180 |
| Other goals | 70 |
| **Total** | **2,000** |

Check: the lines sum to 2,000. Over the year the salary uses 24,000 CU of the 28,000 CU left after tax, leaving a surplus of 4,000 CU in the holding account.

**Does the holding account survive the low months?** Month by month, after-tax income (80% of receipts) minus the 2,000 CU salary gives a running balance of: -80; 1,040; 400; 880; 960; 2,320; 1,520; 2,160; 2,480; 3,360; 2,960; 4,000. The lowest point is -80 CU in month 1, so a starting buffer of at least 80 CU is needed; a full month of salary (2,000 CU) is a much safer starting buffer because real months do not arrive in a convenient order. This is the reason step 4 above exists.

## Monthly budget worksheet

```
MONTHLY BUDGET WORKSHEET        Month: ________
NET INCOME (baseline)                          ______
FIXED
  Housing                                      ______
  Utilities and phone                          ______
  Insurance                                    ______
  Debt minimums                                ______
VARIABLE ESSENTIALS
  Groceries                                    ______
  Transport                                    ______
  Health and personal care                     ______
IRREGULAR (annual total / 12)
  Sinking funds (Chapter 7)                    ______
SAVING
  Emergency fund                               ______
  Goals                                        ______
  Extra debt payment                           ______
PERSONAL
  Fun and eating out                           ______
  Subscriptions                                ______
BUFFER                                         ______
TOTAL ASSIGNED                                 ______
INCOME - TOTAL ASSIGNED (target 0)             ______
```

## When the budget does not balance

If expenses exceed income, there are only three levers: raise income, cut costs, or change a big fixed cost (housing, transport, a loan). Cutting small things while ignoring housing or a car loan rarely closes a large gap. Work through your largest three categories first.

## Common mistakes and fixes

- **No buffer line:** add one; unused buffer rolls to the emergency fund.
- **Budget written once and never reviewed:** hold a 15-minute review at month end (checklist in Appendix A).
- **Guilt after overspending:** move the money between lines and continue. A budget is a plan you edit.

# Chapter 4. Emergency funds

## What it is for

An emergency fund is money held for unplanned essential costs: income loss, urgent repairs, medical bills, travel for family emergencies. It is not for sales, holidays or investments. Its job is to keep a shock from turning into debt.

## How much: a method, not a magic number

No single amount fits everyone. One official source, the US Consumer Financial Protection Bureau, says the right size depends on your situation and suggests basing the goal on unexpected expenses you have faced before (CFPB, accessed 2026-11-07; see Appendix D). Common rules suggest a number of months of essential spending; treat them as a starting range.

**Method:**

1. Calculate **essential monthly spending**: housing, utilities, food, transport, insurance, minimum debt payments, and any required care costs. Exclude fun, subscriptions you could cancel and savings.
2. Pick a **number of months** from the risk checklist below.
3. Multiply.
4. Build in two stages: a **starter fund** (one small cushion, such as one month of essentials or a figure from your own record of surprise costs) and then the **full fund**.

**Choose months by risk:**

| Situation | Suggested range (months) |
|---|---|
| Stable job, no dependants, low fixed costs | 3 |
| One income for a household or dependants | 4 to 6 |
| Variable or freelance income | 6 to 9 |
| Specialised job with long search times | 6 or more |
| Health or housing risk, no insurance | add 1 to 3 |

These ranges are common planning conventions, not rules from a regulator.

## Worked examples

**Example A (low income).** Essential spending 1,200 CU per month, stable job, target 3 months. Target = 1,200 x 3 = 3,600 CU. Starter fund: 1,000 CU. Saving 80 CU per month (from Example A in Chapter 3), the starter fund takes 1,000 / 80 = 12.5, so 13 months, and the full fund takes 3,600 / 80 = 45 months. That is slow. Options: raise the monthly amount using the buffer, direct windfalls (tax refund, gift) into it, or hold the starter fund as the goal for the first year. A slow start is still a start.

**Example B (middle income).** Essential spending 2,300 CU, one household income, target 6 months. Target = 2,300 x 6 = 13,800 CU. Saving 300 CU per month takes 13,800 / 300 = 46 months with no interest. If the money earned an **assumed** 2 percent a year, added monthly (each month's interest is the balance times 0.02 / 12, rounded to the cent, then 300 is added), it would take 45 months and reach 14,007.05 CU. Interest helps a little; the contributions do most of the work.

**Example C (freelancer).** Essential spending 1,550 CU, target 6 to 9 months. 6 months = 9,300 CU; 9 months = 13,950 CU. Saving 180 CU per month (Example C in Chapter 3) takes 9,300 / 180 = 51.67, so 52 months, for the 6 month target. Because that is slow, the freelancer in Chapter 3 also routes surplus months into the fund from the holding account, which can shorten the timeline in good years but is not guaranteed.

## Where to keep it

The fund must be safe, easy to reach and boring: an account you can access within a day or two, separate from your everyday account to reduce temptation, and held with an institution whose deposits are protected under your country's rules (check your own regulator; protection schemes and limits differ by country). Do not put it into assets that can fall in value when you need it, which includes most investments.

## Rules for using it

Write them down so you can decide in advance:

```
EMERGENCY FUND RULES
Use it for: loss of income, urgent health costs, urgent essential
repairs (home, vehicle needed for work), emergency travel.
Do not use it for: sales, holidays, planned costs, upgrades.
If I use it: I will rebuild it before I increase other goals.
Two-question test: Is it unexpected? Is it necessary?
Both must be yes.
```

## Emergency fund planner

```
EMERGENCY FUND PLANNER
Essential monthly spending:                 ______ CU
Months to cover (from risk table):          ______
TARGET (spending x months):                 ______ CU
Starter fund goal:                          ______ CU
Already saved:                              ______ CU
Remaining:                                  ______ CU
Monthly amount I can add:                   ______ CU
Months to starter goal (remaining / monthly): ______
Months to full goal:                        ______
Windfalls to add (tax refund, gifts):       ______
Where the fund is held:                     ______
Review date:                                ______
```

**US example (labelled).** The CFPB page opened for this book recommends setting a specific goal, automating transfers (for example splitting direct deposit where an employer allows it), saving windfalls such as tax refunds, and watching your checking balance to avoid overdraft fees. Readers elsewhere should look for the equivalent guidance from their own consumer protection agency.

## Common mistakes and fixes

- **Waiting to save until debts are gone.** Save a starter fund first or each surprise goes back on the card.
- **Calling every want an emergency.** Use the two-question test.
- **Parking the fund where it can lose value.** Keep it accessible and stable.
- **Never rebuilding it.** Add "refill" as the first goal after any withdrawal.
