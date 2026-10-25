---
name: project-default-theme
description: "Default UI theme for every APK, website and Chrome extension is \"Material You Design Theme\" (company/design/themes/material-you), with looping motion"
metadata:
  node_type: memory
  type: project
  originSessionId: 25fa4087-de78-4573-8559-7e44500becfd
  modified: 2026-10-13T22:56:29.459Z
---

Founder (Mangesh, 2026-10-14) made the "Material You Design Theme" the default for every APK, website and Chrome extension. It was built from the mood board `Downloads/Themes-1-001.zip` (193 retro-playful brand boards). It lives on main in `company/design/themes/material-you/` (THEME.md, tokens.json, theme.css, flutter/, compose/, shapes, fonts), with the registry in `company/design/themes/themes.json`.

**Why:** the founder wants one consistent look across all products, with continuous Material You looping animations. More themes will be added later, always derived from a saved theme.

**How to apply:**
- Any UI work starts from this theme.
- To make a new theme, copy the folder, edit only tokens.json, run `node company/design/themes/build.mjs`, and register it as `proposed` until the founder says YES.
- The founder checks shapes visually. On 2026-10-14 they flagged the green clover as wrong (it was too square), so shapes must match the board: round lobes and pinched notches.
- Compose files are not compile-checked yet (no JDK 11+ on the PC).

Related: [[feedback-do-more-than-asked]], [[feedback-flow-animation-theme]]
