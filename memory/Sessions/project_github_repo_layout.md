---
name: github-repo-layout
description: "How Mangesh's extensions are split across private code repos and public -website repos on GitHub (Mangesh347), and how to update them"
metadata:
  node_type: memory
  type: project
  originSessionId: 69b155d2-e49a-432c-a16a-74a006d48a25
  modified: 2026-10-01T04:23:19.058Z
---

Since 2026-10-01 every extension has a PRIVATE code repo (Mangesh347/<folder-name>, plus older ones QuickCast, Orbi-New-Tab-Live-Wallpapers-Shortcuts, Extension, voiceaudiorecorder) and a PUBLIC Mangesh347/<name>-website repo holding only static/legal pages.

**Why:** user wants code private but privacy/terms/legal pages public; api/ payment + license code must never go public.

**How to apply:**
- Public site copies live in `Projects/_public-websites/<name>-website`; regenerate with `bash _public-websites/sync-websites.sh`, then commit+push each. Never hand-copy api/, lib/, server.js, .env*.
- `C:\Extension` holds older extensions; only the LATEST of each duplicate group was pushed (user: "don't push duplicates"). Skipped on purpose: Orbit V1, volume-booster (soundblast is newer), web-time-tracker, Web Screen Time Tracker (1.0.2), ShieldX-SaaS-v4, Job_Fit_Check v2 + Copy, resume-jd-matcher, daily-motivation, motivation_extension_chrome, Screenshot-YouTube-master, Snappage, full-page-screen-capture-master.
- Nested repos: `WEB SCREEN TIME (LATEST)/Screen_Time_Tracker/website` = Mangesh347/Screen-Time-Tracker- (made private), `video-speed-master/Tempo` = Mangesh347/Tempo (public, Pages).
- Volume-Booster, Youtube-Screenshot, Tempo, Tempo-Controler, Web-Time-Tracker stay PUBLIC (GitHub Pages). Volume-Booster repo stays PUBLIC on purpose: GitHub Pages hosts its privacy page.
- Push with gh credentials inline: `git -c credential.https://github.com.helper= -c "credential.https://github.com.helper=!gh auth git-credential" push` (gh at `%LOCALAPPDATA%\gh-cli\bin`); the global credential manager holds a different account (shreyaahiremath).
- `Extension/.env.example` on disk holds REAL live keys — never stage it.
- User plans one Gmail + Vercel + Supabase account per extension (chosen deliberately); see [[feedback-version-and-push]].
