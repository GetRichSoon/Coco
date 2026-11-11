# Math check log

Produced by `verify_book_numbers.py` (which imports `verify_math.py`) on 2026-11-07. Each row compares the value printed in the book with the value computed by the script.
Rounding: ROUND_HALF_UP to 2 decimals; monthly interest rounded to the cent each month. All rates are illustrative assumptions.

| ID | Chapter | Example | In book | Script | Match |
|---|---|---|---|---|---|
| 2A | Ch2 | Spending shares of 2,600 | 42.31 16.15 8.85 10.00 2.46 20.23 | 42.31 16.15 8.85 10.00 2.46 20.23 | OK |
| 3A | Ch3 | Budget A total / fixed / fixed share | 1800 / 910 / 50.56 | 1800 / 910 / 50.56 | OK |
| 3B | Ch3 | Budget B total / fixed / fixed share | 3600 / 1720 / 47.78 | 3600 / 1720 / 47.78 | OK |
| 3B2 | Ch3 | Budget B savings share 550/3600 | 15.28 | 15.28 | OK |
| 3C1 | Ch3 | Freelance total / average month | 35000 / 2916.67 | 35000 / 2,916.67 | OK |
| 3C2 | Ch3 | Tax 20% / after tax / after-tax average | 7000.00 / 28000.00 / 2333.33 | 7,000.00 / 28,000.00 / 2,333.33 | OK |
| 3C3 | Ch3 | Lowest-six gross average / after tax | 2183.33 / 1746.67 | 2,183.33 / 1,746.67 | OK |
| 3C4 | Ch3 | Freelance budget total / yearly surplus | 2000 / 4000.00 | 2000 / 4,000.00 | OK |
| 4A | Ch4 | 3 x 1200; months at 80 (1000 and 3600) | 3600 / 13 / 45 | 3600 / 13 / 45 | OK |
| 4B | Ch4 | 6 x 2300; months at 300 | 13800 / 46 | 13800 / 46 | OK |
| 4B2 | Ch4 | 13,800 target, 2% APR, 300/month: months, balance | 45 / 14007.05 | 45 / 14007.05 | OK |
| 4C | Ch4 | 6x and 9x 1550; months at 180 | 9300 / 13950 / 52 | 9300 / 13950 / 52 | OK |
| 5A | Ch5 | 18% APR monthly rate; month-1 interest on 1000 | 0.015 / 15.00 | 0.015 / 15.00 | OK |
| 5B | Ch5 | Effective annual rate of 18% monthly (%) | 19.56 | 19.56 | OK |
| 5C | Ch5 | Loan 10000, 8%, 24 months: payment / total / interest | 452.27 / 10854.48 / 854.48 | 452.27 / 10,854.48 / 854.48 | OK |
| 5D | Ch5 | Minimum-pay card: months, interest, month-1 interest, month-1 payment | 112 / 1798.28 / 33.33 / 61.00 | 112 / 1,798.28 / 33.33 / 61.00 | OK |
| 5E | Ch5 | Fixed 100 payment: months, interest | 25 / 453.20 | 25 / 453.20 | OK |
| 5F | Ch5 | Differences: months sooner, interest saved | 87 / 1345.08 | 87 / 1,345.08 | OK |
| 6A | Ch6 | Total debt / monthly debt budget | 10400 / 520 | 10400 / 520 | OK |
| 6B | Ch6 | Avalanche months / interest / total paid | 23 / 1288.30 / 11688.30 | 23 / 1,288.30 / 11,688.30 | OK |
| 6C | Ch6 | Snowball months / interest / total paid | 23 / 1431.44 / 11831.44 | 23 / 1,431.44 / 11,831.44 | OK |
| 6D | Ch6 | Hybrid months / interest / total paid | 23 / 1388.48 / 11788.48 | 23 / 1,388.48 / 11,788.48 | OK |
| 6E | Ch6 | Minimums only months / interest / total paid | 82 / 4917.69 / 15317.69 | 82 / 4,917.69 / 15,317.69 | OK |
| 6F | Ch6 | Interest gaps: snowball-av, hybrid-av, minimums-av | 143.14 / 100.18 / 3629.39 | 143.14 / 100.18 / 3,629.39 | OK |
| 6G | Ch6 | Month-1 interest A,B,C,D, total | 64.00 / 17.42 / 41.25 / 3.00 / 125.67 | 64.00 / 17.42 / 41.25 / 3.00 / 125.67 | OK |
| 6H | Ch6 | Payoff months avalanche (A,B,C,D) | 11 / 14 / 23 / 23 | 11 / 14 / 23 / 23 | OK |
| 6I | Ch6 | Payoff months snowball (A,B,C,D) | 15 / 6 / 23 / 3 | 15 / 6 / 23 / 3 | OK |
| 6J | Ch6 | Payoff months hybrid (A,B,C,D) | 13 / 15 / 23 / 3 | 13 / 15 / 23 / 3 | OK |
| 6K | Ch6 | Payoff months minimums only (A,B,C,D) | 82 / 44 / 52 / 26 | 82 / 44 / 52 / 26 | OK |
| 6L | Ch6 | Final-month payments av/snow/hybrid/min | 248.30 / 391.44 / 348.48 / 22.04 | 248.30 / 391.44 / 348.48 / 22.04 | OK |
| 7A | Ch7 | Goal planner a, b; 10% of 3600; sinking total, monthly | 200 / 200.00 / 360.00 / 2820 / 235 | 200 / 200.00 / 360.00 / 2820 / 235 | OK |
| 8A | Ch8 | 1000 at 5%, 10y annual: FV, simple total, compound interest | 1628.89 / 1500 / 628.89 | 1628.89 / 1500 / 628.89 | OK |
| 8B | Ch8 | Monthly compounding FV; difference | 1647.01 / 18.12 | 1647.01 / 18.12 | OK |
| 8C | Ch8 | 30 years FV; ratio to 10-year FV | 4321.94 / 2.65 | 4321.94 / 2.65 | OK |
| 8D | Ch8 | 500 at 3% for 5 years | 579.64 | 579.64 | OK |
| 8E | Ch8 | 200/month at 5%: 10 / 20 / 30 years | 31056.46 / 82206.73 / 166451.73 | 31056.46 / 82206.73 / 166451.73 | OK |
| 8F | Ch8 | 1000 at 18% monthly, 3 years | 1709.14 | 1709.14 | OK |
| 8G | Ch8 | Saver A at 35 / 65; Saver B at 65; ratio % | 31056.46 / 138752.30 / 166451.73 / 83.4 | 31056.46 / 138752.30 / 166451.73 / 83.4 | OK |
| 8H | Ch8 | Fees 0/1/2% 30y; loss 1%; loss 2%; 1% loss share % | 166451.73 / 138809.88 / 116547.38 / 27641.85 / 49904.35 / 16.6 | 166451.73 / 138809.88 / 116547.38 / 27641.85 / 49904.35 / 16.6 | OK |
| 8I | Ch8 | Real rate (%); real value of 1628.89 after 10y at 2% inflation | 2.94 / 1336.26 | 2.94 / 1336.26 | OK |
| 8J | Ch8 | 1000 at 6% for 12 years | 2012.20 | 2012.20 | OK |
| 8K | Ch8 | Rule of 72 table (rate, rule, exact, error %) | [(2, '36.00', '35.00', '2.85'), (4, '18.00', '17.67', '1.85'), (6, '12.00', '11.90', '0.88'), (8, '9.00', '9.01', '-0.07'), (10, '7.20', '7.27', '-1.00'), (12, '6.00', '6.12', '-1.90')] | [(2, '36.00', '35.00', '2.85'), (4, '18.00', '17.67', '1.85'), (6, '12.00', '11.90', '0.88'), (8, '9.00', '9.01', '-0.07'), (10, '7.20', '7.27', '-1.00'), (12, '6.00', '6.12', '-1.90')] | OK |
| 9A | Ch9 | Fall 50% needs +100%; -20% then +25% | 1000.00 / 1000.00 | 1,000.00 / 1,000.00 | OK |
| 9B | Ch9 | Concentration: 40% of 10000; 40% of 1000 | 4000.00 / 400.00 | 4,000.00 / 400.00 | OK |
| 10A | Ch10 | Insurance: yearly saving; extra excess | 180 / 600 | 180 / 600 | OK |
| 12A | Ch12 | Net worth: assets / liabilities / NW | 8900 / 8100 / 800 | 8900 / 8100 / 800 | OK |
| 3C5 | Ch3 | Holding account running balances and minimum | -80, 1040, 400, 880, 960, 2320, 1520, 2160, 2480, 3360, 2960, 4000 / -80 | -80, 1040, 400, 880, 960, 2320, 1520, 2160, 2480, 3360, 2960, 4000 / -80 | OK |

Rows: 47. Mismatches: 0.
