# Category-appropriate cover concepts for the four original Velvet Foundry books.
# Each book gets concepts A, B (category conventions) and C (the old navy baseline). Output: <book>/03_improved/covers/concept_X/
# Usage: python old4_covers_v2.py [slug] [concept]   e.g.  python old4_covers_v2.py retake-exam-technique A
import sys,subprocess,pathlib,tempfile,shutil,json
from PIL import Image
ROOT=pathlib.Path(r'C:\Users\Lenovo\Good Space\Coco\Gumroad Ebooks\Original Four')
CHROME=r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
CREAM='#f4efe6'
TF="Constantia,'Palatino Linotype',Georgia,serif"; SF="'Segoe UI',Arial,sans-serif"

# ---------------- art ----------------
def art_calendar(P):
    cells=[]; cw=44; gap=9
    for d in range(1,91):
        w=(d-1)//7; r=(d-1)%7; x=w*(cw+gap); y=r*(cw+gap)
        fill=P['c1'] if d<=30 else P['c2'] if d<=60 else P['c3'] if d<=89 else P['c4']
        cells.append(f'<rect x="{x}" y="{y}" width="{cw}" height="{cw}" rx="7" fill="{fill}"/>')
        if d==90: cells.append(f'<rect x="{x-9}" y="{y-9}" width="{cw+18}" height="{cw+18}" rx="12" fill="none" stroke="{P["c4"]}" stroke-width="4"/>')
    W=13*(cw+gap)-gap; H=7*(cw+gap)-gap
    leg=''.join(f'<rect x="{x}" y="{H+34}" width="26" height="26" rx="6" fill="{c}"/><text x="{x+36}" y="{H+54}" font-family="Segoe UI" font-size="22" fill="{P["lab"]}">{t}</text>' for x,c,t in [(0,P['c1'],'Days 1-30'),(190,P['c2'],'31-60'),(340,P['c3'],'61-89'),(490,P['c4'],'Exam day')])
    return f'<svg viewBox="-16 -16 {W+32} {H+84}" xmlns="http://www.w3.org/2000/svg">{"".join(cells)}{leg}</svg>'

def art_ledger(P):
    def page(x):
        s=f'<rect x="{x}" y="0" width="300" height="400" rx="8" fill="{P["paper"]}" stroke="{P["edge"]}" stroke-width="3"/>'
        s+=''.join(f'<line x1="{x+26}" y1="{70+i*34}" x2="{x+274}" y2="{70+i*34}" stroke="{P["rule"]}" stroke-width="2"/>' for i in range(9))
        s+=f'<line x1="{x+170}" y1="46" x2="{x+170}" y2="368" stroke="{P["rule"]}" stroke-width="2"/><line x1="{x+222}" y1="46" x2="{x+222}" y2="368" stroke="{P["rule"]}" stroke-width="2"/>'
        return s
    def rows(x0):
        o=''
        for i,(w,ci,cw_) in enumerate([(90,0,28),(70,1,24),(100,0,32),(60,1,26),(84,0,34),(110,1,22),(76,0,28),(96,1,30)]):
            y=74+i*34
            o+=f'<rect x="{x0+36}" y="{y}" width="{w}" height="9" rx="4" fill="{P["ink"]}"/>'
            o+=f'<rect x="{x0+(182 if ci==0 else 234)}" y="{y}" width="{cw_}" height="9" rx="4" fill="{P["ok"] if ci==0 else P["bad"]}"/>'
        return o
    hd=lambda x0:(f'<text x="{x0+36}" y="40" font-family="Georgia" font-size="19" fill="{P["ink"]}" letter-spacing="2">ITEM</text><text x="{x0+196}" y="40" font-family="Georgia" font-size="16" fill="{P["ok"]}" text-anchor="middle">IN</text><text x="{x0+248}" y="40" font-family="Georgia" font-size="16" fill="{P["bad"]}" text-anchor="middle">OUT</text>')
    return (f'<svg viewBox="-20 -34 660 480" xmlns="http://www.w3.org/2000/svg"><rect x="-8" y="14" width="636" height="400" rx="14" fill="#000" opacity=".25"/>{page(0)}{page(320)}'
            f'<rect x="300" y="0" width="20" height="400" fill="{P["edge"]}" opacity=".35"/>{rows(0)}{rows(320)}{hd(0)}{hd(320)}'
            f'<path d="M505 -30 h46 v130 l-23 -22 -23 22 z" fill="{P["acc"]}"/></svg>')

