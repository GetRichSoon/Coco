import sys,pathlib,zipfile,datetime,os
sys.path.insert(0,str(pathlib.Path(__file__).parent))
import distro_build as D
from openpyxl import Workbook
from openpyxl.styles import Font,Alignment,PatternFill
G=D.G; OUT=D.OUT
rows=D.build()
today=datetime.date.today().isoformat()
# ---------------- xlsx ----------------
wb=Workbook(); ws=wb.active; ws.title='Matrix'
hdr=['#','Book','Subtitle','Gumroad price (USD)','Pages (PDF)','EPUB MB','EPUB status','Amazon KDP','Amazon price/royalty','Google Play','Google price','Payhip','Payhip price','Manual work required']
ws.append(hdr)
for b in rows:
    ws.append([b['n'],b['title'],b['sub'],b['price'],b['pages'],b['epub_mb'],'EPUBCheck 0 errors','DRAFT READY (not uploaded; login needed)','not set (needs approval)','DRAFT READY (not uploaded; sign-in needed)','not set (needs approval)','DRAFT READY (not uploaded; browser blocked from payhip.com)','not set (needs approval)','Log in; decide author; confirm rights; approve prices; upload (see checklist)'])
ws2=wb.create_sheet('KDP royalty')
ws2.append(['#','Book','EPUB MB','A) Keep Gumroad price','35% royalty at that price','70% royalty at that price (US band to 12.99 per 2026 sources, unverified)','B) Amazon-specific price in 70% band','70% royalty at B (list x 0.70 - 0.15 x MB)','35% royalty at B','Difference B(70%) minus A(35%)'])
for b in rows:
    r70a='n/a (price above band)' if b['r70'] is None else b['r70']
    diff=round((b['a70'] or 0)-b['r35'],2)
    ws2.append([b['n'],b['title'],b['epub_mb'],b['price'],b['r35'],r70a,b['amz_alt'],b['a70'],b['a35'],diff])
ws2.append([]); ws2.append(['Notes: US only. Delivery fee 0.15 USD per MB applies to the 70% option only (35% has none). Sources disagree on whether the 70% price band ends at 9.99 or 12.99; confirm on KDP\'s pricing page before choosing. Other marketplaces use different bands and fees. India (Amazon.in): 70% reportedly needs KDP Select, which we will not use, so India sales would be at 35%. Amazon may price-match lower prices elsewhere (not verified here).'])
ws3=wb.create_sheet('Payhip fees')
for r in [['Plan','Monthly fee','Payhip transaction fee','Notes'],['Free','$0','5%','Plus payment processor charges'],['Plus','$29','2%','Plus processor charges'],['Pro','$99','0%','Plus processor charges'],['','','','Source: Payhip help "Billing and Upgrading" (read through search results; confirm in Payhip). No upgrade made.'],['India gateway','Razorpay is documented by Payhip for sellers in India (Account > Settings > Payment Details). PayU: NOT confirmed in anything opened; check the gateway list in your Payhip dashboard.','','']]: ws3.append(r)
ws4=wb.create_sheet('AI disclosure & rights')
ws4.append(['#','Book','Text','Cover','Interior diagrams','Author on record','Rights / citations'])
for b in rows:
    ws4.append([b['n'],b['title'],'AI-generated (Claude); not human-written','AI-generated (ChatGPT Image Generation) then adjusted in code','AI-drawn SVG in code' if b['n']<=4 else 'none in PDF/EPUB (original five), tables only',b['author_note'],'Rights not verified by Claude: owner to confirm. Citations: only sources opened on 2026-11-07 are listed in each book.'])
ws5=wb.create_sheet('Files')
ws5.append(['#','Book','PDF path','EPUB path','Cover (1600x2560)','Pack folder'])
for b in rows:
    ws5.append([b['n'],b['title'],str(b['folder']/b['pdf']),str(b['folder']/b['epub']),str(b['cover_up']),str(OUT/f"{b['n']:02d}_{b['slug']}")])
