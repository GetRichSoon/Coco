---
name: neon-b2-target-architecture
description: 2026-11-10 founder decision - Neon only (3 projects) + B2 only (3 buckets); Supabase is legacy for one verified migration; current setup state
metadata:
  node_type: memory
  type: project
  originSessionId: a4503653-a1ce-4894-9850-f2f9d7768cc3
  modified: 2026-11-10T13:40:11.031Z
---

Founder decision 2026-11-10: the target is **Neon only** (goodspace-core green-lab-97008479, goodspace-staging shy-bread-57566036, goodspace-dev lingering-rice-73578808; all Singapore, Postgres 18, Free plan, org org-orange-paper-01611391) and **Backblaze B2 only** (buckets goodspace-artifacts, goodspace-media, goodspace-backups, each with its own least-privilege key). Supabase (project bfnhnkxvppqmklfpslfm) is the legacy source for ONE verified migration, then removed; never delete it before verification; no new Supabase project or dependency.

**Why:** founder wants one database provider and one storage provider, no Supabase runtime.

**How to apply:**
- Credentials live only in `~/.nova-secrets/neon-core.env`, `neon-staging.env`, `neon-dev.env` (owner-only ACL, written by `scripts/ops/secret-store.mjs`); never print them.
- State on 2026-11-10: staging queue 9/9 on real Neon; COCO's live security (device keys + RLS + Nova request pattern) 8/8 on Neon dev via `os/cloud/neon/0001_neon_compat.sql`; B2 existing proof/ key 16/16 (GitHub run 42820640644). Branch `org/unified` (CocoMaison) holds it, not pushed.
- Still blocked: B2 three-bucket setup (founder creates one temporary key, `scripts\ops\b2-key-input.ps1 -Name b2-admin`), legacy backup (DB password once + 402 egress until billing day 14), Neon Free compute (~182 CU-h/month needed vs 100: decide polling cut or paid plan).
- Report: `reports/goodspace-final-cloud-setup.md`. Related: [[project-supabase-egress-restriction]], [[project-durable-queue]], [[project-stt-db-move]].
