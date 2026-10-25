---
name: terminal-first-execution
description: "All work (incl. publishing) runs on the PC terminals 1,2,3 by default; the cloud session only does a task when Mangesh says 'cloud pe kaam kar'. Cloud passes everything else to the terminal."
metadata:
  node_type: memory
  type: feedback
  originSessionId: aa7542f4-84db-5845-87e7-fa142bcada27
  modified: 2026-10-08T20:14:01.840Z
---

Default executor is the PC terminals (Terminal 1, 2, 3), not the cloud session. Any work, including publish tasks, runs there.

**Why:** Mangesh said (2026-10-09): "Abhi terminal se hi sab publish ka hoga, kuch bhi kaam ho terminal se hi hoga. Agar main bolunga cloud pe kaam kar, tabhi cloud session pe hoga, nahi to terminal 1,2,3 pe hi hoga."

**How to apply:**
- Cloud session: when Mangesh sends a task without saying "cloud", do not run it. Pass it to the PC terminal (task file / `nova-task` hand-off / COMMS.md line) and let the terminal run it.
- Run on cloud only if he explicitly says "cloud pe kaam kar" (or similar) for that task.
- The CLAUDE.md approval gate (publish, spend, delete, message non-family) still applies on the terminal.

Related: [[one-brain-rule]], [[command-memory]].
