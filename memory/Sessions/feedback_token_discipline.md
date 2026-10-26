---
name: feedback-token-discipline
description: "Boss wants fewer tokens used on the Max plan; no repetitive work, focus on what matters, then publish good output directly"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 59ee144d-81f9-4d78-ae14-ca2fe5054c43
  modified: 2026-10-25T19:22:21.154Z
---

Boss, 2026-10-26, near a usage limit (96%, reset about 1.5 hours away): "use fewer tokens, don't repeat the same tasks, focus on what matters. If a GitHub tool helps, install it once or put it in memory. Generate good output and publish directly."

**Why:** the Claude plan has 5-hour and weekly limits. Running out stops all teams.

**How to apply:**
- Give subagents one complete brief instead of many small follow-ups.
- Don't re-read files or re-run checks that already passed.
- Use the cheapest model that can do the job (Haiku or Sonnet for QA and scans).
- Batch tool calls.
- At about 90–96% usage, tell running agents to commit WIP and pause. Wake up after the reset, resume them, and test.
- Token tool: Boss said yes on 2026-10-26 to installing a GitHub token-saving tool (RTK was tried earlier and blocked by the permission check). Install it once and note the result here.

Related: [[usage-limit-stop]].