for w in wb.worksheets:
    for c in w[1]: c.font=Font(bold=True); c.fill=PatternFill('solid',fgColor='DDE6F3'); c.alignment=Alignment(wrap_text=True,vertical='top')
    for col in w.columns: w.column_dimensions[col[0].column_letter].width=min(60,max(12,max(len(str(c.value or ''))for c in col[:12])*0.9))
    for r in w.iter_rows(min_row=2):
        for c in r: c.alignment=Alignment(wrap_text=True,vertical='top')
xl=G/'THE_VELVET_FOUNDRY_RETAILER_DISTRIBUTION.xlsx'; wb.save(xl)
# ---------------- report ----------------
mx=''.join(f"| {b['n']} | {b['title']} | ${b['price']:.2f} | DRAFT READY | none | not set | DRAFT READY | none | not set | DRAFT READY | none | not set |\n" for b in rows)
roy=''.join(f"| {b['n']} | {b['title']} | {b['epub_mb']} | ${b['price']:.2f} | {b['r35']:.2f} | {'n/a' if b['r70'] is None else b['r70']} | ${b['amz_alt']:.2f} | {b['a70']} | {b['a35']:.2f} |\n" for b in rows)
rep=f'''# GLOBAL 9-BOOK DISTRIBUTION REPORT ({today})

## Headline
**Nothing has been uploaded or published on Amazon KDP, Google Play Books or Payhip, and no platform has confirmed anything.** All nine books are DRAFT READY: validated EPUBs, final PDFs, 1600x2560 covers and separate metadata for each retailer are built and packaged. The uploads are blocked by account access, not by file readiness:
- **Amazon KDP:** the browser session is not signed in (KDP shows its sign-in page). I do not sign in with passwords or deal with OTP/2FA.
- **Google Play Books Partner Center:** shows "Sign in / Get started": not signed in, and I did not register a seller account on your behalf.
- **Payhip:** the browser tool is not permitted to open payhip.com, so I could not even check whether you have an account.
Gumroad listings, prices and URLs were not touched. KDP Select was not used and must stay off.

## What was done
- Inspected all nine books and chose the latest finals: the improved original four (final PDF/EPUB) and the five new editions.
- Built EPUB 3 editions for the five new books (the original four already had them). **All nine pass EPUBCheck with 0 errors and 0 warnings.** Python code blocks keep their indentation; Retake Method question options are on separate lines.
- One fix found on the way: Book 7 (Python) had a raw `<urlopen error ...>` message in running text that broke the EPUB (and silently vanished from the PDF). I wrapped it in code formatting in the source and rebuilt the EPUB. **The published Gumroad PDF for Python still omits that one error line;** a corrected PDF can be re-uploaded if you want (not done: you asked to leave Gumroad unchanged).
- Covers: portrait covers upscaled to 1600x2560 JPEGs for KDP/Google/Payhip. The originals are 1024x1536 (new five) or 1800x2700 (original four); the five new covers are upscaled by about 1.6x and are soft at full size. KDP's recommended ideal is 2560x1600 (this is below it only for the five new books); re-export from the image tool at a higher resolution if you want them sharper.
- Metadata written per retailer for each book: `Global Distribution\\<book>\\metadata_amazon_KDP.txt`, `metadata_google_play.txt`, `metadata_payhip.txt`.
- Pricing and royalty comparisons (below, and in the workbook). Nothing was priced on any retailer.

## Distribution matrix (all nine; nothing is live)
| # | Book | Gumroad | Amazon status | Amazon URL | Amazon price/royalty | Google status | Google URL | Google price | Payhip status | Payhip URL | Payhip price |
|---|---|---|---|---|---|---|---|---|---|---|---|
{mx}
Categories: PUBLISHED AND VERIFIED = Gumroad only (existing). UPLOADED AND UNDER REVIEW = none. DRAFT READY = all nine on all three retailers. BLOCKED = uploads (login/access). WAITING FOR YOUR ACTION = see the phone checklist.

## Amazon: royalty comparison (US, from the finished EPUB sizes)
Rule used: 35% royalty = 35% of list price (no delivery fee); 70% royalty = 70% of list price minus delivery fee of $0.15 per MB, available only inside the 70% price band. You said the band is $2.99 to $12.99; some 2026 sources say the band was extended to $12.99 on 7 July 2026 and older guides say $9.99, and I could not open KDP's own pricing page, so **confirm the band in KDP before choosing**. All nine EPUBs are about 0.4 to 1.4 MB, so delivery fees are $0.06 to $0.20.
| # | Book | EPUB MB | A) Keep Gumroad price | 35% royalty at A | 70% royalty at A | B) Amazon price in band | 70% royalty at B | 35% royalty at B |
|---|---|---|---|---|---|---|---|---|
{roy}
How to read it: at $14, $19, $29, $34 and $39 the 70% option is not available (the price is above the band), so you would earn only 35%: $4.90, $6.65, $10.15, $11.90, $13.65. Pricing a book at $12.99 would earn about $8.9 to $9.0 at 70%. That is more than 35% of $14 ($4.90) or $19 ($6.65), so for the $14 and $19 books an Amazon price of $12.99 pays more per sale than keeping the Gumroad price. For the $29, $34 and $39 books, 35% of the full price ($10.15, $11.90, $13.65) is higher than the 70% royalty at $12.99 (about $8.9), so keeping the higher price pays more per sale, though it may sell less on Amazon (not tested). The $9 and $12.99 books already fit the 70% band. **India (Amazon.in): 70% reportedly requires KDP Select, which we are not using, so Indian sales would be at 35%.** Amazon can also match lower prices found elsewhere (not verified): a lower Gumroad/Payhip/Google price than your Amazon price may pull the Amazon price down. No price was changed; choose per book.

## Google Play Books (India)
Seller sign-up for ebooks is listed for India in Google's supported-countries table; payouts are by USD wire transfer to a local bank account (minimum balance reported as $100). EPUB (preferred) or PDF accepted; the EPUB must contain the full book and a cover; cover files should be at least 640 px (larger recommended). An ISBN is the normal identifier: whether Partner Center accepts a book without one for ebooks was not confirmed: this is a decision (buy ISBNs, or check in Partner Center). Sample PDFs were NOT put into the packs as books. Payment/tax/bank steps are in the manual checklist.

## Payhip
Plans (from Payhip's help page via search results): Free 5% transaction fee, Plus $29/month 2%, Pro $99/month 0%, all plus payment-processor charges. No upgrade was made. For India, Payhip documents **Razorpay** (Account > Settings > Payment Details); **PayU was not confirmed** by anything I opened, so check the gateway list in your dashboard. Razorpay/PayU KYC and onboarding are your personal steps. The Python bonus ZIP is included in the pack and the Payhip metadata, with the tested-on notes from the book (Windows 11, Python 3.14.4 full run, 3.12.12 partial).

## AI content record (for KDP and Google declarations)
- Manuscripts: written by an AI assistant (Claude) from research and prompts, checked with scripts and by the publisher; not human-written. **Declare text as AI-generated** on KDP.
- Covers: generated with ChatGPT Image Generation and adjusted in code; landscape/square versions composed in code. **Declare as AI-generated images.**
- Interior diagrams (original four): drawn in code by the AI assistant. Declare as AI-generated. The new five have no images inside their PDF/EPUB.
- Python book: scripts were written and tested by the AI assistant.
Do not describe any of this as human-created.

## Authors, rights, citations (decisions and checks)
- **Author:** no author name is approved. The original four show "The Velvet Foundry Editorial Team" as the author line; the new five show none. A retailer needs an author or contributor name: **decision required** (a pen name, your name, or the publisher name where the retailer allows it). I did not invent one.
- **Rights:** I cannot verify legal rights. You must confirm: rights to the text (AI-assisted authorship may affect copyright; take advice if this matters), rights to the ChatGPT cover art under OpenAI's current terms, and that nothing third-party is embedded (diagrams are original; the covers were checked by eye for stray text and trademarks, not by a legal search). Titles use "ASWB"/"AWS" descriptively with independence disclaimers (the ASWB and AWS books); a trademark review before KDP is advisable.
- **Citations:** each book lists only sources opened on 2026-11-07; some pages could not be opened and are not cited as read.

## Quality gate status (per your list)
Complete manuscript: yes. Accurate content: corrected for the original four, checked with scripts for the others; not human-edited line by line. Correct author metadata: NO (decision). Approved rights: NO (owner). AI disclosures: prepared. Valid EPUB: yes (9/9). Readable PDF: yes. Professional cover: yes (5 new covers are upscaled). Title/subtitle/description: prepared. Categories/keywords: prepared (category names must be confirmed in each retailer's picker; keyword demand not measured). Price reviewed: comparison done, NOT approved. Preview check: Kindle Previewer was not available here, so the Kindle preview and the Google preview are NOT done. So the full gate is not passed; nothing should be published until the author, rights and price decisions are made.

## Where everything is
`{OUT}` (nine book folders with EPUB, PDF, cover, three metadata files), `{xl}`, `GLOBAL_9_BOOK_PHONE_UPLOAD_CHECKLIST.md`, `GLOBAL_9_BOOKS_RETAILER_UPLOAD_PACK.zip` (all in `{G}`).
'''
(G/'GLOBAL_9_BOOK_DISTRIBUTION_REPORT.md').write_text(rep,encoding='utf-8')
# ---------------- checklist ----------------
c=[f'# GLOBAL 9-BOOK PHONE UPLOAD CHECKLIST ({today})\n\nStatus legend: COMPLETED BY CLAUDE = files, metadata and packs. WAITING FOR MY ACTION = everything below. BLOCKED = uploads by Claude (no login / browser not permitted on payhip.com).\n\n## Step 0. Decisions needed first (required)\n- [ ] AUTHOR NAME to use on all nine books (not decided; none invented).\n- [ ] Confirm you own the rights you will declare (text, covers, diagrams).\n- [ ] For each book choose the Amazon price (A keep Gumroad price at 35%, or B $12.99 at 70%): see the comparison in the report and workbook.\n- [ ] Choose Google Play and Payhip prices (default: same as Gumroad).\n- [ ] Do NOT enable KDP Select.\n\n## Step 1. Move the pack to your phone\nThe pack is `{G}\\GLOBAL_9_BOOKS_RETAILER_UPLOAD_PACK.zip` (a C: path is not on your phone). Send it with Google Drive (upload from PC, open Drive on the phone, download), email to yourself, or USB. Extract it on the phone: you get nine folders, each with the EPUB, PDF, 1600x2560 cover and three metadata text files (Amazon, Google Play, Payhip) holding the full copy-paste text.\n\n## Step 2. Accounts (your personal action)\n- [ ] **Amazon KDP** (kdp.amazon.com): sign in, complete tax interview, bank details, identity checks yourself. Required.\n- [ ] **Google Play Books Partner Center** (play.google.com/books/publish): sign in with the Google account for the business, register as a seller, complete payment profile (USD wire to a local bank account) and tax details yourself. Required.\n- [ ] **Payhip** (payhip.com): create/log in; Account > Settings > Payment Details: connect Razorpay (documented for India) and complete its KYC yourself; check whether PayU is listed. Stay on the Free plan unless you decide otherwise. Required.\n']
for b in rows:
    n=f'{b["n"]:02d}_{b["slug"]}'; pk=OUT/n
    c.append(f'\n---\n\n## BOOK {b["n"]}: {b["title"]}\nSubtitle: {b["sub"]} · Gumroad price ${b["price"]:.2f} · {b["pages"]} pages\n\nFiles in the pack folder `{n}`:\n- EPUB: `{n}.epub` (path on PC: `{pk}\\{n}.epub`)\n- PDF: `{n}.pdf` (path on PC: `{pk}\\{n}.pdf`)\n- Cover: `{n}_cover_1600x2560.jpg` (path on PC: `{pk}\\{n}_cover_1600x2560.jpg`)\n'+(f'- Bonus: `Python_Automation_Project_Source.zip` (PC: `{pk}\\Python_Automation_Project_Source.zip`)\n' if b['key']=='python' else '')+f'- Free sample (Payhip/Gumroad only, NOT for Amazon/Google): `{b["folder"]}\\{[x for x in os.listdir(b["folder"]) if "FREE_SAMPLE" in x][0] if b["n"]>=5 else "09 FREE SAMPLE"}`\n')
    c.append(f'\n**Amazon KDP** (required) . Create Kindle eBook > Language English > Title `{b["title"]}` > Subtitle `{b["sub"]}` > Author: your decided name > Description: paste the HTML from `metadata_amazon_KDP.txt` > Keywords (7 boxes):\n'+''.join(f'  {i+1}. {k}\n' for i,k in enumerate(b['kw']))+f'Categories: {b["amz_cat"][0]} ; {b["amz_cat"][1]} (confirm in the picker). Upload manuscript `{n}.epub`, cover `{n}_cover_1600x2560.jpg`. AI content: Text = AI-generated (yes), Images = AI-generated (yes). KDP Select: NO (leave unchecked). Pricing: your chosen price; royalty per the comparison (A: ${b["price"]:.2f} at 35% = {b["r35"]:.2f}; B: ${b["amz_alt"]:.2f} at 70% = {b["a70"]}). Success: status "In Review", later "Live" with an Amazon URL.\n')
    c.append(f'\n**Google Play Books** (required) . Partner Center > Books > Add book > Title, subtitle, author, publisher `The Velvet Foundry` > Description (paste from `metadata_google_play.txt`) > Categories: {b["play_cat"][0]} ; {b["play_cat"][1]} > Content: upload `{n}.epub` (full book) > Cover `{n}_cover_1600x2560.jpg` > Price USD (your decision; default ${b["price"]:.2f}) > Territories you hold rights for > Preview as you choose. Do NOT upload the free sample as the book. Success: "Published" with a play.google.com/store/books link.\n')
    c.append(f'\n**Payhip** (required) . Products > Add product > Digital download > Name `{b["title"]}: {b["sub"]}` > Price ${b["price"]:.2f} (or your decision) > Upload `{n}.pdf` and `{n}.epub`'+(' and the bonus ZIP' if b['key']=='python' else '')+f' > Cover image `{n}_cover_1600x2560.jpg` > Tags: {b["pay_tags"]} > Description: paste from `metadata_payhip.txt` > Add the free sample PDF as a preview if Payhip offers a preview file (optional). Success: a payhip.com/b/... product page that downloads the files after a test checkout of your own coupon (do not create fake sales).\n')
    c.append(f'\n<details><summary>Short description for Payhip</summary>\n{b["short"]}\n</details>\n')
    c.append(f'\n**Full description text (plain text, used by Google Play and Payhip):**\n```\n{b["desc_text"]}\n```\n')
