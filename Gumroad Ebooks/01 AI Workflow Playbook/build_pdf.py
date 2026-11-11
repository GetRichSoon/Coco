import re,markdown,subprocess,pathlib,html
D=pathlib.Path(__file__).parent
parts=[ "2 Manuscript Part 1 (Ch 1-4).md","3 Manuscript Part 2 (Ch 5-9).md","4 Manuscript Part 3 (Ch 10-12, Appendices).md"]
txt="\n\n".join((D/p).read_text(encoding='utf-8') for p in parts)
# drop title block + manual TOC (generated below)
txt=re.sub(r'^# THE AI WORKFLOW PLAYBOOK.*?\n---\n','',txt,count=1,flags=re.S)
txt=re.sub(r'## Table of contents.*?\n---\n','',txt,count=1,flags=re.S)
txt=re.sub(r'\n---\n','\n',txt)
txt=txt.replace('*End of manuscript.*','')
txt=re.sub(r'^(\*\*[^*\n]+\*\*)\n(?=\d+\. |- )',r'\1\n\n',txt,flags=re.M)
md=markdown.Markdown(extensions=['fenced_code','tables','toc','nl2br','sane_lists'])
body=md.convert(txt)
# TOC from h1/h2 ids
PN=globals().get('PN',{})
items=re.findall(r'<h([12]) id="([^"]+)">(.*?)</h\1>',body)
toc=[]
for lvl,i,t in items:
    t=re.sub('<[^>]+>','',t)
    if lvl=='1' or t.startswith('Workflow'):
        pg=PN.get(i,''); toc.append(f'<div class="t{lvl}"><a href="#{i}">{t}</a><span class="pn">{pg}</span></div>')
css="""
@page{size:6in 9in;margin:.7in .6in .8in .75in;@bottom-center{content:counter(page);font:9pt Georgia;color:#666}}
@page:first{@bottom-center{content:none}}
body{font:10.5pt/1.5 'Segoe UI',Arial,sans-serif;color:#1a1a1a}
h1{font:700 24pt Georgia,serif;color:#0B1330;page-break-before:always;border-bottom:2px solid #D9BD84;padding-bottom:6pt;margin-top:0}
h2{font:700 14pt Georgia,serif;color:#0B1330;margin:16pt 0 4pt;page-break-after:avoid}
h2[id^=workflow]{page-break-before:always;color:#1d4fb8}
p,li{orphans:3;widows:3}
pre{white-space:pre-wrap;word-wrap:break-word;background:#eef3fb;border-left:3px solid #3D8BFF;padding:7pt 9pt;font:9pt/1.4 Consolas,'Courier New',monospace;page-break-inside:auto}
code{font:9pt Consolas,monospace;background:#eef3fb}pre code{background:none}
table{border-collapse:collapse;width:100%;font-size:9pt;margin:8pt 0}th,td{border:1px solid #c9d3e6;padding:3pt 5pt;vertical-align:top}th{background:#0B1330;color:#fff}
.cover{page-break-after:always;text-align:center;padding-top:2.2in}
.cover .s{font:600 10pt Segoe UI;letter-spacing:.3em;color:#9a7b3c}
.cover .t{font:700 38pt/1.1 Georgia;color:#0B1330;margin:10pt 0}
.cover .u{font:12pt/1.5 Georgia;color:#444;margin:0 .3in}
.cover .e{margin-top:1.2in;font:9pt Segoe UI;color:#777}
.toc h1{page-break-before:avoid}.t1{font-weight:700;margin-top:7pt}.t2{margin-left:14pt;font-size:9.5pt}
.toc div{display:flex;justify-content:space-between;gap:8pt}.pn{color:#555}.toc a{color:#0B1330;text-decoration:none}a{color:#1d4fb8}
strong{color:#0B1330}
"""
title='''<div class="cover"><div class="s">THE</div><div class="t">AI WORKFLOW<br>PLAYBOOK</div><div class="u">30 Practical ChatGPT Systems for Small Business, Marketing, Sales &amp; Daily Operations</div><div class="e">Edition 1 &middot; Written 7 November 2026<br>Educational guide. No income or growth is promised.</div></div>'''
page=f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>The AI Workflow Playbook</title><style>{css}</style></head><body>{title}<div class="toc"><h1 id="contents" style="page-break-before:avoid">Contents</h1>{"".join(toc)}</div>{body}</body></html>'
h=D/'_book.html'; h.write_text(page,encoding='utf-8')
out=D/'The_AI_Workflow_Playbook.pdf'
chrome=r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
subprocess.run([chrome,'--headless=new','--disable-gpu','--no-pdf-header-footer','--generate-pdf-document-outline','--user-data-dir='+str(D/'_chrome_tmp'),f'--print-to-pdf={out}',h.as_uri()],check=True,timeout=180)
print('ok',out)
import pypdf,sys
if not PN:
    r=pypdf.PdfReader(str(out)); PN={k.lstrip('/'):r.get_destination_page_number(v)+1 for k,v in r.named_destinations.items()}
    exec(open(__file__,encoding='utf-8').read(),{'PN':PN,'__file__':__file__})
