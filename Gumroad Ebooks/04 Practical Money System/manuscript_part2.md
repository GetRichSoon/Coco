# Chapter 5. Managing debt

## Why debt needs its own system

Debt is a contract: you receive money now and pay it back later with a cost. Some debt is a reasonable tool; some is expensive and corrosive. The difference is the interest rate, the terms and whether you can afford the payments. This chapter gives you a way to see all your debts on one page.

## Types of debt

| Type | Typical features | Watch for |
|---|---|---|
| Credit card | Revolving, variable rate, minimum payment | High rates, balance carries forward |
| Personal loan | Fixed term, fixed payment | Fees, early repayment terms |
| Student loan | Often special terms, may be income-linked | Rules differ widely by country |
| Vehicle or mortgage loan | Secured on an asset | Asset can be repossessed if you default |
| Store or buy-now-pay-later | Short term, may be interest-free at first | Late fees, deferred interest, stacking |
| Overdraft | Borrowing against your account | Fees and high rates |
| Informal (family, friends) | Flexible | Relationship risk; agree terms in writing |

"Secured" means the lender can take a named asset if you stop paying; "unsecured" means they cannot take it directly, but they can pursue the debt by other legal routes that depend on your country.

## Interest rate versus APR

The **interest rate** is the cost of borrowing before other charges, usually stated per year. The **APR** (annual percentage rate) is intended to express the yearly cost of credit, often including some fees, in a standard form so offers can be compared. The exact definition and what must be included are set by law in each country, so read the lender's disclosure and compare the same measure across offers.

**Compounding matters.** If a card has an **assumed** 18 percent APR with interest added monthly, the monthly rate is 18 / 12 = 1.5%. On a balance of 1,000 CU, the first month's interest is 1,000 x 0.015 = 15.00 CU. Compounded over a year, 1.015^12 - 1 = 19.56% effective annual cost. The gap between 18 and 19.56 is the effect of compounding on the balance. Always compare like with like.

**Fixed-payment loan example (assumptions: 10,000 CU, 8% a year, 24 monthly payments).** The payment formula is:

```
payment = P x i / (1 - (1 + i)^-n)
P = 10,000   i = 0.08 / 12   n = 24
payment = 452.27 CU (rounded to the cent)
total paid = 452.27 x 24 = 10,854.48 CU
interest paid = 10,854.48 - 10,000 = 854.48 CU
```

Rounding the payment to the cent can leave a few cents of difference on the final payment; lenders adjust the last instalment.

## Minimum payments: why they mislead

A minimum payment keeps the account in good standing; it is not a plan to be debt-free. Many cards set the minimum as a percentage of the balance, so the payment shrinks as the balance shrinks and the payoff stretches out.

**Example (assumptions: 2,000 CU balance, 20% APR, minimum is the greater of 25 CU or 3% of the balance, no new spending).**

- Month 1 interest: 2,000 x 0.20 / 12 = 33.33 CU. Balance becomes 2,033.33. Minimum: 3% x 2,033.33 = 61.00 CU.
- Paying only the minimum takes **112 months** (9 years and 4 months) and costs **1,798.28 CU** in interest.
- Paying a fixed **100 CU** every month instead takes **25 months** and costs **453.20 CU** in interest.

Compare the two: the fixed payment pays it off about 87 months sooner. Interest is 1,345.08 CU lower (1,798.28 - 453.20). The lesson is general: keep the payment fixed at the level of your first minimum, or higher, even as the minimum falls.

## Debt inventory

List every debt on one page. Copy this template.

```
DEBT INVENTORY                      Date: ________
Name | Type | Balance | APR % | Min pay | Due date | Secured?
-----|------|---------|-------|---------|----------|---------
1.
2.
3.
4.
5.
TOTAL balance:            ______
TOTAL minimum payments:   ______
Monthly interest estimate (balance x APR / 12, per debt): ______
Debts that are past due:  ______
```

Fill in the APR from your latest statement, not from memory. If you cannot find a figure, ask the lender in writing.