def art_bubbles(P):
    rows=[0,2,1,3,1,2]
    def sheet(dx,dy,fill,stroke,sel,muted):
        it=[f'<rect x="{dx}" y="{dy}" width="400" height="418" rx="18" fill="{fill}" stroke="{stroke}" stroke-width="4"/>']
        for i,s in enumerate(rows):
            y=dy+40+i*64
            it.append(f'<text x="{dx+22}" y="{y+9}" font-family="Georgia" font-size="22" fill="{muted}">{i+1}</text>')
            for j,l in enumerate('ABCD'):
                cx=dx+96+j*76
                if j==s: it.append(f'<circle cx="{cx}" cy="{y}" r="22" fill="{sel}"/>')
                else: it.append(f'<circle cx="{cx}" cy="{y}" r="22" fill="none" stroke="{muted}" stroke-width="3"/><text x="{cx}" y="{y+8}" font-family="Segoe UI" font-size="21" fill="{muted}" text-anchor="middle">{l}</text>')
        return ''.join(it)
    back=sheet(-26,-24,P['back'],P['backedge'],P['backsel'],P['backmut']); front=sheet(0,0,P['card'],P['edge'],P['sel'],P['mut'])
    badge=f'<circle cx="400" cy="-4" r="54" fill="{P["acc"]}"/><path d="M375 -4 l19 21 33 -42" fill="none" stroke="{P["badgeink"]}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>'
    return f'<svg viewBox="-60 -80 560 530" xmlns="http://www.w3.org/2000/svg">{back}{front}{badge}</svg>'

def art_receipt(P):
    bars=P['bars']; its=[]
    for i,(w,c) in enumerate(zip([260,170,120,78,44],bars)):
        y=70+i*58
        its.append(f'<rect x="38" y="{y}" width="{w}" height="26" rx="6" fill="{c}"/><rect x="{38+w+14}" y="{y+8}" width="{max(24,70-i*10)}" height="10" rx="5" fill="{P["lab"]}"/>')
    zig=' '.join(f'{x+15} 422 {x+30} 404' for x in range(0,420,30))
    body=(f'<path d="M0 0 H420 V404 L405 422 390 404 375 422 360 404 345 422 330 404 315 422 300 404 285 422 270 404 255 422 240 404 225 422 210 404 195 422 180 404 165 422 150 404 135 422 120 404 105 422 90 404 75 422 60 404 45 422 30 404 15 422 0 404 Z" fill="{P["paper"]}" stroke="{P["edge"]}" stroke-width="3"/>')
    return (f'<svg viewBox="-20 -20 460 470" xmlns="http://www.w3.org/2000/svg">{body}<rect x="38" y="24" width="120" height="14" rx="7" fill="{P["ink"]}"/>{"".join(its)}'
            f'<line x1="38" y1="346" x2="382" y2="346" stroke="{P["rule"]}" stroke-width="3" stroke-dasharray="8 8"/><rect x="38" y="364" width="110" height="16" rx="8" fill="{P["ink"]}"/><rect x="262" y="360" width="120" height="24" rx="8" fill="{P["acc"]}"/></svg>')

