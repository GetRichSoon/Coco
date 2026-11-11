"""Verifies every calculation in The Practical Money System.
Run: python verify_math.py   (prints results).
Rounding: ROUND_HALF_UP to 2 decimals for money; interest rounded to cents each month.
All rates are ASSUMPTIONS for illustration only."""
from decimal import Decimal as D, ROUND_HALF_UP, getcontext
import math
getcontext().prec = 40


def r2(x):
    return D(x).quantize(D("0.01"), rounding=ROUND_HALF_UP)


def f(x):
    return f"{r2(x):,.2f}"


R = {}  # results quoted in the book

# ---- Ch3 budgets
A_net = D(1800)
A = {"Housing": 620, "Utilities and phone": 140, "Food (groceries)": 330, "Transport": 130,
     "Insurance and health": 60, "Minimum debt payments": 90, "Personal and fun": 100,
     "Emergency fund": 80, "Other goals": 50, "Buffer": 200}
B_net = D(3600)
B = {"Housing": 1100, "Utilities and phone": 220, "Food (groceries)": 480, "Transport": 260,
     "Insurance and health": 150, "Minimum debt payments": 250, "Personal and fun": 300,
     "Emergency fund": 300, "Other goals": 250, "Buffer": 290}
FIXED = ["Housing", "Utilities and phone", "Insurance and health", "Minimum debt payments"]
for k, (n, b) in {"A": (A_net, A), "B": (B_net, B)}.items():
    R[f"budget_{k}_total"] = sum(b.values())
    R[f"budget_{k}_diff"] = n - sum(b.values())
    R[f"budget_{k}_fixed"] = sum(b[x] for x in FIXED)
    R[f"budget_{k}_fixed_pct"] = r2(D(R[f"budget_{k}_fixed"]) / n * 100)

# freelancer: 12 months of gross income
inc = [2400, 3900, 1700, 3100, 2600, 4200, 1500, 3300, 2900, 3600, 2000, 3800]
R["fl_total"] = sum(inc)
R["fl_avg"] = D(sum(inc)) / 12
srt = sorted(inc)
R["fl_lowest3_avg"] = D(sum(srt[:3])) / 3
R["fl_lowest6_avg"] = D(sum(srt[:6])) / 6
R["fl_tax_rate_assumed"] = D("0.20")
tax = [r2(D(x) * D("0.20")) for x in inc]
R["fl_tax_year"] = sum(tax)
R["fl_after_tax_year"] = D(sum(inc)) - sum(tax)
R["fl_after_tax_avg"] = R["fl_after_tax_year"] / 12
FL = {"Housing": 800, "Utilities and phone": 150, "Food (groceries)": 350, "Transport": 120,
      "Insurance and health": 110, "Minimum debt payments": 100, "Personal and fun": 120,
      "Emergency fund": 180, "Other goals": 70, "Buffer": 0}
R["fl_budget_total"] = sum(FL.values())
R["fl_salary_year"] = D(R["fl_budget_total"]) * 12
R["fl_surplus_year"] = R["fl_after_tax_year"] - R["fl_salary_year"]
R["fl_after_tax_lowest3"] = sorted([D(x) * D("0.8") for x in inc])[:3]

# ---- Ch4 emergency funds
ess_A = D(1200); ess_B = D(2300); ess_F = D(1550)
R["ef_A_3"] = ess_A * 3; R["ef_B_6"] = ess_B * 6; R["ef_F_6"] = ess_F * 6; R["ef_F_9"] = ess_F * 9
R["ef_A_months_80_starter"] = math.ceil(1000 / 80)
R["ef_A_months_80_full"] = math.ceil(3600 / 80)
R["ef_B_months_300"] = math.ceil(13800 / 300)
R["ef_F_months_180"] = math.ceil(9300 / 180)


def months_to_target(target, dep, apr, start=0):
    bal = D(start); m = 0
    while bal < target:
        bal = r2(bal + bal * D(apr) / 12) + dep; m += 1
    return m, r2(bal)


