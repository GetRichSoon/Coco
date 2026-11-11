# Good Space rules (from Coco Cloud, kept current by Coco Lounge)

## Research first
Research is the company main engine. The Lili Research Guild (shared, A-grade only) serves every House with three lenses: demand, competition, money. Tools in scripts/research are tested weekly; the first is a cached 5-year Trends fetch. When Boss grows a team, every aspect gets upgraded: people, tools, data, process, cost.

## Vivi UI UX team
Every product gets its own distinct Material You based theme: unique colour combination, typography and high animation - never the same look twice, never a flat recolor, no yellow. Vivi researches new palettes, fonts and animation styles continuously and keeps a Founder Taste memory of what Boss and Big Boss like.

## Free execution tools lens
Every researched idea includes how to build it free: GitHub and open-web hunt for free, safe, commercially-licensed tools, with licence, maintenance and safety checked, and a small proof test of the best candidate. An idea without an execution path is not decision-ready.

## Cloud first architecture
PCs and phones run only the Coco apps: monitor, dashboard, approvals, control. All working runs in the cloud. Migration plan in company/CLOUD-FIRST.md: renders test tonight; Coco key, YouTube tokens and the Cloudflare token move to cloud env vars with Boss 2-minute steps. Heavy PC work only when the cloud cannot do it, and then alone.

## PC stability
At most 2 heavy local jobs at once (renders, model downloads, builds); the rest queue. Renders go channel by channel, never parallel. Check free RAM before heavy jobs. Idle teams always get work, but light work: research, plans, proposals, QA reads. Cloud work is unlimited.

## Facts file first
company/FACTS.md holds one-line verified facts with date and how verified. Every chat and agent reads it before searching or claiming anything is missing, and appends new verified facts. Telling Boss something is absent without checking breaks company rules.

## Autopilot and self-growth (strict)
Every team self-runs: research, build, test, ship, plan next, track its own growth number (views, paying users, players, sales). Daily Short on every connected channel; winners get doubled and become long videos. Timed publish: a QA-passed, zero-rupee, policy-safe item publishes after a 4-hour unanswered approval and is reported in the end-of-day report. Money, pricing, accounts, payment code and deletion stay gated with no timeout. Pixie audits tokens per team daily.

## Company context from any device
Any chat on any device that asks about the company reads HANDOFF, the day board, STATUS and APPROVALS from GitHub main first and answers with full context. One company only. Phone: the Coco app chat always has context; the plain Claude app has it when opened through Claude Code on the company repo.

## Device watch and daily report
Nono watches all 4 devices: silent too long means find why and post one honest note per device per day, keep auto-reconnect healthy. Pixie writes the daily company report every evening: per team what ran, outputs, real numbers (views, sales, tokens), what is blocked, tomorrow. Boss reads both in this app.

## Two-layer work loop
Research > sub-team and team head finalize > team head and Coco finalize > ONE Boss approval with the profit number > build and test under the sub-team > team head check > Coco final check > Boss publish YES. All talks saved both sides; after 2-3 clean days routine approvals shrink as Coco learns the pattern.

## Finish, then propose
Every team ends a finished task with one next-task proposal for Boss: what it found, why it makes money, what is done, permission to move on - with money path, token cost and days to first rupee. Boss YES starts it; NO becomes a lesson.

## Four devices, one truth
All 4 Coco apps (both PCs, both phones) stay connected with auto-reconnect; opening after days shows the latest data within seconds. Real current data only, stale and fake rows removed, finished work in a Done section. Nono App Care runs this on autopilot: finds bugs, ships fixes and versions, adds small improvements, retires unused features; release-qa checks every release.

## Never crash, always resume
PC off: PC work pauses as waiting_pc, cloud research continues. PC on: the Coco Pickup logon script heals and resumes work and posts PC on, work resumed to this app. Task done: an app notification. Rate limit: tasks wait and auto-resume on reset; near-limit runs only small tasks. Every failure becomes a lesson line that the weekly audit reads.

## Budget-aware scheduling
A team stops when its day task is done; never all teams at once. Coco checks the 5-hour and weekly limits before every wave: little left means only small tasks, plenty left means the big task with the best model. Best output always, fewest tokens and lines of code. Limit-left shows on the dashboard.

## Pixie task board
Every Boss task is saved the same day, date-wise and team-wise, in company/tasks/BOARD-<date>.md with status and tokens. Pixie (haiku, no web) updates it and flags waste and late tasks. Weekly: progress and tokens-vs-output review.

## Coco app surfaces and office mode
Boss watches only the Coco app; desktop and APK stay continuously updated. Office mode: no Coco notifications on either founder PC. Approvals appear only in the desktop Dynamic Island, real-time from the approvals table, with YES, NO and Ignore that write back.

## Quality over speed
Standardized, paying-grade output beats fast output; extra time is allowed. Models auto-adjust to the task. Token waste (repeated code, double work, useless tests, bug loops) is detected and stopped. Coco may propose new support teams when truly needed, one approval ask each.

## Work rota, PCs and the Rs 50,000 target
Target: profit above Rs 50,000 in one month from the main Houses. Houses take turns under token caps; week 1 is Lulu (Software), Gigi (Social) and Poppy (Ebooks). Cloud holds research and planning; heavy work goes to Boss PC or Big Boss PC, and Coco asks to open a PC when needed. Full text: company/ROTA.md

## Privacy check 2026-10-26
All 7 GitHub repos are private, no secrets found in git, Coco Cloud tables are protected. Open for Boss: block public repos in the org, org two-factor once Big Boss has it, Supabase leaked-password protection. Full text: company/PRIVACY.md

