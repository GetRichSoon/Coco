---
name: project-coco-remote
description: "Coco Lounge two-way Remote (phone<->PC via Supabase commands table), Coco Gatekeeper chat responder, what is live and what is blocked"
metadata:
  node_type: memory
  type: project
  originSessionId: d04bdd3a-42fd-4026-a609-62a9f381ce5d
  modified: 2026-10-14T23:06:49.798Z
---

Built 2026-10-15 (night). All 4 devices command each other through Coco Cloud `commands` table (realtime pulse), from anywhere.
- Plain-words action `say` parsed on the target device: `understand()` in `Good Space\Coco\Lounge Desktop\main.js` and `PhoneRemote.understand` in the Android app; keep both rule sets identical.
- PC actions: status, lock, sleep, restart/shutdown (60 s, cancel), open_url, play_youtube (first result autoplays), media, volume, open_app (fixed list), notify. Phone: same plus ring; opening apps from background needs one notification tap (Android rule).
- Commands older than 10 minutes are never run (both runners).
- Phone app has mic command bar (RecognizerIntent) on Home and Remote. Desktop: Win+H for voice typing.
- Founder rule 2026-10-15: no device may depend on another. Chat is answered by Supabase Edge Function `coco-chat` (source `Good Space\Coco\Cloud\Functions\coco-chat\index.ts`), woken by trigger `wake_coco_chat` (pg_net) on chat insert; rules now, Gemini when secret GEMINI_API_KEY is set. Sends device phrases ("pc pe kesariya chalao") as `say` commands.
- Speed: PowerShell takes ~13 s to start on Boss PC (low RAM) — never use it on the hot path. Media/volume keys go through `Lounge Desktop\CocoKeys.exe` (0.3 s); battery is cached. Devices run their commands on every pulse (fast path). Measured: PC 0.7 s, phone <1 s.
- Office mode: Lounge reads nova-hq/os/state/local/last-place.txt; at office it never shows its window (tray only) but stays connected.
- Each device writes its own live info into `devices.info` with its heartbeat.
- Coco Gatekeeper (laptop, backup only after 45 s): `Good Space\Coco\Gatekeeper\Coco Gatekeeper.mjs`, Ollama gemma3:4b answers chat (calls founders Boss/Big Boss), real work becomes a `tasks` row for the Coco Engine; starts hidden via Startup folder `Coco Gatekeeper.vbs`; uses engine key from the vault.
- BLOCKED by classifier (founder decides): widening PC control (type text, key presses, close apps, screenshots) via a `commands_action_check` migration. Do not work around it.
- Lesson: patching HTML/JS through JS template strings ate backslashes and blanked the desktop page; always `node --check` the extracted inline script after edits.
Related: [[project-coco-engine]], [[project-good-space-structure]]
