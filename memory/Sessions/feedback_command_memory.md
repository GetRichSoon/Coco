---
name: command-memory
description: "Standing rule: after a command succeeds (verified), save it as a reusable workflow and reuse it next time. Workflow store is os/state/local/workflows.md."
metadata:
  node_type: memory
  type: feedback
  modified: 2026-10-08T04:25:55.226Z
  originSessionId: eae988a0-dd5e-57ea-bace-9851f07a5d7f
---

Every command Mangesh gives is a potential workflow. Loop: EXECUTE → VERIFY → SAVE → REUSE → OPTIMIZE → MONITOR → UPDATE.

**Save only when verified** (e.g. window title matches the song, screenshot checked), never just because it was attempted. Save: original command, intent, exact steps, apps/sites used, parameters (coordinates, timings), required state (window open, not fullscreen), result, exceptions, and known failures.

**Reuse first:** before planning, check `os/state/local/workflows.md`. Redesign only if the workflow fails, the app/site changed, a better method is found, or the founder asks for another method.

**Failure:** diagnose, repair, re-test, update the saved workflow, and keep the failure note so the same mistake is not repeated.

**Why:** Mangesh does not want to re-explain open → search → click → verify each time.

**Stateful series:** for series (e.g. Taarak Mehta), also keep per-series state in `os/state/local/series-state.json`: episode, timestamp, completed, last played, next episode. Not completed → same episode at saved timestamp; completed → next episode at 0:00. Only trust "completed" from real player state (video.ended), never from assumption.

**How to apply:** after any successful multi-step task (YouTube, GitHub, builds, deploys, bug repro), add or update its entry in workflows.md. Also see [[autonomous-qa-protocol]] (bug register) and [[playlist-feature]].
