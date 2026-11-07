# Round 3: category-convention cover concepts for the four original books, based on the competitor cover research in each book's 02_audit\COVER_CONVENTIONS.md.
# Output: <book>/03_improved/covers_v3/concept_{A,B,C}/ (cover 1600x2560, poster 1280x720, thumbnail 600x600)
import sys,subprocess,pathlib,tempfile,shutil
from PIL import Image
sys.path.insert(0,str(pathlib.Path(__file__).parent))
import old4_covers_v2 as V
ROOT=V.ROOT; CHROME=V.CHROME; SF=V.SF
BAH="Bahnschrift,'Arial Narrow','Segoe UI',sans-serif"; SER=V.TF
# ---------- new art ----------
def art_score(P):
    bars=[(330,'c1'),(290,'c1'),(150,'ring'),(310,'c1'),(260,'c1')]; its=[]
    for i,(w,k) in enumerate(bars):
        y=64+i*62; col=P['ring'] if k=='ring' else P['bar']
        its.append(f'<text x="30" y="{y+17}" font-family="Segoe UI" font-size="16" fill="{P["lab"]}">Area {i+1}</text><rect x="110" y="{y}" width="{w}" height="26" rx="6" fill="{col}"/>')
    ring=f'<ellipse cx="190" cy="{64+2*62+13}" rx="104" ry="30" fill="none" stroke="{P["ring"]}" stroke-width="5"/><path d="M300 190 C340 150 350 128 372 118" fill="none" stroke="{P["ring"]}" stroke-width="5" stroke-linecap="round"/><text x="330" y="106" font-family="Georgia" font-style="italic" font-size="34" fill="{P["ring"]}">why?</text>'
    pl=f'<line x1="372" y1="40" x2="372" y2="396" stroke="{P["passc"]}" stroke-width="4" stroke-dasharray="9 9"/><text x="372" y="30" font-family="Segoe UI" font-size="16" fill="{P["passc"]}" text-anchor="middle" font-weight="700">PASSING LINE</text>'
    return (f'<svg viewBox="-20 -30 500 470" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(-2.5 230 210)"><rect x="-4" y="-6" width="460" height="420" rx="10" fill="{P["paper"]}" stroke="{P["edge"]}" stroke-width="3"/>'
            f'<text x="30" y="30" font-family="Segoe UI" font-size="19" font-weight="700" fill="{P["ink"]}" letter-spacing="2">SCORE REPORT</text>{"".join(its)}{pl}{ring}</g></svg>')
def art_tiles(P):
    names=['Time','Storage','Requests','Transfer','Capacity']; its=[]
    for i,n in enumerate(names):
        x=i*108; c=P['tiles'][i]
        its.append(f'<rect x="{x}" y="0" width="98" height="120" rx="14" fill="{P["card"]}" stroke="{c}" stroke-width="4"/>')
        cx=x+49
        if i==0: its.append(f'<circle cx="{cx}" cy="46" r="24" fill="none" stroke="{c}" stroke-width="5"/><path d="M{cx} 30 V46 L{cx+12} 54" fill="none" stroke="{c}" stroke-width="5" stroke-linecap="round"/>')
        if i==1: its.append(''.join(f'<rect x="{cx-26}" y="{24+j*20}" width="52" height="14" rx="5" fill="{c}"/>' for j in range(3)))
        if i==2: its.append(f'<path d="M{cx-22} 38 H{cx+14} M{cx+4} 28 L{cx+16} 38 L{cx+4} 48 M{cx+22} 62 H{cx-14} M{cx-4} 52 L{cx-16} 62 L{cx-4} 72" fill="none" stroke="{c}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>')
        if i==3: its.append(f'<path d="M{cx-24} 50 H{cx+24} M{cx+10} 36 L{cx+24} 50 L{cx+10} 64" fill="none" stroke="{c}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><line x1="{cx}" y1="26" x2="{cx}" y2="74" stroke="{c}" stroke-width="3" stroke-dasharray="5 5"/>')
        if i==4: its.append(f'<rect x="{cx-24}" y="30" width="48" height="36" rx="7" fill="none" stroke="{c}" stroke-width="5"/><rect x="{cx-24}" y="30" width="30" height="36" rx="7" fill="{c}"/>')
        its.append(f'<text x="{cx}" y="104" font-family="Segoe UI" font-size="17" font-weight="700" fill="{P["lab"]}" text-anchor="middle">{n}</text>')
    return f'<svg viewBox="-10 -10 540 140" xmlns="http://www.w3.org/2000/svg">{"".join(its)}</svg>'
