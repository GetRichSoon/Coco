---
name: youtube-the-flow-team
description: "YouTube team (The Flow channel) and Extension team are separate, Nova manages both; daily Short, performance tracking loop, weekly cadence; set 2026-10-09"
metadata:
  node_type: memory
  type: project
  originSessionId: eae988a0-dd5e-57ea-bace-9851f07a5d7f
  modified: 2026-10-08T19:45:07.834Z
---

Channel "The Flow – Daily Science" is connected (creds in C:\Users\Lenovo\.nova-secrets\youtube.env, laptop only). First Short published 2026-10-09: https://youtube.com/shorts/lXw1F8FpLCA ("Why your phone charges slow after 80%").

**Rules from the founder (Mangesh):**
- Everything in The Flow format, fully original, nothing copyrighted (art drawn in code, Windows TTS voice, synthesised music). Kurzgesagt = style reference only.
- YouTube team and Extension team are separate; Nova manages both properly and checks every day.
- 1 Short per day (trending science topic, thumbnail/title/description/tags A to Z), 1 long video per week. Extension team: ideas all week, shortlist Friday, publish ONE extension per week after the founder finalises.
- Track every posted video (views, likes, comments, which topics work, what is trending) and make more videos like the winners. Nova monitors it all and gives a daily report from every team. `scripts/yt-track.mjs`, `company/youtube/PERFORMANCE.md`.
- "I am sleeping, do not ask permission, everything is allowed, Nova handles it": proceed on the stated tasks without asking. Still never spend money, delete the founder's files, or message non-family.

**Why:** founder wants a hands-off channel that learns from its audience.

**How to apply:** daily Short run = `yt-track` -> pick topic (trending + close to a winner, never repeat) -> new episode script in studio/the-flow/episodes -> render/QA -> `node scripts/yt-local.mjs upload ...` then `public <id>` -> update performance and daily status. Known gaps: custom thumbnails fail (403) until the channel is phone-verified; Chrome Web Store needs a one-time Google login (refresh token); Analytics (audience country, retention) needs another scope. Never run probe uploads: a resumable-upload init creates a stray "probe" video on the channel. See [[feedback-do-more-than-asked]].

**Publishing rule (2026-10-09):** every publish (YouTube Shorts and long videos, Chrome Web Store) runs on the Laptop Terminal only, where the credentials live. Cloud never publishes: it only sends the command, and the command must reach Terminal 1. If the laptop is off, the command waits and runs when it is back.

**Motion standard (2026-10-09):** every video must be as high on motion graphics and animation as possible so viewers like it: parallax particles, floating glows, camera push-in, iris/slide transitions, word-by-word kinetic captions, pulses, speed lines, in every frame. Toolkit: studio/the-flow/motion.py and stack.py (build_frame_fn). Known bug to fix: motion.camera() crop box can go negative; clamp cx/cy to [cw/2, W-cw/2] and [ch/2, H-ch/2].

**Quality v2 (2026-10-09, founder feedback):** (1) voice was irritating -> Piper neural voice (studio/the-flow/voices, LJSpeech public-domain data), softened mix; (2) captions were hidden by the Shorts Subscribe/channel UI -> safe zone y 230-1330, x < 930, captions at lib.CAPTION_Y=1215, bottom 25% empty; (3) every video: smoother, 60 fps, more motion and text animation (stack.build_frame_fn); (4) references = the two YT-team videos kai_orbi_theme_60fps_4k.mp4 and habit_tired_4k.mp4 (company/youtube/refs). (5) Model rule: make the video on Opus, then Sonnet 5.5 low for upload/reports; a session cannot switch its own model, so the daily routine uses an Opus subagent. YouTube team lead = video-producer agent; Nova monitors. Full spec: company/youtube/QUALITY_V2.md. I cannot hear audio: voice quality is the founder's call.

**RULE 0 (2026-10-09, founder):** upload ONLY videos made like the two reference videos (Kai & Orbi / habit_tired style, cairo renderers in studio/kai-orbi and studio/faceless/habit-tired), NOT abstract diagram videos like Short 001. meta.json style must be "kai-orbi" or "habit-beats"; Nova's daily report flags anything else (it already flags 001). Video made by Opus 5.5 medium (subagent), then Sonnet 5.5 low for upload/reports. Renderer proven on this PC: pycairo installed, ffmpeg.exe copied beside render.py, Piper voice, `SCALE=1 python render.py` -> 1080x1920 60 fps in ~75 s; captions at CAP_Y=1215; old scenes need Kai moved up/smaller so he does not hit the caption. Short 001 is still live on the channel and is off-reference: ask the founder before replacing it.

**Later 2026-10-09 (founder):** (a) New videos EXACTLY like the references, only improved: more amazing graphics and a better voice than the references. (b) Captions = the references' own animation (words light up one by one), NO box/pill/new style; only moved to CAP_Y=1215 (founder confirmed the position). My PIL "kinetic caption" stack is NOT the standard. (c) ALL YouTube work from any session (terminal or cloud) is saved under the YouTube team (company/youtube, content, studio; shown in the Nova desktop app) and goes through the **YT Brain**: scripts/yt-brain.mjs (facts yt:* and events yt.* in the Nova Brain DB, snapshot company/youtube/BRAIN.md, cloud sessions use `send` -> company/youtube/inbox/, the Laptop Terminal runs `inbox`). Run `node scripts/yt-brain.mjs inbox` at the start of any YouTube task. Cloud to PC sync of BRAIN.md needs a push of company/youtube to main (not done; founder go needed).

**FINAL OVERRIDE (2026-10-09, founder):** the y=1215 caption position / safe zone / CAP_Y is CANCELLED. Videos are exactly like the two reference videos AS THEY ARE: same pattern, layout, caption look and position. ADD NOTHING NEW (no new caption style, boxes, overlays, PIL motion stack). Only allowed changes: much higher-quality animation, interesting stories, backgrounds that change beat to beat (like habit_tired), better voice. I reverted my edit to studio/faceless/habit-tired/render.py. One risk I flagged: the Shorts UI can cover the reference caption position; it is the founder's call.

**Team brains (2026-10-09, founder):** only the YouTube team and the Extension team exist now (social media paused). Each has its own brain, children of the Nova Brain: `node scripts/yt-brain.mjs` and `node scripts/ext-brain.mjs` (core scripts/team-brain.mjs; facts yt:*/ext:*, events yt.*/ext.*, snapshots company/youtube/BRAIN.md and company/extensions/BRAIN.md, inbox dirs). All sessions save team work in the team brain. Cloud sessions never work or publish: they run `send <type> "<text>"` and the Laptop Terminal acts (Nova daily status processes both inboxes). The Extension team publishes from the Terminal exactly like the YouTube team. Old cloud routines (created via http_api) cannot be edited by me; rules live in CLAUDE.md. Desktop app has sections "YouTube team" and "Extension team".
