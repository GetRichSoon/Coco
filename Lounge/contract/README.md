# Coco contracts

Two small contracts keep Desktop, the phone (PWA) and Android as **one application**. Everything else in this folder is generated from them.

| File | What it is | Edited by hand? |
|---|---|---|
| `nav-contract.json` | The one navigation: 8 sections, 2 global actions (Ask COCO, Remote Control), 7 Houses, the 20 House tabs, and where each of the 20 original pages went. | yes |
| `themes.json` | The six themes (seed colours, names, taglines), the rotation options, the defaults. **Theme 1, Original Signature, is locked.** | yes (themes 2 to 6 only) |
| `theme-schemes.json` | The complete Material 3 colour roles of every theme, light and dark, for the page and for panels (cards, navigation). Generated from the seeds with Google's Material Color Utilities; every text pair is checked against WCAG AA and the build fails if one is not. | **no** (`node contract/build-themes.mjs`) |
| `nav-contract.js`, `theme-contract.js` | The same data as plain scripts, because the desktop app opens the page from disk and `fetch()` is refused on `file://`. | **no** (`node contract/build.mjs`) |
| `theme-vectors.json` | Inputs and expected outputs of the theme engine (rotation, scheduling, the seeded "random" pick), produced by `../theme-engine.js`. Android runs the same file against its Kotlin port. | **no** (`node contract/build-vectors.mjs`) |
| `theme-css.mjs` | Writes the two generated blocks of `../index.html` (fallback palette, panel remap). | no |

Regenerate everything after changing a seed: `npm run themes:build` (the generator needs the dev dependency `@material/material-color-utilities`; the apps themselves ship only the generated numbers).

## How a theme reaches the screen

1. `theme-engine.js` (pure core + thin browser shell) reads `theme-contract.js`, decides the theme and mode, and sets every CSS variable on `<html>` before the first paint (the saved theme is on screen before anything else).
2. The stylesheet defines **no colours**. Surfaces that can have the opposite polarity to the page (black cards and navigation on Original Signature's lavender page) re-declare their variables from the *panel* copy of the palette, so no component needs to know.
3. Rotation is computed from timestamps (`evaluate`, `nextDueAt`), never from a UI timer. The timer in the page only asks the engine "is anything due?" once a minute and when the app wakes up.

## The shared preference document

One small JSON document, identical on every device: `{v, appearance, themeId, previousThemeId, lastSwitchedAt, seq, locked, reason, rotation{enabled, frequency, order, time, weekday, dayOfMonth, tz, seed, anchorAt}, updatedAt, updatedBy}`.

* Stored per device (`localStorage` key `gs-theme-prefs`, Android `SharedPreferences coco_theme_prefs`).
* Shared between a person's devices through the **existing `controls` table**, row `id = "ui_theme." + lowercase(email)` (no migration). Writes are compare-and-set on the row's `updated_at`; the document's own `updatedAt` decides which copy is newer. A "launch" switch is device-local and is never shared. If the row cannot be read or written the app keeps working from the device, silently.

## Rules the engine guarantees (all tested)

* *Every time COCO opens*: a new session switches; a reload, navigation or focus does not.
* *5 h / 7 h*: counted from the last switch. *Daily / weekly / monthly*: at the configured time in the configured IANA time zone (daylight saving decided like `java.time`: a time that happens twice uses the first, a time that does not exist moves forward).
* A schedule that fell due while the app was closed applies **one** step on the next open.
* *Sequential* goes 1 to 6 and wraps. *Random* never picks the theme in use nor the one before it; scheduled random picks come from a hash of a shared seed, so every device computes the same theme.
* A locked theme, "manual only" and a switched-off rotation never change. Saving a new schedule never fires it on the spot.
