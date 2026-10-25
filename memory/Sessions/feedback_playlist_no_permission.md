---
name: playlist-no-permission
description: "For the daily YouTube playlist, act without asking per step; keep songs playing until the founder ends it. Fast runbook for the Brave YouTube app."
metadata:
  node_type: memory
  type: feedback
  originSessionId: eae988a0-dd5e-57ea-bace-9851f07a5d7f
  modified: 2026-10-08T04:33:20.823Z
---

For all YouTube work (playlist, ad-hoc songs, searches, fullscreen, volume, sequences), do not ask permission at all. Run the steps directly and keep songs playing until the founder ends it. Only the CLAUDE.md approval gate still applies (delete, spend, publish, message a non-family person).

**Why:** The founder said (2026-10-08): "For yt done ask any permision from now." The founder is often asleep or away, and each permission prompt blocks the song.

**Permission rules:** `nova-hq/.claude/settings.local.json` allows the YT scripts (`yt-*.ps1`), `YtApp`/Brave window calls, and the playlist-related Node scripts, so Claude should not prompt for them.

**How to apply (fast path, no re-discovery):**
1. Check the playlist: read `os/state/local/playlist.json`. Change it only if the founder asks.
2. Play a slot now: `powershell -File scripts/yt-app-play.ps1 -At <HH:MM>` (or the item's `at` value). It searches in the Brave YouTube window, clicks the first result at (720,400), and presses F for fullscreen. Log: `os/state/local/yt-app-play.log`.
3. Confirm with one screenshot (Brave window title and progress bar), not repeated polling.
4. Keep the scheduled tasks ("Nova YT 06 Tarak Mantra", "Nova YT 07 Kanada Pandharichi", "Nova Bedtime Playlist Reminder") as they are. Don't change them without a clear ask.
5. Do not close the Brave YouTube window or stop playback unless the founder asks. Do not reopen the app unless the founder says "open yt".

**Known limits:** the first-result click is blind (a Short or Mix could be picked); the window must stay open; the laptop must stay on.

Related: [[playlist-feature]], [[fullscreen-playback]].

**Bug fixed 2026-10-08:** the 06:00 and 07:00 tasks ran but exited with code 1 before logging. Cause: `"$At:"` inside a double-quoted string is parsed as a drive-qualified variable, so the script failed to parse. Use `${At}`. Test a script change with `-At 99:99` and check that `yt-app-play.log` gets a BLOCKED line.

**Chrome:** the Kanada song in the founder's normal Chrome (default profile) is NOT Nova's window. Never close the founder's default Chrome profile; only close Nova's own profile (`os/state/local/youtube-profile`) if one exists. The founder wants songs in the Brave YouTube app only.
