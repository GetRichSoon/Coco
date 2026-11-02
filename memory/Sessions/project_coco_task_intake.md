---
name: project_coco_task_intake
description: "Cloud cycle runs through Nova + deterministic COCO task intake (2026-11-02); schedule takes ONLY task b50ad5b5 (YT+ebook); blocked by Boss's 2026-10-26 emergency stop in os/controls.json"
metadata:
  node_type: memory
  type: project
  originSessionId: 334a9046-52b7-4446-9c7f-8b8085706a0c
  modified: 2026-11-02T17:38:14.371Z
---

Built 2026-11-02 on Boss's order (CocoMaison cloud-foundation 61761b7..latest, main bridge ab16e7d; Coco Nova 92bb15d + 0741c40). The cloud cycle (main bridge, checks out cloud-foundation, cron 02:15/13:15 UTC) reaches Coco Cloud through Nova (NOVA_DEVICE_ID=cloud-worker-1, key derived from SUPABASE_ENGINE_KEY). Nova now types inserts with jsonb_populate_recordset (text[] upserts) and allows coco_structure_provisioned. scripts/task-intake.mjs: validate (founder name or founder device) -> conditional claim (queued->working) -> team from "Team:" line or words -> coco_request_run of the team's <team>-pick, note "coco-task:<id>" -> task.result/evidence. run-requests.mjs runs it under a root run kind=task task_id=<id>, input {instructions, context=brief under 3600 chars}, then settles the task (working/failed/verifying).

Handoff is lossless since 2026-11-02 (cloud-foundation, after 61761b7): scripts/lib/task-spec.mjs structures a task into R1..Rn (one per line, word for word, fields + one scope youtube/ebooks/publishing/analytics/shared/handoff), the intake stores it in tasks.evidence.spec and records each request's scope; publishing/analytics are HELD on the task (no team workflow); build-package puts the scoped spec first and uncut; dry runs return `planning`. Proof: scripts/task-spec.e2e.test.mjs (real brief fixture, real youtube-pick/ebooks-pick) 40/40; Boss brief 4,593 chars -> 108 requirements, payloads 2,611 (YT) / 2,880 (ebooks) under the 4,000 final_selection cap.

Standing DAILY task (Boss 2026-11-02): 1d702f2c-a4ef-43c2-ad4a-9e221c9e3594 "Daily: The Flow + Gumroad" (status planned, Recurrence: daily, Starts: 2026-11-03). spawnDaily makes one queued "Daily instance of <id> for <date> · Day N" per India day at the first cycle (07:45 IST) - never under the stop; INTAKE_TASKS now = that id (b50ad5b5 left queued as backlog: it orders a Day-1 long video the daily task forbids). Day-1 ebooks payload 3,920 of the 4,000 final_selection cap: if the brief grows it is refused loudly, not cut.

**Why:** Boss wants queued COCO tasks executed by COCO Cloud, Claude Code only builds infra. He said "yt and ebook task only working".

**How to apply:** INTAKE_TASKS in the workflow env = 'b50ad5b5-e8c6-4ac3-96e6-b147fbab6e34' (change only with YES); 9 older queued tasks (Oct 14-25, APK/Shorts) are reported as backlog. Intake skips pushes; manual test = dispatch on main with intake=true only_task=<id> dry_run=true. While os/controls.json has "stopped" (Boss 2026-10-26), intake and run-requests touch nothing; the Boss task runs at the first cycle after a founder lifts it (Coco Chat "resume the company" changes only the DB policy, not that file). See [[project_coco_chat_scopes]], [[nova-control-api]].
