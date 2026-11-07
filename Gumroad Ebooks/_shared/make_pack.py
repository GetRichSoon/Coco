# Builds: 00 PHONE UPLOAD CHECKLIST.md and Gumroad_5_Ebooks_Phone_Upload_Pack.zip
import re,zipfile,pathlib,sys,datetime
ROOT=pathlib.Path(__file__).resolve().parent.parent
BOOKS=[
 ('01','01 AI Workflow Playbook','THE AI WORKFLOW PLAYBOOK','01_The_AI_Workflow_Playbook','01_AI_Workflow_Playbook'),
 ('02','02 Client Acquisition Playbook','THE CLIENT ACQUISITION PLAYBOOK','02_The_Client_Acquisition_Playbook','02_Client_Acquisition_Playbook'),
 ('03','03 Python Automation','PYTHON AUTOMATION FOR BEGINNERS','03_Python_Automation_for_Beginners','03_Python_Automation'),
 ('04','04 Practical Money System','THE PRACTICAL MONEY SYSTEM','04_The_Practical_Money_System','04_Practical_Money_System'),
 ('05','05 Job Interview Playbook','THE JOB INTERVIEW PLAYBOOK','05_The_Job_Interview_Playbook','05_Job_Interview_Playbook'),
]
def sections(p):
    t=p.read_text(encoding='utf-8'); parts=re.split(r'^## ',t,flags=re.M); d={}
    for x in parts[1:]:
        head,_,body=x.partition('\n'); d[head.split(' (')[0].strip()]=body.strip()
    return d
def files(folder,pdf,cov):
    f=ROOT/folder
    L=[('Full ebook PDF (required)',f/f'{pdf}.pdf','PDF'),('Free sample PDF (required)',f/f'{pdf}_FREE_SAMPLE.pdf','PDF'),
       ('Landscape product cover 1280 x 720 (required)',f/f'{cov}_Landscape_1280x720.png','PNG image'),
       ('Square thumbnail 600 x 600 (required)',f/f'{cov}_Thumbnail_600x600.png','PNG image'),
       ('Portrait front cover (optional second cover image)',f/f'{cov}_Portrait_Cover.png','PNG image')]
    zp=f/'Python_Automation_Project_Source.zip'
    if folder.startswith('03') and zp.exists(): L.append(('Project source ZIP (optional bonus download)',zp,'ZIP archive'))
    return L