## If you are behind on payments

Missing payments can bring fees, higher rates, damage to your credit record and, for secured debts, loss of the asset. Act early; options shrink as arrears grow.

1. **Prioritise.** Pay essentials and secured debts that protect your housing, transport to work, energy and food before unsecured debt.
2. **Contact the lender before the due date.** Ask what hardship options exist: a payment plan, a temporary reduction, a due-date change. Keep notes of who you spoke to and when.
3. **Use free advice first.** Free, independent debt advice exists in many countries. Do not pay a company that promises to "erase" your debt; check your regulator's guidance on fee-charging firms.
4. **Never ignore letters from a court or collector.** Replies and deadlines often have legal effect.

**Free official or charity sources (examples; check your own country).**

- **United States (CFPB).** The CFPB's debt collection page tells consumers to ask collectors for the creditor's name, the amount and how to dispute it, says that federal law (the Fair Debt Collection Practices Act) restricts what collectors may say or do, and says you can tell a collector to stop contacting you. It also explains the difference between credit counselors and debt settlement companies. CFPB phone line: (855) 411-2372 (page opened 2026-11-07).
- **United Kingdom (GOV.UK).** National Debtline offers free, confidential and independent advice by phone and webchat in England and Wales: 0808 808 4000, Monday to Friday 9am to 8pm, Saturday 9:30am to 1pm per the GOV.UK page opened 2026-11-07. Check the page for current hours, call costs and arrangements in Scotland and Northern Ireland. UK readers can also look for the government-backed MoneyHelper service (not opened for this book; verify it yourself).
- **Elsewhere.** Search for your national consumer protection agency or financial regulator and look for the "debt advice" page. Prefer non-profit or government services.

## Common mistakes and fixes

- **Paying only minimums on everything.** Choose a strategy (Chapter 6).
- **Taking a new loan to pay a card without comparing total cost.** Compare total interest and fees on both sides, and watch for transfer fees and for rates that jump after an introductory period.
- **Hiding from collectors.** Respond in writing and ask for the debt to be verified.
- **Stopping all saving to pay debt.** Keep the starter emergency fund going.

# Chapter 6. Debt repayment strategies

## Three strategies

All three pay the **minimum on every debt** and send every extra unit to one target debt. They differ only in the target.

- **Avalanche:** target the debt with the highest APR first. This minimises total interest.
- **Snowball:** target the smallest balance first. It clears accounts sooner, which some people find easier to stick to.
- **Hybrid:** clear the smallest debt first for an early win, then switch to avalanche order for the rest.

When a debt is cleared, its minimum payment is added to the extra amount (the "rollover"), so total monthly payment stays constant.

## The comparison: same debts, same budget

The numbers below were produced by `verify_math.py`, which simulates each month: interest is added (balance x APR / 12, rounded to the cent), minimums are paid, then the extra goes to the target debt. All rates are **assumptions**.

| Debt | Balance (CU) | APR | Minimum (CU) |
|---|---|---|---|
| Card A | 3,200 | 24% | 80 |
| Card B | 1,100 | 19% | 35 |
| Loan C | 5,500 | 9% | 130 |
| Bill D | 600 | 6% | 25 |
| **Total** | **10,400** | | **270** |

Extra payment: 250 CU a month, so the total monthly debt budget is 520 CU. New borrowing: none. Loan C's minimum is treated as a normal minimum that can be prepaid without penalty (check your own loan's terms).

**Orders:**

- Avalanche: Card A, Card B, Loan C, Bill D.
- Snowball: Bill D, Card B, Card A, Loan C.
- Hybrid: Bill D, then Card A, Card B, Loan C.

### Month 1 working (all strategies share the interest step)

