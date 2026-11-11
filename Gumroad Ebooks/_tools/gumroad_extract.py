# Reads public Gumroad product pages (curl) and prints name, price, ratings count, seller-shown sales, summary.
# Run with: PYTHONIOENCODING=utf-8 python gumroad_extract.py <url> <url> ...
import re,html,json,subprocess,sys
U=sys.argv[1:]  # usage: python gumroad_extract.py seller.gumroad.com/l/slug ...
rows=[]
for u in U:
    s=subprocess.run(['curl','-sL','-A','Mozilla/5.0','https://'+u],capture_output=True).stdout.decode('utf-8','ignore')
    t=html.unescape(s)
    d={'url':u}
    m=re.search(r'"@type":"Product","name":"(.*?)"',t); d['name']=m.group(1) if m else None
    m=re.search(r'"currency_code":"(\w+)","price_cents":(\d+)',t); d['price']=(m.group(2),m.group(1)) if m else None
    m=re.search(r'"sales_count":(\w+)',t); d['sales_shown']=m.group(1) if m else None
    m=re.search(r'"ratings":(\{.*?\}|null)',t); d['ratings']=m.group(1)[:120] if m else None
    m=re.search(r'aggregateRating[^}]*\}',t); d['agg']=m.group(0)[:160] if m else None
    m=re.search(r'"@type":"Product".*?"description":"(.*?)","sku"',t,re.S); d['desc']=(m.group(1)[:260] if m else None)
    m=re.search(r'"covers":\[(.*?)\]',t); d['covers']=len(re.findall('"url"',m.group(1))) if m else None
    rows.append(d)
    print(json.dumps(d,ensure_ascii=True))