c.append('\n---\n\n## After publishing (optional)\n- [ ] Send me the live Amazon, Google and Payhip links and I will record them in the report and workbook.\n- [ ] Keep the Gumroad prices and URLs as they are.\n')
(G/'GLOBAL_9_BOOK_PHONE_UPLOAD_CHECKLIST.md').write_text(''.join(c),encoding='utf-8')
D.write_meta(rows)
# ---------------- zip ----------------
zp=G/'GLOBAL_9_BOOKS_RETAILER_UPLOAD_PACK.zip'
with zipfile.ZipFile(zp,'w',zipfile.ZIP_DEFLATED) as z:
    for f in OUT.rglob('*'):
        if f.is_file() and f.parent.name!='covers': z.write(f,f.relative_to(OUT).as_posix())
    z.write(G/'GLOBAL_9_BOOK_DISTRIBUTION_REPORT.md','00_GLOBAL_9_BOOK_DISTRIBUTION_REPORT.md'); z.write(G/'GLOBAL_9_BOOK_PHONE_UPLOAD_CHECKLIST.md','00_GLOBAL_9_BOOK_PHONE_UPLOAD_CHECKLIST.md'); z.write(xl,'00_THE_VELVET_FOUNDRY_RETAILER_DISTRIBUTION.xlsx')
print('zip',zp.stat().st_size//1048576,'MB')