def build():
    out=[]; W=out.append
    W('# 00 PHONE UPLOAD CHECKLIST\n')
    W(f'Prepared {datetime.date.today()}. Everything below is still to be done by you, because the browser connection needed to log in to Gumroad and upload from this PC was not available to Claude (no Chrome extension was connected), so NOTHING has been uploaded or published on Gumroad.\n')
    W('## Status legend\n- COMPLETED BY CLAUDE: manuscripts, PDFs, free samples, covers, thumbnails, listing text, this checklist and the ZIP.\n- PENDING MANUAL UPLOAD BY ME: every Gumroad step below.\n- BLOCKED BY GUMROAD: nothing found blocked by Gumroad itself; the block is the missing browser connection.\n- OPTIONAL TASK: marked OPTIONAL.\n')
    W('## Step 0. Get the files onto your phone (do this once)\n1. On the PC, open `C:\\Users\\Lenovo\\Good Space\\Coco\\Gumroad Ebooks\\Gumroad_5_Ebooks_Phone_Upload_Pack.zip`.\n2. Send it to the phone with ANY ONE of these: (a) upload to your Google Drive from the PC, then open Drive on the phone and download it; (b) email it to yourself and download the attachment; (c) Windows Phone Link or Nearby Share if you use them; (d) USB cable, copy to the phone\'s Downloads folder.\n3. On the phone, extract the ZIP (Files app, long-press the ZIP, Extract). You get five numbered folders, each with its PDF, sample, covers and a `LISTING.txt`.\n4. Success: you can open each PDF on the phone.\n')
    W('## How to create each product on your phone (same for all five)\n1. Open gumroad.com in the phone browser and log in (you do the login and any 2-step verification yourself).\n2. Go to Products, then New product. Choose a digital product, paste the TITLE, set the PRICE, then create it. (Names of buttons can differ slightly; follow what the page shows.)\n3. In the product editor: paste the DESCRIPTION; upload the landscape image as the cover and the square image as the thumbnail; in the content / files section upload the full PDF; add the free sample as a second file or as a separate free product if your plan requires, as described under each book.\n4. In the Share (or similar) tab: choose the CATEGORY, add the 8 TAGS, set the URL SLUG (custom permalink), and make sure product ratings are ENABLED (needed for Discover).\n5. Preview the page, then publish. Success: the product page opens at gumroad.com/l/<slug> in a private window.\n6. Do not change payout, bank, tax or profile details unless you want to.\n')
    for n,folder,title,pdf,cov in BOOKS:
        lp=ROOT/folder/'Gumroad Listing.md'
        if not lp.exists(): W(f'## BOOK {n}: {title}\nListing not ready yet.\n'); continue
        s=sections(lp); fl=files(folder,pdf,cov)
        W(f'---\n\n## BOOK {n}: {title}\n')
        W('**Status:** [ ] PENDING MANUAL UPLOAD BY ME (not created on Gumroad). **Why:** no browser connection to your Gumroad account was available to Claude. **Required.**\n')
        W('### Files (Windows folder, exact filename, type)\n')
        for lab,p,typ in fl:
            ok='EXISTS' if p.exists() else 'MISSING'
            W(f'- [ ] {lab}\n  - Folder: `{p.parent}`\n  - Filename: `{p.name}`\n  - Type: {typ} ({ok})\n  - Phone ZIP path: `{n}_*/{p.name}`')
        W('')
        W(f'### Copy and paste fields\n\n**Product title** (Gumroad: Name)\n```\n{s["TITLE"]}\n```\n')
        W(f'**Price** (Gumroad: Price): {s["PRICE"].splitlines()[0]}\n')
        W(f'**URL slug** (Share tab, custom permalink)\n```\n{s["URL SLUG"]}\n```\n')
        W(f'**Category** (Share tab): {s["CATEGORY"].splitlines()[0]}\n')
        W(f'**Tags** (Share tab, add one at a time)\n```\n{s["TAGS"]}\n```\n')
        W(f'**Short summary** (Gumroad: Summary / subtitle field if shown)\n```\n{s["SHORT SUMMARY"]}\n```\n')
        W(f'**Full description** (Gumroad: Description; includes the contents, what you get, who it is for and the 5 FAQs)\n```\n{s["DESCRIPTION"]}\n```\n')
        W(f'**Free sample note** (put in the description or in the sample file name): {s["FREE SAMPLE DESCRIPTION"]}\n')
        W('**Success looks like:** the product page shows the landscape cover, the description above, the price, and the PDF is attached as the product file. Ratings are enabled. (Do not buy your own product to test it.)\n')
    W('---\n\n## After publishing (all optional)\n- [ ] OPTIONAL: in Google Search Console, use URL Inspection to request indexing of each product URL (free; indexing is not guaranteed).\n- [ ] OPTIONAL: arrange the five products as one collection on your Gumroad profile and paste the creator bio from `00 MASTER PROJECT STATUS.md`.\n- [ ] OPTIONAL: after the first genuine buyers, update the sales pages with honest improvements.\n')
    (ROOT/'00 PHONE UPLOAD CHECKLIST.md').write_text("\n".join(out),encoding='utf-8')
    # ZIP
    zp=ROOT/'Gumroad_5_Ebooks_Phone_Upload_Pack.zip'
    with zipfile.ZipFile(zp,'w',zipfile.ZIP_DEFLATED) as z:
        z.write(ROOT/'00 PHONE UPLOAD CHECKLIST.md','00 PHONE UPLOAD CHECKLIST.md')
        for n,folder,title,pdf,cov in BOOKS:
            lp=ROOT/folder/'Gumroad Listing.md'
            if lp.exists(): z.write(lp,f'{n}_{cov[3:]}/LISTING.txt')
            for lab,p,typ in files(folder,pdf,cov):
                if p.exists(): z.write(p,f'{n}_{cov[3:]}/{p.name}')
    print('checklist + zip written',zp.stat().st_size//1024,'KB')
if __name__=='__main__': build()
