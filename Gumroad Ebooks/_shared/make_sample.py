# Usage: python make_sample.py <key>   Builds <folder>/<NN>_..._FREE_SAMPLE.pdf from the book's final PDF.
# Sample = cover page + "About this sample" page + contents pages + chosen sections copied page-for-page from the full PDF.
import sys,re,pathlib,subprocess,tempfile,shutil,html
import pypdf
sys.path.insert(0,str(pathlib.Path(__file__).parent))
from build_book import BOOKS,ROOT,CSS
from PIL import Image
# picks: list of (start_heading_id, next_heading_id) ; pages start..(page of next)-1 (at least one page)
PICKS={
 '01':[('workflow-1-the-business-context-block','workflow-2-the-prompt-improver'),
       ('workflow-12-customer-email-reply-drafter','workflow-13-newsletter-from-rough-notes'),
       ('workflow-22-meeting-notes-to-action-items','workflow-23-proposal-and-quote-draft'),
       ('A one-page AI use policy for a small business','Accuracy rules')],
}
PICKS['05']=[('Plain text ATS safe structure','Career changers'),('STAR worksheet','If you have no paid experience'),
 ('Q1. Tell me about yourself.','Q4.'),('Q21. Tell me about a time you failed.','Q24.'),('1. Responding to an early salary question','Chapter 12')]
PICKS['02']=[('Ideal customer profile worksheet','Chapter 4'),('O1. Referral ask to a happy client','O3.'),('C1. Inbound lead','C3.'),('Qualification worksheet','Chapter 12'),('P1. One page proposal','P3.')]
ABOUT={
 '02':'This sample shows the cover, the full contents, the ideal customer profile worksheet, two outreach templates, a discovery call script, the client qualification worksheet with scoring, and proposal frameworks, each with instructions and a filled example, exactly as they appear in the book.',
 '05':'This sample shows the cover, the full contents, the plain-text resume structure, the STAR answer worksheet, six of the 100 interview questions in full (each with what the interviewer wants, an answer framework, an example answer, common mistakes and beginner and experienced adaptations), and salary negotiation scripts, exactly as they appear in the book.',
 '01':'This sample shows the cover, the full contents, and three complete workflows (a reusable Business Context Block, a customer email reply drafter, and meeting notes to action items) plus the one-page AI use policy template, exactly as they appear in the book.',
}
PICKS['04']=[('Worked example B: middle income','Worked example C'),('Monthly budget worksheet','When the budget does not balance'),('The comparison: same debts, same budget','Hybrid in practice'),('Worked examples (rates are assumptions','Start early or save more'),('Scam-check checklist','Protect yourself in advance')]
ABOUT['04']='This sample shows the cover, the full contents, a worked budget for a middle income, the monthly budget worksheet, the debt repayment comparison (avalanche, snowball and hybrid on the same debts), compound interest worked examples and the scam-check checklist, exactly as they appear in the book. All rates are assumptions used for illustration.'
PICKS['03']=[('Install Python','Installing packages with pip'),('Project 1. Bulk file renaming','Project 2.'),('Project 3. Duplicate file detection','Project 4.'),('Project 13. Excel report generation','Project 14.')]
ABOUT['03']='This sample shows the cover, the full contents, the Python installation and setup section, and three complete projects (bulk file renaming, duplicate file detection and Excel report generation) with the full source code, sample input, real test output, common errors and safe-use notes, exactly as they appear in the book.'
def sample(key):
    b=BOOKS[key]; d=ROOT/b['folder']; full=d/b['out']
    r=pypdf.PdfReader(str(full)); nd={k.lstrip('/'):r.get_destination_page_number(v) for k,v in r.named_destinations.items()}
    ids=sorted(nd.items(),key=lambda kv:kv[1])
    first_h1=min(v for k,v in nd.items() if k!='contents' and (k.startswith('introduction') or k.startswith('chapter-') or k.startswith('before')))
    txt=[ (pg.extract_text() or '') for pg in r.pages]
    cstart=next(i for i,t in enumerate(txt[:8]) if re.match(r'\s*\d*\s*Contents',t))
    contents=range(cstart,first_h1)
    def res(x,after=0):
        if x in nd: return nd[x]
        key=re.sub(r'\s+','',x).lower()
        for i in range(max(after,first_h1),len(txt)):
            for j,line in enumerate(txt[i].splitlines()):
                l=re.sub(r'\s+','',line).lower()
                if j==0: l=re.sub(r'^\d+','',l)
                if l.startswith(key): return i
        print('NOT FOUND',x); return None
    pages=[]
    for s,e in PICKS[key]:
        a=res(s)
        if a is None: continue
        z=res(e,a); z=a+1 if z is None else max(z,a+1)
        pages+=list(range(a,z))
    pages=sorted(set(pages))
    jpg=pathlib.Path(tempfile.gettempdir())/f'cov_{key}.jpg'
    tt=" ".join(b['title']); n=len(r.pages)
    page=f'''<!doctype html><html><head><meta charset="utf-8"><style>{CSS}
    .about{{padding-top:.9in;page:front}}.about h2{{font-size:17pt;margin-top:0}}.about p{{font-size:10.5pt}}</style></head><body>
    <div class="cov"><img src="{jpg.as_uri()}"></div>
    <div class="about"><h2>About this free sample</h2>
    <p><strong>{html.unescape(tt)}</strong><br>{b["sub"]}</p>
    <p>{ABOUT.get(key,"")}</p>
    <p>The full book has {n} pages. Page numbers in the contents refer to the full book; sample pages keep their original page numbers.</p>
    <p>{b["note"]}</p></div></body></html>'''
    h=d/'_sample.html'; h.write_text(page,encoding='utf-8'); tmp=d/'_sample_front.pdf'; prof=tempfile.mkdtemp()
    subprocess.run([r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe','--headless=new','--disable-gpu','--no-pdf-header-footer','--user-data-dir='+prof,f'--print-to-pdf={tmp}',h.as_uri()],check=True,timeout=120)
    shutil.rmtree(prof,ignore_errors=True)
    w=pypdf.PdfWriter(); f=pypdf.PdfReader(str(tmp))
    for p in f.pages: w.add_page(p)
    for p in list(contents)+pages: w.add_page(r.pages[p])
    out=d/b['out'].replace('.pdf','_FREE_SAMPLE.pdf'); w.write(str(out)); h.unlink(); tmp.unlink()
    print(key,'sample pages',len(w.pages),'->',out.name)
if __name__=='__main__': sample(sys.argv[1])
