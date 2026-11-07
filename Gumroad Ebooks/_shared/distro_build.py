# Builds the global distribution pack: retailer metadata, pricing/royalty comparison, xlsx, reports, phone checklist and zip. No uploads happen here.
import pathlib,re,json,zipfile,shutil,os,datetime,html
from PIL import Image
import pypdf
G=pathlib.Path(r'C:\Users\Lenovo\Good Space\Coco\Gumroad Ebooks')
O=G/'Original Four'
OUT=G/'Global Distribution'; OUT.mkdir(exist_ok=True)
# ---------- the nine books ----------
B=[
 dict(n=1,key='aswb',title='The 90-Day Clinical Licensing Exam Study Plan',sub='A Day-by-Day Schedule for the ASWB Clinical (LCSW) Exam',price=34.0,slug='aswb-clinical-90-day-study-plan',folder=O/'aswb-clinical-90-day-study-plan',pdf='03 FINAL PDF/aswb-clinical-90-day-study-plan.pdf',epub='04 FINAL EPUB/aswb-clinical-90-day-study-plan.epub',cover='05 APPROVED PORTRAIT COVER/cover_final_portrait_1800x2700.png',desc='10 SEO AND GUMROAD DESCRIPTION/description.txt',
   kw=['LCSW exam study plan','ASWB clinical exam prep','social work licensing exam','90 day study schedule','LCSW retake','clinical social work exam','ASWB exam study guide'],
   amz_cat=['Education & Teaching > Test Preparation','Health, Fitness & Dieting > Mental Health > Counseling'],play_cat=['Education / Test Preparation','Social Science / Social Work'],pay_tags='lcsw exam,aswb clinical,study plan,exam prep,social work,licensing exam',
   short='A dated 90-day study plan for the ASWB Clinical (LCSW) exam: schedule, spaced review and pacing for the 2026 format. Independent; no exam questions.',
   author_note='Old listing used "The Velvet Foundry Editorial Team".'),
 dict(n=2,key='keep',title='Keep Your Own Books',sub='Bookkeeping for Freelancers and Sole Traders',price=29.0,slug='keep-your-own-books',folder=O/'keep-your-own-books',pdf='03 FINAL PDF/keep-your-own-books.pdf',epub='04 FINAL EPUB/keep-your-own-books.epub',cover='05 APPROVED PORTRAIT COVER/cover_final_portrait_1800x2700.png',desc='10 SEO AND GUMROAD DESCRIPTION/description.txt',
   kw=['bookkeeping for freelancers','sole trader bookkeeping','self employed bookkeeping guide','double entry basics','bank reconciliation guide','small business accounting beginners','month end close'],
   amz_cat=['Business & Money > Accounting','Business & Money > Small Business & Entrepreneurship'],play_cat=['Business & Economics / Accounting / Bookkeeping','Business & Economics / Small Business'],pay_tags='bookkeeping,freelancer,sole trader,double entry,reconciliation,small business',
   short='Learn bookkeeping for freelancers and sole traders: record, reconcile and close a month in about an hour. No tax rules, so it works anywhere.',author_note='Old listing used "The Velvet Foundry Editorial Team".'),
 dict(n=3,key='retake',title='The Retake Method',sub='Exam Technique After You Fail a Licensing Exam',price=29.0,slug='retake-exam-technique',folder=O/'retake-exam-technique',pdf='03 FINAL PDF/retake-exam-technique.pdf',epub='04 FINAL EPUB/retake-exam-technique.epub',cover='05 APPROVED PORTRAIT COVER/cover_final_portrait_1800x2700.png',desc='10 SEO AND GUMROAD DESCRIPTION/description.txt',
   kw=['retake licensing exam','failed licensing exam what next','multiple choice exam technique','test taking strategies','exam retake strategy','how to read a score report','exam day routine'],
   amz_cat=['Education & Teaching > Studying & Workbooks','Education & Teaching > Test Preparation'],play_cat=['Education / Test Preparation','Study Aids / Study Guides'],pay_tags='exam retake,failed exam,test taking,exam technique,licensing exam,exam anxiety',
   short='A method guide for retaking a multiple-choice licensing exam: diagnose your fail, answer FIRST and BEST questions, pace the clock.',author_note='Old listing used "The Velvet Foundry Editorial Team".'),
 dict(n=4,key='aws',title='Where Your AWS Bill Goes',sub='Understand and Reduce Your AWS Costs',price=39.0,slug='where-your-aws-bill-goes',folder=O/'where-your-aws-bill-goes',pdf='03 FINAL PDF/where-your-aws-bill-goes.pdf',epub='04 FINAL EPUB/where-your-aws-bill-goes.epub',cover='05 APPROVED PORTRAIT COVER/cover_final_portrait_1800x2700.png',desc='10 SEO AND GUMROAD DESCRIPTION/description.txt',
   kw=['reduce AWS bill','AWS cost optimization','understand AWS billing','cloud cost management guide','AWS data transfer costs','FinOps for engineers','AWS monthly cost review'],
   amz_cat=['Computers & Technology > Networking & Cloud Computing','Business & Money > Management & Leadership'],play_cat=['Computers / Cloud Computing','Business & Economics / Information Technology'],pay_tags='aws,aws cost,cloud cost,cost optimization,aws billing,finops',
   short='Plain-English guide to why your AWS bill is what it is: five pricing shapes, a one-hour monthly review and an order for cutting cost.',author_note='Old listing used "The Velvet Foundry Editorial Team".'),
 dict(n=5,key='ai',title='The AI Workflow Playbook',sub='30 Practical ChatGPT Systems for Small Business, Marketing, Sales & Daily Operations',price=14.0,slug='chatgpt-workflows-small-business',folder=G/'01 AI Workflow Playbook',pdf='01_The_AI_Workflow_Playbook.pdf',epub='04 FINAL EPUB/01_The_AI_Workflow_Playbook.epub',cover='01_AI_Workflow_Playbook_Portrait_Cover.png',desc=None,listing='Gumroad Listing.md',
   kw=['ChatGPT for small business','ChatGPT prompts for business','AI workflows small business','ChatGPT SOP templates','ChatGPT marketing prompts','AI productivity for freelancers','ChatGPT customer service templates'],
   amz_cat=['Business & Money > Small Business & Entrepreneurship','Computers & Technology > Artificial Intelligence & Semantics'],play_cat=['Business & Economics / Small Business','Computers / Artificial Intelligence'],pay_tags='chatgpt workflows,small business ai,business prompts,ai sops,marketing prompts,ai productivity',
   short='30 step-by-step ChatGPT workflows with copy-and-paste prompts and review checklists for small-business marketing, sales, customer service and admin.',author_note='No author name approved.'),
 dict(n=6,key='client',title='The Client Acquisition Playbook',sub='A Practical System for Finding Leads, Booking Calls & Winning Clients',price=19.0,slug='client-acquisition-playbook',folder=G/'02 Client Acquisition Playbook',pdf='02_The_Client_Acquisition_Playbook.pdf',epub='04 FINAL EPUB/02_The_Client_Acquisition_Playbook.epub',cover='02_Client_Acquisition_Playbook_Portrait_Cover.png',desc=None,listing='Gumroad Listing.md',
   kw=['client acquisition for freelancers','freelance lead generation','cold email templates freelancers','discovery call script','proposal templates consultants','find freelance clients','sales pipeline freelancers'],
   amz_cat=['Business & Money > Marketing & Sales > Sales & Selling','Business & Money > Entrepreneurship'],play_cat=['Business & Economics / Sales & Selling','Business & Economics / Freelance Business'],pay_tags='client acquisition,freelance clients,lead generation,cold outreach,discovery call,proposals',
   short='A step-by-step client acquisition system: 20 outreach templates, 10 follow-ups, 10 discovery call scripts, 5 proposal frameworks and a 30-day plan.',author_note='No author name approved.'),
 dict(n=7,key='python',title='Python Automation for Beginners',sub='25 Practical Projects for Files, Spreadsheets, Reports & Everyday Work',price=14.0,slug='python-automation-for-beginners',folder=G/'03 Python Automation',pdf='03_Python_Automation_for_Beginners.pdf',epub='04 FINAL EPUB/03_Python_Automation_for_Beginners.epub',cover='03_Python_Automation_Portrait_Cover.png',desc=None,listing='Gumroad Listing.md',
   kw=['Python automation for beginners','automate Excel with Python','Python projects beginners','Python file automation scripts','Python CSV PDF automation','Python scripts office work','openpyxl pypdf tutorial'],
   amz_cat=['Computers & Technology > Programming > Python','Computers & Technology > Programming > Software Development'],play_cat=['Computers / Programming Languages / Python','Computers / Programming / General'],pay_tags='python,python automation,python beginners,excel automation,csv,pdf',
   short='25 complete, tested Python projects for renaming files, cleaning CSVs, building Excel reports, handling PDFs and more, explained step by step for beginners.',author_note='No author name approved.'),
 dict(n=8,key='money',title='The Practical Money System',sub="A Beginner's Guide to Budgeting, Saving, Debt Payoff & Building Wealth",price=9.0,slug='practical-money-system-beginners',folder=G/'04 Practical Money System',pdf='04_The_Practical_Money_System.pdf',epub='04 FINAL EPUB/04_The_Practical_Money_System.epub',cover='04_Practical_Money_System_Portrait_Cover.png',desc=None,listing='Gumroad Listing.md',
   kw=['personal finance for beginners','budgeting for beginners','how to pay off debt','emergency fund guide','debt snowball vs avalanche','compound interest explained','beginner money management'],
   amz_cat=['Business & Money > Personal Finance > Budgeting & Money Management','Business & Money > Personal Finance > Credit & Debt'],play_cat=['Business & Economics / Personal Finance / Budgeting','Business & Economics / Personal Finance / Money Management'],pay_tags='budgeting,personal finance,debt payoff,saving money,emergency fund,money management',
   short='A step-by-step beginner guide to budgeting, an emergency fund, debt payoff, saving and investing basics, with worksheets and checked calculations.',author_note='No author name approved.'),
 dict(n=9,key='job',title='The Job Interview Playbook',sub='100 Common Interview Questions, Powerful Answer Frameworks, Resume & LinkedIn Strategies',price=12.99,slug='job-interview-playbook-100-questions',folder=G/'05 Job Interview Playbook',pdf='05_The_Job_Interview_Playbook.pdf',epub='04 FINAL EPUB/05_The_Job_Interview_Playbook.epub',cover='05_Job_Interview_Playbook_Portrait_Cover.png',desc=None,listing='Gumroad Listing.md',
   kw=['job interview questions and answers','behavioral interview STAR method','interview preparation guide','resume and LinkedIn tips','first job interview questions','salary negotiation scripts','career change interview'],
   amz_cat=['Business & Money > Job Hunting & Careers > Interviewing','Business & Money > Job Hunting & Careers > Resumes'],play_cat=['Business & Economics / Careers / Job Hunting','Business & Economics / Careers / Resumes'],pay_tags='interview questions,interview prep,job interview,star method,resume,linkedin',
   short='100 interview questions, each with what the interviewer wants, an answer framework, an example and beginner and experienced tips, plus resume and LinkedIn guides.',author_note='No author name approved.'),
]
def desc_of(b):
    if b['desc']: return (b['folder']/b['desc']).read_text(encoding='utf-8').strip()
    t=(b['folder']/b['listing']).read_text(encoding='utf-8')
    d=re.search(r'## DESCRIPTION[^\n]*\n(.*?)\n## FREE SAMPLE DESCRIPTION',t,re.S).group(1).strip()
    return re.sub(r'\n?FREE SAMPLE\nDownload the free sample first:[^\n]*\n','\n',d)
