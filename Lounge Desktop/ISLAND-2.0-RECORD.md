# Coco Island 2.0 — execution record (Boss orders 2026-11-04)

Status: **Island 2.0 COMPLETE in code, tested, running on this PC.** Not committed, not released to other devices (needs Boss's say).
4-device sync monitor: **logic + tests done, NOT deployed, no scheduler running** (see bottom).

## What Boss ordered, and where it ended up
- Upgrade the existing island in place (no second app): done, `Good Space\Coco\Lounge Desktop` (inside Coco Desktop; no separate island app exists to delete).
- 3 states (compact pill / expanded dashboard / details), real Coco data only, BOSS + BIG BOSS identities, Ctrl+Alt+I, click-outside, multi-screen + side, saved prefs, hide/show.
- Two themes, switchable in the island's gear: **Coco (default)** = matte black + deep sky blue; **Mafia** = ALL BLACK (pure black, white/silver hairlines, crimson only for failed/blocked, serif small caps, sharp corners, pinstripe). Mafia has NO cute characters: Coco is a stern octagon crest, and every agent/team/product is a Material Design icon that says what it is (mic = audio, magnifier = research, shield-check = QA, rocket = publish ...) inside a masculine crest; 120 crests per icon from a registry, so no two look alike. Icon comes from the name + real job + team (members.job / members.grp). Light / Follow Windows were removed on Boss's order; an old saved dark/light/auto = Coco.
- Logos: Coco mascot (official scalloped logo, vivid, blinks, sways in a loop); every agent / team / channel / product = its own Material You character (shape + colour + eyes + mouth) from a persistent registry that never reuses a combination (600 distinct); characters float slowly, each offset. A real service (YouTube, GitHub ...) shows as a small real-logo badge on the owner's character.
- Team label after each agent name from real data (`members.grp`): "Lola · Think team", "Cleo · Make team", "Elise · Care team".
- Fresh colours: no green anywhere; status colour = deep sky blue.

## Files changed (all in Good Space\Coco)
`Lounge Desktop/island.html`, `main.js`, `island-preload.js`, `island-approve.test.js` (2 stale assertions), `island2.test.js` (new), `device-sync.test.js` (new), `Lounge/index.html` (push: issues, history, live, at, me, member team), `Lounge/device-sync.js` (new).

## Tests (actual results, last run)
- island2.test.js, island-approve.test.js (21 + toggle + module), island-hover.test.js (17), heal.test.js, device-sync.test.js: all passed.
- Real Electron run of island.html with a bridge stub: 52 checks, 0 failed (states, both themes, settings, approvals, quick actions, Esc, shortcut, click-outside, stacked toasts without duplicates, connection green/amber/red/recover, music, focus, Wi-Fi tile, hide, office mode, logos always moving + offset, 400 and all 600 characters distinct, team labels).
- Real app: Coco Lounge Desktop restarted; island opened from the top-edge hover on the real screen with real data (agents, BOSS, team labels); island.log: 0 island errors after the restart. The real run found one bug the stub missed (negative hash index in the logo tint), fixed.

## Known limits (honest)
- No real acrylic/Mica (Electron cannot on a transparent click-through window): flat matte surfaces.
- Task progress percentages do not exist in Coco data -> not shown. Failed-task reason only if the task row has `error`/`result`/`note`.
- Multi-monitor tested with fake displays (one real monitor here). The Mafia theme was verified in the test window, not yet on the real screen (default Coco theme was).
- The logo registry lives in the island window's storage (per PC); 600 capacity vs ~150 names today.
- `Lounge/refresh.test.js` hangs in this environment (not touched by this work).
- Not done: phone island changes; release / OTA of this desktop build.

## 4-device sync pipeline: state at the end of 2026-11-04 (supersedes the older section)
Commits (local, NOT pushed): e11d419, e541bef on cloud-foundation.
1. IMPLEMENTED AND VERIFIED (offline / Electron / JVM): Lounge/device-sync.js (decisions, budget <=7, 10-20 min gate, backoff 15/30/60/120/240/360, offline honesty, generic labels, state keyed by one-way hash); Cloud/Device Sync.mjs (runner: counts every call, refuses the 8th; Nova or direct; dry run by default; 11 scenarios, worst measured cycle <=7 over 200 cycles); Release Center 'Sync monitor' panel (real audit rows only, 11 checks); phone updater session-leak fix (Updater.kt InstallSessions; 61 Android unit tests, 0 failures); privacy: generic labels everywhere, no personal name in any file written or in audit rows.
2. IMPLEMENTED BUT NOT DEPLOYED: migration Cloud/Migrations/0037_device_sync_audit.sql (reviewed, idempotent, rollback = drop table; pre-checks passed: table absent, helper fns present); Nova table allowlist (Lounge/api/_nova.js, needs a Nova deploy); .github/workflows/device-sync.yml (inactive until on main + secrets); phone fix (needs a new versionCode, e.g. 2.10.0 (22) with a release.json history entry, then a push auto-publishes the OTA release).
3. BLOCKED: Boss approved all four production steps in chat, but the migration call was DECLINED at the permission prompt; no other route was used and nothing else was deployed. Also needed from Boss: NOVA_DEVICE_KEY / NOVA_ENGINE_KEY as GitHub secrets for the cloud worker; one manual install of the fixed phone build on each phone (the buggy updater already on them cannot install its own fix); an unlocked screen for the real-screen Mafia check (the PC was locked).
4. NOT DONE: real-screen check of the Mafia theme (screen locked; verified in a real Electron window, log clean, theme persists); both phones' successful update and authenticated session (needs the release); Big Boss PC reconnect (offline since 30 Oct, nothing to do until it is switched on).
Security note (not mine, found while pushing): github.com/GetRichSoon/Coco reports private=false (public) although memory says it stays private until the old service key is rotated.
Pre-existing, out of scope: Lounge/index.html chat code still matches a founder by name to pick a call-name (not displayed).

## Taskbar (Coco Dock) + background cost: measured, 2026-11-04 (Boss order: lag, bugs, auto-hide with mouse wheel)
The Dock is OFF on this PC (island.json dock:false), so it was measured in isolated real Electron windows; the live taskbar was not touched.
MEASURED idle CPU (same machine, same method, before -> after):
- Native helper (CocoIslandHelper.exe, always running): 16.5% of a core -> 0.4-0.9%. A stopwatch build showed where: Procs() 195 ms per call (touched MainWindowHandle on every process), Fullscreen() 41 ms every 500 ms (a Process object per tick), Media() 17 ms every tick, netsh 1.8 s blocking the loop. Fixes: Procs removed (the list now comes from the window enumeration that already runs), cheap checks first + cached process name, media every second, netsh/WMI on their own thread every 30 s. Same message types still produced (A/B checked).
- Island page, idle compact pill (real transparent Electron window): 18.7-20.3% -> 1.0% (60 s average incl. wiggles). Cause: any CSS animation running at 60 fps in that window costs ~5-20% (a trivial 30 px animation alone costs ~5%); no single animation was to blame. The first fix (compositor-only transforms) did NOT help (19%) and was measured and reported as such; what worked is not animating at rest (logo wiggles <2 s every ~25 s, characters move only under the pointer, pulses play 3 times, bars are static shapes while idle).
- Island open and pinned, nothing hovered: ~17-20% -> 0.9%.
- Dock page idle: 0.16-0.48% shown, 0.01% hidden.
- Whole Coco app idle (all processes, live, 60 s): ~24.6% -> ~9.6% of one core. Main process unchanged (2.4%): the adaptive pointer timer (25/s -> 8/s when far) made no measurable CPU difference; kept because the Dock auto-hide needs one shared loop.
DOCK FIXES: auto-hide (hides after 700 ms off it, returns on 120 ms at the bottom edge or a mouse-wheel turn there, menu switch 'Auto-hide Dock'); one debounced pinned-apps watcher closed with the Dock (was recreated on every switch-on and never closed); Dock page told only when its data changed; hidden Dock reports no clickable area; resumes shown after sleep/wake; Coco mark + accent follow the saved theme (Coco: pink mark, sky blue; Mafia: stern crest, white, sharp corners); Material icon instead of letter tiles; no emoji.
WHEEL HOOK (privacy): WH_MOUSE_LL in the helper, installed only while auto-hide is on; sees every wheel turn but prints only a bare {"t":"wheel"} when the pointer is within 3 px of a screen's bottom edge (<= 8/s); no position, window, app or count. REAL TEST on the live desktop: wheel mid-screen 0 signals, at the bottom edge 1, after 'wheelhook off' 0.
NOT VERIFIED: Dock on the real taskbar position (it would hide the live Windows taskbar), Explorer restart, display resolution change, 12-hour leak soak, a second monitor, the Windows taskbar's own auto-hide interplay. Tested instead: sleep/wake handler by test, theme switch by real window, 16 + 53 real-window checks, 13 test files.
KNOWN OPEN (found while measuring, not fixed): Lounge page logs 'Coco commands: reading commands timed out' every ~30 s (cloud read, probably the Supabase egress restriction).

## Backlog (unrelated)
- refresh.test.js hang. - Wire `agent_messages` publishing from the engine. - Phone updater session-limit error. - Optional realtime on the activity feed (blocked by the Supabase egress rule).
