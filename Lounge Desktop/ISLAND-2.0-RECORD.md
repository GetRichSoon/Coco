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

## 4-device sync monitor (Boss order, same day)
Real registry (Coco Cloud, read-only, 2026-11-04): four app devices (Boss PC, Boss Phone, Big Boss PC, Big Boss Phone) plus one GitHub runner that is not counted. Internal ids and owner addresses are the stable identity and are never shown or stored in audit rows.
1. IMPLEMENTED AND VERIFIED (offline tests): `Lounge/device-sync.js` + `device-sync.test.js` — registry filter (exactly 4), classify (CURRENT/OUTDATED/OFFLINE/ERROR/UNKNOWN from the device's own report), one batched check with a call budget (2 reads + 1 audit + 1 per signal, max 7), 10-20 min interval gate with jitter, no repeat signals, exponential backoff 15/30/60/120/240/360 min, offline kept honest, reconnect handling, lease against duplicate schedulers, stale-cycle guard when the cloud release moves, restart-safe state, stalled-scheduler detection.
2. NOT YET DEPLOYED / NOT IMPLEMENTED: the runner that reads the two tables and applies the signals + audit row; the schedule (needs the GitHub `main` trampoline); dashboard panel for call count / budget / next check (the Release Center already shows the four devices and their real states); persistence for the state/audit (needs a table or file; a migration needs Boss's approval).
3. BLOCKED BY EXPLICIT APPROVAL: any migration, production schedule or production write.
4. Phones' real install failure ("Too many active sessions for UID") is a separate bug in the phone updater, not fixed here.

## Backlog (unrelated)
- refresh.test.js hang. - Wire `agent_messages` publishing from the engine. - Phone updater session-limit error. - Optional realtime on the activity feed (blocked by the Supabase egress rule).
