# Nova release process

Nova is `Lounge/api/*` in this repository, deployed by the Vercel project `cocolounge` (team `orbi10`, Hobby plan, region bom1).

## The rule

Production changes **only** by promoting a reviewed preview deployment, after the founder's YES.

1. Work lands on a branch (for this release candidate: `nova/rc-2026-11`) and a PR into the current production line (`ops/nova-2026-11-12`), never into `main`.
2. Vercel builds a **preview** for the branch. Whatever deployment protection the project has stays on.
3. The PR is reviewed: tests green (`npm test` in `Lounge/`, from an LF checkout), the diff read, and the pre-deploy checklist below done.
4. The founder says YES in writing.
5. The owner promotes **that exact preview deployment** to production (Vercel dashboard: the deployment, then "Promote to Production"). Production is never pointed at a branch, and no protection is turned off to make it happen.
6. Rollback: promote the previous production deployment again (Instant Rollback).

Pushes to `main` can never build production: `vercel.json` sets `git.deploymentEnabled.main = false` (previews of other branches are unaffected).

## Database login (Supabase removal plan, step 4)

Nova has no Supabase role, schema, REST, Storage or Edge Function in its server code.

- `DATABASE_URL` is the Neon pooled connection string of the LOGIN role **`nova_app`** (CocoMaison migration `0043_nova_roles`). The account owner sets its password and the variable; it is never in git.
- Every request statement runs inside `runAs()` as **`coco_member`** (`SET LOCAL ROLE coco_member`), with the founder's claims in `request.jwt.claims` (read by `private.claims()`) and the device header in `request.headers`.
- The vault runs as **`coco_vault`**, only through the portable vault (`COCO_VAULT_BACKEND=coco`, `COCO_VAULT_KEYS`, `COCO_VAULT_KEY_ID`, CocoMaison migration 0041). Without it every vault route answers `503 VAULT_NOT_CONFIGURED` ("vault not configured"); nothing falls back to Supabase Vault.
- The job door and worker tokens read **`NOVA_ENGINE_KEY`** (16+ characters). Without it they answer 503.

## Pre-deploy checklist (owner, before the YES)

- [ ] Neon: the verified legacy load, then 0034-0037 and **0043_nova_roles** applied on the database production will use (founder YES per `docs/NEON_CUTOVER.md` in CocoMaison). 0043 must not raise.
- [ ] Neon: `nova_app` password set by the owner (Neon console or `ALTER ROLE`), outside git; BYPASSRLS on `nova_app` confirmed (0043 warns if the owner could not grant it).
- [ ] Vercel production env: `DATABASE_URL` = Neon pooled URL of `nova_app` (set by the owner).
- [ ] Vercel production env: `NOVA_ENGINE_KEY` set, and its sha256 row active in `engine_keys` on Neon (the old engine key row switched off).
- [ ] Vault: 0041 applied on Neon and `COCO_VAULT_BACKEND=coco`, `COCO_VAULT_KEYS`, `COCO_VAULT_KEY_ID` set, or accept that OAuth, publishing tokens, connect/check, revenue sync and the AI door answer "vault not configured" until it is.
- [ ] Vercel Usage page checked (Hobby limits: function invocations, duration, Runtime Cache) before and the day after.
- [ ] On the promoted deployment: `/api/health` shows `db: ok`; `/api/awake` answers without a key; one paired device reads `/api/me` and a table; one cloud-worker cycle.

## Still on Supabase outside Nova's server (plan step 8, client side)

- `index.html`: the supabase-js script and client, Supabase Auth session calls (`sb.auth.*`), the realtime channel, and sign-in through the `device-recover` Edge Function. Nova already serves the replacement: `POST /rest/v1/rpc/pair_device` (a pairing or recovery code plus a device key the app generates).
- Android `Cloud.kt` / `Updater.kt`, desktop and PC tools: the same items on their side.
- `control-plane.js` / `control-plane.json`: documentation strings naming the old secrets.
