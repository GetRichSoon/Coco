---
name: usage-limit-stop
description: Stop long/overnight work when the weekly usage limit nears 90% — save everything first
metadata:
  node_type: memory
  type: feedback
  originSessionId: 0a0a68ab-65c8-42a0-8020-ae8bd3707608
  modified: 2026-10-22T21:11:10.027Z
---

When working unattended (night shifts, /loop, cron resume jobs), stop when the weekly usage limit gets near 90%.
Claude can't read the percentage directly, so treat ANY usage-limit warning from Claude Code as the signal:
delete the resume cron job, commit + push all work, write the status report, then stop.

**Why:** Mangesh said so on 2026-10-23 during the overnight extension upgrade; he wants weekly budget left for daytime work.

**How to apply:** Applies to every autonomous run. Never keep retrying after a limit warning.