def clean(d):  # remove Gumroad-only mentions of sample downloads
    d=re.sub(r'\n?FREE SAMPLE\n[^\n]*\n','\n',d)
    return d
AI_TEXT='AI-generated text: the manuscript was written by an AI assistant (Claude) from research prompts and then checked with scripts and by the publisher; it was not human-written. Declare it as AI-generated.'
AI_IMG='AI-generated images: the cover was generated with ChatGPT Image Generation (OpenAI) and then adjusted in code; the interior diagrams (where present) were drawn in code by the AI assistant. Declare cover and diagrams as AI-generated.'
def royalty(price,mb):
    r70=None if (price<2.99 or price>12.99) else round(0.70*price-0.15*mb,2)
    r35=round(0.35*price,2)
    return r70,r35
def mbsize(p): return round(p.stat().st_size/1048576,2)
def build():
    rows=[]
    cdir=OUT/'covers'; cdir.mkdir(exist_ok=True)
    for b in B:
        f=b['folder']; pdf=f/b['pdf']; epub=f/b['epub']; cov=f/b['cover']
        assert pdf.exists() and epub.exists() and cov.exists(),(b['title'],pdf.exists(),epub.exists(),cov.exists())
        im=Image.open(cov).convert('RGB');
        up=cdir/f'{b["n"]:02d}_{b["slug"]}_cover_1600x2560.jpg'
        im.resize((1600,2560),Image.LANCZOS).save(up,quality=95)
        b['cover_up']=up; b['epub_mb']=mbsize(epub); b['pdf_mb']=mbsize(pdf); b['pages']=len(pypdf.PdfReader(str(pdf)).pages)
        b['desc_text']=clean(desc_of(b)); b['cover_src_px']='x'.join(map(str,im.size))
        r70,r35=royalty(b['price'],b['epub_mb'])
        amz=min(b['price'],12.99) if b['price']>12.99 else b['price']
        a70,a35=royalty(amz,b['epub_mb'])
        b.update(r70=r70,r35=r35,amz_alt=amz,a70=a70,a35=a35)
        rows.append(b)
    return rows
