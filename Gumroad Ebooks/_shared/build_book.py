# Usage: python build_book.py <key>   (keys: 01..05). Builds the book PDF next to the manuscript parts.
import re,sys,subprocess,pathlib,html,markdown,shutil,tempfile
from PIL import Image
import pypdf
ROOT=pathlib.Path(__file__).resolve().parent.parent
BOOKS={
 '01':dict(folder='01 AI Workflow Playbook',cover='01_AI_Workflow_Playbook_Portrait_Cover.png',out='01_The_AI_Workflow_Playbook.pdf',
   title=['THE','AI WORKFLOW','PLAYBOOK'],sub='30 Practical ChatGPT Systems for Small Business, Marketing, Sales &amp; Daily Operations',
   parts=['2 Manuscript Part 1 (Ch 1-4).md','3 Manuscript Part 2 (Ch 5-9).md','4 Manuscript Part 3 (Ch 10-12, Appendices).md'],
   toc2=r'^Workflow',brk2=r'^Workflow',brk3=None,toc3=None,
   note='All business examples, names and figures in this book are fictional and for illustration only. This is an educational guide; it does not promise income or growth.'),
 '02':dict(folder='02 Client Acquisition Playbook',cover='02_Client_Acquisition_Playbook_Portrait_Cover.png',out='02_The_Client_Acquisition_Playbook.pdf',
   title=['THE','CLIENT ACQUISITION','PLAYBOOK'],sub='A Practical System for Finding Leads, Booking Calls &amp; Winning Clients',
   parts='glob',toc2=None,brk2=None,brk3=None,toc3=None,
   note='This is an educational guide, not legal or tax advice. Rules on outreach, privacy and advertising differ by country; check the rules that apply to you. Examples are fictional. No results are promised.'),
 '03':dict(folder='03 Python Automation',cover='03_Python_Automation_Portrait_Cover.png',out='03_Python_Automation_for_Beginners.pdf',
   title=['PYTHON','AUTOMATION','FOR BEGINNERS'],sub='25 Practical Projects for Files, Spreadsheets, Reports &amp; Everyday Work',
   parts='glob',toc2=None,brk2=None,brk3=r'^Project',toc3=r'^Project',
   note='Code is provided as is, for learning. Run scripts on copies of your files first and keep backups. Each project states what was and was not tested.'),
 '04':dict(folder='04 Practical Money System',cover='04_Practical_Money_System_Portrait_Cover.png',out='04_The_Practical_Money_System.pdf',
   title=['THE PRACTICAL','MONEY','SYSTEM'],sub='A Beginner&#39;s Guide to Budgeting, Saving, Debt Payoff &amp; Building Wealth',
   parts='glob',toc2=None,brk2=None,brk3=None,toc3=None,
   note='This book is general financial education. It is not personalised financial, tax, legal or investment advice, and it does not recommend any product. Investing involves risk, including loss. Rules and taxes differ by country. Examples use assumed figures.'),
 '05':dict(folder='05 Job Interview Playbook',cover='05_Job_Interview_Playbook_Portrait_Cover.png',out='05_The_Job_Interview_Playbook.pdf',
   title=['THE JOB','INTERVIEW','PLAYBOOK'],sub='100 Common Interview Questions, Powerful Answer Frameworks, Resume &amp; LinkedIn Strategies',
   parts='glob',toc2=None,brk2=None,brk3=None,toc3=None,
   note='This book is general career guidance. It does not guarantee interviews, offers or any outcome. Hiring practices differ by employer and country. Example answers are fictional illustrations: use your own true experience.'),
}

OLD='Original Four/'
def _old(slug,title,sub,note,cover):
    return dict(folder=OLD+slug+'/03_improved',cover=cover,out='pdf/'+slug+'.pdf',title=title,sub=sub,parts=['manuscript_with_diagrams.md'],toc2=None,brk2=None,brk3=None,toc3=None,note=note,nl2br=False)
