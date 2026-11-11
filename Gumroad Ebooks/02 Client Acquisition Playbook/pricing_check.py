inc, exp = 60000, 12000
weeks, hrs = 46, 25
bill = weeks*hrs
rate = (inc+exp)/bill
print("billable hours", bill, "rate", round(rate,2))
h=40; base=h*rate; buf=base*1.2
print("project base", round(base,2), "with 20% buffer", round(buf,2), "round", round(buf/50)*50)
print("effective hourly if actual 52h at 3000:", round(3000/52,2))
print("value: 30000 extra * 10% =", 30000*.10, " 15%:", 30000*.15)
ret = 10*rate; print("retainer 10h", round(ret,2), "+15% =", round(ret*1.15,2))
# discount arithmetic
print("10% off 3000 =", 3000*.9, " hours to cover:", round(300/rate,2))
# tiers
for p in (1800,3000,4800): print(p, round(p/rate,1),"hours at rate")
# monthly revenue from rates
print("52h at rate", round(52*rate,2))
# funnel
c,r,k,p,w=100,12,5,3,1
print("funnel", r/c, k/r, p/k, w/p, w/c)
print("100 contacts needed for 3 wins at 1%:", 3/0.01)
