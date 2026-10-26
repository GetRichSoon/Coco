# Candidate Aurora (wildcard look for the founders to react to, 2026-10-26, NOT applied to any product)

Feel: slow, luminous, expensive. Glass cards over drifting aurora light; a dramatic high-contrast serif for big words.
Files: tokens.css (light + dark, full M3 roles, no yellow), fonts.css + fonts/, motion.css, preview.html, preview.png, preview-dark.png.

## Colour (source: ../make_tokens.mjs)
Primary aurora green-teal hue 172 (light #00614a, dark #3bdfb1), secondary violet hue 285, tertiary rose-pink hue 345; neutrals midnight violet (hue 275). Brand extras: --ca-aurora-a #2fe0b4, --ca-aurora-b #8b5cf6, --ca-aurora-c #ff5fa8 (used for blobs, orb and gradient text only, never for text on text).
Contrast: every on-colour pair at least 5.16:1. Dark mode is the hero look; light mode is frosted mint and lilac.
Shape: large soft corners 8 / 16 / 24 / 32 / 48 px, pill buttons, morphing blob shapes.
Trend sources behind it are in ../../Library.md.

## Type
| Role | Font | Licence | Use |
|---|---|---|---|
| Display | Bodoni Moda (variable wght 400-900, wght axis only in the bundled file) | SIL OFL 1.1 | hero words, big numbers, card titles |
| Body / UI | Manrope (variable 200-800) | SIL OFL 1.1 | everything else |
| Mono | Martian Mono (variable) | SIL OFL 1.1 | eyebrows, times, hex |
Licence texts still to be copied next to the fonts before any paid product ships them. Bodoni's hairlines get thin below 20 px: use it only large.

## Motion spec (motion.css, prefix ca-)
Easings: glide (.16,1,.3,1) signature long settle, silk (.4,0,.2,1), drift (.45,.05,.55,.95) for ambient loops. No bounce. Durations: short 240, medium 480, long 900 ms; loops 4.2 s breathe, 7 s float/shimmer, 11 s morph, 16 s orbit, 24 s drift.
| Loop | Where | Time |
|---|---|---|
| ca-drift | three blurred aurora blobs wander and swell | 24 s |
| ca-curtain | vertical aurora curtains sway (dark mode) | 13 s |
| ca-shimmer | gradient slides through the headline | 7 s |
| ca-float | glass cards hover, offset per card | 7 s |
| ca-orbit | chips circle the orb | 16 s |
| ca-breathe | glow behind the orb | 4.2 s |
| ca-morph | orb and logo change shape | 11 s |
| ca-ring | progress ring draws in | 1.8 s once |
| ca-reveal | blur-to-sharp rise, 90 ms stagger | 900 ms once |
| ca-glass | hover: rises, light sheen sweeps across | 480 / 900 ms |
Heavy layers animate transform and opacity only. Reduced motion and data-motion="off" stop all loops. Cost to watch: backdrop-filter blur on low-end phones; Android builds should fall back to opaque containers.
