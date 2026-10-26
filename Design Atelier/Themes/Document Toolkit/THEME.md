# Document Toolkit (candidate kit, 2026-10-26, NOT applied to any product)

For the PDF and files product. Feel: paper and ink, one bold accent (cinnabar), tool cards that are always gently alive.
Files: tokens.css (light + dark, full M3 roles, no yellow), fonts.css + fonts/, motion.css, preview.html, preview.png, preview-dark.png.

## Colour (source: ../make_tokens.mjs)
Primary cinnabar hue 34 (light #cb3600, dark #ffb5a0), secondary slate-blue, tertiary deep teal, neutrals cool paper (hue 245, chroma 3).
Contrast: every on-colour pair is at least 5.16:1 (script check). Accent is used once per section: button, underline, stamp, active nav.
Shape: sharp and paper-like. Corners 2 / 4 / 8 / 12 / 20 px. Hard offset shadows (3px 3px, ink colour) on buttons, sheets, logo.

## Type
| Role | Font | Licence | Use |
|---|---|---|---|
| Display / headings | Newsreader (variable, wght 200-800) | SIL OFL 1.1 | hero, tool names, italic accent word |
| UI / body | Schibsted Grotesk (variable 400-900) | SIL OFL 1.1 | everything else, 14-16 px |
| Mono | JetBrains Mono (variable) | SIL OFL 1.1 | file sizes, page counts, crumbs, tags |
Files bundled in fonts/ (latin subset woff2 from Fontsource). Licence texts still to be copied next to the fonts before any paid product ships them.

## Motion spec (motion.css, prefix dt-)
Easings: standard (.2,0,0,1), decel (.05,.7,.1,1), snap (.34,1.56,.64,1), spring (linear() stamp curve). Durations: micro 120, short 220, medium 380, long 640 ms; loops 1.1 s / 2.6 s / 5.5 s.
| Loop | Where | Time |
|---|---|---|
| dt-reveal | every block rises in, 70 ms stagger | 640 ms once |
| dt-float | idle sheet bob | 5.5 s |
| dt-scan | scan line over drop-zone thumbnail and Read text | 2.6 s |
| dt-stripes | barber-pole progress fill | 1.1 s |
| dt-merge / dt-split / dt-squish / dt-swap / dt-draw | one signature loop per tool card (merge, split, compress, convert, sign); slow idle (4.4 s), fast on hover (1.7 s) | 2.6 s |
| dt-stamp + ring | DONE stamp thumps in with a spring | 640 ms |
| dt-tool | hover lift with 3D tilt and accent rule; press squashes | 380 ms |
| dt-ink | heading underline grows on hover | 380 ms |
Reduced motion and data-motion="off" stop all loops.

## How a team applies it
Link fonts.css, tokens.css, motion.css; read colours only through --md-sys-color-* roles. Their own build and QA apply it, never Vivi.
