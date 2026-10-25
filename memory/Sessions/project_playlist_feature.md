---
name: playlist-feature
description: "Founder's daily YouTube playlist on the laptop (Brave YouTube app): files, scheduled tasks, bedtime reminder, how to change the playlist quickly."
metadata:
  node_type: memory
  type: project
  originSessionId: eae988a0-dd5e-57ea-bace-9851f07a5d7f
  modified: 2026-10-07T23:57:48.549Z
---

Daily YouTube playlist, played in the Brave YouTube app (not Nova Chrome). Full screen on every video.

**Where it lives**
- `os/state/local/playlist.json`: the items (`at`: now / 06:00 / 07:00, `query`), `keep_old_playlist`, `bedtime_reminder` (22:00), `volume_percent` (50), `fullscreen` (true).
- `scripts/yt-app-play.ps1 -At HH:MM`: reads the item for that time, brings the Brave YouTube window forward, searches with "/", clicks the first result at (720,400), presses F for fullscreen. Logs to `os/state/local/yt-app-play.log`.
- `scripts/yt-bedtime-reminder.ps1`: shows a balloon at 22:00 asking to change the playlist or keep the old one. Logs to `os/state/local/bedtime-reminder.log`.
- Scheduled tasks (Windows Task Scheduler, daily): "Nova YT 06 Tarak Mantra" (06:00), "Nova YT 07 Kanada Pandharichi" (07:00), "Nova Bedtime Playlist Reminder" (22:00). WakeToRun on. The old "Nova YouTube 6AM" Chrome task is disabled.

**Why:** Founder wants the songs in the YouTube app, fullscreen, with YouTube autoplay in between, and wants to be asked before bed whether to change the playlist.

**How to apply:** To change the playlist, edit `playlist.json` (fast, no tokens). Do not change the schedule or the scripts without a clear ask. The founder is asleep at night: do not raise permission prompts; handle issues and log them. Known weak points: the first-result click at (720,400) is blind (a Short or Mix could be picked), and the Brave YouTube window must stay open.

**2026-10-09 (founder):** the playlist now ROTATES daily (scripts/playlist-rotate.mjs, tasks NovaPlaylistRotateMorning 05:50 and NovaPlaylistRotateNight 21:30 rewrite os/state/local/playlist.json): 06:00 and 07:00 = devotional songs of different gods (Ganpati, Shiv, Ram, Krishna, Hanuman, Devi...), famous top-viewed; night = random Bollywood or Hollywood hits 2014-2018. Edit the pools inside that script, not playlist.json (it is overwritten daily).

**2026-10-14 (founder):** new morning plan + WEEKLY playlist. 05:00 and 06:00 = popular morning songs of two different gods each day (Swami Samarth Tarak Mantra, Ganpati Bappa morning aarti, Maa Durga, Shiv ji stuti, Vitthal morning songs), filling 5 to 7 AM. 07:00 onwards = English morning songs, weighted to The Weeknd (the English artist in yt-history.md). Every Monday a new song set is drawn (3 per god, 7 English, 7 night); days inside the week are random; playlist.json "week" shows the set. New task "Nova YT 05 God Songs" (05:00, wake on); NovaPlaylistRotateMorning moved 05:50 -> 04:50. Edit pools in scripts/playlist-rotate.mjs (GODS, ENGLISH_MORNING, NIGHT).

**2026-10-14 player fix (founder: "stop what is running and play what we set from 5"):** scripts/yt-app-play.ps1 no longer clicks screen positions (that failed on 10-09 and 10-13: night video kept playing). It looks up the first real video, ends Brave when only YouTube app windows are open, and restarts the YouTube app (Profile 15, app-id agimnkijcaahngcdmfeangaknmldooml) at watch?v=ID&list=RDID with play-while-hidden flags. One window only. F only if the window is really in front. Verified 2026-10-14 03:48 (audio peak 0.39, fullscreen). Another session had deleted this script around 00:35; restored.

**2026-10-14 06:00 outage + permanent fix (founder: "save this, it should work correctly from tomorrow"):** 05:00 and 06:00 failed (task result 0xFFFD0000 = script file missing). Cause: commit 269aa27 (03:49) recorded yt-app-play.ps1 as DELETED, and the file vanishes from disk shortly after each run (not after sitting idle; no session command deleted it; 360 Total Security behaviour monitor is the likely cause, not proven). Fix: restored the fixed player from session 8647bed8's transcript and committed it (d2198e3); window wait 30 s -> 90 s (cold Brave start took >30 s, logged false BLOCKED); new launcher scripts/yt-slot-run.ps1 restores the player from git if missing, logs RESTORED and adds an ALERTS line; tasks 05/06/07 now run the launcher; .githooks/pre-commit blocks commits that delete playlist scripts (override NOVA_ALLOW_DELETE=1). Open: founder may add C:\Users\Lenovo\nova-hq\scripts to the 360 Total Security trust list to stop the deletions at the source.
