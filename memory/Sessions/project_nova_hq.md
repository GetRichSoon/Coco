---
name: nova-hq
description: "Nova = always-on AI chief of staff for Mangesh + Shreya's company; lives in private repo Mangesh347/nova-hq and runs as 5 cloud routines"
metadata:
  node_type: memory
  type: project
  originSessionId: 69b155d2-e49a-432c-a16a-74a006d48a25
  modified: 2026-10-06T17:24:34.051Z
---

Built 2026-10-06. Mangesh wants a "Jarvis-like" AI company (he named it **Nova**) that runs 24/7 in the cloud even with laptop and phone off. Co-founder: Shreya. 2026-10-06 he asked to drop the "Fenwick" name from Nova HQ (done; live product "Fenwick Recorder" left unchanged pending his call). Nova must be voice-first: he speaks Hinglish via voice typing, wants spoken-style short replies.

- Repo `Projects/fenwick-hq` (local folder name; GitHub renamed) → github.com/Mangesh347/nova-hq (private). CLAUDE.md = Nova; 16 subagents in `.claude/agents/` (extensions, Play apps, social media, growth, ops); skills /brief /extension-pipeline /app-pipeline /content-pipeline /status; company memory in `company/`.
- 5 routines (IST): morning brief daily 08:00 (trig_012yWhvbacJQNiJgcGarrNBJ), extension team Mon+Thu 10:00 (trig_01YD1qbpaSjuu2X53XdzCcLw), Play apps Wed 10:00 (trig_015CHr9jHVkvP4WrwZ5qoPsw), social media Mon/Wed/Fri 17:00 (trig_01D5L435UgwwUNdMZEPkSv9w), weekly audit Sun 19:00 (trig_019ErCk2oj5KLzm98ZfXCyU5). Sonnet 5.5, MCP connectors cleared on purpose (they auto-attach, incl. Gmail).

**Why:** approval gate — teams prepare, founders approve publishing/spending/deleting via `company/APPROVALS.md` ("YES A-001").
**How to apply:** change teams by editing the repo; change times via RemoteTrigger update. Related: [[github-repo-layout]].
