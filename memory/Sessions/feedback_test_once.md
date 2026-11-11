---
name: feedback-test-once
description: "Founder rule: never re-run passing tests; build first, test once at the end, rerun only a failing case (max two fixes, then report FAIL)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c61efa00-d33f-4fd9-a5f4-76b5bc1eaf5f
  modified: 2026-11-10T13:52:25.101Z
---

Build the whole change first, then run each relevant test suite ONCE. If something fails, fix it and rerun only that case (e.g. `node --test --test-name-pattern=...` or a one-off script for that check). At most two fix attempts per failure, then report it as FAIL with the reason. Never re-run tests that already passed and whose code did not change; reuse earlier PASS results in reports.

**Why:** On 2026-11-10 the founder interrupted twice ("bro dont make this in loop", "bro dont repeat test") after long end-to-end suites were re-run again and again while most failures were test-harness bugs. He wants premium quality, not test loops.

**How to apply:** give the same rule verbatim to every agent you delegate to; when a test fails, read the actual error before re-running; check whether a "failure" is the harness (wrong URL, Free-plan locks, missing dev dependency, Playwright never hiding tabs) before touching product code. Related: [[feedback-token-discipline]].
