# GUMROAD FINAL PUBLICATION REPORT (2026-11-07)

**Result: 0 of 5 products published. No product exists on Gumroad yet. Nothing was uploaded, created or changed on the Gumroad account.**

## Exact reason
- The only tool that can drive a logged-in browser in this session is the Claude in Chrome extension. Every attempt (three, the last one just now) returned "Browser extension is not connected", and the connected-browsers list is empty. The Windows desktop-control server (windows-mcp) also failed to connect at session start. There is therefore no way for Claude to open Gumroad, use an existing logged-in session, or upload files.
- Claude did not search the PC or the pipeline for Gumroad passwords or tokens and did not try to log in with them. Entering passwords or tokens to authenticate is something Claude must not do even when asked, and the Gumroad API cannot create products or upload files anyway, so it would not have helped.
- No 2FA, CAPTCHA or Gumroad restriction was reached; the block is the missing browser connection only.

## Per product

| # | Product | Status | Live URL | Price to set | PDF to upload | Cover | Thumbnail | Sample | Discover |
|---|---|---|---|---|---|---|---|---|---|
| 1 | The AI Workflow Playbook | NOT published | none | $14 | `01_The_AI_Workflow_Playbook.pdf` | `01_AI_Workflow_Playbook_Landscape_1280x720.png` | `01_AI_Workflow_Playbook_Thumbnail_600x600.png` | `01_The_AI_Workflow_Playbook_FREE_SAMPLE.pdf` (not uploaded) | Not assessed (no product) |
| 2 | The Client Acquisition Playbook | NOT published | none | $19 | `02_The_Client_Acquisition_Playbook.pdf` | `02_Client_Acquisition_Playbook_Landscape_1280x720.png` | `02_Client_Acquisition_Playbook_Thumbnail_600x600.png` | `02_The_Client_Acquisition_Playbook_FREE_SAMPLE.pdf` (not uploaded) | Not assessed |
| 3 | Python Automation for Beginners | NOT published | none | $14 | `03_Python_Automation_for_Beginners.pdf` | `03_Python_Automation_Landscape_1280x720.png` | `03_Python_Automation_Thumbnail_600x600.png` | `03_Python_Automation_for_Beginners_FREE_SAMPLE.pdf` (not uploaded) | Not assessed |
| 4 | The Practical Money System | NOT published | none | $9 | `04_The_Practical_Money_System.pdf` | `04_Practical_Money_System_Landscape_1280x720.png` | `04_Practical_Money_System_Thumbnail_600x600.png` | `04_The_Practical_Money_System_FREE_SAMPLE.pdf` (not uploaded) | Not assessed |
| 5 | The Job Interview Playbook | NOT published | none | $12.99 | `05_The_Job_Interview_Playbook.pdf` | `05_Job_Interview_Playbook_Landscape_1280x720.png` | `05_Job_Interview_Playbook_Thumbnail_600x600.png` | `05_The_Job_Interview_Playbook_FREE_SAMPLE.pdf` (not uploaded) | Not assessed |

All files are in the numbered folders under `C:\Users\Lenovo\Good Space\Coco\Gumroad Ebooks\`. The listing text for each is in that folder's `Gumroad Listing.md`.

## Discover eligibility
Not assessable until a product exists. Official Gumroad help says a product needs a selected category and ratings enabled; other requirements quoted by third-party blogs are unverified.

## What unblocks publishing
1. In the Chrome profile where you are already logged in to Gumroad, make sure the Claude in Chrome extension is installed, running and signed in to the same claude.ai account as Claude Code (restart Chrome if it was just installed). Then tell Claude to continue: it will use the existing Gumroad session, create and publish all five products and verify each live page.
2. Claude will stop only for a genuine login screen, 2FA, CAPTCHA or identity check that needs you personally.
3. Alternative: use `00 PHONE UPLOAD CHECKLIST.md` and the phone pack zip.

## Update: how The Retake Method was published, and why that route is blocked today
- Store in the pipeline: thevelvetfoundry.gumroad.com (the older commit mentions lokade.gumroad.com, which memory says returns 404).
- Method (repo `nova-hq\scripts\publish\gumroad.mjs`, first used 2026-10-29): Gumroad API v2. Create the product as a DRAFT with `draft` set explicitly, upload the file through Gumroad's multipart presign/complete calls, attach cover and thumbnail through the covers call, read the product back from Gumroad, then enable it only after approval. The API token is read from the Coco Vault inside the script at the moment of use and is never printed. The adapter takes an EPUB plus a `listing.json`; these five books are PDFs.
- Blocker found: the adapter reads the Gumroad connection and credential from Coco Cloud (Supabase). A read-only test returned HTTP 402 ("could not read connections"), the same egress-quota block recorded in memory on 2026-11-02. So the pipeline cannot reach its own credential right now. No token was read, copied or used by Claude.
- The pipeline's own note for that book says: "Do not enable Discover: 30% is worse than Amazon" (10% + $0.50 on a direct sale). The five-book organic plan assumes Discover is wanted; that is a decision to confirm before publishing.
- Note from memory: the old Gumroad publishing chain was switched off on 2026-11-04 (Boss directive). Reusing it for these five books needs the 402 cleared and an explicit go-ahead, which the chat instruction provides.

## Investigation of the Chrome connection (2026-11-07)
Read-only checks of Chrome's profile list, extension install records and Orbi's installed code. No cookies, history, password stores or session databases were opened.
- Chrome profiles on this PC: 20. The profile for mangesh.lokade.dev@gmail.com is **Profile 65** ("Mangesh"). The profile for lokademangesh123@gmail.com (the Gumroad account email in the pipeline notes) is **Profile 32**.
- The Claude extension (version 1.0.105, enabled, all-sites access, tab-group permission granted) is installed in exactly two profiles: Profile 65 and Profile 32. It is not missing permissions in Profile 65.
- The single connected browser ("Browser 1") connected about 6 minutes after Profile 65 was last active, so it is almost certainly Profile 65, the correct profile. It is not a wrong-profile problem.
- Cause of "not in Claude's tab group": Profile 65 also runs the **Orbi** extension (2.9.2), which replaces the New Tab page and, on every new tab, assigns it to its own workspace tab-group and re-sorts the window (`tabs.onCreated` then `OrbiTabSpaces.inherit` and `scheduleStripSync`). The tab Claude opens is a blank New Tab in a new window, so Orbi regroups it and Claude's tab group is destroyed within a second. This is the strongest explanation found; it is not yet proven by a test.
- Fix to try: in Profile 65 open chrome://extensions, switch Orbi OFF, keep the Gumroad Products tab open, then retry. (Fallback: Profile 32 has the Claude extension and no Orbi.)
- Whether Gumroad is logged in in Profile 65 could not be checked without opening the browser's cookie store, which was not done; it needs the extension to open a tab.
