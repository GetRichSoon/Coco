# Island TODO — phone side of the office-mode order (Boss, 2026-10-26)

The PC side is done (see COMPLETION CHECKLIST 2026-10-26). There is NO server push path to the
phone — the APK polls Coco Cloud itself and raises its own Android notifications. So office-mode
silence on the phone needs APK changes (not built tonight, per the order):

1. **Office-mode notification gate in the APK**: the Kotlin files that build notifications
   (`Alerts.kt`, `Connected.kt`, `island/runtime/IslandRuntime.kt`, `island/service/IslandListener.kt`,
   `PhoneRemote.kt`) must skip posting when the workspace mode is `office`. Mode source: the same
   place the PC writes it — read the devices/houses status line from Coco Cloud (workspaceLine puts
   "office mode" in the device heartbeat), or add a tiny `mode` column read.
2. **Approvals only in the phone island (Coco Halo)**: mirror the PC rule — in office mode the
   Halo/island overlay shows ONLY waiting approvals with YES / NO / Ignore; YES/NO write
   `state approved/rejected`, `decided_by`, `decided_at` on the `approvals` table (same columns the
   PC uses); Ignore hides locally only.
3. Re-test: office mode → zero Android notifications, approvals visible and decidable in the island.

Full merge note: on the PC the island overlay and the Coco app are already ONE app (Lounge Desktop
Electron; `CocoIslandHelper.exe` is only its media/system helper child process). The in-window
island strip was added to the Lounge page 2026-10-26, so the app window shows the same approvals
strip at the top. Remaining nice-to-have: share one template between `island.html` and the
in-page strip so the two renderings cannot drift.

## 2026-10-26 (Nono) Live island feed + module audit
Boss order: the island must never be static. Built (Lounge page 2.1 / Desktop 1.0.1):
- Feed = `agent_messages` + `activity` merged by `teamTalk()` (newest first, 20 rows). Realtime INSERT on both tables
  (`feedSoon`) plus the 15 s poll (`pollApprovals`, now approvals + activity + agent_messages, re-pushes only on change).
- Compact pill: rotating ticker, newest 5 lines, one every 4 s (home only; office stays approvals only, by the law above).
  Open panel: "Live team feed" with new rows sliding in. In-app strip: same ticker line under the approvals.
- Safety: chips are `pointer-events:none` unless the panel is open, and clicks within 400 ms of opening are ignored.

Module audit (island.html): Coco stats + HQ counts LIVE | Approvals chips LIVE | Team feed LIVE (was a list refreshed
only on the full load, now streamed) | Claude-at-work sessions LIVE (main.js) | Music LIVE (helper) | Control Wi-Fi / Bluetooth / volume /
brightness / battery LIVE | Weather LIVE (hourly) | Focus calendar LIVE (clock), Pomodoro LIVE (local) | "Focus / Do not
disturb" tile STATIC link to Windows settings (kept, it is an action) | DEAD, removed: `.strip` and `.hqrow/.chip2` CSS,
`data-vol` handler (no element emitted it).
Still open: APK Halo feed (needs Kotlin), shared template for island.html and the in-page strip.