```
Interest: A 3,200 x 0.24 / 12 = 64.00
          B 1,100 x 0.19 / 12 = 17.42 (17.4167 rounded)
          C 5,500 x 0.09 / 12 = 41.25
          D   600 x 0.06 / 12 =  3.00
Total interest month 1 = 125.67
Minimums paid = 270; extra = 250 to the target debt.
Avalanche, end of month 1: A = 3,200 + 64.00 - 80 - 250 = 2,934.00
                           B = 1,100 + 17.42 - 35 = 1,082.42
                           C = 5,500 + 41.25 - 130 = 5,411.25
                           D = 600 + 3.00 - 25 = 578.00
Total owed = 10,005.67
```

### Results

| Measure | Avalanche | Snowball | Hybrid | Minimums only |
|---|---|---|---|---|
| Months to debt-free | 23 | 23 | 23 | 82 |
| Total interest (CU) | 1,288.30 | 1,431.44 | 1,388.48 | 4,917.69 |
| Total paid (CU) | 11,688.30 | 11,831.44 | 11,788.48 | 15,317.69 |
| Final-month payment (CU) | 248.30 | 391.44 | 348.48 | 22.04 |

"Minimums only" does not roll over freed-up payments, so it shows the cost of never raising the payment.

**Payoff month of each debt:**

| Debt | Avalanche | Snowball | Hybrid | Minimums only |
|---|---|---|---|---|
| Bill D | 23 | 3 | 3 | 26 |
| Card B | 14 | 6 | 15 | 44 |
| Card A | 11 | 15 | 13 | 82 |
| Loan C | 23 | 23 | 23 | 52 |

(In the avalanche column Bill D and Loan C both finish in month 23; the last payment clears both.)

### Total owed at the end of each month

| Month | Avalanche | Snowball | Hybrid |
|---|---|---|---|
| 1 | 10,005.67 | 10,005.67 | 10,005.67 |
| 2 | 9,604.96 | 9,608.71 | 9,608.71 |
| 3 | 9,197.76 | 9,209.10 | 9,209.10 |
| 4 | 8,783.96 | 8,804.44 | 8,803.53 |
| 5 | 8,363.43 | 8,394.06 | 8,391.06 |
| 6 | 7,936.03 | 7,977.87 | 7,971.56 |
| 7 | 7,501.66 | 7,555.46 | 7,544.90 |
| 8 | 7,060.18 | 7,125.76 | 7,110.94 |
| 9 | 6,611.46 | 6,688.63 | 6,669.55 |
| 10 | 6,155.39 | 6,243.95 | 6,220.61 |
| 11 | 5,691.80 | 5,791.55 | 5,763.95 |
| 12 | 5,220.73 | 5,331.31 | 5,299.44 |
| 13 | 4,743.24 | 4,863.06 | 4,826.93 |
| 14 | 4,259.27 | 4,386.66 | 4,347.59 |
| 15 | 3,770.51 | 3,901.95 | 3,861.47 |
| 16 | 3,278.14 | 3,411.21 | 3,370.43 |
| 17 | 2,782.14 | 2,916.79 | 2,875.71 |
| 18 | 2,282.48 | 2,418.67 | 2,377.28 |
| 19 | 1,779.13 | 1,916.81 | 1,875.11 |
| 20 | 1,272.06 | 1,411.19 | 1,369.17 |
| 21 | 761.25 | 901.77 | 859.44 |
| 22 | 246.67 | 388.53 | 345.89 |
| 23 | 0.00 | 0.00 | 0.00 |

### What the comparison shows

- All three finish in the same month here because the total budget is the same and the longest, cheapest debt (Loan C) sets the finish line. That will not always be true.
- Avalanche costs the least interest: 143.14 CU less than snowball (1,431.44 - 1,288.30) and 100.18 CU less than hybrid (1,388.48 - 1,288.30) in this example.
- Snowball removes two accounts by month 6 (Bill D in month 3, Card B in month 6); avalanche removes none until month 11. That is the trade: a lower cost for avalanche, earlier visible progress for snowball.
- The much larger effect than the choice of strategy is **paying more than the minimums**: 3,629.39 CU less interest (4,917.69 - 1,288.30) and 59 fewer months than minimums only.
- The gap between strategies depends on how different the rates are, and how large the balances are. If your rates are similar, the order matters little, so pick the one you will follow.

