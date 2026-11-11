# GOOD SPACE: Complete Company Status (read-only audit)

Date: 2026-11-07. Audit only: nothing was created, changed, published, scheduled, deleted or paid for. No secrets were read or printed (key files were checked by name/validity only).

Evidence base: GitHub `GetRichSoon/CocoMaison` origin/main at fd9c046 (2026-11-07 10:40 UTC); live read-only checks on 2026-11-07 (YouTube token + channel stats, Vercel/Supabase/GitHub lists, GitHub Actions run history, Windows scheduled tasks, HTTP status of live pages); local folders; shared memory `Good Space\Coco\memory\Sessions`.
Important: the local clone `C:\Users\Lenovo\nova-hq` is 337 commits behind origin/main. A session reading only local files sees the pre-November state.

Statuses used: COMPLETED, WORKING, PARTIALLY COMPLETED, NOT STARTED, BLOCKED, NEEDS VERIFICATION.
Companion files in this folder: GOOD_SPACE_REMAINING_WORK.md, GOOD_SPACE_EXISTING_AUTOMATION_MAP.md, GOOD_SPACE_TEAM_AND_CHANNEL_INVENTORY.xlsx, GOOD_SPACE_NEXT_DECISIONS.md.

---

## 1. The honest picture in ten lines

1. The organisation is real in code: Boss and Big Boss, Coco (chief of staff), Bonbon Club (support), Core House, and 7 Houses. Registry on 2026-11-04: 28 teams, 37 sub-teams, 48 categories, 23 products, 204 agents. Only 51 agents have a prompt file; about 150 are registry rows only.
2. Scheduled cloud automation that is verifiably green (2026-11-05 to 11-07): cloud cycle, cloud worker, YouTube daily analytics, extension intelligence, Gumroad daily monitor, brains cycle, secret scan. These measure, report and queue. They do not create or publish content on their own.
3. Money earned so far that has evidence: none confirmed. Gumroad: 9 books live, 0 purchases, $0, 19 views. Chrome extensions: 926 users (Screen Time Tracker) and 84 users (Orbi); Pro revenue figures NEEDS VERIFICATION (payment server dashboards not read).
4. YouTube: 17 channels exist in the audit (16 registry rows plus Penthouse Frequency, which is missing from the registry). Only 3 have working logins and any uploads: The Flow (12 subs, 16 videos, 8,678 views), Moonveil Audio (2 subs, 5 videos, 87 views), Penthouse Frequency (1 sub, 1 video, 10 views). 12 channel logins are dead (invalid_grant). 2 channels do not exist yet.
5. The "brains" are mostly empty. 12 of 14 team BRAIN.md files are 430 to 570 byte stubs. Real lessons live in only 3 files. The new Brains engine runs daily but every action is HELD by design.
6. The company-wide emergency stop in `os/controls.json` is still set (Boss: keep it on, 2026-11-04). Anything that reads "company is running" must be checked against this.
7. The PC is in trouble: C: has 2.5 GB free (474 GB used) and G: (Google Drive) is not mounted, so the nightly Drive backup fails.
8. Security items open: Gumroad token leaked in Actions logs (not rotated), QuickCast service_role key in the history of the now-PUBLIC Coco repo, a YouTube refresh token leaked in logs (A-031).
9. Supabase Good Space hit an egress limit (HTTP 402) on 2026-11-02 to 11-04; current state NEEDS VERIFICATION.
10. Claude dependence: `scripts/lib/model.mjs` calls only Claude, with no Gemini/Ollama fallback. Ollama did not answer on localhost:11434. Claude Max (to 2026-11-25 per Boss) is 18 days away.

---

## 2. Company hierarchy, A to Z (Coco, Houses, teams, sub-teams, categories, channels, brains, pipelines)

Legend for automation level: A0 paper only; A1 research files by a routine; A2 partly deterministic cloud job; A3 scheduled and verified green.

```
BOSS (Mangesh) and BIG BOSS (Shreya): approve everything public, paid or irreversible
  COCO: chief of staff (daily list, decisions log, token vs money table)
    Bonbon Club: support for all Houses
    Core House: engine, cloud, security, registry (8 sub-teams)
    LULU Software      6 sub-teams
    GIGI Social+YouTube 5 sub-teams
    POPPY Ebooks       4 sub-teams
    MOCHI Comics       4 sub-teams
    FIFI Courses       5 sub-teams
    ZAZA Games         5 sub-teams
    TILLY Commerce     6 sub-teams
    Planned only: Juno Jobs, Services (AI agency), micro-drama
    Support: Pixie (keeper), Nono (appcare), Lili (research), Vivi (design)
```

