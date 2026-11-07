# Recomputes every figure in the worked month and the small worked examples of keep-your-own-books.
bank0,rec0,eq0,pay0,dep0=4200,1500,1600,300,600
assert bank0+rec0+eq0==7300 and pay0+dep0==900 and 7300-900==6400
moves=[+1500,-300,-450,-1200,-60,+1400,-15]
assert sum(moves)==875 and bank0+sum(moves)==5075
rev=2000+3000; sub=800; gp=rev-sub
assert (rev,gp)==(5000,4200) and round(gp/rev*100)==84
profit=gp-60-450-15; assert profit==3675
rec1=rec0-1500+1400+3000-1400; pay1=pay0-300+800
assert (rec1,pay1)==(3000,800)
assets=5075+rec1+1600; eq1=6400+profit-1200
assert assets==9675 and eq1==8875 and pay1+eq1==9675
assert 3675-1500-600+500-1200==875          # bridge (receivables +1500, deposit 600, payables +500, drawings 1200)
assert (rec1-rec0, pay1-pay0)==(1500,500)
assert 5075-800==4275
assert 2000//4==500 and round(500/12)==42     # depreciation example
assert 10000-2000==8000                         # December example, accrual
assert abs(540-450)%9==0 and abs(1278-1728)%9==0
assert 15+20+2+10+5+5+3==60                     # month-end timings
print("all figures verified")
