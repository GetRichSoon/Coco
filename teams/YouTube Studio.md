# 🎬 YouTube Studio

Coco's YouTube team. Channels: The Flow (live) plus the other channels in the YouTube page. Shorts post on their own (A-006); long videos need a YES. Videos follow `nova-hq/company/youtube/QUALITY_V2.md`.

---
_Playbook brought over from Nova:_

# YouTube team (separate from the Extension team)

Two teams, two jobs. They share nothing except Nova's daily report and the original-content rules. Different backlogs, different automations, different approvals.

| | YouTube team | Extension team |
|---|---|---|
| Goal | Grow "The Flow – Daily Science" (views, subscribers, watch time) | Ship one good Chrome extension a week |
| Cadence | 1 Short every day, 1 long video every week | Ideas Mon to Thu, shortlist Friday, 1 release per week |
| Files | `company/youtube/`, `content/`, `studio/the-flow/` | `company/EXTENSION-TEAM.md`, `company/BACKLOG.md`, extension repos |
| Credentials | `~/.nova-secrets/youtube.env` | `~/.nova-secrets/chrome-store.env` |
| Publishing | Shorts: no YES (A-006). Long video: YES per video | YES per release, after the founder says it is final |
| Automations | `youtube-daily`, `flow-long-weekly` | `extension-ideas-weekly`, `extension-weekly-release` |

Nova is the manager of both: checks every connection, runs the daily status, collects each team's line for the founder's daily report, and never lets one team's work leak into the other's backlog.

## The performance loop (YouTube team)
1. Every day `scripts/yt-track.mjs` reads every public video: views, likes, comments, views per day, like rate. Output: `company/youtube/PERFORMANCE.md` and `os/state/local/yt-performance.json`.
2. It also lists what is trending today (YouTube India, Science & Technology).
3. The scout picks the next topic: **trending today AND close to a winner** (same topic family, same simple-metaphor style, a new fact). Never repeat a video.
4. After publishing, the next morning's check records how the Short did. Winners get more videos like them; flops teach what to drop.
5. Nova reports the numbers in the daily status ("YouTube team: ... views ... best ...").

Not tracked yet: audience country and age, and retention (where people stop watching). That needs the YouTube Analytics permission (one more Google login by the founder).

## Originality rule
Everything is made here: art drawn in code, Windows text-to-speech voice, synthesised music. No stock footage, no copied scripts, art, characters or music, no reuploads. Style reference is inspiration only. Facts are checked and sources noted, so there is nothing to claim.

## Team lead and model rule
- **YouTube team lead:** the `video-producer` agent. It leads production and signs the pre-publish checklist (company/youtube/QUALITY_V2.md); `release-qa` verifies as a different agent. Nova monitors the lead's work and reports it daily.
- **Models:** the video is made on Opus; once it is done, work returns to Sonnet 5.5 at low effort (upload, tracking, reports). The daily routine does this by handing the video work to an Opus subagent.
- **Publishing:** only from the Laptop Terminal.

## YT Brain (the team's own brain)
`node scripts/yt-brain.mjs status | sync | inbox | event | fact | send`. Facts `yt:*` and events `yt.*` live in the Nova Brain database; `company/youtube/BRAIN.md` is the snapshot every session can read; `company/youtube/inbox/` is how a cloud session sends the team a command. Every session, any terminal or cloud, saves YouTube work under this team, never in a private chat. Nova (parent Brain) and the YT Brain stay in sync through `sync`.

