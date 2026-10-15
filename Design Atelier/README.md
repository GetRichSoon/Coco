# Company themes

Every extension, app and website uses the **default theme** in `themes.json` unless the founders pick another.

| Theme | Status | Folder |
|---|---|---|
| Material You Design Theme | **default** (since 2026-10-14) | `material-you/` (read `material-you/THEME.md`) |

## Build / check
```
node company/design/themes/build.mjs            # build every theme's dist/ + AA contrast check
node company/design/themes/build.mjs --check    # contrast check only (exit 1 on failure)
```

## Adding a new theme (always start from a saved theme)
1. Copy `material-you/` to `<new-id>/` (keeps theme.css, preview.html, flutter/, compose/, fonts/).
2. Edit only `<new-id>/tokens.json`: id, name, palette, duos, light/dark roles, fonts, shape radii, loop periods.
   The shape library and all loops are theme-agnostic and come along for free.
3. Run `node company/design/themes/build.mjs <new-id>`. Fix every contrast failure it reports.
4. Open `<new-id>/preview.html` over http and check light, dark and phone width.
5. Add the theme to `themes.json` with `status: "proposed"`. Only a founder YES makes it `default`.
6. Put the new mood board's contact sheets in `<new-id>/refs/` (style only, never copy logos or artwork).
