# GOOD SPACE: Existing Automation Map (audit 2026-11-07, read-only)

Sources: origin/main fd9c046; GitHub Actions run history (2026-11-04 to 11-07); Windows Task Scheduler on this PC (2026-11-07); company/cloud-autonomy audit files (2026-11-04); shared memory. Live Supabase was not queried. No secrets were read.
Statuses: COMPLETED, WORKING, PARTIALLY COMPLETED, NOT STARTED, BLOCKED, NEEDS VERIFICATION.

## 1. The five layers
```
LAYER 1  GitHub Actions cron (cloud, PC not needed)          13 scheduled workflows of 26
LAYER 2  Nova API + queue + worker (cocolounge.vercel.app, Supabase)   WORKING
LAYER 3  Windows Task Scheduler (PC only)                    mixed, several failing
LAYER 4  Claude sessions: cloud routines and 30-minute checks   NEEDS VERIFICATION
LAYER 5  Manual founder actions (approvals, logins, payouts)  always manual
```

## 2. GitHub Actions (scheduled)
| Workflow | Cron (UTC) | Does | Recent result | Status |
|---|---|---|---|---|
| cloud-cycle | 02:15 and 13:15 | task cycle, company run | 6/6 success | WORKING |
| cloud worker | every 4 h | executes queued tasks | 10/10 success | WORKING |
| youtube-daily | 04:10 | The Flow analytics + diagnose report via Nova | 3/3 success; reports through 2026-11-06 | WORKING |
| youtube-competitors | weekly Mon 04:30 | 11 competitor channels | last run NEEDS VERIFICATION | PARTIALLY COMPLETED |
| youtube-publish | scheduled/dispatch | publish via Nova, idempotent | 1 failure; only the-flow and moonveil-audio have cloud creds | PARTIALLY COMPLETED |
| youtube-produce | dispatch | brief, write, render in cloud | 1 success, 4 failures (11-04, 11-05) | PARTIALLY COMPLETED |
| extension-intel | 03:40 (x3 variants) | store users, reviews, bugs, recommendation | 4/4 success | WORKING |
| extension-publish | Mon 03:00 | package and publish, approval gated | 1/1 | WORKING (needs YES) |
| gumroad-daily | 04:30 | public snapshot and report | 2/2 success | WORKING (cannot read sales) |
| brains | 05:00 | 341-brain measure + tasks | success 11-05, 11-06 | WORKING (all actions HELD) |
| cloud-db-backup | scheduled | DB backup to B2 | built, never confirmed live | NEEDS VERIFICATION |
| cloud-daily-summary | scheduled | daily summary | built, never confirmed live | NEEDS VERIFICATION |
| integration-health, ops-snapshots | scheduled | health checks | not read | NEEDS VERIFICATION |
| secret scan | on push | scans for leaked secrets | 33/33 | WORKING |
| company-run | on push | | 2 of 2 failed | BROKEN |
| tests | on PR | | 2 of 18 failed (company-registry.mjs missing on main; fix in uncommitted dev worktree) | BROKEN |
| android-build, capability-proof, claude-proof, workflow-proof | manual/proof | | proofs | WORKING on demand |
Caveats: schedules fire only from the default branch; the brains workflow checks out branch cloud/durable-queue and pushes there, so its newest records are probably not on main.

## 3. Windows tasks on this PC (2026-11-07)
| Task | Last result | Status |
|---|---|---|
| Coco Daily Seal (23:30, pushes shared memory to GetRichSoon/Coco) | 0, ran 11-06 23:30 | WORKING |
| Coco Lounge Keepalive (every 5 min) | 0 | WORKING |
| Nova Office/Home mode (unlock, WiFi, session save) | 0 | WORKING |
| NovaPlaylistRotate Morning/Night | 0 | WORKING |
| Nova YT 05/06/07 playlist slots | 1 each (11-07 09:34) | NEEDS VERIFICATION |
| Coco Cloud Backup (23:30) | 1: needs G: mounted | BLOCKED |
| Coco Daily Summary (23:15) | 1 | BROKEN |
| NovaDailyStatus | error 2147943467 | BROKEN |
| NovaTerminalsWatchdog | error, running | BROKEN |
| NovaTerminal1Watchdog | no run since 11-02, no next run | DEAD |
| CocoFlowMake, CocoFlowPost, Nova YouTube 6AM | disabled | disabled (old PC video path) |
| RecoverabilityToastTask, SustainabilityTelemetry | error / last 10-26 | NEEDS VERIFICATION |