### 2.1 Coco and the Core House
- Coco: chief of staff, formerly Nova. Apps: Coco Lounge Android 2.9.2 (OTA via GitHub releases), Lounge Desktop, face/heart local app, Nova control API (cocolounge.vercel.app, health 200 on 2026-11-07). Status WORKING. Data: Supabase "Good Space" (bfnhnkxvppqmklfpslfm), healthy. 402 egress state NEEDS VERIFICATION.
- Core sub-teams (8): Coco Platform, Cloud Engine, Infrastructure, Security, Automation, Data and Company Registry, Shared Engineering, Central Administration. Agents live: scout, builder, release-qa, content-writer, video-producer, growth (plus Nova).
- Brain: `company/core/BRAIN.md` (441 B stub, 2026-10-27). Pipeline: cloud cycle 02:15 and 13:15 UTC, cloud worker every 4 h, brains 05:00 UTC. A3, WORKING.
- Bonbon Club: Lola (ideas), Lili (research), Remy (builds), Vivi (design), Margot (writes), Cleo (video), Elise (QA gate), Kiki (growth), Didi (care), Bibi (money). Only Lili, Vivi, Pixie and Nono have agent files. The others' work is done by the generic agents. Status PARTIALLY COMPLETED.

### 2.2 LULU Software (head: software-head; 7 agents; spec says 15 categories, memory says 10, NEEDS VERIFICATION which is canonical)
| Sub-team | Categories | Products | Brain | Pipeline | Status |
|---|---|---|---|---|---|
| Diamond Extensions | AI Extensions, Productivity Extensions, Browser Utilities | Screen Time Tracker (926 users, 5.0 from 8 ratings), Orbi (84 users, 5.0 from 2) | `company/extensions/BRAIN.md` STALE (says "no releases"), `MISTAKES.md` REAL (2026-10-29), `PORTFOLIO.json` FRESH daily | intel (daily, A3) > plan > build on PC > QA gate > package > Boss YES > Chrome Web Store API publish > live check | WORKING for intel; publish works on demand with YES |
| Pearl Android | AI Tools, Productivity, Utilities | Unfold APK v1.0 (built 2026-10-14), Lounge | none | build on PC, `android-build.yml` | BLOCKED: Play Console not connected, $25 fee, account type undecided |
| Velvet Windows, Bella Web and SaaS, Royale Samsung, Opal iPhone and Mac | various | none | none | nightly shortlist only | NOT STARTED (research shortlists exist) |
Other extensions with code on the PC but no store id in the repo (NEEDS VERIFICATION): Typewave, Breakwater, Loudleaf, SpaceGuard/WhatsApp Enhancer, QuickCast, Coco Idea Saver, Claude Enhancer, Job Fit Check, Tempo Controller, XCoda, TubeShot Pro and roughly 35 older ones.
Open: A-021 (GitHub token for private repos), A-022/A-027 (2-Step Verification per extension Google account), A-025 (shipping source not all on GitHub), A-034 (Orbi listing text still old), Orbi P1 music play-state bug.

### 2.3 GIGI Social and Media (head social-head; YouTube head NOT ASSIGNED)
| Sub-team | Categories | Brain | Pipeline | Status |
|---|---|---|---|---|
| Goldie YouTube | Education, Technology, Entertainment, Motivation, History and Stories, Health and Lifestyle (spec); company/youtube has 14 category folders | `company/youtube/BRAIN.md` STALE (2026-10-25), `MISTAKES.md` REAL (2026-10-29), `PERFORMANCE.md`, `QUALITY_V2.md`, reports/latest.json FRESH | pipeline `pl.gigi.goldie`, 13 stages, status TESTING ("nothing LIVE") | PARTIALLY COMPLETED |
| Honey Facebook, Cherry Instagram | Pages, Reels, Theme Pages | stub | kits only (15 files, 5 brands x FB/IG/Pinterest) | PAUSED by Boss 2026-10-09; accounts not created |
| Bunny Pinterest, Daisy X | Idea Pins, Brand Accounts | stub | kits only | NOT STARTED |

