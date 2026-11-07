# Designs improved covers for the four original Velvet Foundry books (HTML + inline SVG -> headless Chrome -> PNG).
# Usage: python old4_covers.py [slug ...]
import sys,subprocess,pathlib,tempfile,shutil
from PIL import Image
ROOT=pathlib.Path(r'C:\Users\Lenovo\Good Space\Coco\Gumroad Ebooks\Original Four')
CHROME=r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
NAVY='#0b1b2e'; CREAM='#f4efe6'

def art_aswb(accent='#d08c54'):
    # 13 weeks x 7 days = 91 cells, day 90 = exam day ring
    cells=[]; cw=44; gap=9; ox=0; oy=0
    for d in range(1,92):
        w=(d-1)//7; r=(d-1)%7
        x=ox+w*(cw+gap); y=oy+r*(cw+gap)
        if d<=30: fill='#3b2d27'; op=1; stroke=accent
        elif d<=60: fill='#9a6238'; op=1; stroke='none'
        elif d<=89: fill=accent; op=1; stroke='none'
        elif d==90: fill=CREAM; op=1; stroke='none'
        else: fill='none'; op=.0; stroke='none'
        if d==91: continue
        cells.append(f'<rect x="{x}" y="{y}" width="{cw}" height="{cw}" rx="7" fill="{fill}" stroke="{stroke}" stroke-width="2.5" opacity="{op}"/>')
        if d==90:
            cells.append(f'<rect x="{x-9}" y="{y-9}" width="{cw+18}" height="{cw+18}" rx="12" fill="none" stroke="{CREAM}" stroke-width="3"/>')
    W=13*(cw+gap)-gap; H=7*(cw+gap)-gap
    return f'<svg viewBox="-14 -14 {W+28} {H+28}" xmlns="http://www.w3.org/2000/svg">{"".join(cells)}</svg>'

def art_keep(accent='#d9a35f'):
    page=lambda x:(f'<rect x="{x}" y="0" width="300" height="400" rx="8" fill="#f4efe6"/>'+
        ''.join(f'<line x1="{x+26}" y1="{70+i*34}" x2="{x+274}" y2="{70+i*34}" stroke="#c9bfae" stroke-width="2"/>' for i in range(9))+
        f'<line x1="{x+170}" y1="46" x2="{x+170}" y2="368" stroke="#b9a98d" stroke-width="2"/><line x1="{x+222}" y1="46" x2="{x+222}" y2="368" stroke="#b9a98d" stroke-width="2"/>')
    nums=''.join(f'<rect x="{x}" y="{74+i*34}" width="{w}" height="9" rx="4" fill="{c}"/>' for i,(x,w,c) in enumerate([(35,90,'#33485f'),(35,70,'#33485f'),(35,100,'#33485f'),(35,60,'#33485f'),(35,84,'#33485f'),(35,110,'#33485f'),(35,76,'#33485f'),(35,96,'#33485f')]))
    ink=''.join(f'<rect x="{x}" y="{74+i*34}" width="{w}" height="9" rx="4" fill="{c}"/>' for i,(x,w,c) in enumerate([(182,30,'#2f7d6f'),(182,24,'#2f7d6f'),(234,26,'#b4543a'),(182,34,'#2f7d6f'),(234,22,'#b4543a'),(182,28,'#2f7d6f'),(234,30,'#b4543a'),(182,32,'#2f7d6f')]))
    nums2=''.join(f'<rect x="{x}" y="{74+i*34}" width="{w}" height="9" rx="4" fill="#33485f"/>' for i,(x,w) in enumerate([(335,100),(335,78),(335,96),(335,64),(335,110),(335,72),(335,90),(335,84)]))
    ink2=''.join(f'<rect x="{x}" y="{74+i*34}" width="{w}" height="9" rx="4" fill="{c}"/>' for i,(x,w,c) in enumerate([(482,28,'#2f7d6f'),(534,24,'#b4543a'),(482,30,'#2f7d6f'),(534,26,'#b4543a'),(482,34,'#2f7d6f'),(534,22,'#b4543a'),(482,26,'#2f7d6f'),(534,30,'#b4543a')]))
    return (f'<svg viewBox="-20 -30 660 470" xmlns="http://www.w3.org/2000/svg"><rect x="-10" y="12" width="640" height="400" rx="14" fill="#06101d" opacity=".5"/>'
            f'{page(0)}{page(320)}<rect x="300" y="0" width="20" height="400" fill="#d8ccb7"/>{nums}{ink}{nums2}{ink2}'
            f'<path d="M505 -26 h46 v128 l-23 -22 -23 22 z" fill="{accent}"/>'
            f'<text x="36" y="40" font-family="Georgia" font-size="19" fill="#33485f" letter-spacing="2">ITEM</text><text x="196" y="40" font-family="Georgia" font-size="16" fill="#2f7d6f" letter-spacing="1" text-anchor="middle">IN</text><text x="248" y="40" font-family="Georgia" font-size="16" fill="#b4543a" letter-spacing="1" text-anchor="middle">OUT</text></svg>')

