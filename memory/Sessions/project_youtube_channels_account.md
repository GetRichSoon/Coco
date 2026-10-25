---
name: project-youtube-channels-account
description: All 12 YouTube channels (The Flow + 11 from YOUTUBE.pdf) are brand channels under sampleshoppp@gmail.com
metadata:
  node_type: memory
  type: project
  originSessionId: 59ee144d-81f9-4d78-ae14-ca2fe5054c43
  modified: 2026-10-15T17:02:12.241Z
---

Every YouTube channel is a brand channel under the Google account **sampleshoppp@gmail.com**, the same account that owns The Flow (founder, 2026-10-14). The channels are The Flow plus BodyDecode, PastWoven, DreamFrame, QuiteMindFiles, MindSpark, SuccessHasal, UntoldUniverse, UnveilAI, TasteOdessey, SanatanEchoes and Streebellion.

Status 2026-10-15: all 12 channels created and CONNECTED (tokens in ~/.nova-secrets/youtube-<slug>.env on Boss PC). Full per-channel brief from the PDF: company/youtube/categories/<slug>/PRODUCTION_SYSTEM.md. Still open: human-info and app-web (not in the PDF, founder to decide); quota-extension form for daily uploads on all channels.

**Why:** Boss chose one account for all channels so one login and one Cloud project serve every channel.

**How to apply:**
- Open the channel list for that account at youtube.com/channel_switcher?authuser=sampleshoppp@gmail.com.
- Pick that account in every `node scripts/yt-local.mjs connect <slug>` login.
- The registry is company/youtube/channels.json, and each playbook is in company/youtube/categories/<slug>/PROMPTS.md.
- One Cloud project allows about 6 uploads per day in total, so ask for more quota before uploading daily on all channels.

Related: [[project-youtube-the-flow]]