YouTube channels (17), each a sub-channel under Goldie. Detail table with URLs/IDs is in the XLSX. Summary:
- WORKING (3): The Flow (Science), Moonveil Audio (Lofi/Sleep), Penthouse Frequency (Motivational deep house). All three live now, none with scheduled videos.
- BLOCKED, token dead (12): BodyDecode (biology-health), PastWoven (history-geography), DreamFrame (stories), QuiteMindFiles (human-behaviour), MindSpark (study), SuccessHasal (money), UntoldUniverse (mixed), UnveilAI (ai-software), TasteOdessey (food), SanatanEchoes (devotional), Streebellion (feminism), Kahani Ghar TV (Hindi stories). No upload evidence found for any. Subscriber counts and handles NEEDS VERIFICATION. Fix: one device-login reconnect per channel by the founder.
- NOT STARTED (2): human-info, app-web (no channel exists).
- All brand channels sit under the Google account sampleshoppp@gmail.com (memory 2026-10-15).
- YouTube Studio roles (16, registry only): Marquee, Trendy, Topix, Scripty, Hook, Board, Vox, Vivid, Cutter, Subs, Thumbs, Headline, Tagger, Critic, Launchpad, Views. Real work is done by the core agents.

### 2.4 POPPY Ebooks (head ebooks-head; 5 agents; brand The Velvet Foundry)
| Sub-team | Status |
|---|---|
| Royale Direct Sales (Gumroad) | WORKING, the only live channel: 9 books live, 0 sales |
| Duchess Amazon KDP, Jewel Google Books, Tiara Apple Books | NOT STARTED (upload packs only; KDP shows founder_upload_required) |
Brain: `company/ebooks/BRAIN.md` stub; `company/publishing/ebooks/LEARNING.md` REAL (2.3 KB, 2026-10-29, the only real lessons file). Pipeline: category research + monitor (gumroad-daily, 04:30 UTC, A3) > weekly performance BLOCKED (Gumroad token lacks view_sales) > cover BLOCKED > ebook-daily producer OFF (schedule off; its Claude steps cannot run, "no Anthropic credit" note, NEEDS VERIFICATION) > founder approval > publish. Full book table in section 6.

### 2.5 MOCHI Comics and Animation (head comics-head; 5 agents)
Sub-teams: Moonbeam Webcomics, Starlight Manga and Volumes, Pixie Animated Shorts, Blossom Memberships (8 categories). Brain `company/comics/BRAIN.md` empty template. Plan verdict (PLAN-FINAL.md, 2026-10-26): do NOT start the full House; run only one motion-comic YouTube test. Status: House NOT STARTED/paused; test project PARTIALLY COMPLETED and BLOCKED (see section 7).

### 2.6 FIFI Courses (head courses-head; 6 agents)
Sub-teams: Princess Udemy, Belle Skillshare, Angel Coursera, Crown YouTube Courses, Darling Own Website. Pilot "Study Smarter in 14 Days" (Rs 499): 14 lesson scripts and sales page written per publishing audit; HANDOFF (2026-10-26) says 3 lessons done and 4 to 14 missing, so the two sources disagree (NEEDS VERIFICATION). Nothing recorded, no account. A-015 PENDING. Brain stub. Status PARTIALLY COMPLETED, BLOCKED.

### 2.7 ZAZA Games (head games-head; 6 agents)
Sub-teams: Turbo Roblox, Pixel Android, Spark Web, Rocket PC, Nitro Other Creators (10 categories in spec, 7 in memory). Products: Coco Obby (30 stages, built, NOT published, pass/product IDs still 0), Rift Eggs v0.1 (71 tests pass, not play-tested, money off). Roblox account mangeshlokade, API key valid. India payout eligibility unconfirmed. Brain stub. Status PARTIALLY COMPLETED, BLOCKED (needs Boss YES plus Studio/Creator Dashboard login).

### 2.8 TILLY Commerce (head commerce-head; 7 agents)
Sub-teams: Luxe Suppliers, Opal Shop Operations, Sterling Print on Demand, Cashmere Traffic, Goldie Support Bot, Pearl Legal Tax and Payments (12 categories). Only PLAN-FINAL.md (pet accessories niche, evidence grade C). Nothing bought, no store. NOT STARTED, waiting 5 answers from Boss.