def art_spike(P):
    vals=[60,70,64,80,72,230,96,70,62,58]; its=[]
    for i,v in enumerate(vals):
        x=i*44; col=P['spike'] if i==5 else P['bar']
        its.append(f'<rect x="{x}" y="{300-v}" width="34" height="{v}" rx="5" fill="{col}"/>')
    cut=f'<path d="M290 40 L240 100 M240 40 L290 100" stroke="{P["spike"]}" stroke-width="0"/><line x1="190" y1="110" x2="372" y2="110" stroke="{P["cut"]}" stroke-width="6" stroke-dasharray="14 10"/><path d="M356 96 L376 110 L356 124" fill="none" stroke="{P["cut"]}" stroke-width="6" stroke-linecap="round"/>'
    return f'<svg viewBox="-20 -20 480 340" xmlns="http://www.w3.org/2000/svg"><line x1="-10" y1="300" x2="450" y2="300" stroke="{P["lab"]}" stroke-width="4"/>{"".join(its)}{cut}<text x="224" y="64" font-family="Segoe UI" font-size="22" font-weight="700" fill="{P["spike"]}" text-anchor="middle">SPIKE</text></svg>'
def art_bubbles_two(P):
    rows=[0,2,'two',3]; its=[f'<rect x="0" y="0" width="420" height="330" rx="18" fill="{P["card"]}" stroke="{P["edge"]}" stroke-width="4"/>']
    for i,s in enumerate(rows):
        y=52+i*74; its.append(f'<text x="24" y="{y+9}" font-family="Georgia" font-size="22" fill="{P["mut"]}">{i+1}</text>')
        for j,l in enumerate('ABCD'):
            cx=104+j*78
            if s=='two' and j in (1,2): its.append(f'<circle cx="{cx}" cy="{y}" r="23" fill="none" stroke="{P["ring"]}" stroke-width="5"/><path d="M{cx} {y-23} A23 23 0 0 {1 if j==1 else 0} {cx} {y+23}" fill="{P["ring"]}"/>')
            elif s==j: its.append(f'<circle cx="{cx}" cy="{y}" r="23" fill="{P["sel"]}"/>')
            else: its.append(f'<circle cx="{cx}" cy="{y}" r="23" fill="none" stroke="{P["mut"]}" stroke-width="3"/><text x="{cx}" y="{y+8}" font-family="Segoe UI" font-size="21" fill="{P["mut"]}" text-anchor="middle">{l}</text>')
    pencil=f'<g transform="rotate(35 396 160)"><rect x="380" y="104" width="22" height="110" rx="4" fill="{P["acc"]}"/><path d="M380 214 H402 L391 242 Z" fill="#f1d9b5"/><path d="M386 232 H396 L391 242 Z" fill="#2b2b2b"/></g>'
    return f'<svg viewBox="-10 -10 470 350" xmlns="http://www.w3.org/2000/svg">{"".join(its)}{pencil}</svg>'
