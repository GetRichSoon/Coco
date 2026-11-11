# GUMROAD FINAL PUBLICATION REPORT (2026-11-07)

**Result: all five books are PUBLISHED on Gumroad and verified live.** Store: The Velvet Foundry (`thevelvetfoundry.gumroad.com`). No duplicates were created (the four older Velvet Foundry products were left untouched). The earlier pre-publication report is kept as `_GUMROAD_report_before_publishing.md`.

## Connection: what was wrong and what fixed it
- Chrome profile connected to Claude: **Profile 65, "Mangesh", mangesh.lokade.dev@gmail.com** (Claude extension 1.0.105, all-sites access). It holds the Gumroad session. Gumroad opened already logged in, with no login, OTP or CAPTCHA needed. No cookies, passwords or tokens were read or typed.
- Cause of the earlier "not in Claude's tab group" failures: the Orbi extension in the same profile regrouped every new tab into its own workspace group, destroying Claude's tab group within a second (found by reading Orbi's installed code; confirmed because the connection worked immediately once Orbi was switched off).
- Fix: Orbi was switched off in Profile 65 by the owner. Orbi can be switched back on; it only needs to be off while Claude drives the browser.
- The pipeline route (Nova/Supabase) was not used; it was blocked by HTTP 402 and no credential was touched.

## Products (all checked on Gumroad's dashboard and on the public page: HTTP 200, published true)
| # | Title on Gumroad | Live URL | Price | Uploaded file(s) | Cover | Thumbnail | Category |
|---|---|---|---|---|---|---|---|
| 1 | ChatGPT Workflows for Small Business: The AI Workflow Playbook (30 Step-by-Step Systems + Prompts) | https://thevelvetfoundry.gumroad.com/l/chatgpt-workflows-small-business | $14 | `01_The_AI_Workflow_Playbook.pdf` (948 KB) | `01_AI_Workflow_Playbook_Landscape_1280x720.png` | `01_AI_Workflow_Playbook_Thumbnail_600x600.png` | Business & Money > Entrepreneurship |
| 2 | The Client Acquisition Playbook: Find Leads, Book Calls & Win Clients (for Freelancers, Consultants & Small Agencies) | https://thevelvetfoundry.gumroad.com/l/client-acquisition-playbook | $19 | `02_The_Client_Acquisition_Playbook.pdf` (1.1 MB) | `02_Client_Acquisition_Playbook_Landscape_1280x720.png` | `02_Client_Acquisition_Playbook_Thumbnail_600x600.png` | Business & Money > Marketing & Sales |
| 3 | Python Automation for Beginners: 25 Practical Projects for Files, Spreadsheets, PDFs & Reports (with Tested Source Code) | https://thevelvetfoundry.gumroad.com/l/python-automation-for-beginners | $14 | `03_Python_Automation_for_Beginners.pdf` (1.4 MB) + `Python_Automation_Project_Source.zip` (64 KB), in a folder "Book and source code" | `03_Python_Automation_Landscape_1280x720.png` | `03_Python_Automation_Thumbnail_600x600.png` | Software Development > Programming > Python |
| 4 | The Practical Money System: A Beginner's Guide to Budgeting, Saving, Debt Payoff & Building Wealth | https://thevelvetfoundry.gumroad.com/l/practical-money-system-beginners | $9 | `04_The_Practical_Money_System.pdf` (1.1 MB) | `04_Practical_Money_System_Landscape_1280x720.png` | `04_Practical_Money_System_Thumbnail_600x600.png` | Business & Money > Personal Finance |
| 5 | The Job Interview Playbook: 100 Common Interview Questions with Answer Frameworks, Resume & LinkedIn Strategies | https://thevelvetfoundry.gumroad.com/l/job-interview-playbook-100-questions | $12.99 | `05_The_Job_Interview_Playbook.pdf` (1.2 MB) | `05_Job_Interview_Playbook_Landscape_1280x720.png` | `05_Job_Interview_Playbook_Thumbnail_600x600.png` | Business & Money > Networking, Careers & Jobs |

Each product also has: the prepared description (with FAQ), a summary line, 8 tags (saved and re-read from Gumroad), the custom URL slug shown above, a Pages detail, and the star-rating display switched on. Tags differ from the plan only where Gumroad limits tags to 20 characters (for example "customer service" instead of "customer service templates", "python beginners" instead of "python for beginners", "interview prep" instead of "interview preparation").

## What was checked per product
Correct title; correct price; cover and thumbnail present on the public page; full description present on the public page (last FAQ sentence found); category and tags re-read after saving; ratings on; the paid PDF attached on the Content tab (Book 3 also has the source ZIP); status "Published" on the dashboard. The download experience was inspected on the Content tab. **No test purchase was made.**

## Free samples: NOT uploaded
The five free-sample PDFs were prepared but are not on Gumroad. The product editor has no preview-file field, and adding a sample to the paid content would hand it to buyers as an extra file. Because of that, the sentence "a free N-page sample is available" was REMOVED from all five live descriptions (it would have been untrue). The sample files remain in each book folder. Options: publish each as a separate $0 product, or host them elsewhere.

## Discover eligibility (reported separately)
- Gumroad's banner on every product's Share tab says that to appear on Discover a product must meet the eligibility criteria, which include at least one successful sale and completing the Risk Review process.
- Done: category selected and ratings shown on all five. Not met: a first sale, and the Risk Review (its status is not visible to Claude). So none of the five is Discover-eligible yet.
- Gumroad's Discover text states a flat 30% fee on sales that come through Discover (the pipeline note for The Retake Method said not to enable Discover for that reason). Claude did not change any Discover or affiliate setting; they remain at the account defaults.

## Not changed
Payout, bank, tax and profile settings; the four older products; any Discover or affiliate switch.

## Remaining items for the owner
1. Switch Orbi back on if wanted.
2. Decide whether to publish the free samples as $0 products.
3. Real traffic and a first genuine sale are needed before Discover can list anything; nothing was done to fake that.
4. Optional: an EPUB edition (Gumroad suggests it), a refund policy, and the creator profile text in `00 MASTER PROJECT STATUS.md`.
