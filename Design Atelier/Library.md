# Design Atelier Library

Vivi's growing research library. Each entry: what, source, verdict (WORKS / REJECTED / TESTING), date. Delta only: add new findings, do not repeat old ones.
Read `Founder Taste.md` before using anything here.

## Kits (one entry per kit, newest first)

### Candidate Aurora (2026-10-26) - TESTING, waiting for founders
- Wildcard: glass cards over drifting aurora light (green-teal, violet, rose), Bodoni Moda display + Manrope + Martian Mono, slow luminous motion (drift 24 s, glide easing, no bounce).
- Basis: 2026 trends below (adaptive and layered colour, expressive serifs, text as graphic). Dark mode is the hero look.
- Preview: Themes\Candidate Aurora\preview.html (+ preview.png, preview-dark.png). Not applied anywhere.

### Coco Notes (2026-10-26) - TESTING, waiting for founders
- Accent kit for the Notes tab and Idea Saver chip: orchid magenta + mint + periwinkle, Bricolage Grotesque 800 + DM Sans, very round shapes.
- Capture-fast motion: 90 ms tap response, springy pop-in, record ring, voice wave, typing caret, note flies into stack, saved burst.
- Preview: Themes\Coco Notes\preview.html (+ preview.png, preview-dark.png). Not applied anywhere.

### Document Toolkit (2026-10-26) - TESTING, waiting for founders
- PDF and files product: cool paper + graphite ink + one cinnabar accent, Newsreader + Schibsted Grotesk + JetBrains Mono, sharp corners, hard ink shadows.
- High-motion tool cards: each tool has its own loop (merge, split, squish, swap, signature draw, scan), idle slow, fast on hover, DONE stamp thump.
- Preview: Themes\Document Toolkit\preview.html (+ preview.png, preview-dark.png). Not applied anywhere.

## Research findings

### 2026 colour direction - WORKS (directional, trend blogs, not authoritative) - 2026-10-26
- Adaptive, layered colour is the 2026 shift: tints over layers (Apple Liquid Glass, iOS 26) and brighter tonal palettes (Google Material 3 Expressive, Android 16). Used in: Candidate Aurora (glass over light), all kits (full M3 tonal roles).
- Teal leads, browns get richer, pastels cool down, pink grows up, neutrals tilt warm; biophilic calm palettes as a counterweight to synthetic UI. Used in: Aurora teal + rose, Notes mint + orchid.
- Claim not verified by Vivi: "EU makes WCAG 2.2 contrast a legal requirement". All kits pass AA anyway (checked by script, min 5.16:1).
- Sources: https://customstickers.com/community/blog/color-trends-for-2026-palettes-designers-will-actually-use , https://ixdf.org/literature/article/ui-color-palette , https://trends.daisyui.com/ui-design-trends-2026/ , https://unicoconnect.com/blogs/impact-of-color-in-mobile-app-design

### 2026 typography direction - WORKS (directional) - 2026-10-26
- Expressive variable serifs with personality are called the defining 2026 trend; variable fonts are now the default (one file, weight and optical size on demand); text used as a graphic (gradient or masked text, kinetic type).
- Used in: Aurora (Bodoni Moda large + gradient shimmer headline), Document Toolkit (Newsreader with an italic accent word), Notes (Bricolage Grotesque variable weight 800 for punch).
- Caution: several of these guides promote their own tools. Distorted or stretched type was seen as a music and fashion trend; not used, too hard to read in tools.
- Sources: https://madegooddesigns.com/font-trends-2026/ , https://www.designmonks.co/blog/typography-trends-2026 , https://www.inspoai.io/blog/typography-trends-2026 , https://www.sidora.ch/en/blog/typografie-als-designelement

### Tooling notes - 2026-10-26
- Tokens are generated from tonal palettes with @material/material-color-utilities 0.3.0 (Themes\make_tokens.mjs); 0.4+ fails to import under Node ESM. Contrast check is in the script.
- Fonts come as latin-subset woff2 from Fontsource via jsDelivr; all nine are SIL OFL per their Google Fonts listing (licence files still to be copied before a paid product bundles them).
- Preview proof: headless Edge via puppeteer-core, two frames 1.3 s apart must differ (they do for all six screenshots).
