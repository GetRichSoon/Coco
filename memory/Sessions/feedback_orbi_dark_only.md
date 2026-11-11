---
name: feedback-orbi-dark-only
description: "Orbi (new tab extension 3.1 and its website) is dark theme only, no light theme or theme toggle (2026-11-11)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c61efa00-d33f-4fd9-a5f4-76b5bc1eaf5f
  modified: 2026-11-11T08:48:27.003Z
---

Orbi uses the DARK theme only, in the extension and on the website. No light theme, no light variants, no theme toggle, no `prefers-color-scheme: light` styling. Founder: "use dark theme only no light theme" (2026-11-11), after the earlier "community keep dark theme also".

**Why:** Orbi lives on wallpapers, so a dark UI keeps the art in front; the founder does not want two themes to build, test and review.
**How to apply:** every scheme switch in `design/orbi-tokens.css` (and its synced copies in the extension and website) resolves to `color-scheme: dark`; every page carries `<meta name="color-scheme" content="dark">`; screenshots and smoke tests cover dark only (1440 and 390 wide). Related: [[project-orbi-210-rc]], [[material-you-theme]], [[feedback-test-once]].