def art_retake(accent='#3fb8b0'):
    rows=[(0,'B'),(2,'D'),(1,'A'),(3,'C'),(1,'B'),(2,'C')]
    def sheet(dx,dy,fill,stroke,sel_fill,muted):
        it=[f'<rect x="{dx}" y="{dy}" width="400" height="418" rx="18" fill="{fill}" stroke="{stroke}" stroke-width="3"/>']
        for i,(sel,_) in enumerate(rows):
            y=dy+40+i*64
            it.append(f'<text x="{dx+22}" y="{y+9}" font-family="Georgia" font-size="22" fill="#9fb3c4">{i+1}</text>')
            for j,l in enumerate('ABCD'):
                cx=dx+96+j*76
                if j==sel: it.append(f'<circle cx="{cx}" cy="{y}" r="22" fill="{sel_fill}"/>')
                else: it.append(f'<circle cx="{cx}" cy="{y}" r="22" fill="none" stroke="{muted}" stroke-width="3"/><text x="{cx}" y="{y+8}" font-family="Segoe UI" font-size="21" fill="{muted}" text-anchor="middle">{l}</text>')
        return ''.join(it)
    back=sheet(-26,-24,'#0f2234','#233e57','#3a5670','#3a5670')
    front=sheet(0,0,'#12283d','#2c4a66',CREAM,'#6c8aa3')
    badge=f'<circle cx="400" cy="-4" r="52" fill="{accent}"/><path d="M376 -4 l18 20 32 -40" fill="none" stroke="#0b1b2e" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>'
    return f'<svg viewBox="-60 -80 560 530" xmlns="http://www.w3.org/2000/svg">{back}{front}{badge}</svg>'

def art_aws(accent='#f0a03c'):
    # receipt with five cost bars, tallest highlighted
    bars=[(260,'#2fa39b'),(170,'#2a8f97'),(120,'#3a77a0'),(78,'#4a608f'),(44,'#5a5483')]
    items=[]
    for i,(w,c) in enumerate(bars):
        y=70+i*58
        items.append(f'<rect x="38" y="{y}" width="{w}" height="26" rx="6" fill="{c}"/><rect x="{38+w+14}" y="{y+8}" width="{max(24,70-i*10)}" height="10" rx="5" fill="#bfc9d3"/>')
    teeth=''.join(f'<path d="M{x} 404 l15 18 15 -18" fill="#0f2238"/>' for x in range(0,420,30))
    return (f'<svg viewBox="-20 -20 460 470" xmlns="http://www.w3.org/2000/svg"><path d="M0 0 H420 V404 L405 422 390 404 375 422 360 404 345 422 330 404 315 422 300 404 285 422 270 404 255 422 240 404 225 422 210 404 195 422 180 404 165 422 150 404 135 422 120 404 105 422 90 404 75 422 60 404 45 422 30 404 15 422 0 404 Z" fill="{CREAM}"/>'
            f'<rect x="38" y="24" width="120" height="14" rx="7" fill="#33485f"/>{"".join(items)}'
            f'<line x1="38" y1="346" x2="382" y2="346" stroke="#b9a98d" stroke-width="3" stroke-dasharray="8 8"/><rect x="38" y="364" width="110" height="16" rx="8" fill="#33485f"/><rect x="262" y="360" width="120" height="24" rx="8" fill="{accent}"/></svg>')

