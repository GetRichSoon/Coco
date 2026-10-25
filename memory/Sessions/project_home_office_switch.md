---
name: home-office-switch-v2
description: "Home/Office Mode v4 BUILT 2026-10-22 in office-mode.exe: verified saves, home=Brave YouTube, office=Chrome dev Calendar+Teams+Cursor, Close All button on PC+APK."
metadata:
  node_type: memory
  type: project
  originSessionId: 5c4d9b4e-a663-4256-b1a0-2ec912acc008
  modified: 2026-10-21T22:16:43.796Z
---

v4 built 2026-10-22 (nova-hq e816529, Coco 998cd91). Founder rules (2026-10-22):
- Switch (Wi-Fi place != last-place.txt): save old place, verify by reading back (previous kept as <place>-session.bak.json); save fails -> nothing changes. The old place is NOT closed any more (founder 2026-10-22 later): it stays in the background; home works on desktop 1, office on desktop 2 (created if missing). Saved sessions are NOT reopened automatically; only via Restore buttons.
- Home start: Brave Profile 15 on YouTube + the VS Code home-mode window (Claude Code). No Cursor/Chrome/Teams.
- Office start: Chrome Profile 65 (mangesh.lokade.dev@gmail.com) on https://calendar.google.com/calendar/u/0/r, Teams (ms-teams.exe), Cursor. No PowerShell desktop 2 any more. Coco and Claude terminals 1,2,3 stay running; the VS Code home-mode window is never closed.
- Office Wi-Fi = any SSID/profile containing assetcues or assetqs (no spaces/case); home = saved profile name. Config in os/state/local/places.json.
- Triggers: logon, unlock, and task "Nova Office Mode on WiFi" (NetworkProfile event 10000). Same place -> nothing (no duplicates).
- Commands: office-mode.exe --close-all | --save-session | --restore home|office | --switch home|office. Remote action `workspace {op}` in Coco Lounge (main.js), card "Home & Office" in Lounge/index.html and APK Screens.kt (2.7.0, Releases\Coco Lounge 2.7.apk). DB constraint commands_action_check now allows 'workspace'.
- Coco Lounge must always be connected: Startup\Coco Lounge.vbs + task "Coco Lounge Keepalive" (5 min) run Lounge Desktop\Coco Lounge Keepalive.vbs.

**Why:** founder 2026-10-22 prompt "Smart Home Mode, Office Mode & Session Control".

**How to apply:** build scripts/build-office-mode.cmd. APK build needs JAVA_HOME=C:\Users\Lenovo\.nova-tools\jdk-17.0.20.1+1. Starting Electron from Claude's shell needs `env -u ELECTRON_RUN_AS_NODE`. Not yet seen live: real office Wi-Fi switch, real Close All, sleep/wake. Related: [[playlist-feature]], [[project-coco-remote]].
