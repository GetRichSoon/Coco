# Material You Design Theme (default theme #1)

**Status:** DEFAULT for every Chrome extension, Android app (APK) and website we build.
Founder decision, Mangesh, 2026-10-14. New themes will be added later, built from this one (see `../README.md`).

**Source:** founder mood board `Themes-1-001.zip` (193 images of retro-playful brand boards).
Contact sheets are in `refs/board-1.jpg` to `refs/board-7.jpg`. They are **style references only**:
we never copy a logo, name, wordmark or illustration from them (STUDIO_RULES Clean-Room). Everything in this
folder (palette names, shapes, type pairing) is our own.

Live preview: open `preview.html` over http (e.g. `npx http-server company/design/themes/material-you`).
Screenshot: `refs/preview-light.png`.

## 1. What the board says (analysis)

| Seen in the board | How the theme uses it |
|---|---|
| Warm cream "paper" behind almost every board, never pure white | `cream #FFF4E6` background, `paper #FBF8EB` cards, `ink #2B1712` warm brown-black text |
| Big flat **duo blocks**: one bold colour + one soft colour (Wine/Milk, Plum/Mauve, Tomato/Cream, Cobalt/Sky, Forest/Butter) | 10 named **duos** (`.mu-duo-*`, `MaterialYouTokens.duo*`), each contrast-checked |
| Hot tomato/orange is the loudest colour on the board | `tomato #F24E1E` signature, `tomatoDeep #B83A12` for buttons/links (passes AA) |
| Bubblegum pink, baby blue, butter yellow as soft fills | `bubblegum`, `sky`, `butter`, `marigold` |
| Deep plum / oxblood / wine for "night" boards | `plum #4A1430`, `wine #7A1838`; dark mode is plum-black, not grey |
| Chunky, soft, retro serif and bubbly display type (Cooper-like, groovy) | **Fraunces** with `SOFT 100, WONK 1, opsz 30`, weight 900 (display); **Bagel Fat One** for one-word stickers |
| Clean small sans for labels and hex codes | **Figtree** body/UI, system mono for hex codes |
| Scalloped "cookie" seals, flowers, clovers, bursts, squiggles, blobs | 9-shape library (`dist/shapes/*.svg`), same as Material 3 Expressive's shape idea |
| Rounded palette cards with big radius, stickers with a hard bottom shadow | radius `lg 24 / xl 32`, pill buttons, `--mu-elev-sticker` |

Why Material You: Material 3 already gives us colour **roles** (primary, containers, surface levels), shape scale and
motion rules that Android and Flutter understand natively. The board gives the personality. Together: one system
that looks the same in a Chrome popup, a Play Store app and a website.

Note on STUDIO_RULES 5.1 ("cream + serif + terracotta" is an AI-default tell): this theme is founder-chosen, so it
stays. It must never look generic, so every product shows **at least one** of the signature elements: a moving
library shape, a duo block, or the chunky display type at hero size.

## 2. Colour

Source of truth: `tokens.json`. Build (and AA contrast check) with `node company/design/themes/build.mjs`.
The build fails if any role pair or duo drops below WCAG AA (4.5:1 text, 3:1 big display/duo).

Brand palette: cream `#FFF4E6`, paper `#FBF8EB`, ink `#2B1712`, cocoa `#5A2E1E`, tomato `#F24E1E`,
tomatoDeep `#B83A12`, bubblegum `#FFC2E2`, cherry `#C21D5F`, sky `#A9DCFF`, cobalt `#2F55C4`, plum `#4A1430`,
wine `#7A1838`, forest `#1F5A3A`, butter `#FFE79A`, marigold `#EAB04A`.

Roles (light → dark): primary `#B83A12 → #FFA383`, secondary `#A3245A → #FFB0CF`, tertiary `#2F55C4 → #A9C8FF`,
surface `#FFF4E6 → #1E0F14`, plus full container / surface-container / outline / inverse sets, and extra
`success` and `warning` roles. Full list in `tokens.json`.