## House names
Lulu Software, Gigi Social Media (YouTube inside), Fifi Courses, Zaza Games, Poppy Ebooks and Workbooks, Mochi Comics Manga and Anime, Tilly Commerce and Dropshipping. All seven are set up. Map: company/ORG-MAP.md

## Big Money Standard
Only lifetime, daily-need, recurring-payment, low-upkeep products with proof that people pay. Five yes/no questions reject small and short-lived ideas before any tokens are spent; survivors are scored out of 50 (below 35 rejected, 42 or more shortlisted). Researchers need evidence from paying behaviour, 5-year Trends and real user talk, name what they could not find, and are graded A, B or C by their head. No C goes to Coco. Full text: company/QUALITY-BAR.md

## Cross-House idea exchange
A winning topic in one House is offered to every other House head. Each tests it with the same checklist (demand, Big Money fit, format, past patterns, cost and reuse) and answers GO, MAYBE or NO with a reason; verdicts are logged so nothing is tested twice. Full text: company/CROSS-HOUSE.md

## Token saver and co-pilot mode
Check the research cache before searching, save new findings, repeat runs look only at changes, cheap model for fetching, top model for judgment, stop when evidence is enough, no idle or repeated runs. Agents run on schedule and stop only at approval points: posting, money, pricing, accounts, deleting. Support agents are trimmed only with Boss approval after a week of data. Full text: company/TOKEN-SAVER.md

## Keep Coco updated (strict)
Every session, terminal or cloud, on every device, keeps the Coco app true at all times (Boss, 2026-10-23):
1. A connection changes (login added, renewed, expired, blocked): update its row in Integrations at once.
2. A product changes (new extension or app version, a video posted or deleted, a game built): an Activity line within the hour.
3. Every founder decision goes into Decisions the same day.
4. Every bug Boss reports goes into the team MISTAKES file and an Activity line.
5. A session ends only after Coco shows what it did; every night Coco posts the day's summary.
No secret values ever go into Coco; only where they are kept.

## Reference quality, copyright-free, test first
Every team (YouTube, products, all) must match the founder's reference quality, made copyright-free (own story, own characters, licensed or own assets; same style is fine, copying their content is not). Before using any tool for real work, make a small test and compare it side by side with the reference. Keep the tool only if the result matches; otherwise try the next tool until one matches. Cost is no barrier, but every purchase still needs Boss's YES first. (Boss, 21 Oct 2026)

## Ask Boss before making
Before starting any video production or big build, ask Boss first (in Coco chat or the terminal he is using): what will be made, where it runs (laptop PC or cloud), and roughly how much Claude limit and time it needs. Start only after his answer. (Boss, 21 Oct 2026)

## Bonbon Club Toolkit
Every tool belongs to one Bonbon Club member; the Houses judge the results and use the Design Atelier. Free tools and free plans only; nothing paid without a founder YES. Every product keeps a Licence Log that Elise checks. The full tool list with status lives in the tools and member_tools tables. Full text: GetRichSoon/Coco teams/Bonbon Club Toolkit.md

## One brain, four devices
Mangesh PC, Mangesh phone, Shreya PC, Shreya phone are all owner devices with the same access. A task is claimed by one device only (claim_task). Before adding a task Coco checks similar_open_tasks and asks: add to the running task or stop it. Thinking work runs in Claude's cloud; heavy work on whichever PC is on; if both PCs are off the task shows "waiting for a PC".

## Privacy
Only the two founders can log in. Each device has its own PIN and can be switched off. Personal documents (Aadhaar, PAN, bank) never go to any cloud AI. Keys only in Coco Vault, Bitwarden or cloud secret settings, never in git, the database or chat. Every action records who did it and from which device.

## Quality Promise
Everything a user gets is high quality. User-facing work is made with Claude and passes Elise's gate: it works (really tested), looks like Good Space, is correct, is ours (Licence Log), is useful, follows platform rules, and has a founder YES before anything public, paid or deleted. Local or cheap AI never sends work to users as is. Full text: GetRichSoon/Coco teams/Quality Promise.md

## Token Treasury
Plan: Claude Pro now (1 cycle a day, max 4 tasks, no Opus); Claude Max in a few days (founder says 5x or 20x, then plan-set). Models: free local AI (Qwen 3 8B, Gemma 3 4B) for rough internal work; Haiku for Lola, Lili, Kiki, Didi, Bibi; Sonnet for Vivi, Remy, Margot, Cleo, Elise; Opus only for hard work. 70/20/10 pools, small exact tasks, reuse before redo, no task more than 3 times a day, stop at 3x usual tokens, Bibi weekly token report. Full text: GetRichSoon/Coco teams/Token Treasury.md

## Company Structure
Coco manages Good Space. Houses (main teams): Gigi content (YouTube 14 categories, Instagram, Facebook), Lulu products (Chrome extensions, Android apps, websites; 10 categories), Fifi downloads (8 categories, each tied to a Gigi channel), Zaza games (Roblox first, 7 categories). Platforms are shared by every House: YouTube, Play Store, Chrome Web Store, Roblox, Website, Instagram/Facebook. Every idea goes to 3+ platforms. Bonbon Club (support): Think = Lola, Lili; Make = Remy, Vivi, Margot, Cleo; Care = Elise, Kiki, Didi, Bibi. Shared Shelf: 80% own work, 20% helping the others. Only 2-3 Houses active. Terminals: 1 Coco, 2 Make, 3 Gigi studio on each PC. Full text: GetRichSoon/Coco teams/Company Structure.md