R["ef_B_interest"] = months_to_target(D(13800), D(300), D("0.02"))

# ---- Ch5 APR vs rate
apr = D("0.18")
R["apr_monthly"] = apr / 12
R["apr_eff"] = ((1 + apr / 12) ** 12 - 1) * 100
R["apr_month1_interest"] = r2(D(1000) * apr / 12)


def pmt(P, rate, n):
    i = D(rate) / 12
    return P * i / (1 - (1 + i) ** (-n))


R["loan_pmt"] = r2(pmt(D(10000), "0.08", 24))
R["loan_total_paid"] = R["loan_pmt"] * 24
R["loan_total_interest"] = R["loan_total_paid"] - 10000


def min_sim(b, apr, pct, floor, cap=600):
    b = D(b); tot = D(0); m = 0; first = None
    while b > 0 and m < cap:
        i = r2(b * D(apr) / 12); b += i
        p = max(D(floor), r2(b * D(pct))); p = min(p, b)
        if first is None:
            first = (i, p)
        b -= p; tot += i; m += 1
    return m, r2(tot), first


R["minpay"] = min_sim(2000, "0.20", "0.03", 25)


def fixed_sim(b, apr, pay):
    b = D(b); tot = D(0); m = 0
    while b > 0:
        i = r2(b * D(apr) / 12); b += i; p = min(D(pay), b); b -= p; tot += i; m += 1
    return m, r2(tot)


R["fixed100"] = fixed_sim(2000, "0.20", 100)

# ---- Ch6 strategies
debts0 = [("Card A", D(3200), D("0.24"), D(80)), ("Card B", D(1100), D("0.19"), D(35)),
          ("Loan C", D(5500), D("0.09"), D(130)), ("Bill D", D(600), D("0.06"), D(25))]
EXTRA = D(250)
BUDGET = sum(d[3] for d in debts0) + EXTRA
R["debt_total"] = sum(d[1] for d in debts0)
R["debt_budget"] = BUDGET


def simulate(order, minonly=False, cap=600):
    bal = {d[0]: d[1] for d in debts0}
    apr = {d[0]: d[2] for d in debts0}
    mn = {d[0]: d[3] for d in debts0}
    total_int = D(0); m = 0; rows = []; payoff = {}
    while any(v > 0 for v in bal.values()) and m < cap:
        m += 1
        for k in bal:
            if bal[k] > 0:
                i = r2(bal[k] * apr[k] / 12); bal[k] += i; total_int += i
        spent = D(0)
        for k in bal:
            if bal[k] > 0:
                p = min(mn[k], bal[k]); bal[k] -= p; spent += p
        if not minonly:
            rem = BUDGET - spent
            for k in order:
                if rem <= 0:
                    break
                if bal[k] > 0:
                    p = min(rem, bal[k]); bal[k] -= p; rem -= p; spent += p
        for k in bal:
            if bal[k] == 0 and k not in payoff:
                payoff[k] = m
        rows.append((m, dict(bal), spent))
    return m, total_int, payoff, rows


order_av = [d[0] for d in sorted(debts0, key=lambda d: -d[2])]
order_sn = [d[0] for d in sorted(debts0, key=lambda d: d[1])]
smallest = order_sn[0]
order_hy = [smallest] + [k for k in order_av if k != smallest]
S = {}
for name, o in [("Avalanche", order_av), ("Snowball", order_sn), ("Hybrid", order_hy)]:
    S[name] = simulate(o)
S["Minimums only"] = simulate(order_av, minonly=True)
R["orders"] = (order_av, order_sn, order_hy)
R["strat"] = {k: (v[0], f(v[1]), v[2]) for k, v in S.items()}
R["strat_total_paid"] = {k: f(v[1] + R["debt_total"]) for k, v in S.items()}

# ---- Ch7 savings
R["goal_planner_a"] = D(2400) / 12
R["goal_planner_b"] = r2(D(1800) / 9)
sinking = [("Car service", 420), ("Annual insurance", 540), ("Gifts and holidays", 600),
           ("Laptop replacement", 900), ("Medical and dental", 360)]
