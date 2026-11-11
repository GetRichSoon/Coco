---
name: show-video-when-created
description: "Boss wants every video/animation I create opened for him immediately, not just described"
metadata:
  node_type: memory
  type: feedback
  originSessionId: a4503653-a1ce-4894-9850-f2f9d7768cc3
  modified: 2026-11-10T10:20:19.417Z
---

When a video (animation, render, preview mp4) is created, open it for Boss right away (Start-Process on the file) and give the full path, instead of only reporting that it exists.

**Why:** Boss said "show video directly when created" (2026-11-10, during the Kaggle/Blender animation work). He judges quality by watching it.

**How to apply:** after a render/encode finishes and the file is verified (plays, right length/resolution), run `Start-Process "<full path to mp4>"` and also name the path in the reply. Still do not claim quality; say what is visibly there. Related: [[feedback-fullscreen-playback]], [[feedback-quality-promise]].