Rules:
- Text and icons always use roles (`on-*`), never raw palette colours, except inside a duo block.
- Max **one** loud duo block per screen section; the rest stays cream/surface.
- Dynamic colour (Android 12+ wallpaper colours) is **off by default**: the brand palette is the product.
  An app may offer "Match my wallpaper" as a setting.

## 3. Type

| Role | Font | Use |
|---|---|---|
| Display / headline | Fraunces (variable, SOFT 100, WONK 1, opsz 30, wght 700-900) | hero, screen titles, palette names, logos |
| Fun | Bagel Fat One | ONE word per screen max: sticker, splash, badge |
| Body / UI | Figtree (variable 300-900) | everything else, 14-16 px |
| Mono | system mono | hex codes, keys, numbers |

Scale: 56 / 40 / 32 / 28 / 24 / 20 / 16 / 14 / 12. Line height 1.05-1.2 display, 1.5 body.
All fonts are SIL Open Font License (licences in `fonts/`), safe to bundle in paid products.
Bundle them locally: Chrome extensions must not load fonts from Google at runtime.

## 4. Shape

Philosophy: **round** (one philosophy per product, per STUDIO_RULES 5.2).
Radius: xs 6, sm 10, md 16, lg 24, xl 32, xxl 44, full (pill).
Buttons and chips are pills; cards lg; palette cards, dialogs and sheets xl; fields md.
On press, buttons change shape from pill to md radius (Material 3 Expressive shape-shift).

Shape library (`dist/shapes/`, preview `refs/shapes.png`): cookie, flower, clover, sunny, burst, soft-burst,
wavy-circle, pill-blob, circle. Every shape is the same 96-point polar outline, so **any shape can morph into
any other** (CSS/SMIL, Flutter `MuMorphShape`, Compose `MuMorphShape`). Use them for avatars, badges, seals,
empty-state art and hero decoration, never for buttons that hold text.

Shape fix 2026-10-14: clover and flower are drawn as unions of round lobes (four round leaves with pinched notches,
six round petals), matching the board. Earlier versions were too square or too pointy.

## 5. Motion: continuous looping animations

The theme moves all the time, gently. Loops (period from `tokens.json` → `motion.loops`):

| Loop | Period | CSS class | Flutter | Compose |
|---|---|---|---|---|
| Shape morph (cookie → flower → clover → sunny → circle) | 9 s | `dist/shapes/morph-loop.svg`, `.mu-loop-shapes` | `MuMorphShape` | `MuMorphShape` |
| Spin (scalloped seals) | 24 s | `.mu-loop-spin`, `.mu-loop-spin-rev` | `MuLoop(kind: spin)` | `Modifier.muLoop(Spin)` |
| Float (stickers bob 8 px) | 6 s | `.mu-loop-float` | `MuLoop(kind: float)` | `muLoop(Float)` |
| Wobble (tilt ±4°) | 4 s | `.mu-loop-wobble` | `MuLoop(kind: wobble)` | `muLoop(Wobble)` |
| Breathe (the one CTA / FAB) | 3.2 s | `.mu-loop-breathe` | `MuLoop(kind: breathe)` | `muLoop(Breathe)` |
| Blob (organic border-radius) | 12 s | `.mu-loop-blob` | — | — |
| Drift (soft colour blobs behind hero) | 22 s | `.mu-drift` | `MuDriftBackground` | — |
| Marquee band | 18 s | `.mu-marquee` | — | — |
| Squiggle line flow | 2.4 s | `.mu-squiggle` | — | — |
| Duo cycle (background through 4 duos) | 16 s | `.mu-loop-duo` | — | — |

Use `.mu-delay-1/2/3` (or `phase:` in Flutter) so stickers don't move in sync.

Rules (also in `tokens.json`):
1. Max **3** looping things visible at once. Content never loops, only decoration and the one CTA.
2. Loops are slow (≥ 2.4 s) and soft. Nothing flashes more than 3 times a second.
3. Reduced motion (OS setting or `prefers-reduced-motion`) stops every loop. `data-motion="off"` stops them for
   a subtree (give users a "Pause animations" toggle in settings).
