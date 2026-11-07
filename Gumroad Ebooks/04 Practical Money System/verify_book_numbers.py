"""Compares every number printed in the book with verify_math.py output and writes math_check_log.md.
Run: python verify_book_numbers.py"""
from decimal import Decimal as D
import verify_math as v
from verify_math import R, S, f, r2, debts0

S_ = R["strat"]
P = R["strat_total_paid"]
pay = lambda n: " / ".join(str(S[n][2][k]) for k in ["Card A", "Card B", "Loan C", "Bill D"])
# each row: id, chapter, description, value printed in book, computed value (strings)
rows = [
    ("2A", "Ch2", "Spending shares of 2,600", "42.31 16.15 8.85 10.00 2.46 20.23", " ".join(p[1] for p in R["spend_pct"])),
    ("3A", "Ch3", "Budget A total / fixed / fixed share", "1800 / 910 / 50.56", f"{R['budget_A_total']} / {R['budget_A_fixed']} / {R['budget_A_fixed_pct']}"),
    ("3B", "Ch3", "Budget B total / fixed / fixed share", "3600 / 1720 / 47.78", f"{R['budget_B_total']} / {R['budget_B_fixed']} / {R['budget_B_fixed_pct']}"),
    ("3B2", "Ch3", "Budget B savings share 550/3600", "15.28", f(D(550) / 3600 * 100)),
    ("3C1", "Ch3", "Freelance total / average month", "35000 / 2916.67", f"{R['fl_total']} / {f(R['fl_avg'])}"),
    ("3C2", "Ch3", "Tax 20% / after tax / after-tax average", "7000.00 / 28000.00 / 2333.33", f"{f(R['fl_tax_year'])} / {f(R['fl_after_tax_year'])} / {f(R['fl_after_tax_avg'])}"),
    ("3C3", "Ch3", "Lowest-six gross average / after tax", "2183.33 / 1746.67", f"{f(R['fl_lowest6_avg'])} / {f(R['fl_lowest6_avg'] * D('0.8'))}"),
    ("3C4", "Ch3", "Freelance budget total / yearly surplus", "2000 / 4000.00", f"{R['fl_budget_total']} / {f(R['fl_surplus_year'])}"),
    ("4A", "Ch4", "3 x 1200; months at 80 (1000 and 3600)", "3600 / 13 / 45", f"{R['ef_A_3']} / {R['ef_A_months_80_starter']} / {R['ef_A_months_80_full']}"),
    ("4B", "Ch4", "6 x 2300; months at 300", "13800 / 46", f"{R['ef_B_6']} / {R['ef_B_months_300']}"),
    ("4B2", "Ch4", "13,800 target, 2% APR, 300/month: months, balance", "45 / 14007.05", f"{R['ef_B_interest'][0]} / {R['ef_B_interest'][1]}"),
    ("4C", "Ch4", "6x and 9x 1550; months at 180", "9300 / 13950 / 52", f"{R['ef_F_6']} / {R['ef_F_9']} / {R['ef_F_months_180']}"),
    ("5A", "Ch5", "18% APR monthly rate; month-1 interest on 1000", "0.015 / 15.00", f"{R['apr_monthly']} / {f(R['apr_month1_interest'])}"),
    ("5B", "Ch5", "Effective annual rate of 18% monthly (%)", "19.56", f(R["apr_eff"])),
    ("5C", "Ch5", "Loan 10000, 8%, 24 months: payment / total / interest", "452.27 / 10854.48 / 854.48", f"{f(R['loan_pmt'])} / {f(R['loan_total_paid'])} / {f(R['loan_total_interest'])}"),
    ("5D", "Ch5", "Minimum-pay card: months, interest, month-1 interest, month-1 payment", "112 / 1798.28 / 33.33 / 61.00", f"{R['minpay'][0]} / {f(R['minpay'][1])} / {f(R['minpay'][2][0])} / {f(R['minpay'][2][1])}"),
    ("5E", "Ch5", "Fixed 100 payment: months, interest", "25 / 453.20", f"{R['fixed100'][0]} / {f(R['fixed100'][1])}"),
    ("5F", "Ch5", "Differences: months sooner, interest saved", "87 / 1345.08", f"{R['minpay'][0] - R['fixed100'][0]} / {f(R['minpay'][1] - R['fixed100'][1])}"),
    ("6A", "Ch6", "Total debt / monthly debt budget", "10400 / 520", f"{R['debt_total']} / {R['debt_budget']}"),
    ("6B", "Ch6", "Avalanche months / interest / total paid", "23 / 1288.30 / 11688.30", f"{S_['Avalanche'][0]} / {S_['Avalanche'][1]} / {P['Avalanche']}"),
    ("6C", "Ch6", "Snowball months / interest / total paid", "23 / 1431.44 / 11831.44", f"{S_['Snowball'][0]} / {S_['Snowball'][1]} / {P['Snowball']}"),
    ("6D", "Ch6", "Hybrid months / interest / total paid", "23 / 1388.48 / 11788.48", f"{S_['Hybrid'][0]} / {S_['Hybrid'][1]} / {P['Hybrid']}"),
    ("6E", "Ch6", "Minimums only months / interest / total paid", "82 / 4917.69 / 15317.69", f"{S_['Minimums only'][0]} / {S_['Minimums only'][1]} / {P['Minimums only']}"),
    ("6F", "Ch6", "Interest gaps: snowball-av, hybrid-av, minimums-av", "143.14 / 100.18 / 3629.39", f"{f(v.S['Snowball'][1] - v.S['Avalanche'][1])} / {f(v.S['Hybrid'][1] - v.S['Avalanche'][1])} / {f(v.S['Minimums only'][1] - v.S['Avalanche'][1])}"),
    ("6G", "Ch6", "Month-1 interest A,B,C,D, total", "64.00 / 17.42 / 41.25 / 3.00 / 125.67",
     " / ".join(f(r2(d[1] * d[2] / 12)) for d in debts0) + " / " + f(sum(r2(d[1] * d[2] / 12) for d in debts0))),
    ("6H", "Ch6", "Payoff months avalanche (A,B,C,D)", "11 / 14 / 23 / 23", pay("Avalanche")),
    ("6I", "Ch6", "Payoff months snowball (A,B,C,D)", "15 / 6 / 23 / 3", pay("Snowball")),
    ("6J", "Ch6", "Payoff months hybrid (A,B,C,D)", "13 / 15 / 23 / 3", pay("Hybrid")),
    ("6K", "Ch6", "Payoff months minimums only (A,B,C,D)", "82 / 44 / 52 / 26", pay("Minimums only")),
    ("6L", "Ch6", "Final-month payments av/snow/hybrid/min", "248.30 / 391.44 / 348.48 / 22.04",
     " / ".join(f(v.S[n][3][-1][2]) for n in ["Avalanche", "Snowball", "Hybrid", "Minimums only"])),
    ("7A", "Ch7", "Goal planner a, b; 10% of 3600; sinking total, monthly", "200 / 200.00 / 360.00 / 2820 / 235",
     f"{R['goal_planner_a']} / {R['goal_planner_b']} / {f(R['pyf_10pct_3600'])} / {R['sinking_total']} / {R['sinking_month']}"),
    ("8A", "Ch8", "1000 at 5%, 10y annual: FV, simple total, compound interest", "1628.89 / 1500 / 628.89", f"{R['fv_1000_5_10']} / {R['si_1000_5_10']:.0f} / {f(R['fv_1000_5_10'] - 1000)}"),
    ("8B", "Ch8", "Monthly compounding FV; difference", "1647.01 / 18.12", f"{R['fv_1000_5_10_monthly']} / {f(R['fv_1000_5_10_monthly'] - R['fv_1000_5_10'])}"),
    ("8C", "Ch8", "30 years FV; ratio to 10-year FV", "4321.94 / 2.65", f"{R['fv_1000_5_30']} / {f(R['fv_1000_5_30'] / R['fv_1000_5_10'])}"),
    ("8D", "Ch8", "500 at 3% for 5 years", "579.64", f"{R['fv_500_3_5']}"),
    ("8E", "Ch8", "200/month at 5%: 10 / 20 / 30 years", "31056.46 / 82206.73 / 166451.73", f"{R['fv_200_5_10']} / {R['fv_200_5_20']} / {R['fv_200_5_30']}"),
    ("8F", "Ch8", "1000 at 18% monthly, 3 years", "1709.14", f"{R['card_1000_18_3y']}"),
    ("8G", "Ch8", "Saver A at 35 / 65; Saver B at 65; ratio %", "31056.46 / 138752.30 / 166451.73 / 83.4", f"{R['early_A_at35']} / {R['early_A_at65']} / {R['late_B_at65']} / {r2(R['early_A_at65'] / R['late_B_at65'] * 100):.1f}"),
    ("8H", "Ch8", "Fees 0/1/2% 30y; loss 1%; loss 2%; 1% loss share %", "166451.73 / 138809.88 / 116547.38 / 27641.85 / 49904.35 / 16.6",
     f"{R['fee_0.00']} / {R['fee_0.01']} / {R['fee_0.02']} / {R['fee_diff_1']} / {R['fee_diff_2']} / {r2(R['fee_diff_1'] / R['fee_0.00'] * 100):.1f}"),
    ("8I", "Ch8", "Real rate (%); real value of 1628.89 after 10y at 2% inflation", "2.94 / 1336.26", f"{f(R['real_rate'])} / {R['real_fv_1000_10']}"),
    ("8J", "Ch8", "1000 at 6% for 12 years", "2012.20", f"{R['rule72_check_6']}"),
    ("8K", "Ch8", "Rule of 72 table (rate, rule, exact, error %)",
     "[(2, '36.00', '35.00', '2.85'), (4, '18.00', '17.67', '1.85'), (6, '12.00', '11.90', '0.88'), (8, '9.00', '9.01', '-0.07'), (10, '7.20', '7.27', '-1.00'), (12, '6.00', '6.12', '-1.90')]", str(R["rule72"])),
    ("9A", "Ch9", "Fall 50% needs +100%; -20% then +25%", "1000.00 / 1000.00", f"{f(D(500) * 2)} / {f(D(1000) * D('0.8') * D('1.25'))}"),
    ("9B", "Ch9", "Concentration: 40% of 10000; 40% of 1000", "4000.00 / 400.00", f"{f(D(10000) * D('0.4'))} / {f(D(1000) * D('0.4'))}"),
    ("10A", "Ch10", "Insurance: yearly saving; extra excess", "180 / 600", f"{40 * 12 - 25 * 12} / {800 - 200}"),
    ("12A", "Ch12", "Net worth: assets / liabilities / NW", "8900 / 8100 / 800", f"{R['nw_assets']} / {R['nw_liab']} / {R['nw']}"),
]
# holding-account running balance (Ch3 example C): independent check
bal = D(0); run = []
for x in v.inc:
    bal += D(x) * D("0.8") - 2000; run.append(bal)
