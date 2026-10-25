---
name: autonomous-qa-protocol
description: "Standing rule from Mangesh: Nova hunts bugs itself (detect, reproduce, fix, regression-test, verify, monitor). Includes the bug register and open items."
metadata:
  node_type: memory
  type: feedback
  modified: 2026-10-08T04:18:17.433Z
  originSessionId: eae988a0-dd5e-57ea-bace-9851f07a5d7f
---

Every bug, failure, regression, UI/integration/performance issue becomes Nova's own QA job. Do not wait for Mangesh to report bugs; a report is only a signal. Hunt for bugs proactively (flows, restarts, multi-browser, concurrent sessions, interrupted processes, malformed/duplicate data, old and new states).

**Loop per bug:** observe → detect → reproduce → diagnose root cause → classify (new or regression) → minimal regression test → safest fix → run related suites → verify in a clean state → deploy only after verification → monitor → record incident and what detection was missing.

**Done means:** reproduced → root cause found → fixed → tested → regression-protected → verified after deploy. Never hide a symptom to make a test pass. Ask "could this fix create another bug?" and test neighbours.

**Authority:** fix safe, in-scope issues without asking. Stop and ask for risky production changes, money, publishing, deletions, or closing the founder's own windows or profiles (see CLAUDE.md approval gate).

**Why:** Mangesh wants a permanent system: once a class of bug is fixed, Nova must detect it automatically next time.

**How to apply:** For any YouTube/Brave/Chrome bug, check the register below first, then add a new entry (ID, date, repro, root cause, fix, regression check, status). Before a major release, rerun the full register.

## Bug register (local, 2026-10-08)
- BUG-001 — Search click hit the browser tab bar, not the YouTube search box (click at 860,38). Fixed: click (880,88) when window is not fullscreen; ESC first. Status: fixed. Regression: after a play, log title must contain the query words. Verified: Taarak Mehta episode started.
- BUG-002 — "/" did not focus search; ^a selected the whole page; typed text went nowhere. Fixed: click the search box instead of "/". Status: fixed.
- BUG-003 — `"$At:"` parse error stopped 06:00 and 07:00 tasks before logging. Fixed to `${At}`. Status: fixed in script; end-to-end run not yet verified (next: 06:00 task).
- BUG-004 — Two audio sessions can play at once: Brave YouTube song plus Chrome default-profile Kanada song. Intended behaviour: one song at a time in the Brave app only. Status: OPEN. Needs founder YES before anything closes the default Chrome profile.
- BUG-005 — First-result click is blind; a Short, Mix or wrong video can start (e.g. Hanuman Chalisa, Nishankh Tarakmantra). Status: OPEN. Idea: check the title in the log and screenshot after each play.
- BUG-006 — Fullscreen click missed. Fixed: press F key with the window foreground. Status: fixed.
- BUG-007 — Sequence moved to the next step without checking the last one had worked (Taarak step failed silently). Status: OPEN. Fix: verify title change before next step.
- BUG-008 — Old "Taarak" step ran while Weeknd video still playing; no stop/verify step. Status: partly fixed (new search replaces the page); explicit pause and verify still open.

Related: [[playlist-feature]], [[playlist-no-permission]], [[fullscreen-playback]].
