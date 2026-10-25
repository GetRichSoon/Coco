---
name: material-you-motion-required
description: "Extension UIs must use the theme's real motion library (morphing shapes, loops, stickers, drift, marquee) — flat recolors were rejected"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 0a0a68ab-65c8-42a0-8020-ae8bd3707608
  modified: 2026-10-22T21:30:30.784Z
---

Mangesh rejected the first Framemark (TubeShot) redesign (2026-10-23): "theme is not good, no motion graphics animation, not Material You". A recolor + a few hover springs is NOT enough.

**Why:** He wants a premium, alive feel that matches his mood board / preview (`Material You Theme/refs/preview-hero.png`).

**How to apply:** For every extension UI (popup, options, pages):
- Ship the theme's own `dist/tokens.css` + `theme.css` + `dist/shapes/*.svg` (incl. `morph-loop.svg`) and use its classes, not hand-made lookalikes. See [[material-you-theme]].
- Every surface shows a signature: a morphing/spinning library shape, floating sticker(s) with hard sticker shadow, drifting soft colour blobs, chunky Fraunces display at hero size, and/or a duo block / marquee band.
- Continuous gentle loops (≤3 visible) + springy one-shot entrances + shape-shift on press. Keep reduced-motion + Pause toggle.
- Screenshot-check against `refs/preview-hero.png` before calling it done; if it looks like a generic settings panel, it's not done.
- Each extension still gets its own palette/layout from the boards.
