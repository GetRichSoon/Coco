# Free sample PDF for each of the original four: cover + about page + contents + front matter/first chapter + one chosen later chapter + link to the full book.
import sys,re,pathlib,subprocess,tempfile,shutil,html
import pypdf
from markdown.extensions.toc import slugify
sys.path.insert(0,str(pathlib.Path(__file__).parent))
import final4_build as F
BB=F.BB; R=F.R
URL={'aswb-clinical-90-day-study-plan':'https://thevelvetfoundry.gumroad.com/l/aswb-clinical-90-day-study-plan','keep-your-own-books':'https://thevelvetfoundry.gumroad.com/l/keep-your-own-books','retake-exam-technique':'https://thevelvetfoundry.gumroad.com/l/retake-exam-technique','where-your-aws-bill-goes':'https://thevelvetfoundry.gumroad.com/l/where-your-aws-bill-goes'}
# later chapter chosen by a title fragment
PICK={'aswb-clinical-90-day-study-plan':'Reading a score report','keep-your-own-books':'The bank reconciliation','retake-exam-technique':'Tie-breakers','where-your-aws-bill-goes':'The five things you actually pay for'}
def sample(slug):
    m=F.META[slug]; d=R/slug; full=d/'03 FINAL PDF'/(slug+'.pdf'); r=pypdf.PdfReader(str(full))
    nd={k.lstrip('/'):r.get_destination_page_number(v) for k,v in r.named_destinations.items()}
    txt=(d/'02 FINAL MANUSCRIPTS'/'manuscript_final.md').read_text(encoding='utf-8')
    h1=[l[2:].strip() for l in txt.splitlines() if l.startswith('# ')]
    pg=lambda t:nd[slugify(re.sub(r'\*','',t),'-')]
    first=pg(h1[0]);
    body_h1=[t for t in h1 if t.lower().startswith('chapter')]
    c1=pg(body_h1[0]); c2=pg(body_h1[1]) if len(body_h1)>1 else c1+8
    pick=[t for t in h1 if PICK[slug].lower() in t.lower()][0]; p0=pg(pick); idx=h1.index(pick); p1=pg(h1[idx+1])
    pages=list(range(first,c2))+list(range(p0,p1))
    pages=sorted({p for p in pages if p<len(r.pages)})
    n=len(r.pages)
    cs=next(i for i,t in enumerate([(p.extract_text() or '') for p in r.pages[:8]]) if re.match(r'\s*\d*\s*Contents',(r.pages[i].extract_text() or '')))
    contents=list(range(cs,first))
    jpg=pathlib.Path(tempfile.gettempdir())/f'cov_{m["key"]}.jpg'
    sub=html.escape(m['sub'],quote=False); title=' '.join(m['title'])
    page=f'''<!doctype html><html><head><meta charset="utf-8"><style>{BB.CSS}.about{{padding-top:.9in;page:front}}.about h2{{font-size:17pt;margin-top:0}}.about p{{font-size:10.5pt}}.btn{{display:inline-block;background:#0B1330;color:#fff;padding:7pt 14pt;border-radius:4pt;text-decoration:none;margin-top:6pt}}</style></head><body>
    <div class="cov"><img src="{jpg.as_uri()}"></div>
    <div class="about"><h2>Free sample</h2><p><strong>{html.escape(title)}</strong><br>{sub}</p>
    <p>This sample contains the contents, the opening of the book and one full chapter ("{html.escape(pick)}"), exactly as they appear in the full book. The full book has {n} pages. Page numbers in the contents refer to the full book.</p>
    <p><strong>Get the full book:</strong><br><a class="btn" href="{URL[slug]}">{URL[slug]}</a></p><p>{html.escape(m['note'])}</p></div></body></html>'''
    out=d/'09 FREE SAMPLE'; out.mkdir(exist_ok=True); h=out/'_s.html'; h.write_text(page,encoding='utf-8')
    Image=BB.Image; Image.open(d/'05 APPROVED PORTRAIT COVER'/'cover_final_1024x1536.png').convert('RGB').save(jpg,quality=92)
    tmp=out/'_front.pdf'; prof=tempfile.mkdtemp()
    subprocess.run([r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe','--headless=new','--disable-gpu','--no-pdf-header-footer','--user-data-dir='+prof,f'--print-to-pdf={tmp}',h.as_uri()],check=True,timeout=120)
    shutil.rmtree(prof,ignore_errors=True)
    w=pypdf.PdfWriter()
    for p in pypdf.PdfReader(str(tmp)).pages: w.add_page(p)
    for p in contents+pages: w.add_page(r.pages[p])
    # make the link annotation work: keep the URL link from the front page (pypdf keeps annots)
    fp=out/(slug+'_FREE_SAMPLE.pdf'); w.write(str(fp)); h.unlink(); tmp.unlink()
    print(slug,'sample pages',len(w.pages),'of',n)
if __name__=='__main__': sample(sys.argv[1])