def art_pages(P):
    its=[]
    for i,(dx,dy,rot) in enumerate([(0,30,-9),(110,0,0),(220,30,9)]):
        its.append(f'<g transform="rotate({rot} {dx+90} {dy+130})"><rect x="{dx}" y="{dy}" width="180" height="250" rx="8" fill="{P["paper"]}" stroke="{P["edge"]}" stroke-width="3"/>'
                   f'<rect x="{dx+16}" y="{dy+18}" width="110" height="12" rx="6" fill="{P["ink"]}"/>'+''.join(f'<rect x="{dx+16}" y="{dy+50+k*22}" width="{148-(k%3)*26}" height="8" rx="4" fill="{P["rule"]}"/>' for k in range(7))+f'<rect x="{dx+16}" y="{dy+214}" width="70" height="18" rx="6" fill="{P["acc"]}"/></g>')
    return f'<svg viewBox="-20 -10 440 300" xmlns="http://www.w3.org/2000/svg">{"".join(its)}</svg>'

# ---------- concepts ----------
C={}
C['aswb-clinical-90-day-study-plan']={
 'meta':dict(kicker='2026 ASWB CLINICAL (LCSW) EXAM',main=['90-DAY','STUDY PLAN'],mid='',sub2='',fs=250,tf=BAH,
   tag='A day-by-day independent preparation schedule built for the 2026 exam format, for first attempts and retakes',
   pills=['4 phases','Day-by-day schedule','Spaced review','Pacing for 122 questions'],
   foot='Independent guide. Not affiliated with, endorsed by or approved by ASWB. Contains no examination questions. No pass is promised.'),
 'A':dict(name='Bold exam-prep blue with exam name and year',bg='linear-gradient(#1b57b3,#123f86)',t='#ffffff',k='#ffd27a',tg='#e8f0fb',ft='#b9cdea',br='#ffd27a',fr='#ffffff44',mid='#cfe0f7',pill='#ffd27a',pilltx='#0f2d57',art=V.art_calendar,
   P=dict(c1='#3b73c4',c2='#7fa7e0',c3='#ffffff',c4='#ffc24d',lab='#dbe7f8')),
 'B':dict(name='Clean planner, light with orange exam day',bg='#f7f4ec',t='#0f2d57',k='#e8742a',tg='#33475f',ft='#5d6f83',br='#1f5fa8',fr='#1f5fa833',mid='#1f5fa8',pill='#1f5fa8',pilltx='#ffffff',art=V.art_calendar,
   P=dict(c1='#c8d9ee',c2='#6f9bd1',c3='#1f5fa8',c4='#e8742a',lab='#33475f')),
 'C':dict(name='Navy and copper (old baseline)',bg='radial-gradient(ellipse at 50% 38%,#0c2038 0%,#091523 78%)',t='#f4efe6',k='#9fb3c4',tg='#d8e0e8',ft='#8ea3b5',br='#d08c54',fr='#d08c5455',mid='#c8d3de',pill='#d08c54',pilltx='#0b1b2e',art=V.art_calendar,
   P=dict(c1='#3b2d27',c2='#9a6238',c3='#d08c54',c4='#f4efe6',lab='#c8d3de'))}