BOOKS['o1']=_old('aswb-clinical-90-day-study-plan',['THE 90-DAY','CLINICAL LICENSING EXAM','STUDY PLAN'],'A structured, independent preparation schedule for the 2026 ASWB Clinical (LCSW) examination','Independent guide. Not affiliated with, endorsed by or approved by ASWB. Contains no examination questions. No pass is promised.','covers_v3/concept_A/cover_portrait_1600x2560.png')
BOOKS['o2']=_old('keep-your-own-books',['KEEP YOUR','OWN BOOKS'],'A bookkeeping routine for freelancers and sole traders, from the first invoice to a month you can close in an hour','Contains no tax rates, thresholds or filing rules, by design. Not accounting, tax or legal advice.','covers_v3/concept_A/cover_portrait_1600x2560.png')
BOOKS['o3']=_old('retake-exam-technique',['THE RETAKE','METHOD'],'Exam technique for candidates retaking a professional licensing exam','General educational material. Not affiliated with, endorsed by or approved by any examination body. No pass is promised.','covers_v3/concept_A/cover_portrait_1600x2560.png')
BOOKS['o4']=_old('where-your-aws-bill-goes',['WHERE YOUR','AWS BILL GOES'],'The five shapes of cloud cost, the decisions that set them, and a monthly review that takes an hour','Independent guide. Not affiliated with or endorsed by Amazon Web Services. Contains no prices, rates or figures, by design.','covers_v3/concept_A/cover_portrait_1600x2560.png')
CSS="""
@page{size:6in 9in;margin:.7in .6in .8in .75in;@bottom-center{content:counter(page);font:9pt Georgia;color:#666}}
@page cover{margin:0;@bottom-center{content:none}}
@page front{@bottom-center{content:none}}
body{font:10.5pt/1.5 'Segoe UI',Arial,sans-serif;color:#1a1a1a}
.cov{page:cover;page-break-after:always;width:6in;height:9in;overflow:hidden}.cov img{width:6in;height:9in;display:block}
.front{page:front}
h1{font:700 23pt/1.15 Georgia,serif;color:#0B1330;page-break-before:always;border-bottom:2px solid #D9BD84;padding:1.1in 0 8pt;margin:0 0 12pt}
h1 .chn{display:block;font:600 9.5pt 'Segoe UI';letter-spacing:.28em;text-transform:uppercase;color:#9a7b3c;margin-bottom:6pt}
h2{font:700 14pt Georgia,serif;color:#0B1330;margin:16pt 0 4pt;page-break-after:avoid}
h3{font:700 11.5pt Georgia,serif;color:#1d4fb8;margin:13pt 0 3pt;page-break-after:avoid}
p,li{orphans:3;widows:3}
pre{white-space:pre-wrap;word-wrap:break-word;background:#eef3fb;border-left:3px solid #3D8BFF;padding:7pt 9pt;font:8.6pt/1.38 Consolas,'Courier New',monospace}
code{font:9pt Consolas,monospace;background:#eef3fb}pre code{background:none;font-size:inherit}
table{border-collapse:collapse;width:100%;font-size:8.8pt;margin:8pt 0}tr{page-break-inside:avoid}th,td{border:1px solid #c9d3e6;padding:3pt 5pt;vertical-align:top}th{background:#0B1330;color:#fff}
.title{text-align:center;padding-top:2.3in;page-break-after:always}.title .s{font:600 10pt 'Segoe UI';letter-spacing:.3em;color:#9a7b3c}.title .t{font:700 36pt/1.1 Georgia;color:#0B1330;margin:6pt 0}.title .u{font:12pt/1.5 Georgia;color:#444;margin:14pt .25in 0}.title .e{margin-top:1.1in;font:9pt 'Segoe UI';color:#777}
.legal{font-size:9pt;color:#444;page-break-after:always;padding-top:.6in}.legal h2{font-size:11pt}
.toc div{display:flex;justify-content:space-between;gap:8pt}.t1{font-weight:700;margin-top:7pt}.t2{margin-left:14pt;font-size:9.5pt}.t3{margin-left:14pt;font-size:9.5pt}.pn{color:#555}.toc a{color:#0B1330;text-decoration:none}a{color:#1d4fb8}
strong{color:#0B1330}img{max-width:100%;height:auto;display:block;margin:10pt auto;page-break-inside:avoid}
"""
def load(b):
    d=ROOT/b['folder']
    if b['parts']=='glob':
        files=sorted(d.glob('manuscript_part*.md'),key=lambda p:int(re.search(r'(\d+)$',p.stem).group(1)))
    else: files=[d/p for p in b['parts']]
    txt="\n\n".join(f.read_text(encoding='utf-8') for f in files)
    txt=re.sub(r'^# THE AI WORKFLOW PLAYBOOK.*?\n---\n','',txt,count=1,flags=re.S)
    txt=re.sub(r'## Table of contents.*?\n---\n','',txt,count=1,flags=re.S)
    txt=re.sub(r'\n---\n','\n',txt).replace('*End of manuscript.*','')
    txt=re.sub(r'^(\*\*[^*\n]+\*\*)\n(?=\d+\. |- )',r'\1\n\n',txt,flags=re.M)
    return txt
