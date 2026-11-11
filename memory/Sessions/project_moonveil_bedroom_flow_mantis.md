---
name: project-moonveil-bedroom-flow-mantis
description: "2026-11-06 jobs in flight: Moonveil 3 h \"Deep Sleep\" bedroom video (no rain) and The Flow 7-8 min mantis shrimp long video via Opus agent; Boss said upload directly public"
metadata:
  node_type: memory
  type: project
  originSessionId: 4f9aea26-8f89-413c-9287-9413add140f3
  modified: 2026-11-06T06:42:22.868Z
---

Two jobs started 2026-11-06 (Boss: "upload directly", public).

**Moonveil Audio, video 007 "Deep Sleep · 3 Hours"**
- Engine reused: `studio/moonveil/longform.py` (new `--rain=0` flag, seed 7, 3 h non-repeating) → `out_bedroom/audio3h.m4a`; `loop.py` new variant `bedroom` (image `assets/bedroom_night.png` = Boss's ChatGPT bedroom photo) + `motion.py` GEOMETRY `bedroom` → `out_bedroom/loop.mp4` (128 s seamless).
- Thumbnail done: `out_bedroom/thumb.jpg` (thumbtext.py, "DEEP SLEEP / 3 HOURS").
- Metadata: `company/youtube/channels/moonveil_audio/007_deep_sleep_bedroom/metadata.json` (public).
- Remaining: mux 85 loops trimmed to exactly 10800 s with audio3h → `out_bedroom/full.mp4`, `verify.py out_bedroom/full.mp4 --loops=85`, then `publish.py --meta=... --video=... --thumb=...` (publish.py checks the channel is Moonveil and the >15 min feature; Moonveil token `~/.nova-secrets/youtube-moonveil-audio.env`).

**The Flow, long video "mantis shrimp"**
- Opus subagent building `studio/the-flow/long_mantis/` (render.py, mp4 1080p60, thumbnail, meta.json, QA.md). Boss's bar: full-body Kai with face, animal characters, depth, transitions, no top-view shapes. Publish via the Flow's own flow after Boss sees QA.

**Why:** Boss ordered both after Penthouse went live. **How to apply:** finish these before new builds; see [[project-penthouse-video-001]].

**Moonveil 007 LIVE 2026-11-06 13:43:** https://www.youtube.com/watch?v=rKq5l4-UgmE public, 3:00:00 exact (verify.py got a `--seconds=` option for trimmed builds). Audio = 2:50 main (seed 7, OOM crash at 2.83 h) + 11 min tail (seed 11) crossfaded 8 s. Flow mantis video: v1 rendered 7:06; sent back for af_bella voice + slug "animals" + robot-beat fix; upload pending.

**Flow mantis LIVE 2026-11-06 14:20:** https://youtu.be/tNbX-iIn8jc public 7:22, af_bella, category 28. The Flow login: all old youtube.env tokens returned 400 (dead); new token file `~/.nova-secrets/youtube-the-flow.env` (channel "The Flow · Daily Science"). Open: nobody listened to the audio; Kai has a female voice.