# ---------------- concepts ----------------
# bg: css background; t: title colour; k: kicker; tg: tagline; ft: footer; br: brand colour; fr: frame colour
CONCEPTS={
 'aswb-clinical-90-day-study-plan':{
  'meta':dict(kicker='THE',main=['90-DAY'],mid='CLINICAL LICENSING EXAM',sub2='STUDY PLAN',fs=250,
     tag='A structured, independent preparation schedule for the 2026 ASWB Clinical (LCSW) examination',
     foot='Independent guide. Not affiliated with, endorsed by or approved by ASWB. Contains no examination questions.'),
  'A':dict(name='Clean planner (light test-prep)',bg='#f7f4ec',t='#0f2d57',k='#4a6a8f',tg='#33475f',ft='#5d6f83',br='#1f5fa8',fr='#1f5fa833',mid='#1f5fa8',art=art_calendar,
     P=dict(c1='#c8d9ee',c2='#6f9bd1',c3='#1f5fa8',c4='#e8742a',lab='#33475f')),
  'B':dict(name='Bold blue exam-prep',bg='linear-gradient(#1b57b3,#123f86)',t='#ffffff',k='#cfe0f7',tg='#e8f0fb',ft='#b9cdea',br='#ffd27a',fr='#ffffff44',mid='#cfe0f7',art=art_calendar,
     P=dict(c1='#3b73c4',c2='#7fa7e0',c3='#ffffff',c4='#ffc24d',lab='#dbe7f8')),
  'C':dict(name='Navy and copper (old baseline)',bg='radial-gradient(ellipse at 50% 38%,#0c2038 0%,#091523 78%)',t='#f4efe6',k='#9fb3c4',tg='#d8e0e8',ft='#8ea3b5',br='#d08c54',fr='#d08c5455',mid='#c8d3de',art=art_calendar,
     P=dict(c1='#3b2d27',c2='#9a6238',c3='#d08c54',c4='#f4efe6',lab='#c8d3de'))},
 'keep-your-own-books':{
  'meta':dict(kicker='A BOOKKEEPING GUIDE FOR FREELANCERS AND SOLE TRADERS',main=['KEEP YOUR','OWN BOOKS'],mid='',sub2='',fs=205,
     tag='A bookkeeping routine from the first invoice to a month you can close in an hour',
     foot='No tax rates, thresholds or filing rules, by design. Not accounting, tax or legal advice.'),
  'A':dict(name='Ledger green (finance convention)',bg='linear-gradient(#124a38,#0b3326)',t='#f6f1e4',k='#cfe3d8',tg='#e6efe8',ft='#a8c6b7',br='#f2c14e',fr='#f2c14e55',mid='#cfe3d8',art=art_ledger,
     P=dict(paper='#fbf8f0',edge='#0b3326',rule='#d5cdb8',ink='#2b3d37',ok='#1f8a5f',bad='#c24a2f',acc='#f2c14e')),
  'B':dict(name='Ivory and ink (light business)',bg='#f6f2e8',t='#12382c',k='#4a6b5d',tg='#2f4a3f',ft='#5f7a6e',br='#12382c',fr='#12382c33',mid='#4a6b5d',art=art_ledger,
     P=dict(paper='#ffffff',edge='#12382c',rule='#d8d2c2',ink='#2b3d37',ok='#1f8a5f',bad='#c24a2f',acc='#e0a23a')),
  'C':dict(name='Navy and copper (old baseline)',bg='radial-gradient(ellipse at 50% 38%,#0d2036 0%,#0a1626 78%)',t='#f4efe6',k='#9fb3c4',tg='#d8e0e8',ft='#8ea3b5',br='#d9a35f',fr='#d9a35f55',mid='#c8d3de',art=art_ledger,
     P=dict(paper='#f4efe6',edge='#d8ccb7',rule='#c9bfae',ink='#33485f',ok='#2f7d6f',bad='#b4543a',acc='#d9a35f'))},
 'retake-exam-technique':{
  'meta':dict(kicker='FAILED ONCE? DO THIS DIFFERENTLY',main=['THE RETAKE','METHOD'],mid='',sub2='',fs=185,
     tag='Exam technique for candidates retaking a professional licensing exam',
     foot='General educational material. Not affiliated with, endorsed by or approved by any examination body.'),
  'A':dict(name='High-energy yellow (self-improvement convention)',bg='#f7c948',t='#10213a',k='#10213a',tg='#10213a',ft='#3d3418',br='#10213a',fr='#10213a44',mid='#10213a',art=art_bubbles,
     P=dict(back='#e0b23a',backedge='#c9982a',backsel='#c9982a',backmut='#c9982a',card='#10213a',edge='#10213a',sel='#f7c948',mut='#8fa3bd',acc='#ffffff',badgeink='#10213a')),
  'B':dict(name='Clean white and signal red',bg='#fbfaf7',t='#141414',k='#c8362d',tg='#2a2a2a',ft='#666',br='#c8362d',fr='#c8362d33',mid='#c8362d',art=art_bubbles,
     P=dict(back='#eceae4',backedge='#d6d2c8',backsel='#d6d2c8',backmut='#d6d2c8',card='#141b2b',edge='#141b2b',sel='#ffffff',mut='#8794aa',acc='#c8362d',badgeink='#ffffff')),
  'C':dict(name='Navy and teal (old baseline)',bg='radial-gradient(ellipse at 50% 38%,#0b1f2c 0%,#08141d 78%)',t='#f4efe6',k='#9fb3c4',tg='#d8e0e8',ft='#8ea3b5',br='#3fb8b0',fr='#3fb8b055',mid='#c8d3de',art=art_bubbles,
     P=dict(back='#0f2234',backedge='#233e57',backsel='#3a5670',backmut='#3a5670',card='#12283d',edge='#2c4a66',sel='#f4efe6',mut='#6c8aa3',acc='#3fb8b0',badgeink='#0b1b2e'))},
 'where-your-aws-bill-goes':{
  'meta':dict(kicker='AN INDEPENDENT GUIDE TO CLOUD COST',main=['WHERE YOUR','AWS BILL','GOES'],mid='',sub2='',fs=168,
     tag='The five shapes of cloud cost, the decisions that set them, and a monthly review that takes an hour',
     foot='Independent guide. Not affiliated with or endorsed by Amazon Web Services. Contains no prices, rates or figures, by design.'),
  'A':dict(name='Technical dark slate and orange (tech convention)',bg='linear-gradient(#1c2833,#121a22)',t='#ffffff',k='#ffb454',tg='#d9e1e8',ft='#9fb0bf',br='#ff9f2e',fr='#ff9f2e55',mid='#ffb454',art=art_receipt,
     P=dict(paper='#f3f6f9',edge='#ff9f2e',rule='#b6c2cd',ink='#27323d',lab='#aab8c4',acc='#ff9f2e',bars=['#ff9f2e','#2fa3c7','#4a7fd1','#7a6ad1','#a063c4'])),
  'B':dict(name='Light technical chart',bg='#f4f6f8',t='#16222e',k='#d2691a',tg='#34424f',ft='#66737f',br='#16222e',fr='#16222e33',mid='#d2691a',art=art_receipt,
     P=dict(paper='#ffffff',edge='#16222e',rule='#c6ced6',ink='#27323d',lab='#9aa8b4',acc='#e8801c',bars=['#e8801c','#2a86a6','#3a68b8','#6a5bb8','#8f52a8'])),
  'C':dict(name='Navy (old baseline)',bg='radial-gradient(ellipse at 50% 38%,#0b1c2c 0%,#081420 78%)',t='#f4efe6',k='#9fb3c4',tg='#d8e0e8',ft='#8ea3b5',br='#f0a03c',fr='#f0a03c55',mid='#c8d3de',art=art_receipt,
     P=dict(paper='#f4efe6',edge='#f0a03c',rule='#b9a98d',ink='#33485f',lab='#bfc9d3',acc='#f0a03c',bars=['#2fa39b','#2a8f97','#3a77a0','#4a608f','#5a5483']))},
}
SIZES={'portrait':(1600,2560,'cover_portrait_1600x2560.png'),'landscape':(1280,720,'poster_landscape_1280x720.png'),'square':(600,600,'thumbnail_square_600x600.png')}
def html(slug,cid,fmt):
    S=CONCEPTS[slug]; m=S['meta']; c=S[cid]; art=c['art'](c['P'])
    fs=m['fs']; main=''.join(f'<div class="m">{l}</div>' for l in m['main'])
    mid=f'<div class="mid">{m["mid"]}</div>' if m['mid'] else ''; sub2=f'<div class="m s2">{m["sub2"]}</div>' if m['sub2'] else ''
    sc={'portrait':1,'landscape':.46,'square':.33}[fmt]
    css={'portrait':f'''body{{width:1600px;height:2560px}}.page{{padding:150px 130px 150px;display:flex;flex-direction:column;align-items:center;text-align:center}}
      .brand{{font:700 34px {SF};letter-spacing:.42em;color:var(--br)}}.rule{{width:120px;height:4px;background:var(--br);margin:26px 0 80px}}
      .k{{font:700 40px {SF};letter-spacing:.2em;color:var(--k);margin-bottom:30px;max-width:1250px;line-height:1.3}}.m{{font:700 {fs}px/1.02 {TF};letter-spacing:.01em}}.s2{{font-size:150px;margin-top:8px}}
      .mid{{font:600 62px {TF};letter-spacing:.2em;color:var(--mid);margin:26px 0}}.art{{margin:100px 0 80px;width:1050px}}.art svg{{width:100%}}.tag{{font:500 54px/1.36 {TF};color:var(--tg);max-width:1200px}}
      .foot{{margin-top:auto;font:400 34px/1.45 {SF};color:var(--ft);max-width:1150px}}.author{{font:700 34px {SF};letter-spacing:.3em;color:var(--tg);margin:60px 0 36px}}''',
     'landscape':f'''body{{width:1280px;height:720px}}.page{{padding:54px 70px;display:grid;grid-template-columns:1.1fr .9fr;gap:36px;align-items:center}}.txt{{text-align:left}}
      .brand{{font:700 17px {SF};letter-spacing:.4em;color:var(--br);margin-bottom:22px}}.k{{font:700 19px {SF};letter-spacing:.16em;color:var(--k);margin-bottom:12px;line-height:1.3}}
      .m{{font:700 {round(fs*.5)}px/1.02 {TF}}}.s2{{font-size:66px}}.mid{{font:600 26px {TF};letter-spacing:.14em;color:var(--mid);margin:10px 0}}.tag{{font:500 24px/1.4 {TF};color:var(--tg);margin-top:24px;max-width:560px}}
      .art{{width:100%;max-width:450px;justify-self:center}}.art svg{{width:100%}}.foot,.author,.rule{{display:none}}''',
     'square':f'''body{{width:600px;height:600px}}.page{{padding:30px 30px 26px;display:flex;flex-direction:column;align-items:center;text-align:center}}
      .brand{{font:700 12px {SF};letter-spacing:.36em;color:var(--br)}}.rule,.foot,.author,.tag,.k{{display:none}}.m{{font:700 {round(fs*.36)}px/.98 {TF}}}.s2{{font-size:50px}}.mid{{font:600 17px {TF};letter-spacing:.12em;color:var(--mid);margin:6px 0}}.art{{margin-top:auto;width:300px}}.art svg{{width:100%}}'''}[fmt]
    txt=f'<div class="brand">THE VELVET FOUNDRY</div><div class="rule"></div><div class="k">{m["kicker"]}</div>{main}{mid}{sub2}'
    if fmt=='portrait': body=f'<div class="page">{txt}<div class="art">{art}</div><div class="tag">{m["tag"]}</div><div class="author">THE VELVET FOUNDRY EDITORIAL TEAM</div><div class="foot">{m["foot"]}</div></div>'
    elif fmt=='landscape': body=f'<div class="page"><div class="txt">{txt}<div class="tag">{m["tag"]}</div></div><div class="art">{art}</div></div>'
    else: body=f'<div class="page">{txt}<div class="art">{art}</div></div>'
    fw={'portrait':'44px','landscape':'20px','square':'12px'}[fmt]
    return (f'<!doctype html><meta charset="utf-8"><style>:root{{--br:{c["br"]};--k:{c["k"]};--tg:{c["tg"]};--ft:{c["ft"]};--mid:{c["mid"]}}}*{{margin:0;box-sizing:border-box}}'
            f'body{{background:{c["bg"]};color:{c["t"]};font-family:{SF};overflow:hidden;position:relative}}.m{{color:{c["t"]};font-variant-numeric:lining-nums}}'
            f'body:before{{content:"";position:absolute;inset:{fw};border:2px solid {c["fr"]};border-radius:4px}}{css}</style><body>{body}</body>')