4. Loops pause when hidden: CSS does this automatically, Flutter uses TickerMode, Compose stops with the composition.
5. One-shot UI motion uses Material easing: standard `cubic-bezier(.2,0,0,1)`, enter
   `cubic-bezier(.05,.7,.1,1)`, durations 120 / 200 / 320 ms.

## 6. How to use it

### Website or Chrome extension (MV3)
Copy `dist/tokens.css`, `theme.css`, `dist/shapes/` and `fonts/*.woff2` (+ OFL files) into the project, keeping
the same relative paths (`fonts/` next to `dist/`). Then:
```html
<link rel="stylesheet" href="dist/tokens.css">
<link rel="stylesheet" href="theme.css">
<body class="mu-root"> … <button class="mu-btn">Save changes</button>
```
- Popup width ≤ 400 px; use a duo header + cream body (see the popup in `preview.html`).
- Content-script UI: attach both CSS files inside a Shadow DOM root. Every class is `mu-` prefixed.
- Dark mode follows the OS; force with `<html data-theme="dark|light">`.

### Flutter app (APK)
1. Copy `flutter/material_you_theme.dart` and `dist/flutter/material_you_tokens.dart` into `lib/theme/`.
2. Copy `fonts/ttf/*.ttf` to `assets/fonts/` and add to `pubspec.yaml`:
```yaml
flutter:
  fonts:
    - family: Fraunces
      fonts: [{ asset: assets/fonts/Fraunces.ttf }]
    - family: Figtree
      fonts: [{ asset: assets/fonts/Figtree.ttf }]
    - family: Bagel Fat One
      fonts: [{ asset: assets/fonts/BagelFatOne-Regular.ttf }]
```
3. `MaterialApp(theme: MaterialYouTheme.light(), darkTheme: MaterialYouTheme.dark())`.
4. Optional test: `flutter/test/material_you_theme_test.dart` (change the import to your app package).
Verified 2026-10-14: `dart analyze` clean, 4/4 widget tests pass (light, dark, loops run, reduced motion stops them).
`BagelFatOne-Regular.ttf` is 1.5 MB (it includes Korean glyphs); subset it before release if APK size matters.

### Native Android (Jetpack Compose)
1. Copy `compose/MaterialYouTheme.kt` and `dist/compose/MaterialYouColors.kt` into your `ui/theme` package
   (change the `package` line in both).
2. Copy the TTFs to `res/font/` as `fraunces.ttf`, `figtree.ttf`, `bagel_fat_one.ttf`.
3. Wrap: `MaterialYouTheme(fonts = MuFonts(display = FontFamily(Font(R.font.fraunces, FontWeight.Black)), body = FontFamily(Font(R.font.figtree)), fun_ = FontFamily(Font(R.font.bagel_fat_one)))) { … }`
**Not compile-checked yet:** this PC has no JDK 11+ (only Java 8), so Gradle could not build it on 2026-10-14.
The builder must compile it once in the first Compose app that uses it.

## 7. Ship checklist (add to STUDIO_RULES 5.9 checks)
- [ ] Uses the tokens (no hand-picked hex in product code).
- [ ] At least one signature element (moving shape, duo block, or display type at hero size).
- [ ] ≤ 3 loops visible; reduced motion stops them; settings has "Pause animations".
- [ ] Light and dark both checked; `node company/design/themes/build.mjs --check` passes.
- [ ] Fonts bundled locally, OFL licence files included.
- [ ] No logo, name or artwork copied from the mood board.

## 8. Files
```
material-you/
  tokens.json            source of truth (edit this, then run build.mjs)
  theme.css              web components + looping animations (handwritten)
  preview.html           live demo of everything
  dist/                  GENERATED: tokens.css, flutter/, compose/, shapes/ (svg + shapes.json + morph-loop.svg)
  flutter/               Flutter ThemeData + loop widgets + test
  compose/               Compose theme + loop modifiers
  fonts/                 woff2 (web) + ttf/ (apps) + OFL licences
  refs/                  mood-board contact sheets, shape sheet, preview screenshots
```