## 4. Scripts by function (scripts/ has about 140 top-level files; subfolders brains 16, ops 15, youtube 13, lib 13, publish 9)
- Orchestration and queue: executor, worker, scheduler, company-run, control-plane, run-requests, local-dispatch, pickup, nova-worker, nova-listener, pc-listener, pc-wake-relay. WORKING in CI.
- AI governance: ai-gateway (refuses deterministic work, ticket and meter), lib/model.mjs (the only door to a model), brains/*, token-dashboard, token-protection, policy, rls-control.
- YouTube: youtube-auto/connect/daily, yt-* (about 20, mostly PC Brave playlist), youtube/ (research, analytics, diagnose, write), yt_upload, yt_auth, flow-daily, topic-pulse.
- Publishing and commerce: publish*, cws_publish, extension-intel, ext-brain, gumroad*, ebook-* (pipeline, registry, categories, structure), publish-apk.
- Storage and backup: storage*, storage-proof/lifecycle/key-check, cloud-backup, cloud/db-backup-b2, neon-sync, router, lib/rest (402 guard), lib/neon.
- Security and ops: secret scan, security-check, ops/* (integration-health, workflow-health, workflow-lint, migrations-check, alert-failure), verify-connection, network-check, daily-status.
- PC and desktop: office-mode*, terminals watchdogs, desktop-placement, setup-pc, shreya-*, bluetooth-audio.
- Logging: coco_log (writes to Coco/Supabase), notes_analyze, outputs.

## 5. Pipelines (stage by stage; where each stops)
Automation levels: A0 paper, A1 research by routine, A2 partly deterministic cloud, A3 scheduled and green.

**YouTube** (`pl.gigi.goldie`, TESTING): research (A3) > topic and fact brief (cloud, TESTING) > script, fact check, storyboard (TESTING) > asset generation (BLOCKED) > cloud render + video QA (TESTING, proven 2026-11-02) > founder approval (manual) > publish via Nova (TESTING, 3 channels have creds) > analytics (WORKING) > performance feedback (measure WORKING, actions HELD). Real videos of 2026-11-06 were built on the PC by sessions.
**Ebooks** (`pl.poppy.royale`, TESTING): monitor and category research (A3) > weekly performance (BLOCKED: view_sales) > ranking, PDF edition, refund check (DESIGNING) > cover (BLOCKED) > ebook-daily producer (schedule OFF, Claude steps cannot run) > ebook-build EPUB/PDF (on demand, no model) > Gumroad draft (TESTING) > approval (manual) > publish (PAUSED).
**Extensions**: intel daily (A3) > plan > build on PC > QA gate > package with approval code > Boss YES > Chrome Web Store API > live check > intel. Proven: STT 5.5.0 (2026-10-26), Orbi 2.9.1 (2026-10-29), Orbi 2.9.2 and STT 5.7.x.
**Comics**: script > local render > QA > A-013 > post. Stops at Big Boss decision. A0.
**Games**: research > Roblox Studio build (manual) > tests > Creator Hub publish (login) > analytics. Stops at login and product IDs. A0.
**Courses**: research > pilot script > record > QA > A-015 > checkout > publish. Stops at approval and checkout account. A0.
**Commerce, Social, Juno, Services**: shared W1 nightly shortlist only. A0 to A1.
**House nightly research routines** (software, ebooks, comics, courses, social, games, commerce): defined in os/automations.json; no evidence of a recent cloud run; last research files dated 2026-10-26 to 10-29; emergency stop set. NEEDS VERIFICATION.

## 6. APIs and integrations
| Integration | State |
|---|---|
| Supabase Good Space (bfnhnkxvppqmklfpslfm) via Nova API | WORKING; 402 egress state NEEDS VERIFICATION |
| Supabase Screen Time Tracker (obbhqrsfnssmiwtvmbrz) | WORKING |
| Neon replica | built, migration 0026 not applied |
| Backblaze B2 | key works only for proof/; no lifecycle rule |
| GitHub Actions, GitHub | WORKING |
| Vercel (team Orbi) | WORKING |
| YouTube Data API | 3 of 17 channels |
| Chrome Web Store API | WORKING (2-Step Verification per account needed) |
| Gumroad | PARTIAL (token lacks view_sales, leaked token not rotated) |
| Anthropic API | optional ANTHROPIC_WORKSPACE_ID; credit NEEDS VERIFICATION |
| Gemini | key present, not wired to model.mjs |
| Google Drive (G:) | not mounted |
| Android OTA via GitHub releases | WORKING |
| Razorpay | key files present; payout state NEEDS VERIFICATION |
| Play Console, Instagram, Facebook | not connected |

## 7. AI tools and Claude dependency
- `scripts/lib/model.mjs` is the only door to a model and has no Gemini/Ollama fallback. The gateway refuses deterministic work, so most cloud steps use 0 Claude calls (company cloud run 2026-11-01).
- Still needing Claude: YouTube marquee step, ebooks-head step, held brains actions, storyboard/environments/demo steps, interactive building, nightly Claude routines.
- Ollama: not answering on localhost:11434. Gatekeeper log ends 2026-10-29 with "fetch failed".
- Two token ledgers disagree (722,588 vs about 2.0M).

## 8. File management and browser automation
File: Daily Seal (memory to GitHub), Link Sessions.ps1 (links memory folders), Good Space move scripts, cloud-backup to B2, Safe Keeping Supabase backups. Browser: Brave YouTube playlists, Edge/Chrome profiles used for Gumroad and Studio; Claude in Chrome and computer use are available to sessions. Analytics collection: youtube-daily, extension-intel, gumroad-daily, brains, ops-snapshots.

## 9. Error handling and resilience
RESILIENCE.md (2026-10-26): PC off pauses work as waiting_pc and pickup.mjs resumes at logon; rate limit marks waiting; failures go to LEARNING.md. Code: 402 guard in lib/rest (dev worktree, may not be on main), fail-closed policy refresh, no silent model fallback, secret scan, workflow-health scripts, Daily Seal. Weakness: nothing automatically re-runs a failed produce or publish.

## 10. What is automated and what is manual
| Function | Level |
|---|---|
| Task queue, worker, daily cycle | automated, WORKING |
| Secret scan | automated, WORKING |
| YouTube analytics and diagnosis (The Flow) | automated, WORKING |
| Extension intelligence | automated, WORKING |
| Gumroad market monitor | automated, WORKING (no sales data) |
| Brains measure and task creation | automated, actions held |
| Memory backup to GitHub | automated on PC, WORKING |
| Video production | mostly manual on PC; cloud path PARTIAL |
| Video upload | manual or session-run; cloud path PARTIAL |
| Ebook writing, covers, listing | manual with Claude |
| Extension build | manual on PC; publish automated after YES |
| Approvals, logins, payouts, credential rotation, verification | manual founder |

## 11. Technical weaknesses ranked
1. Supabase egress 402 (state unverified) blocks Coco writes.
2. Leaked tokens and a public repo containing a service_role key in history.
3. PC single point of failure and C: nearly full; failing PC tasks.
4. Cloud YouTube produce/publish unreliable; 12 channels have no credentials.
5. CI red on company-run and tests; fixes sit in uncommitted worktrees.
6. B2 key restricted to proof/.
7. Access broker not enforced; migrations 0031, 0026, 0034 not applied.
8. Claude-only model door with 18 days of Max left.
9. Documentation drift (HANDOFF, FACTS, TEAMS, BRAIN files).
10. Local clone 337 commits behind.
