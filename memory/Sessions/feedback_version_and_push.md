---
name: Always bump manifest version and push on every update
description: After every code change to the QuickCast extension or website, bump manifest.json version and push to GitHub
type: feedback
originSessionId: 6b69b200-2546-4928-8b27-81e838379455
---
After every update to the QuickCast project, always:
1. Bump `extension/manifest.json` version (patch for bug fixes, minor for new features/UI changes, major for breaking changes)
2. Commit and push to GitHub (`git push origin main`)

**Why:** User expects each change to be versioned and immediately live on the repo without having to ask.

**How to apply:** At the end of every task that touches QuickCast code, automatically bump the version and push — do not wait for the user to ask.
