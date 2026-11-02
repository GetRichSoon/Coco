---
name: lounge-egress-fix
description: Root cause of the Supabase egress blow-up (Lounge realtime subscribe-fail-reconnect loop reading all 31 tables every 2 s) fixed 2026-11-02 in Good Space\Coco Lounge/index.html on branch cloud-foundation; after-measurement pending the 402 restriction lifting
metadata:
  type: project
---

The Supabase egress (18.1 GB of 5 GB) came from Lounge Desktop: `connectLive()` in Good Space\Coco\Lounge\index.html subscribed to realtime changes on houses, activity and agent_messages, which are not in the `supabase_realtime` publication (only approvals, devices, pulse, task_notes, tasks are). The join was acknowledged (SUBSCRIBED → loadAll(), 31 queries, and tries = 0), then failed (CHANNEL_ERROR → reconnect after 2 s). Measured: 59,439 requests/hour, 1,783 full reads/hour from one desktop.

**Why:** Boss ordered the root-cause fix on 2026-11-02; fixed with three edits (published tables only; subscribe reads hot slices unless the 60 s net is due; backoff resets after 60 s of stable link; approvals poll every 15 s only while the link is down). Commit on the Coco repo branch cloud-foundation; test Lounge/live-loop.test.js.

**How to apply:** Test A/B (desktop closed vs open for 10 min, compare edge-log requests) could not run while Supabase answers 402; run it once the restriction lifts: expect ~50 requests/min per desktop (12 commands polls, 31-query full read once a minute, slices) versus 991/min before. Remaining lever: FULL_EVERY (60 s net, pinned by refresh.test.js) once all five unpulsed tables pulse. See [[supabase-egress-restriction]], [[supabase-neon-routing]].