These results are specific to the assumed debts. They are not a prediction for your situation; rerun the comparison with your own numbers.

## Hybrid in practice

A common reading is "one quick win, then maths". Choose the smallest debt only if clearing it frees a meaningful payment or removes a nuisance (a collector's calls, a late-fee risk). Otherwise skip to avalanche.

## Other levers (compare carefully)

- **Lower the rate:** ask the lender; compare a balance transfer or consolidation loan on total cost including fees and the rate after any introductory period. Consolidation does not remove debt; it moves it, and works only if you stop adding new balances.
- **Raise the payment:** use a sinking-fund approach, side income or one-time money.
- **Negotiate:** lenders sometimes agree to payment plans if you contact them early.

## Debt repayment comparison worksheet

```
DEBT REPAYMENT COMPARISON
Debt budget per month (minimums + extra):   ______ CU
Extra above minimums:                       ______ CU

Strategy   | Order of targets | Debt-free month | Total interest
-----------|------------------|-----------------|---------------
Minimums   |                  |                 |
Avalanche  |                  |                 |
Snowball   |                  |                 |
Hybrid     |                  |                 |

Chosen strategy: ________  Why: ____________________
Start date: ______  Review date (every 3 months): ______
```

To fill it in without a script, build a spreadsheet with one row per month per debt: opening balance, interest (balance x APR / 12), payment, closing balance, and a rollover cell that adds a cleared debt's minimum to the extra.

## Common mistakes and fixes

- **Stopping the minimum on the cleared debt without rolling it over:** move the freed amount to the next target on the same day.
- **Adding new card spending while paying:** freeze new borrowing or the plan never ends.
- **Ignoring fees and 0 percent promotional rates that expire:** note expiry dates in the inventory.
- **Choosing a strategy by what sounds best:** run the comparison once and choose.

# Chapter 7. Saving systems

## Pay yourself first

If you save what is left at month end, it is usually nothing. Pay yourself first means the saving transfer happens **right after income arrives**, before you spend. Automate it: a standing order or scheduled transfer on payday into a separate account. Treat it like a bill.

**Setting the amount:** start with what you can sustain through a bad month, not an aspirational figure. For example, 10 percent of a 3,600 CU take-home is 360 CU (3,600 x 0.10). Percentages are only a starting point; raise the amount each time your income rises or a debt is cleared (the rollover principle from Chapter 6).

## Accounts: separate jobs, separate places

Naming accounts makes the goal visible and stops one pot from covering another. A simple structure:

```
1. Everyday account    - bills and spending
2. Emergency fund      - Chapter 4, rarely touched
3. Sinking funds       - irregular costs (below)
4. Goals               - longer-term targets
5. Investing/retirement- Chapters 9 and 12, long horizon only
```

Some banks allow named sub-accounts; otherwise use a spreadsheet to track each purpose in one account.

## Sinking funds: monthly slices of annual costs

A sinking fund saves a fixed amount monthly toward a known, irregular cost.

```
Formula: monthly amount = annual cost / 12
         (or cost / months until it is due)
```

**Illustrative annual costs (fictional):**

| Item | Annual cost (CU) |
|---|---|
| Car service | 420 |
| Annual insurance | 540 |
| Gifts and holidays | 600 |
| Laptop replacement | 900 |
| Medical and dental | 360 |
| **Total** | **2,820** |

Monthly amount = 2,820 / 12 = 235 CU. Without the fund, the 900 CU laptop would arrive as a surprise; with it, the money is waiting.

## Savings goal planner

```
SAVINGS GOAL PLANNER
Goal:                         ______________
Target amount:                ______ CU
Date needed:                  ______
Months remaining:             ______
Already saved:                ______ CU
Monthly amount needed:        (target - saved) / months = ______ CU
Can I afford it? (check against budget): Y / N
If not: lower the target / extend the date / raise income
Where the money is held:      ______________
Progress check dates:         ______
```

**Worked examples:**

1. Goal 2,400 CU in 12 months, nothing saved: 2,400 / 12 = 200 CU a month.
2. Goal 1,800 CU in 9 months, nothing saved: 1,800 / 9 = 200.00 CU a month.

(If the account earns interest, the monthly amount needed is slightly lower; ignore it for short goals unless the rate is meaningful. Keep money for goals under a few years in stable, accessible places, since investments can fall.)

## Order of priorities

A commonly used order, which you may adapt to your situation:

1. Starter emergency fund (a small cushion).
2. Pay down high-interest debt.
3. Grow the emergency fund to its target.
4. Goals and retirement saving, and employer matching contributions where offered (check the terms in your country).
5. Investing beyond retirement accounts.

Debt and saving can run in parallel: a split such as most of the extra to debt and a fixed small amount to the fund is common. Choose the split that stops you from borrowing again.

## Making saving stick

- **Remove friction:** automatic transfers, a separate bank for the emergency fund.
- **Add friction to spending:** delete saved card details on shopping sites.
- **Name the goals:** a named account is harder to raid.
- **Reward progress:** track each goal's percentage in the sheet.

## Common mistakes and fixes

- **Saving into the everyday account:** spend it by accident. Use a separate account.
- **Target too big, date too short:** the monthly amount fails the budget test; extend the date.
- **No sinking funds:** every annual bill feels like an emergency.

# Chapter 8. Compound interest

## The idea

Interest on interest. Money earns a return, and next period the return itself earns a return. The same mechanism works for debt, so it can build savings or raise a balance owed.

## Simple versus compound

- **Simple interest:** earned only on the original amount. 1,000 CU at 5% for 10 years earns 1,000 x 0.05 x 10 = 500 CU, for a total of 1,500 CU.
- **Compound interest:** earned on the growing balance.

## Formulas

**Lump sum:**

```
FV = P x (1 + r/m)^(m x t)
FV = future value    P = amount today
r  = annual rate     m = compounding periods per year
t  = years
```

**Regular deposits at the end of each month:**

```
FV = D x ((1 + i)^n - 1) / i
D = monthly deposit   i = r / 12   n = months
```

## Worked examples (rates are assumptions, not forecasts)

1. **Lump sum, annual compounding.** P = 1,000, r = 5%, m = 1, t = 10. FV = 1,000 x 1.05^10 = **1,628.89 CU**. Compound interest earned is 628.89 versus 500 for simple interest.
2. **Same, compounded monthly.** FV = 1,000 x (1 + 0.05/12)^120 = **1,647.01 CU**. More frequent compounding adds 18.12 CU over ten years.
3. **Longer time.** 1,000 CU at 5% for 30 years = **4,321.94 CU**. Tripling the time more than doubles the final amount, because growth builds on growth.
4. **Small savings goal.** 500 CU at 3% for 5 years, annual compounding = 500 x 1.03^5 = **579.64 CU**.
5. **Regular deposits.** Deposit 200 CU at the end of each month at an assumed 5% a year (i = 0.05/12):

| Years | Total deposited (CU) | Future value (CU) |
|---|---|---|
| 10 | 24,000 | 31,056.46 |
| 20 | 48,000 | 82,206.73 |
| 30 | 72,000 | 166,451.73 |

Growth is not a straight line: the 30-year result is far more than three times the 10-year result. This is an illustration at a constant assumed rate. Real investment returns vary year to year and can be negative, so no investment grows in a smooth line like this.

6. **Debt compounding.** A balance of 1,000 CU at an assumed 18% APR, compounded monthly with no payments, grows over 3 years to 1,000 x 1.015^36 = **1,709.14 CU**. Compounding works against borrowers just as it works for savers.

## Start early or save more? A comparison

Assume a constant 5% a year, deposits of 200 CU a month, and a goal date at 65 (assumptions).

- **Saver A** deposits 200 a month for 10 years (age 25 to 35), then stops and leaves the balance to grow for another 30 years. Total deposited: 24,000 CU. Balance at 35: 31,056.46 CU. Balance at 65: 31,056.46 x (1 + 0.05/12)^360 = **138,752.30 CU**.
- **Saver B** starts at 35 and deposits 200 a month for 30 years. Total deposited: 72,000 CU. Balance at 65: **166,451.73 CU**.

Saver B ends higher, because they deposited three times as much. What the example shows is the weight of time: Saver A deposited one third as much and reached 83.4% of Saver B's result (138,752.30 / 166,451.73). Both approaches work better together; neither is guaranteed.

## The rule of 72 (an approximation)

The rule of 72 estimates doubling time: years to double is roughly 72 divided by the annual percentage rate. It is a **mental shortcut, not an exact answer**. The exact time is ln(2) / ln(1 + r). The table compares them.

| Rate | Rule of 72 (years) | Exact (years) | Error of the rule |
|---|---|---|---|
| 2% | 36.00 | 35.00 | +2.85% |
| 4% | 18.00 | 17.67 | +1.85% |
| 6% | 12.00 | 11.90 | +0.88% |
| 8% | 9.00 | 9.01 | -0.07% |
| 10% | 7.20 | 7.27 | -1.00% |
| 12% | 6.00 | 6.12 | -1.90% |

Error = (rule - exact) / exact. Check: 1,000 CU at 6% for 12 years = 1,000 x 1.06^12 = 2,012.20 CU, slightly more than double, consistent with the exact time being just under 12 years. The rule works best near 8 percent and drifts at very low or very high rates. It also ignores fees, tax and inflation.

## The effect of fees

Fees are charged on the balance, so they compound too. Using the 200 CU a month for 30 years example, with an assumed 5% gross return and the annual fee subtracted from the return (a simplification):

| Annual fee | Net rate | Value after 30 years (CU) | Lost versus no fee (CU) |
|---|---|---|---|
| 0% | 5% | 166,451.73 | 0.00 |
| 1% | 4% | 138,809.88 | 27,641.85 |
| 2% | 3% | 116,547.38 | 49,904.35 |

A 1 percentage point fee reduces the end value by 27,641.85 CU, which is 16.6% of the no-fee result (27,641.85 / 166,451.73), though only 1 point of the return was charged. When you compare any investment or account, find the total yearly cost (fund charges, platform fees, advice fees, trading costs) and test it in the formula.

## Inflation: nominal versus real

Inflation reduces what money buys. If the assumed return is 5% and inflation is an assumed 2%, the **real** return is (1.05 / 1.02) - 1 = 2.94%, not 3% (subtracting gives an approximation; the exact version divides). Applied to the first example, 1,628.89 CU after 10 years is worth 1,628.89 / 1.02^10 = **1,336.26 CU** in today's buying power. Cash in an account paying less than inflation loses buying power, even though the number rises. Inflation and returns both change from year to year; the figures here are placeholders.

## Compound interest calculation template

```
COMPOUND INTEREST WORKSHEET
Lump sum:   FV = P x (1 + r/m)^(m x t)
  P = ____  r = ____  m = ____  t = ____   FV = ____
Monthly deposits:  FV = D x ((1 + i)^n - 1) / i
  D = ____  i = r/12 = ____  n = months = ____   FV = ____
Real value:  FV / (1 + inflation)^t = ____
Fee test: repeat with r reduced by the annual fee = ____
```

Spreadsheet formulas: `=FV(rate/12, years*12, -deposit)` for deposits; `=P*(1+r)^t` for a lump sum; test with a rate of 0 to confirm totals equal deposits.

## Common mistakes and fixes

- **Using one rate as a promise.** It is an assumption.
- **Ignoring fees and inflation.** Run both tests.
- **Treating the rule of 72 as exact.** Use the formula for decisions.
- **Forgetting debt compounds.** Pay costly balances first.