C['keep-your-own-books']={
 'meta':dict(kicker='BOOKKEEPING FOR FREELANCERS AND SOLE TRADERS',main=['KEEP YOUR','OWN BOOKS'],mid='',sub2='',fs=205,tf=BAH,
   tag='Close your month in one hour. A simple bookkeeping routine from the first invoice onward',
   pills=['Month-end close in 1 hour','Works in any country','No tax rules'],
   foot='No tax rates, thresholds or filing rules, by design. Not accounting, tax or legal advice.'),
 'A':dict(name='Ledger page, light cream with green band',bg='linear-gradient(#f6f1e4 0 72%,#1f6f5c 72% 100%)',t='#14202b',k='#1f6f5c',tg='#14202b',ft='#e6f0ea',br='#1f6f5c',fr='#1f6f5c33',mid='#1f6f5c',pill='#e86f51',pilltx='#ffffff',art=V.art_ledger,
   P=dict(paper='#ffffff',edge='#14202b',rule='#d8d2c2',ink='#2b3d37',ok='#1f8a5f',bad='#c24a2f',acc='#e0a23a')),
 'B':dict(name='Solid teal guide with coral accent',bg='linear-gradient(#0f6b66,#0b524e)',t='#f4efe6',k='#ffb4a0',tg='#f4efe6',ft='#cfe7e4',br='#f4efe6',fr='#f4efe655',mid='#ffb4a0',pill='#e86f51',pilltx='#ffffff',art=V.art_ledger,
   P=dict(paper='#fbf8f0',edge='#073b38',rule='#d5cdb8',ink='#2b3d37',ok='#1f8a5f',bad='#c24a2f',acc='#e86f51')),
 'C':dict(name='Navy and copper (old baseline)',bg='radial-gradient(ellipse at 50% 38%,#0d2036 0%,#0a1626 78%)',t='#f4efe6',k='#9fb3c4',tg='#d8e0e8',ft='#8ea3b5',br='#d9a35f',fr='#d9a35f55',mid='#c8d3de',pill='#d9a35f',pilltx='#0b1b2e',art=V.art_ledger,
   P=dict(paper='#f4efe6',edge='#d8ccb7',rule='#c9bfae',ink='#33485f',ok='#2f7d6f',bad='#b4543a',acc='#d9a35f'))}
C['retake-exam-technique']={
 'meta':dict(kicker='FOR ANY MULTIPLE-CHOICE LICENSING EXAM',main=['THE RETAKE','METHOD'],mid='',sub2='',fs=185,tf=BAH,
   tag='Exam technique for candidates retaking a professional licensing exam',
   pills=['Score-report diagnosis','Tie-breaker rules','Pacing plan','Exam-day routine'],
   foot='General educational material. Not affiliated with, endorsed by or approved by any examination body. No pass is promised.'),
 'A':dict(name='Annotated score report (cream, navy, copper)',bg='#f4efe6',t='#0f2238',k='#b87333',tg='#0f2238',ft='#5b6672',br='#0f2238',fr='#0f223833',mid='#b87333',pill='#0f2238',pilltx='#f4efe6',art=art_score,
   P=dict(paper='#ffffff',edge='#0f2238',ink='#0f2238',lab='#5b6672',bar='#3aa6a0',ring='#b87333',passc='#0f2238')),
 'B':dict(name='Two bubbles (white, navy, teal)',bg='#ffffff',t='#0f2238',k='#1d8c86',tg='#0f2238',ft='#5b6672',br='#0f2238',fr='#0f223833',mid='#1d8c86',pill='#3aa6a0',pilltx='#06222a',art=art_bubbles_two,
   P=dict(card='#0f2238',edge='#0f2238',mut='#8fa3b8',sel='#ffffff',ring='#3aa6a0',acc='#b87333')),
 'C':dict(name='Badge and proof (deep blue, teal band)',bg='linear-gradient(#0f2238,#0a1829)',t='#ffffff',k='#3aa6a0',tg='#e6edf4',ft='#9fb3c4',br='#3aa6a0',fr='#3aa6a055',mid='#3aa6a0',pill='#3aa6a0',pilltx='#06222a',art=art_pages,
   P=dict(paper='#f4efe6',edge='#d8ccb7',ink='#0f2238',rule='#c9bfae',acc='#3aa6a0'))}