def build(key,PN=None):
    b=BOOKS[key]; d=ROOT/b['folder']; PN=PN or {}
    md=markdown.Markdown(extensions=['fenced_code','tables','toc','sane_lists']+(['nl2br'] if b.get('nl2br',True) else []))
    body=md.convert(load(b))
    body=re.sub(r'<h1 id="([^"]+)">(Chapter \d+)\. (.*?)</h1>',r'<h1 id="\1"><span class="chn">\2</span> \3</h1>',body)
    items=re.findall(r'<h([123]) id="([^"]+)">(.*?)</h\1>',body)
    toc=[];marks=[]
    for lvl,i,t in items:
        t=html.unescape(re.sub('<[^>]+>','',t)).strip(); show=False
        if lvl=='1': show=True
        if lvl=='2' and b.get('toc2') and re.match(b['toc2'],t): show=True
        if lvl=='3' and b.get('toc3') and re.match(b['toc3'],t): show=True
        if lvl=='2' and b.get('brk2') and re.match(b['brk2'],t): marks.append(i)
        if lvl=='3' and b.get('brk3') and re.match(b['brk3'],t): marks.append(i)
        if show: toc.append(f'<div class="t{lvl}"><a href="#{i}">{html.escape(t)}</a><span class="pn">{PN.get(i,"")}</span></div>')
    css=CSS+"".join(f'#{i}{{page-break-before:always}}' for i in marks)
    jpg=pathlib.Path(tempfile.gettempdir())/f'cov_{key}.jpg'; Image.open(d/b['cover']).convert('RGB').save(jpg,quality=92)
    tt=b['title']
    titlepg=f'<div class="title front"><div class="s">{tt[0]}</div><div class="t">{"<br>".join(tt[1:])}</div><div class="u">{b["sub"]}</div><div class="e">Edition 1 &middot; 2026</div></div>'
    legal=f'<div class="legal front"><h2>Copyright and notice</h2><p>&copy; 2026. All rights reserved.</p><p>You may copy the templates, worksheets, scripts and checklists in this book for your own personal or business use. You may not resell, share or distribute the book itself. Brief quotations are permitted with credit.</p><h2>Educational notice</h2><p>{b["note"]}</p><h2>Sources</h2><p>Statements of fact are supported by the references at the end of the book, with the date each source was checked. Web pages change; confirm current details before relying on them.</p></div>'
    page=f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{html.unescape(" ".join(tt))}</title><style>{css}</style></head><body><div class="cov"><img src="{jpg.as_uri()}"></div>{titlepg}{legal}<div class="toc"><h1 id="contents" style="page-break-before:avoid">Contents</h1>{"".join(toc)}</div>{body}</body></html>'
    h=d/'_book.html'; h.write_text(page,encoding='utf-8')
    out=d/b['out']; out.parent.mkdir(parents=True,exist_ok=True); prof=tempfile.mkdtemp()
    subprocess.run([r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe','--headless=new','--disable-gpu','--no-pdf-header-footer','--generate-pdf-document-outline','--user-data-dir='+prof,f'--print-to-pdf={out}',h.as_uri()],check=True,timeout=300)
    shutil.rmtree(prof,ignore_errors=True)
    if not PN:
        r=pypdf.PdfReader(str(out)); PN={k.lstrip('/'):r.get_destination_page_number(v)+1 for k,v in r.named_destinations.items()}
        return build(key,PN)
    h.unlink(missing_ok=True)
    r=pypdf.PdfReader(str(out)); print(key,'pages',len(r.pages),'dests',len(r.named_destinations),'->',out.name)
    return out
if __name__=='__main__': build(sys.argv[1])