R["sinking_total"] = sum(x[1] for x in sinking)
R["sinking_month"] = D(R["sinking_total"]) / 12
R["pyf_10pct_3600"] = D(3600) * D("0.10")


# ---- Ch8 compound
def fv_lump(P, r, n, m=1):
    return P * (1 + D(r) / m) ** (m * n)


def fv_ann(pmt_, r, years):
    i = D(r) / 12; n = years * 12
    return pmt_ * (((1 + i) ** n - 1) / i)


R["fv_1000_5_10"] = r2(fv_lump(D(1000), "0.05", 10))
R["si_1000_5_10"] = D(1000) + D(1000) * D("0.05") * 10
R["fv_1000_5_10_monthly"] = r2(fv_lump(D(1000), "0.05", 10, 12))
R["fv_1000_5_30"] = r2(fv_lump(D(1000), "0.05", 30))
for y in (10, 20, 30):
    R[f"fv_200_5_{y}"] = r2(fv_ann(D(200), "0.05", y))
    R[f"contrib_200_{y}"] = 200 * 12 * y
a35 = fv_ann(D(200), "0.05", 10)
A65 = a35 * (1 + D("0.05") / 12) ** (12 * 30)
R["early_A_at35"] = r2(a35); R["early_A_at65"] = r2(A65); R["early_A_contrib"] = 200 * 120
R["late_B_at65"] = r2(fv_ann(D(200), "0.05", 30)); R["late_B_contrib"] = 200 * 360
for fee in ("0.00", "0.01", "0.02"):
    net = D("0.05") - D(fee)
    R[f"fee_{fee}"] = r2(fv_ann(D(200), net, 30))
R["fee_diff_1"] = R["fee_0.00"] - R["fee_0.01"]
R["fee_diff_2"] = R["fee_0.00"] - R["fee_0.02"]
R["real_rate"] = (D("1.05") / D("1.02") - 1) * 100
R["real_fv_1000_10"] = r2(R["fv_1000_5_10"] / (D("1.02") ** 10))
rule = []
for rt in (2, 4, 6, 8, 10, 12):
    approx = D(72) / rt
    exact = D(math.log(2)) / D(math.log(1 + rt / 100))
    rule.append((rt, f(approx), f(exact), f((approx - exact) / exact * 100)))
R["rule72"] = rule
R["card_1000_18_3y"] = r2(fv_lump(D(1000), "0.18", 3, 12))
R["rule72_check_6"] = r2(fv_lump(D(1000), "0.06", 12))
R["fv_500_3_5"] = r2(fv_lump(D(500), "0.03", 5))

# ---- Ch12 net worth and Ch2/3 spending analysis
assets = [("Current account", 900), ("Emergency fund", 2400), ("Retirement account", 5200), ("Laptop (resale)", 400)]
liab = [("Credit card", 1300), ("Student loan", 6800)]
R["nw_assets"] = sum(a[1] for a in assets)
R["nw_liab"] = sum(l[1] for l in liab)
R["nw"] = R["nw_assets"] - R["nw_liab"]
spend = [("Housing", 1100), ("Food at home", 420), ("Eating out", 230), ("Transport", 260),
         ("Subscriptions", 64), ("Other", 526)]
tot = sum(s[1] for s in spend)
R["spend_total"] = tot
R["spend_pct"] = [(s[0], f(D(s[1]) / D(tot) * 100)) for s in spend]

if __name__ == "__main__":
    for k, v in R.items():
        print(k, "=", v)
    for name, (m, ti, po, rows) in S.items():
        print("\n##", name, "months", m, "interest", f(ti), "payoff", po)
        for (mm, b, s) in rows:
            if mm in (1, 2, 3, 6, 12, 18, 24, 30, 36) or mm == m:
                print(mm, {k: f(v) for k, v in b.items()}, f(s))