### 2.9 Planned only
Juno Jobs (Finder, Tailor, TPO Watch; plan file only; needs resume, targets, TPO links), Services (AI agency), micro-drama (could live in Mochi), rented always-on server. All NOT STARTED.

### 2.10 Support teams
- Pixie (keeper): rule-based daily board. Latest board file in repo is BOARD-2026-10-26, so NEEDS VERIFICATION.
- Nono (appcare): device-sync snapshot 2026-11-04: Boss PC online, Big Boss PC last seen 2026-10-30, both phones' update FAILED at 2.9.2. PARTIALLY COMPLETED.
- Lili (research guild, opus): WORKING on request; research-cache has 24 files; weekly sweep unverified.
- Vivi (design guild): NOT STARTED as a team (one agent, empty brain). The Design Atelier asset library is WORKING (avatars, logos, Gumroad covers, Material You theme, tokens).
- 14 legacy departments (strategy, engineering, product, design, qa, marketing, content, youtube, career, email, sales, finance, analytics, ops) are PAUSED since 2026-10-07.

### 2.11 Brains (two different things)
1. File brains `company/*/BRAIN.md`: 12 of 14 are stubs from 2026-10-27. Real content: `publishing/ebooks/LEARNING.md`, `youtube/MISTAKES.md`, `extensions/MISTAKES.md`. Stale and partly wrong: `company/BRAIN.md` (2026-10-07), `youtube/BRAIN.md` (2026-10-25), `extensions/BRAIN.md` (2026-10-14).
2. Hierarchical Brains engine (`docs/BRAINS.md`, 2026-11-04): 341 brains across company > team > sub-team > category > product > agent; zero model calls; runs daily 05:00 UTC; green on 2026-11-05 and 11-06; execution HELD by `os/brains/governance.json`. Storage is a git file (`company/brains/records.jsonl`, 982 lines, last on main 2026-11-04); migration 0031 not applied (Boss declined). Newer records may sit on branch cloud/durable-queue (NEEDS VERIFICATION). Goals: company revenue 1M confirmed; The Flow 200 views a day provisional.
3. Shared chat memory `Good Space\Coco\memory\Sessions`: WORKING, 90+ notes, nightly Daily Seal push to GetRichSoon/Coco.

---

## 3. Completed, in progress, missing (summary; full lists in GOOD_SPACE_REMAINING_WORK.md)

COMPLETED: org structure and registry; cloud cycle/worker; YouTube analytics pipeline for The Flow; extension intelligence; Gumroad monitor; 9 Gumroad books published; STT 5.7.x moved to its own Supabase; payment server live; Android OTA; Coco Chat; Design Atelier; 6 Room 4B scripts; 15 social kits; Chrome Web Store publish tooling.
PARTIALLY COMPLETED: cloud YouTube produce/publish (1 success, 4 failures; only 2 channels have cloud credentials); brains (measure only); ebook improvements (prepared, none applied); courses; Obby; Room 4B (ep1 only); Kahani Ghar (2 packages, live status unknown).
BLOCKED: 12 channel logins; Gumroad view_sales and token rotation; Play Console; Roblox publish; comics A-013; course A-015; G: backup; payout methods.
NOT STARTED: KDP, Google Books, Apple Books, Kobo, Payhip; Udemy/Skillshare/Coursera; print on demand/commerce; Instagram/Facebook/Pinterest/X accounts; Juno Jobs; Services; micro-drama; Edge add-ons; Windows/Samsung/Apple/Web software products; the two missing YouTube channels.

---

## 4. YouTube network audit (live checks 2026-11-07)