def amazon_html(b):
    d=b['desc_text']; out=[]
    for blk in d.split('\n\n'):
        lines=blk.split('\n')
        if all(l.startswith('•') for l in lines): out.append('<ul>'+''.join(f'<li>{html.escape(l[1:].strip())}</li>' for l in lines)+'</ul>')
        elif lines[0].isupper() and len(lines)>1 and not lines[0].startswith('Q:'):
            out.append(f'<h3>{html.escape(lines[0])}</h3>')
            rest=lines[1:]
            if rest and all(l.startswith('•') for l in rest): out.append('<ul>'+''.join(f'<li>{html.escape(l[1:].strip())}</li>' for l in rest)+'</ul>')
            else: out.append('<p>'+html.escape(' '.join(rest))+'</p>')
        elif lines[0].isupper() and len(lines)==1: out.append(f'<h3>{html.escape(lines[0])}</h3>')
        else: out.append('<p>'+html.escape(' '.join(lines))+'</p>')
    s=''.join(out)
    return s[:3950] if len(s)>4000 else s
def write_meta(rows):
    for b in rows:
        d=OUT/f'{b["n"]:02d}_{b["slug"]}'; d.mkdir(exist_ok=True)
        for nm,key in [('final.epub','epub'),('final.pdf','pdf')]:
            pass
        shutil.copy2(b['folder']/b['epub'],d/f'{b["n"]:02d}_{b["slug"]}.epub'); shutil.copy2(b['folder']/b['pdf'],d/f'{b["n"]:02d}_{b["slug"]}.pdf'); shutil.copy2(b['cover_up'],d/f'{b["n"]:02d}_{b["slug"]}_cover_1600x2560.jpg')
        if b['key']=='python': shutil.copy2(b['folder']/'Python_Automation_Project_Source.zip',d/'Python_Automation_Project_Source.zip')
        full=f'{b["title"]}: {b["sub"]}'
        amz=f'''AMAZON KDP METADATA (non-exclusive: DO NOT enroll in KDP Select)
Language: English
Book title: {b["title"]}
Subtitle: {b["sub"]}
Series: none
Edition number: 1
Author: DECISION REQUIRED (no approved author name; the original four used "The Velvet Foundry Editorial Team")
Contributors: none
Publisher (optional field): The Velvet Foundry
Description (paste in KDP, HTML allowed; limit 4,000 characters; {len(amazon_html(b))} used):
{amazon_html(b)}

I own the copyright / publishing rights: only select after you confirm rights (see rights notes in the report)
Publishing rights territories: worldwide rights only if you confirm you hold them
Primary audience: not adult content
Categories (choose 3 in KDP; names to be confirmed in KDP's category picker):
  1. {b["amz_cat"][0]}
  2. {b["amz_cat"][1]}
Keywords (7 boxes, each up to 50 characters):
''' + '\n'.join(f'  {i+1}. {k}' for i,k in enumerate(b['kw'])) + f'''

AI-GENERATED CONTENT DISCLOSURE (KDP asks: text / images / translations)
  Text: YES, AI-generated. {AI_TEXT}
  Images: YES, AI-generated. {AI_IMG}
  Translations: not applicable.
Manuscript file: {b["n"]:02d}_{b["slug"]}.epub  ({b["epub_mb"]} MB)
Cover (upload as cover image, JPEG/TIFF, ideal 1600 x 2560): {b["n"]:02d}_{b["slug"]}_cover_1600x2560.jpg (upscaled from {b["cover_src_px"]}: see report)
KDP Select: NO
DRM: your choice (recommended: off for a how-to guide; decide)
Kindle price options (US): A) keep {b["price"]:.2f} USD  -> 35% royalty = {b["r35"]:.2f}{"" if b["r70"] is None else f"; 70% = {b['r70']:.2f}"}.  B) {b["amz_alt"]:.2f} USD -> 70% = {b["a70"] if b["a70"] is not None else "n/a"}, 35% = {b["a35"]:.2f}. NOT SET: needs your approval.
'''
        (d/'metadata_amazon_KDP.txt').write_text(amz,encoding='utf-8')
        goo=f'''GOOGLE PLAY BOOKS PARTNER CENTER METADATA
Title: {b["title"]}
Subtitle: {b["sub"]}
Language: English
Author: DECISION REQUIRED (no approved author name)
Publisher: The Velvet Foundry
Publication date: {datetime.date.today()}
Identifier: ISBN not assigned (decision: buy ISBNs or check whether Partner Center accepts a book without one)
Categories / subjects: {b["amz_cat"][0] if False else b["play_cat"][0]}; {b["play_cat"][1]}
Content file: {b["n"]:02d}_{b["slug"]}.epub (EPUB preferred) ; alternative {b["n"]:02d}_{b["slug"]}.pdf
Cover file: {b["n"]:02d}_{b["slug"]}_cover_1600x2560.jpg
List price (USD): {b["price"]:.2f}  (Gumroad price; NOT approved for Google Play: needs your approval)
Territories: all territories you hold rights for (confirm)
Preview: allow preview of up to 20% (default) or per your choice
DRM: your choice
Description (plain text):
{b["desc_text"]}
AI content: record kept; Google asks for accurate declarations: text AI-generated (Claude), cover AI-generated (ChatGPT Image Generation), diagrams AI-drawn in code.
'''
        (d/'metadata_google_play.txt').write_text(goo,encoding='utf-8')
        pay=f'''PAYHIP METADATA
Product name: {full}
Short description: {b["short"]}
Price: {b["price"]:.2f} USD (Gumroad price; confirm for Payhip)
Tags: {b["pay_tags"]}
Product URL (suggested): payhip.com/b/<auto>  (Payhip makes the URL; slug idea: {b["slug"]})
Files to upload: {b["n"]:02d}_{b["slug"]}.pdf, {b["n"]:02d}_{b["slug"]}.epub{", Python_Automation_Project_Source.zip (bonus)" if b["key"]=="python" else ""}
Cover/thumbnail: {b["n"]:02d}_{b["slug"]}_cover_1600x2560.jpg (portrait) or the landscape/square images in the book folder
Download instructions (put in the product's note): After purchase, download the PDF for reading on a computer or tablet and the EPUB for phones and e-readers. If a file will not open, reply to the receipt email.
Preview: attach the free sample PDF from the book folder as a free preview file (not the paid book)
Description:
{b["desc_text"]}
'''
        (d/'metadata_payhip.txt').write_text(pay,encoding='utf-8')
if __name__=='__main__':
    rows=build(); write_meta(rows)
    for b in rows: print(b['n'],b['title'][:30],b['epub_mb'],'MB',b['pages'],'pp','70%',b['r70'],'35%',b['r35'],'| at',b['amz_alt'],b['a70'],b['a35'])
