# Builds final PDF (via build_book), EPUB 3 and validates it with epubcheck for the original four books.
# Usage: python final4_build.py <slug> [pdf|epub|all]
import sys,re,zipfile,pathlib,html,uuid,shutil,subprocess,datetime
import markdown
from PIL import Image
sys.path.insert(0,str(pathlib.Path(__file__).parent))
import build_book as BB
R=BB.ROOT/'Original Four'
META={
 'aswb-clinical-90-day-study-plan':dict(key='f1',title=['THE 90-DAY','CLINICAL LICENSING EXAM','STUDY PLAN'],epub='The 90-Day Clinical Licensing Exam Study Plan',sub='A structured, independent preparation schedule for the 2026 ASWB Clinical (LCSW) examination',
   note='Independent guide. Not affiliated with, endorsed by or approved by ASWB. Contains no examination questions. No pass is promised.'),
 'keep-your-own-books':dict(key='f2',title=['KEEP YOUR','OWN BOOKS'],epub='Keep Your Own Books',sub='Bookkeeping for freelancers and sole traders: a one-hour monthly routine',
   note='Contains no tax rates, thresholds or filing rules, by design. Not accounting, tax or legal advice.'),
 'retake-exam-technique':dict(key='f3',title=['THE RETAKE','METHOD'],epub='The Retake Method',sub='Exam technique for candidates retaking a professional licensing exam',
   note='General educational material. Not affiliated with, endorsed by or approved by any examination body. No pass is promised.'),
 'where-your-aws-bill-goes':dict(key='f4',title=['WHERE YOUR','AWS BILL GOES'],epub='Where Your AWS Bill Goes',sub='The five shapes of cloud cost, the decisions that set them, and a monthly review that takes an hour',
   note='Independent guide. Not affiliated with or endorsed by Amazon Web Services. Contains no prices, rates or figures, by design.'),
}
for slug,m in META.items():
    BB.BOOKS[m['key']]=dict(folder='Original Four/'+slug+'/02 FINAL MANUSCRIPTS',cover='../05 APPROVED PORTRAIT COVER/cover_final_1024x1536.png',out='../03 FINAL PDF/'+slug+'.pdf',
        title=m['title'],sub=html.escape(m['sub'],quote=False),parts=['manuscript_final.md'],toc2=None,brk2=None,brk3=None,toc3=None,note=m['note'],nl2br=False)
def build_pdf(slug):
    return BB.build(META[slug]['key'])
# ---------------- EPUB ----------------
CSS_EPUB='''body{font-family:serif;line-height:1.5;margin:0 .3em}h1{font-size:1.7em;line-height:1.2;margin:1.2em 0 .6em;page-break-before:always}h2{font-size:1.25em;margin:1.4em 0 .4em}h3{font-size:1.05em;margin:1.2em 0 .3em}
p{margin:.6em 0}pre{white-space:pre-wrap;font-family:monospace;font-size:.85em;background:#f1f1f1;padding:.5em;border-left:3px solid #999;overflow-wrap:anywhere}code{font-family:monospace;font-size:.9em}
table{border-collapse:collapse;width:100%;font-size:.85em;margin:.8em 0}th,td{border:1px solid #999;padding:.25em .4em;vertical-align:top}th{background:#e8e8e8}
blockquote{margin:.8em 0 .8em 1em;padding-left:.7em;border-left:3px solid #999}blockquote ul{list-style:none;padding-left:.2em}img{max-width:100%;height:auto}figure{margin:1em 0;text-align:center}.cap{font-style:italic;font-size:.9em;text-align:center}
.cover{text-align:center;margin:0;padding:0}.cover img{max-height:100%;max-width:100%}'''
def xhtml(title,body,css='style.css'):
    return ('<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en"><head><meta charset="utf-8"/>'
            f'<title>{html.escape(title)}</title><link rel="stylesheet" type="text/css" href="{css}"/></head><body>{body}</body></html>')