| Channel | Niche | Subs | Videos | Views | Last upload | Status |
|---|---|---|---|---|---|---|
| The Flow, UCDmTAcfXbYp6uxmD4eM14WA | Daily science Shorts + long | 12 | 16 | 8,678 | 2026-11-06 (mantis long, https://youtu.be/tNbX-iIn8jc) | WORKING |
| Moonveil Audio, UCf-lgZ6w96r4KR7B8h4DjnA | Lofi / sleep | 2 | 5 | 87 | 2026-11-06 (3 h, https://www.youtube.com/watch?v=rKq5l4-UgmE) | WORKING |
| Penthouse Frequency, UCQ7HRdvJEemDPYPaOEKi34w | Motivational deep house, 90 min | 1 | 1 | 10 | 2026-11-06 (https://youtu.be/I0iVeP8PqVg) | WORKING (not in registry) |
| 12 brand channels | see 2.3 | ? | ? | ? | none found | BLOCKED |
| human-info, app-web | n/a | n/a | n/a | n/a | n/a | NOT STARTED |

The Flow analytics (report 2026-11-06, collected 12:04Z): 28 days 8,585 views, 53.8% average view, net +11 subs; last 7 days 1,306 views and 0 subs. Traffic 28 days: Shorts feed 7,719, search 476, channel 133. Winners: animal family (112 views/day), body (94; the eye floaters Short is 12 times the median, 1,250 views). Worst: phone family (24/day). Weak spot: subscriber conversion, about 1.5 per 1,000 views. Impressions and CTR are not available from the API. The daily cadence broke: no Shorts on 10-30, 10-31, 11-01, 11-03, 11-04, 11-05.
Moonveil: planned 3.5 videos a week; actual 5 videos in 11 days then a 7-day gap before 11-06. Penthouse: third upload (YouTube removed the first two because the over-15-minute feature was off).
Scheduled videos on any channel: none. Pending: Moonveil 006 "Built For More" package (untracked, not uploaded), Penthouse series (no second video), Kahani Ghar episode 1 (unfinished, token dead), a stale queued item in `yt-video-queue.json` (2026-10-07).
Open Flow issues: mantis long video audio not yet listened to; Kai has a female voice (memory 2026-11-06).
Production tools in use: studio/the-flow habit engine (hb.py with Kai and Orbi, Kokoro voice, Rhubarb lip sync, video-qa.py), Moonveil longform/loop/verify/publish scripts, Penthouse synth and render scripts with Canva thumbnails, Kahani Ghar Autodraft workflow. No evidence Hyperframes is used.
Remaining opportunities (evidence based): restore The Flow cadence on the animal and body families; add a subscribe line (1.5 subs per 1,000 views); apply the same engine to 2 or 3 reconnected channels instead of all 12; register Penthouse; give Moonveil and Penthouse analytics; file the YouTube quota extension request before multi-channel daily uploads (not confirmed filed).

---

## 5. Software, websites, integrations

| Item | State | Evidence |
|---|---|---|
| Screen Time Tracker (item llfciomelolhkmnepbnjkiokpinfgdmf) | WORKING, 926 users; PORTFOLIO.json says 5.7.1 live, memory says 5.7.1 PENDING_REVIEW: NEEDS VERIFICATION | PORTFOLIO.json 2026-11-07 |
| Orbi (item jcfgocfmlmookmeikkiilleedifpllmn) | WORKING, 84 users, 2.9.2 per portfolio; listing text old; P1 bug open | PORTFOLIO.json |
| Payment server extension-six-alpha.vercel.app | WORKING (HTTP 200); not in the Vercel account the audit could see | live check |
| Nova control API cocolounge.vercel.app | WORKING (health 200) | live check |
| Vercel team "Orbi" (orbi10) | 6 projects: screentimetracker-api, orbi website, cocolounge, orbi-privacy, nova-studio, analaya; 0 domains; Hobby plan per memory (commercial-use risk) | Vercel list |
| Supabase | Good Space and Screen Time Tracker ACTIVE_HEALTHY; JobScan & AutoFill paused | Supabase list |
| GitHub GetRichSoon | CocoMaison (private), Coco (PUBLIC), BigBossSuite and BossSuite (private, empty), .github-private, Analaysis- (archived). Product repos under personal account Mangesh347 | gh repo list |
| Websites | thevelvetfoundry.gumroad.com (200); orbi site; no custom domains owned | live checks |
| Integrations | Chrome Web Store, GitHub, Vercel, Supabase: connected. YouTube: 3 of 17. Gumroad: partial (token lacks view_sales). Backblaze B2: key works only for `proof/`. Neon and migration 0026: not applied. Play Console, Instagram, Facebook APIs: not connected | os/integrations.json, memory |

---

## 6. Publishing business: The Velvet Foundry (https://thevelvetfoundry.gumroad.com)

Lifetime: 0 purchases, $0 gross, $0 net, no payouts, 19 views (read from the authenticated dashboard on 2026-11-07; source `Good Space\Coco\Gumroad Ebooks\Velvet Foundry Business\STAGE 1 - ANALYTICS SNAPSHOT 2026-11-07.md`).

| # | Book | Price | Format | State | Known defects |
|---|---|---|---|---|---|
| 1 | The 90-Day Clinical Licensing Exam Study Plan (ASWB/LCSW) | $34 | EPUB | WORKING, live 2026-10-29, 13 views | refile to Test Prep pending (A-032) |
| 2 | Keep Your Own Books | $29 | EPUB | WORKING, live 2026-10-30, 3 views | category "Other" |
| 3 | The Retake Method | $29 | EPUB | WORKING with defects, 1 view | wrong live thumbnail, 1 tag, EPUB breaks answer options, category "Other" |
| 4 | Where Your AWS Bill Goes | $39 | EPUB | WORKING with defects, 2 views | 3 outdated AWS claims, wrong cross-references, category "Other" |
| 5 | AI Workflow Playbook (ChatGPT Workflows for Small Business) | $14 | PDF 67 pp | live 2026-11-07, PARTIALLY COMPLETED | no free sample, no refund policy |
| 6 | The Client Acquisition Playbook | $19 | PDF 85 pp | same | same |
| 7 | Python Automation for Beginners | $14 | PDF 136 pp + ZIP | same | same |
| 8 | The Practical Money System | $9 | PDF 72 pp | same | same |
| 9 | The Job Interview Playbook (100 questions) | $12.99 | PDF 97 pp | same | answers Q41 to Q100 shorter than target |

Improvements for books 1 to 4 (per-book audits, 3 cover concepts each, improved listings, diagrams) are prepared and NONE applied; Boss's 2026-11-07 rule forbids live changes without approval. A tenth manuscript, First Apartment Repair Basics, is built and on hold (author name undecided). The 30 Day Student Reset workbook (Rs 199 draft on a second Gumroad account lokademan) has no evidence of ever going live (A-014 PENDING).
Engine: the daily cloud report (2026-11-06) tracks only the original 4 books and cannot read sales (token lacks view_sales). Old publish pipeline OFF since 2026-11-04; its cost was $7.98 of Claude in 7 days.
Other platforms: KDP, Google Play Books, Apple Books, Kobo, Payhip all NOT STARTED. Courses: see 2.6. Commerce: NOT STARTED.
Approvals: A-019 APPROVED and PUBLISHED. PENDING: A-032, A-023, A-024, A-025, A-014, A-015. A-033 reads PENDING but the book is live under a standing authorisation (entry is stale). The IDs A-023/24/25 are also reused by unrelated extension items, so the numbering needs cleanup.

---

## 7. Anime, comics and stories

| Project | Status | Evidence |
|---|---|---|
| Room 4B Never Sleeps (original IP): bible, 6 episode scripts, test plan; characters Mira Voss, Mr. Hale, Ruben Aldous | scripts COMPLETED | `company/publishing/comics/products/room-4b/` |
| Room 4B episode 1 render | rendered (7.7 MB); QA pass NEEDS VERIFICATION | `content/2026-10-26-room4b-ep01/short.mp4` |
| Room 4B episodes 2 to 6 | NOT STARTED | none found |
| Posting 6 Shorts to DreamFrame (A-013) | BLOCKED, PENDING Big Boss decision; DreamFrame token is also dead | APPROVALS.md |
| Webtoon Canvas, Tapas, Patreon, KDP comics | NOT STARTED | PLAN-FINAL.md rejects Tapas, uses Canvas later |
| Manga or anime artwork | none found anywhere under C:\Users\Lenovo | searched to depth 6 |
| Kahani Ghar (Hindi animated stories): ep1 Diwali long + short (2026-10-21), Short 02 Udhaar, workflow docs | PARTIALLY COMPLETED; live on YouTube NEEDS VERIFICATION | `content/kahani-ghar-*`, `studio/kahani-ghar` |

---

## 8. Automation core (details in GOOD_SPACE_EXISTING_AUTOMATION_MAP.md)

Green on 2026-11-05 to 11-07: cloud cycle 6/6, cloud worker 10/10, secret scan 33/33, extension intel 4/4, gumroad daily 2/2, YouTube daily 3/3, Daily Seal on the PC (last run 11-06 23:30, result 0), Office/Home mode tasks.
Failing or broken: YouTube produce 1 success and 4 failures; YouTube publish 1 failure; company-run 2 of 2 failed; tests 2 of 18 failed (company-registry.mjs missing on main, fix sits in an uncommitted dev worktree); PC tasks Coco Cloud Backup and Coco Daily Summary (result 1); NovaDailyStatus; NovaTerminal1Watchdog (dead since 11-02); NovaTerminalsWatchdog; the three playlist slot tasks (result 1 on 11-07).
Still manual: every approval and publish YES, credential rotation, new-channel logins, store 2-Step Verification, payout setup, B2 key, Supabase plan decision, video audio listening, cover and artwork choices.

---

## 9. Financial and resource overview (real evidence only)

- Revenue: no confirmed revenue anywhere. Gumroad $0. Extension Pro and payment-server sales NEEDS VERIFICATION (Razorpay/PayPal dashboards not read). `company/METRICS.md` is stale (2026-11-01) and still says Claude Pro.
- Known monthly costs: Cloudflare $0, Resend $0, Vercel Hobby $0, Supabase free, ad spend $0. Google AI Pro 5 TB via Jio free until about Dec 2027. Chrome Web Store $5 developer fee per account (already paid for existing items). Domains owned: none.
- Pending paid decisions (not bought): Vercel Pro $20/month, Supabase upgrade $25/month, Play Console $25.
- Claude: Max per memory. The 2026-11-25 end date is the founder's statement and is NOT recorded in any repo or memory file; its price is also unrecorded. Token burn on 2026-10-26 was 10.84M fresh tokens (about 90% of the weekly budget, 79% from one 23 hour session). The two token ledgers disagree (722,588 in Supabase vs about 2.0M in the file ledger).
- Generation credits: Anthropic API account credit state NEEDS VERIFICATION (a pipeline note says no credit). Other generation credits: not found.
- Deadlines and verifications: B2 lifecycle verify id proof-mvy3p93o was due 2026-11-03 (result unknown); 2-Step Verification on each extension Google account (A-022/A-027); Play account type; Gumroad payout method (not connected as of 10-26); Razorpay payout state; Roblox India eligibility.

---

## 10. Claude Max deadline: 2026-11-25 (18 days)

Depends on Claude today: interactive sessions like this one; `scripts/lib/model.mjs` (Claude only, no fallback); YouTube marquee step; ebooks-head step; brains actions (held); storyboard/environments/demo steps (held); the nightly "Good Space OS cycle" routine; any building, QA and listing writing.
Does NOT depend on Claude: cloud cycle and worker queue, analytics, extension intel, Gumroad monitor, secret scan, backups, publish engines, Daily Seal, Lounge, the Nova API and payment server (all deterministic by design).
Can continue on other tools: Kokoro voice, Rhubarb, hb.py, ffmpeg renders, Canva, Gemini key (present, not wired into model.mjs), Ollama (not running).
Needs the founder anyway: every YES, logins, rotations, payouts, verifications.
Document before access changes: HANDOFF.md (stale since 2026-10-26), per-team brains, the approval list, how to run each pipeline by hand, which secrets live where (names only), the shared memory index.

---

## 11. Contradictions found (resolve before the next big plan)

- Category counts: Lulu 10 vs 15; Gigi 14 vs 15; Fifi 8 vs 6; Zaza 7 vs 10. Newest source is `os/cloud/company-structure/spec.mjs` (2026-11-04).
- Channels: 13, 15, 16 or 17 depending on the file.
- ORG-MAP says Houses are "SET UP and PAUSED"; controls.json shows no House paused but an emergency stop set; company start on 2026-11-03 per memory.
- STT version: PORTFOLIO.json (5.7.1 live) vs memory (5.7.1 pending review).
- Two Gumroad status files say "0 of 5 published"; the later report shows 5 live (treated as stale).
- Stale documents: `company/TEAMS.md` (2026-10-07), `HANDOFF.md` (2026-10-26), `COORDINATION.md` (2026-10-14), `FACTS.md` YouTube token line, PC folder layout memory (2026-10-14).

## 12. Not checked in this audit
Live Supabase table contents; the cloud/durable-queue branch; public pages of the 12 dead channels; Razorpay/PayPal sales; Chrome Web Store state of the other roughly 35 extensions; Neon and B2 live state; Claude cloud routine list; whether CocoFlowMake/CocoFlowPost are disabled beyond their task state; per-channel studio folders other than Flow, Moonveil, Penthouse, Kahani Ghar; Gatekeeper and Ollama running state.