def render(slug,cid):
    out=ROOT/slug/'03_improved'/'covers'/f'concept_{cid}'; out.mkdir(parents=True,exist_ok=True)
    for fmt,(w,h,name) in SIZES.items():
        tmp=pathlib.Path(tempfile.mkdtemp()); f=tmp/'c.html'; f.write_text(html(slug,cid,fmt),encoding='utf-8'); png=tmp/'c.png'
        sc=2 if fmt!='portrait' else 1
        subprocess.run([CHROME,'--headless=new','--disable-gpu','--hide-scrollbars',f'--force-device-scale-factor={sc}',f'--window-size={w},{h}',f'--screenshot={png}','--user-data-dir='+str(tmp/'p'),f.as_uri()],check=True,timeout=180,capture_output=True)
        im=Image.open(png).convert('RGB')
        if im.size!=(w,h): im=im.resize((w,h),Image.LANCZOS)
        im.save(out/name,optimize=True); shutil.rmtree(tmp,ignore_errors=True)
    print('ok',slug,cid,flush=True)
if __name__=='__main__':
    slugs=[sys.argv[1]] if len(sys.argv)>1 else list(CONCEPTS); cids=[sys.argv[2]] if len(sys.argv)>2 else ['A','B','C']
    for s in slugs:
        for c in cids: render(s,c)