rows.append(("3C5", "Ch3", "Holding account running balances and minimum",
             "-80, 1040, 400, 880, 960, 2320, 1520, 2160, 2480, 3360, 2960, 4000 / -80",
             ", ".join(f"{int(b)}" for b in run) + " / " + f"{int(min(run))}"))

bad = 0
out = ["# Math check log", "",
       "Produced by `verify_book_numbers.py` (which imports `verify_math.py`) on 2026-11-07. Each row compares the value printed in the book with the value computed by the script.",
       "Rounding: ROUND_HALF_UP to 2 decimals; monthly interest rounded to the cent each month. All rates are illustrative assumptions.", "",
       "| ID | Chapter | Example | In book | Script | Match |", "|---|---|---|---|---|---|"]
for i, ch, desc, book, comp in rows:
    ok = book.replace(",", "") == comp.replace(",", "")
    bad += not ok
    out.append(f"| {i} | {ch} | {desc} | {book} | {comp} | {'OK' if ok else 'MISMATCH'} |")
out += ["", f"Rows: {len(rows)}. Mismatches: {bad}."]
open("math_check_log.md", "w", encoding="utf-8").write("\n".join(out) + "\n")
print("rows", len(rows), "mismatches", bad)
for line in out:
    if "MISMATCH" in line:
        print(line)