C['where-your-aws-bill-goes']={
 'meta':dict(kicker='AN INDEPENDENT GUIDE TO CLOUD COST',main=['WHERE YOUR','AWS BILL','GOES'],mid='',sub2='',fs=168,tf=BAH,
   tag='Understand it. Trace it. Reduce it. The five shapes of cloud cost and a one-hour monthly review',
   pills=['5 cost shapes','1-hour monthly review','Independent guide'],
   foot='Independent guide. Not affiliated with or endorsed by Amazon Web Services. Contains no prices, rates or figures, by design.'),
 'A':dict(name='The bill, opened (light paper, circled line)',bg='#f6f2ea',t='#101820',k='#e8542f',tg='#101820',ft='#5e6770',br='#101820',fr='#10182033',mid='#e8542f',pill='#101820',pilltx='#f6f2ea',art=V.art_receipt,
   P=dict(paper='#ffffff',edge='#101820',rule='#c6ced6',ink='#27323d',lab='#9aa8b4',acc='#e8542f',bars=['#e8542f','#1f8a8a','#3a68b8','#6a5bb8','#8f52a8'])),
 'B':dict(name='Five meters (dark navy tiles)',bg='linear-gradient(#0b1f33,#071624)',t='#f4efe6',k='#d98e4a',tg='#e6edf4',ft='#9fb3c4',br='#d98e4a',fr='#d98e4a55',mid='#d98e4a',pill='#3aa6a0',pilltx='#06222a',art=art_tiles,
   P=dict(card='#102a44',lab='#cfdbe7',tiles=['#d98e4a','#3aa6a0','#8fb4e8','#f0c35a','#c9a0e8'])),
 'C':dict(name='Cut the spike (bold yellow and black)',bg='#f7c52e',t='#111111',k='#111111',tg='#111111',ft='#3a3210',br='#111111',fr='#11111144',mid='#111111',pill='#111111',pilltx='#f7c52e',art=art_spike,
   P=dict(bar='#111111',spike='#c8362d',cut='#111111',lab='#111111'))}
