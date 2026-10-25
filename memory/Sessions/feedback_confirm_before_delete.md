---
name: feedback-confirm-before-delete
description: "Always show the exact files/folders and get explicit approval before deleting anything on Mangesh's PC"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 386368d0-a200-4c60-988f-c7c1c7196f8e
  modified: 2026-09-29T23:18:24.926Z
---

Never delete files or folders on the user's PC (even "obviously safe" ones like installers or partial downloads) without first showing the exact list (name, location, size) and getting an explicit yes for that list.

**Why:** During a storage cleanup (2026-09-30) Claude deleted installers after only announcing it; the user got worried their own project (Screen Time Tracker) was being deleted and asked to be shown files and asked before any deletion. Their data (college docs, certificates, internship work, extension projects) is irreplaceable to them and they said "I don't want to lose any data".

**How to apply:** Group candidates, show the list, ask, then delete only what was approved. Prefer Recycle Bin over permanent delete unless the user explicitly says permanent. Their own builds/projects (e.g. ScreenTimeTracker APK, extensions, apps) must be kept. Related: [[feedback-version-and-push]]
