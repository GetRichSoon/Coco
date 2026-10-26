---
name: project-company-handoff
description: "Any new session: read company/HANDOFF.md on main first - full company context, live state, pending YES list, and the 30-minute check duty to restart"
metadata:
  node_type: memory
  type: project
  originSessionId: 5c3b1cc5-243c-4b7f-b192-0cf5d9f4ee08
  modified: 2026-10-26T02:49:58.636Z
---

Since 2026-10-26 the company's full working context lives on GitHub main (GetRichSoon/CocoMaison). A new chat gets everything by: git pull, then reading company/HANDOFF.md (live state + what to restart), company/ORG-MAP.md, company/tasks/BOARD-<date>.md, company/APPROVALS.md and the rule files it lists. The active session must keep HANDOFF.md and the day board current and run the 30-minute check loop (CronCreate) described there.

**Why:** Boss switches chats and devices; nothing may be lost between sessions.
**How to apply:** make reading HANDOFF.md the first act of any session doing company work; update it whenever live state changes. Related: [[feedback-one-brain]], [[project-shared-session-memory]].
