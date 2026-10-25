---
name: shared-session-memory
description: "Since 2026-10-25 every Claude session shares one memory: Good Space\\Coco\\memory\\Sessions (junctions on the laptop, GetRichSoon/Coco for cloud)"
metadata:
  node_type: memory
  type: project
  originSessionId: aa7542f4-84db-5845-87e7-fa142bcada27
  modified: 2026-10-25T14:51:43.414Z
---

Boss, 2026-10-25: "connect all sessions into one, so every session has every session's ideas". Every `~\.claude\projects\*\memory` folder on the laptop is a junction to `C:\Users\Lenovo\Good Space\Coco\memory\Sessions`. A memory saved by one session is seen by every session at its next start.

**Why:** ideas and rules from one session were lost to the others (7 separate memory folders before; 3 had content).

**How to apply:**
- Save memories as usual; they land in the shared folder. Never write a secret value: Daily Seal pushes the folder to GetRichSoon/Coco nightly (23:30). The QuickCast client secret was taken out of `project_quickcast_keys.md` for this reason; the original is only in `~\.claude\memory-backup\`.
- A session in a new folder: run `Good Space\Coco\Link Sessions.ps1` (safe to re-run; Daily Seal runs it nightly on LAPTOP-LSVOC2SK only).
- Cloud sessions read and write `memory/Sessions` in GetRichSoon/Coco (line in CocoMaison CLAUDE.md "One brain").
- `MEMORY.md` merges by union (`.gitattributes`), so two PCs adding lines do not conflict.
- Shreya's PC is NOT linked; it opts in only if she runs `Link Sessions.ps1` there.
Related: [[one-brain-rule]], [[recall-all-sessions]], [[github-org-layout]].