SIZES=V.SIZES
def html(slug,cid,fmt):
    S=C[slug]; m=S['meta']; c=S[cid]; art=c['art'](c['P'])
    fs=m['fs']; tf=m['tf'] if cid!='C' or slug in ('where-your-aws-bill-goes','aswb-clinical-90-day-study-plan','retake-exam-technique','keep-your-own-books') else SER
    tf=m['tf']
    main=''.join(f'<div class="m">{l}</div>' for l in m['main'])
    pills=''.join(f'<span class="pl">{p}</span>' for p in m['pills'])
    css={'portrait':f'''body{{width:1600px;height:2560px}}.page{{padding:140px 120px 140px;display:flex;flex-direction:column;align-items:center;text-align:center}}
      .brand{{font:700 32px {SF};letter-spacing:.42em;color:var(--br)}}.rule{{width:110px;height:4px;background:var(--br);margin:22px 0 70px}}
      .k{{font:700 44px {SF};letter-spacing:.14em;color:var(--k);margin-bottom:34px;max-width:1300px;line-height:1.25}}.m{{font:700 {fs}px/1.0 {tf};letter-spacing:.005em;text-transform:uppercase}}
      .art{{margin:80px 0 60px;width:{ '1250px' if slug=='where-your-aws-bill-goes' and cid=='B' else '1000px'}}}.art svg{{width:100%}}.tag{{font:600 52px/1.3 {SF};color:var(--tg);max-width:1250px}}
      .pills{{display:flex;flex-wrap:wrap;gap:20px;justify-content:center;margin-top:56px;max-width:1350px}}.pl{{background:var(--pl);color:var(--pltx);font:700 38px {SF};padding:16px 34px;border-radius:60px}}
      .foot{{margin-top:auto;font:400 32px/1.45 {SF};color:var(--ft);max-width:1200px}}.author{{display:none}}''',
     'landscape':f'''body{{width:1280px;height:720px}}.page{{padding:48px 64px;display:grid;grid-template-columns:1.12fr .88fr;gap:30px;align-items:center}}.txt{{text-align:left}}
      .brand{{font:700 15px {SF};letter-spacing:.4em;color:var(--br);margin-bottom:18px}}.k{{font:700 19px {SF};letter-spacing:.1em;color:var(--k);margin-bottom:12px;line-height:1.25}}
      .m{{font:700 {round(fs*.5)}px/1.0 {tf};text-transform:uppercase}}.tag{{font:600 23px/1.35 {SF};color:var(--tg);margin-top:20px;max-width:600px}}
      .pills{{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}}.pl{{background:var(--pl);color:var(--pltx);font:700 16px {SF};padding:7px 15px;border-radius:30px}}
      .art{{width:100%;max-width:430px;justify-self:center}}.art svg{{width:100%}}.foot,.rule,.author{{display:none}}''',
     'square':f'''body{{width:600px;height:600px}}.page{{padding:26px 26px 22px;display:flex;flex-direction:column;align-items:center;text-align:center}}
      .brand{{font:700 11px {SF};letter-spacing:.36em;color:var(--br)}}.rule,.foot,.author,.tag,.pills{{display:none}}.k{{font:700 15px {SF};letter-spacing:.1em;color:var(--k);margin:10px 0 6px;line-height:1.2}}
      .m{{font:700 {round(fs*.37)}px/1.0 {tf};text-transform:uppercase}}.art{{margin-top:auto;width:{ '420px' if slug=='where-your-aws-bill-goes' and cid=='B' else '290px'}}}.art svg{{width:100%}}'''}[fmt]
    txt=f'<div class="brand">THE VELVET FOUNDRY</div><div class="rule"></div><div class="k">{m["kicker"]}</div>{main}'
    if fmt=='portrait': body=f'<div class="page">{txt}<div class="art">{art}</div><div class="tag">{m["tag"]}</div><div class="pills">{pills}</div><div class="foot">{m["foot"]}</div></div>'
    elif fmt=='landscape': body=f'<div class="page"><div class="txt">{txt}<div class="tag">{m["tag"]}</div><div class="pills">{pills}</div></div><div class="art">{art}</div></div>'
    else: body=f'<div class="page">{txt}<div class="art">{art}</div></div>'
    fw={'portrait':'44px','landscape':'20px','square':'12px'}[fmt]
    return (f'<!doctype html><meta charset="utf-8"><style>:root{{--br:{c["br"]};--k:{c["k"]};--tg:{c["tg"]};--ft:{c["ft"]};--mid:{c["mid"]};--pl:{c["pill"]};--pltx:{c["pilltx"]}}}*{{margin:0;box-sizing:border-box}}'
            f'body{{background:{c["bg"]};color:{c["t"]};font-family:{SF};overflow:hidden;position:relative}}.m{{color:{c["t"]};font-variant-numeric:lining-nums}}'
            f'body:before{{content:"";position:absolute;inset:{fw};border:2px solid {c["fr"]};border-radius:4px}}{css}</style><body>{body}</body>')
def render(slug,cid):
    out=ROOT/slug/'03_improved'/'covers_v3'/f'concept_{cid}'; out.mkdir(parents=True,exist_ok=True)
    for fmt,(w,h,name) in SIZES.items():
        tmp=pathlib.Path(tempfile.mkdtemp()); f=tmp/'c.html'; f.write_text(html(slug,cid,fmt),encoding='utf-8'); png=tmp/'c.png'
        sc=2 if fmt!='portrait' else 1
        subprocess.run([CHROME,'--headless=new','--disable-gpu','--hide-scrollbars',f'--force-device-scale-factor={sc}',f'--window-size={w},{h}',f'--screenshot={png}','--user-data-dir='+str(tmp/'p'),f.as_uri()],check=True,timeout=180,capture_output=True)
        im=Image.open(png).convert('RGB')
        if im.size!=(w,h): im=im.resize((w,h),Image.LANCZOS)
        im.save(out/name,optimize=True); shutil.rmtree(tmp,ignore_errors=True)
    print('ok',slug,cid,flush=True)
if __name__=='__main__':
    slugs=[sys.argv[1]] if len(sys.argv)>1 else list(C); cids=[sys.argv[2]] if len(sys.argv)>2 else ['A','B','C']
    for s in slugs:
        for cc in cids: render(s,cc)