def build_epub(slug,txt=None,m=None,d=None,src=None,coverp=None,outname=None):
    m=m or META[slug]; d=d or R/slug; src=src or d/'02 FINAL MANUSCRIPTS'; out=d/'04 FINAL EPUB'; out.mkdir(exist_ok=True)
    txt=txt if txt is not None else (src/'manuscript_final.md').read_text(encoding='utf-8')
    parts=re.split(r'(?m)^(?=# )',txt); parts=[p for p in parts if p.strip()]
    imgs={}; files=[]; nav=[]
    for i,p in enumerate(parts,1):
        title=re.match(r'# (.*)',p).group(1).strip()
        md=markdown.Markdown(extensions=['fenced_code','tables','sane_lists'],output_format='xhtml')
        body=md.convert(p)
        def fix(mo):
            fn=pathlib.Path(mo.group(1)).name; imgs[fn]=src/'diagrams'/fn; return f'src="images/{fn}"'
        body=re.sub(r'src="(?:\.\./)?diagrams/([^"]+)"',lambda mo:fix(mo),body)
        body=re.sub(r'<p>(<img [^>]+/>)</p>\s*<p><em>(Figure[^<]*)</em></p>',r'<figure>\1<figcaption class="cap">\2</figcaption></figure>',body)
        fid=f'ch{i:02d}.xhtml'; (files.append((fid,title,xhtml(title,body))))
    # cover
    cov=Image.open(coverp or d/'05 APPROVED PORTRAIT COVER'/'cover_final_1024x1536.png').convert('RGB')
    cj=out/'_cover.jpg'; cov.save(cj,quality=92)
    book=outname or f'{slug}.epub'; fp=out/book
    uid='urn:uuid:'+str(uuid.uuid5(uuid.NAMESPACE_URL,'thevelvetfoundry/'+slug))
    nav_items=''.join(f'<li><a href="{f}">{html.escape(t)}</a></li>' for f,t,_ in files)
    navx=xhtml('Contents',f'<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>{nav_items}</ol></nav><nav epub:type="landmarks" hidden="hidden"><ol><li><a epub:type="cover" href="cover.xhtml">Cover</a></li><li><a epub:type="bodymatter" href="{files[0][0]}">Start</a></li></ol></nav>')
    coverx=xhtml('Cover','<div class="cover"><img src="images/cover.jpg" alt="Cover: '+html.escape(m['epub'])+'"/></div>')
    man=['<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>','<item id="css" href="style.css" media-type="text/css"/>','<item id="cover-img" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>','<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>']
    spine=['<itemref idref="cover" linear="no"/>']
    for f,_,_ in files:
        man.append(f'<item id="{f[:-6]}" href="{f}" media-type="application/xhtml+xml"/>'); spine.append(f'<itemref idref="{f[:-6]}"/>')
    for fn in imgs: man.append(f'<item id="img-{fn.replace(".","-")}" href="images/{fn}" media-type="image/png"/>')
    now=datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    opf=(f'<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="en"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">'
         f'<dc:identifier id="uid">{uid}</dc:identifier><dc:title>{html.escape(m["epub"])}</dc:title><dc:language>en</dc:language><dc:creator>The Velvet Foundry Editorial Team</dc:creator><dc:publisher>The Velvet Foundry</dc:publisher>'
         f'<dc:description>{html.escape(m["sub"])}</dc:description><dc:rights>All rights reserved. {html.escape(m["note"])}</dc:rights><meta property="dcterms:modified">{now}</meta><meta name="cover" content="cover-img"/></metadata>'
         f'<manifest>{"".join(man)}</manifest><spine>{"".join(spine)}</spine></package>')
    with zipfile.ZipFile(fp,'w') as z:
        z.writestr(zipfile.ZipInfo('mimetype'),'application/epub+zip',compress_type=zipfile.ZIP_STORED)
        D=zipfile.ZIP_DEFLATED
        z.writestr('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',compress_type=D)
        z.writestr('OEBPS/content.opf',opf,compress_type=D); z.writestr('OEBPS/nav.xhtml',navx,compress_type=D); z.writestr('OEBPS/cover.xhtml',coverx,compress_type=D); z.writestr('OEBPS/style.css',CSS_EPUB,compress_type=D)
        z.write(cj,'OEBPS/images/cover.jpg')
        for f,_,x in files: z.writestr('OEBPS/'+f,x,compress_type=D)
        for fn,p in imgs.items(): z.write(p,'OEBPS/images/'+fn)
    cj.unlink()
    return fp
def validate_epub(fp):
    r=subprocess.run(['java','-jar',r'C:\Users\Lenovo\AppData\Local\Programs\Python\Python314\Lib\site-packages\epubcheck\epubcheck.jar',str(fp)],capture_output=True,text=True)
    return r.returncode,(r.stdout+r.stderr)[-1800:]
if __name__=='__main__':
    slug=sys.argv[1]; what=sys.argv[2] if len(sys.argv)>2 else 'all'
    if what in('pdf','all'): build_pdf(slug)
    if what in('epub','all'):
        fp=build_epub(slug); print('epub',fp.name,fp.stat().st_size//1024,'KB'); rc,o=validate_epub(fp); print('epubcheck rc',rc); print(o)