B={
 'aswb-clinical-90-day-study-plan':dict(accent='#d08c54',art=art_aswb,kicker='THE',fs=232,main=['90-DAY'],mid='CLINICAL LICENSING EXAM',sub2='STUDY PLAN',
    tag='A structured, independent preparation schedule for the 2026 ASWB Clinical (LCSW) examination',
    foot='Independent guide. Not affiliated with, endorsed by or approved by ASWB. Contains no examination questions.',grad=('#0c2038','#091523')),
 'keep-your-own-books':dict(accent='#d9a35f',art=art_keep,kicker='A BOOKKEEPING GUIDE',fs=205,main=['KEEP YOUR','OWN BOOKS'],mid='',sub2='',
    tag='A bookkeeping routine for freelancers and sole traders, from the first invoice to a month you can close in an hour',
    foot='No tax rates, thresholds or filing rules, by design. Not accounting, tax or legal advice.',grad=('#0d2036','#0a1626')),
 'retake-exam-technique':dict(accent='#3fb8b0',art=art_retake,kicker='THE',fs=250,main=['RETAKE','METHOD'],mid='',sub2='',
    tag='Exam technique for candidates retaking a professional licensing exam',
    foot='General educational material. Not affiliated with, endorsed by or approved by any examination body.',grad=('#0b1f2c','#08141d')),
 'where-your-aws-bill-goes':dict(accent='#f0a03c',art=art_aws,kicker='AN INDEPENDENT GUIDE',fs=205,main=['WHERE YOUR','AWS BILL','GOES'],mid='',sub2='',
    tag='The five shapes of cloud cost, the decisions that set them, and a monthly review that takes an hour',
    foot='Independent guide. Not affiliated with or endorsed by Amazon Web Services. Contains no prices, rates or figures, by design.',grad=('#0b1c2c','#081420')),
}
TITLEFONT="Constantia,'Palatino Linotype',Georgia,serif"
def html(slug,fmt):
    b=B[slug]; a=b['accent']; art=b['art'](a) if slug!='aswb-clinical-90-day-study-plan' else art_aswb(a)
    g1,g2=b['grad']
    main=''.join(f'<div class="m">{l}</div>' for l in b['main'])
    mid=f'<div class="mid">{b["mid"]}</div>' if b['mid'] else ''
    sub2=f'<div class="m s2">{b["sub2"]}</div>' if b['sub2'] else ''
    css={
    'portrait':'''body{width:1600px;height:2560px}.page{padding:150px 130px 150px;display:flex;flex-direction:column;align-items:center;text-align:center}
      .brand{font:600 34px "Segoe UI";letter-spacing:.42em;color:var(--a)}.rule{width:120px;height:3px;background:var(--a);margin:26px 0 90px}
      .k{font:600 42px "Segoe UI";letter-spacing:.34em;color:#9fb3c4;margin-bottom:26px}.m{font:700 %dpx/1.02 %s;color:#f4efe6;letter-spacing:.01em;font-variant-numeric:lining-nums}.s2{font-size:150px;margin-top:8px}
      .mid{font:500 62px %s;letter-spacing:.2em;color:#c8d3de;margin:26px 0}.art{margin:110px 0 90px;width:1080px}.art svg{width:100%%}.tag{font:400 54px/1.38 %s;color:#d8e0e8;max-width:1180px}
      .foot{margin-top:auto;font:400 34px/1.45 "Segoe UI";color:#8ea3b5;max-width:1150px}.author{font:600 36px "Segoe UI";letter-spacing:.3em;color:#c8d3de;margin:70px 0 40px}'''%(b.get('fs',232),TITLEFONT,TITLEFONT,TITLEFONT),
    'landscape':'''body{width:1280px;height:720px}.page{padding:54px 70px;display:grid;grid-template-columns:1.08fr .92fr;gap:40px;align-items:center}
      .txt{text-align:left}.brand{font:600 17px "Segoe UI";letter-spacing:.4em;color:var(--a);margin-bottom:26px}.k{font:600 21px "Segoe UI";letter-spacing:.3em;color:#9fb3c4;margin-bottom:10px}
      .m{font:700 %dpx/1.02 %s;color:#f4efe6;font-variant-numeric:lining-nums}.s2{font-size:70px}.mid{font:500 28px %s;letter-spacing:.16em;color:#c8d3de;margin:10px 0}.tag{font:400 25px/1.4 %s;color:#d8e0e8;margin-top:26px;max-width:560px}
      .art{width:100%%;max-width:470px;justify-self:center}.art svg{width:100%%}.foot{display:none}.author{display:none}.rule{display:none}'''%(round(b.get('fs',232)*.46),TITLEFONT,TITLEFONT,TITLEFONT),
    'square':'''body{width:600px;height:600px}.page{padding:34px 34px 30px;display:flex;flex-direction:column;align-items:center;text-align:center}
      .brand{font:600 12px "Segoe UI";letter-spacing:.36em;color:var(--a)}.rule{display:none}.k{font:600 15px "Segoe UI";letter-spacing:.3em;color:#9fb3c4;margin:12px 0 6px}
      .m{font:700 %dpx/.98 %s;color:#f4efe6;font-variant-numeric:lining-nums}.s2{font-size:54px}.mid{font:500 19px %s;letter-spacing:.14em;color:#c8d3de;margin:6px 0}.art{margin-top:auto;width:300px;padding-bottom:6px}.art svg{width:100%%}
      .tag{display:none}.foot{display:none}.author{display:none}'''%(round(b.get('fs',232)*.33),TITLEFONT,TITLEFONT)}[fmt]
    txt=f'<div class="brand">THE VELVET FOUNDRY</div><div class="rule"></div><div class="k">{b["kicker"]}</div>{main}{mid}{sub2}'
    if fmt=='portrait':
        body=f'<div class="page">{txt}<div class="art">{art}</div><div class="tag">{b["tag"]}</div><div class="author">THE VELVET FOUNDRY EDITORIAL TEAM</div><div class="foot">{b["foot"]}</div></div>'
    elif fmt=='landscape':
        body=f'<div class="page"><div class="txt">{txt}<div class="tag">{b["tag"]}</div></div><div class="art">{art}</div></div>'
    else:
        body=f'<div class="page">{txt}<div class="art">{art}</div></div>'
    return f'''<!doctype html><meta charset="utf-8"><style>:root{{--a:{a}}}*{{margin:0;box-sizing:border-box}}html{{background:{g2}}}
body{{background:radial-gradient(ellipse at 50% 38%,{g1} 0%,{g2} 78%);color:#f4efe6;font-family:"Segoe UI";overflow:hidden;position:relative}}
body:before{{content:"";position:absolute;inset:{ {'portrait':'44px','landscape':'22px','square':'14px'}[fmt] };border:{ {'portrait':'3px','landscape':'2px','square':'2px'}[fmt] } solid {a}55;border-radius:4px}}
{css}</style><body>{body}</body>'''
SIZES={'portrait':(1600,2560,'cover_portrait_1600x2560.png'),'landscape':(1280,720,'poster_landscape_1280x720.png'),'square':(600,600,'thumbnail_square_600x600.png')}
def render(slug):
    out=ROOT/slug/'03_improved'/'covers'; out.mkdir(parents=True,exist_ok=True)
    for fmt,(w,h,name) in SIZES.items():
        tmp=pathlib.Path(tempfile.mkdtemp()); f=tmp/'c.html'; f.write_text(html(slug,fmt),encoding='utf-8'); png=tmp/'c.png'
        scale=2 if fmt!='portrait' else 1
        subprocess.run([CHROME,'--headless=new','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=%d'%scale,f'--window-size={w},{h}',f'--screenshot={png}','--user-data-dir='+str(tmp/'p'),f.as_uri()],check=True,timeout=120,capture_output=True)
        im=Image.open(png).convert('RGB')
        if im.size!=(w,h): im=im.resize((w,h),Image.LANCZOS)
        im.save(out/name,optimize=True); shutil.rmtree(tmp,ignore_errors=True)
    print('ok',slug)
if __name__=='__main__':
    for s in (sys.argv[1:] or list(B)): render(s)
