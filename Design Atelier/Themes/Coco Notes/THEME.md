# Coco Notes (candidate accent kit, 2026-10-26, NOT applied to any product)

Accent kit for the new Notes tab and the Idea Saver chip. Feel: capture-fast. Every tap answers in under 100 ms, then bounces.
Files: tokens.css (light + dark, full M3 roles, no yellow), fonts.css + fonts/, motion.css, preview.html (two phones + accent kit), preview.png, preview-dark.png.

## Colour (source: ../make_tokens.mjs)
Primary orchid magenta hue 335 (light #c104c0, dark #ffabf2), secondary mint-teal (the Idea Saver chip), tertiary periwinkle, neutrals faintly pink (light) / aubergine-black (dark).
Contrast: every on-colour pair at least 5.16:1. Note cards rotate through primary / secondary / tertiary containers so a screen is never one colour.
Shape: very round. Corners 8 / 14 / 20 / 28 / 40 px; FAB is a squircle that morphs to a circle on hover/press.

## Type
| Role | Font | Licence | Use |
|---|---|---|---|
| Display | Bricolage Grotesque (variable wght 200-800) | SIL OFL 1.1 | screen titles, note titles, buttons, weight 700-800 |
| Body | DM Sans (variable 100-1000) | SIL OFL 1.1 | note text, chips |
| Mono | DM Mono (regular 400 only) | SIL OFL 1.1 | timestamps, durations, tags |
Licence texts still to be copied next to the fonts before any paid product ships them.

## Motion spec (motion.css, prefix cn-)
Easings: bounce (.34,1.8,.5,1), spring (linear() overshoot), out (.05,.7,.1,1), standard. Durations: micro 90, short 160, medium 300, long 520 ms; loops .9 / 1.9 / 3.6 s.
| Loop | Where | Time |
|---|---|---|
| cn-pop | chips and note cards spring in, 45 ms stagger | 300 ms once |
| cn-ring | record button breathing double ring | 1.9 s |
| cn-wave | voice bars while recording | .9 s |
| cn-type + cn-caret | live typing in the Idea Saver field | 3.6 s / 1 s |
| cn-fly + cn-bump | captured note flies into the Notes stack, stack bumps | 3.6 s |
| cn-wiggle | Idea Saver bulb nudges for attention (mostly at rest) | 1.9 s |
| cn-marquee | ticker of recent captures (pauses on hover) | 22 s |
| cn-note | card tilts on hover, squashes on press | 300 ms |
| cn-fab | squircle to circle plus quarter spin | 300 ms |
| cn-saved + cn-burst | Idea saved check pops with a burst ring | 520 ms |
Reduced motion and data-motion="off" stop all loops.
