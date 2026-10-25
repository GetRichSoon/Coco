# Coco completion checklist (master prompt, Phase A audit, 2026-10-21)

Status words: VERIFIED WORKING · PARTIAL · NOT BUILT · BLOCKED · NEEDS EXTERNAL SETUP

## What exists (checked today)
| Area | State | Evidence |
|---|---|---|
| Central brain: Supabase "Good Space" (bfnhnkxvppqmklfpslfm) | PARTIAL | 24 tables: houses 4, tasks 7, commands 363, devices 4, approvals 12, decisions 51, members 10, tools 54, offerings 59, pipelines 5, activity 512, pulse 12408, chat 106 |
| PC app: Lounge Desktop (Electron, `main.js` 556 lines + CocoKeys.exe) | VERIFIED WORKING for remote commands | 291 commands done; device mangesh-pc seen today; writes live house status every minute (commit 98684d5) |
| Android APK: Lounge Android 2.5.3 (Kotlin/Compose) | VERIFIED WORKING for commands + self-update | mangesh-phone last seen today on 2.5.3; first self-update without USB verified (commit 687d6ba) |
| Web Lounge (`Lounge/index.html`, Vercel) | PARTIAL | not re-tested today |
| Coco chat (edge function coco-chat, Gemini) | PARTIAL | 106 chat rows; turns chat into tasks |
| Device pairing (4 devices, key hash, founders-only RLS) | VERIFIED WORKING | 4 paired devices |
| YouTube upload (13 channels, `scripts/yt-local.mjs`) | VERIFIED WORKING | uploads, list, delete, public today on Kahani Ghar TV |

## Problems found (fix first)
1. **Fake "queued" tasks.** All 7 `tasks` rows have been "queued" since 14-19 Oct. No worker ever claimed them; no heartbeat. The UI shows them as waiting work. Needs a stale reaper plus an honest label.
2. **Stuck commands.** 8 commands sit in running/queued for days (oldest 16 Oct). They need a stale timeout → failed with a reason.
3. **Status model too small.** The tasks check constraint allows queued, running, waiting_pc, needs_yes, done, failed, stopped. The master prompt needs PLANNED, QUEUED, WORKING, NEED_APPROVAL, BLOCKED, FAILED, VERIFYING, DONE, PAUSED, CANCELLED, plus last heartbeat, retry count, evidence. Changing it needs a constraint-replacing migration.
4. **Houses use the old names.** The Fifi row still says "Downloads". The new baseline (Social Media, Products [Chrome team + Android team], Courses & Learning, Games) is not in the cloud. My update was declined; it needs a YES.
5. **Two brains.** Company state lives in nova-hq git files (STATUS.md, APPROVALS.md, os/state) and in Supabase. They are not one source of truth.
6. **No integration registry.** Nothing records each platform's connection state, scopes, last check or errors. Known: YouTube connected (13 channels); Chrome Web Store login pending; Play Console not connected; Roblox, Meta, Udemy and Coursera not connected.
7. **No DONE evidence.** Tasks can be marked done without verification evidence.

## Plan (smallest safe order)
1. Status model migration: new statuses + heartbeat_at, retry_count, error, evidence; map old values (running→working, needs_yes→need_approval, stopped→cancelled, waiting_pc→queued). **Needs YES (database change).**
2. Stale reaper (SQL function + cron): no heartbeat for 10 min → blocked "worker stale"; queued for 7 days → shown as STALE for the founder to cancel or restart.
3. Houses + platforms rows → the new baseline. **Needs YES.**
4. `integrations` table + a read-only health check per platform (YouTube first).
5. PC and APK: one shared status component that reads the same columns; remove placeholder labels.
6. Move approvals and decisions from git files into Supabase as the single source; git keeps a nightly export.
7. Tests: PC-created task appears on Android and vice versa; reconnect without duplicates; stale worker detection.

## Progress 2026-10-21 (verified in the database)
- DONE: houses → Social Media / Products / Courses & Learning / Games.
- DONE: tasks has retry_count, error, evidence, stale, category, platform_id.
- DONE: status model v2 constraint (planned … cancelled; old values still allowed). Founder ran it in the SQL Editor; checked afterwards.
- DONE: trigger tasks_done_evidence (DONE needs evidence or result).
- DONE: coco_reap_stale() runs every 5 min via pg_cron (coco-reap-stale); 6 stuck commands were marked failed.
- DONE: integrations table with 10 platforms and their real state (RLS: founders read).
- NEXT: PC + APK read integrations and the new statuses (one shared status component); then the PC↔Android sync test.

## Island approvals + office-mode silence (Boss order 2026-10-26, built by builder)
- `Lounge Desktop/main.js` — office mode: island module `coco='approvals'` (approvals-only panel, still no toasts); new `approve` IPC action forwards island YES/NO to the Lounge page.
- `Lounge Desktop/preload.js` — `onApprove` bridge (main → Lounge page).
- `Lounge Desktop/island.html` — YES / NO / Ignore chips on approval rows (Material You motion); Ignore hides locally; YES/NO optimistically hide 30 s; office panel shows ONLY approvals.
- `Lounge/index.html` — shared `decideApproval()` (same Supabase write as the Approvals page: state, decided_by, decided_at, decisions row, activity log); 15 s approvals poll; in-app island strip `#islandStrip` at the top of the Coco window with the same YES/NO/Ignore.
- `Lounge Desktop/island-approve.test.js` — new self-check (11 asserts); hover tests still pass (17).
- `Lounge Android/ISLAND-TODO.md` — phone-side office silence + Halo approvals (APK not touched tonight; no server push path exists, the phone polls itself).
- NOTE: during the live test (island open over a maximised VS Code while Boss was typing) approval **A-001 Play Apps / Fuselist flipped to rejected, decided_by Mangesh** — possibly an accidental click on the new NO chip, possibly Boss himself. If accidental, re-raise A-001. Could not revert from here (no DB write access for this session).
