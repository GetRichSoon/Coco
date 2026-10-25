---
name: feedback-paid-extensions-only
description: Publish only Chrome extensions that have paid users (Pro tier + working checkout + license activation)
metadata:
  node_type: memory
  type: feedback
  originSessionId: 59ee144d-81f9-4d78-ae14-ca2fe5054c43
  modified: 2026-10-25T16:36:27.232Z
---

Boss, 2026-10-25: "I'm planning to publish only extensions in which I can set paid users." Every extension we publish needs three things:
- a Pro tier people can buy;
- a working checkout on the shared payment server (Mangesh347/Extension, one entry per product in products.js);
- license-key activation in the extension.

Free-only extensions are not published.

**Why:** Boss wants revenue from every product (payout from day one), not just installs.

**How to apply:**
- When picking or building an extension, plan the Pro features and the catalog entry from the start.
- Before any publish, check that buying works end to end in test mode.
- Never ship a placeholder paywall.

Related: [[feedback-no-company-names-external]]
