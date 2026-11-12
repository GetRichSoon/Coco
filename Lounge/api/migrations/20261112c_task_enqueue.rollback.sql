-- Rollback for 20261112c_task_enqueue.sql. Run in this order. Jobs and tasks already created stay as history; none of them is deleted.
drop trigger if exists jobs_task_sync on public.jobs;
drop function if exists public.jobs_sync_task();
drop function if exists public.coco_task_enqueue(uuid, text, text, jsonb);
drop function if exists public.coco_run_request_cancel(bigint);
