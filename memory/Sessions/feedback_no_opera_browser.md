---
name: feedback_no_opera_browser
description: "Never use the Opera browser for any automation or testing on Boss's PC"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 030db589-04fe-4298-91cd-977dc8c83384
  modified: 2026-11-01T07:56:09.218Z
---

Boss, 2026-11-01: do not use the Opera browser. Any browser work uses Chromium (the headless
`browser-automation` skill runs patchright/Chromium) or Chrome via the Claude in Chrome extension.

**Why:** he said so plainly while browser automation was in use; he keeps Opera out of the company's
tooling. No reason was given and none is needed.

**How to apply:** when a task needs a browser, reach for the headless Chromium skill first, or
Chrome if a real signed-in profile is required. Never launch or drive Opera, and do not suggest it
as an option. Related: [[feedback_install_safe_automation]], [[project_home_office_switch]].
