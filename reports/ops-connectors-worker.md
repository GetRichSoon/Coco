# Connectors and worker: findings (2026-11-12)

Written by the CONNECTORS and WORKER agent. Everything here was checked against the real systems with read-only access (GitHub runs, the
production database through read-only SQL, the web). Nothing was created, changed or run in production. No secret value appears in this file;
secrets are named only. No real task title or id is quoted.

## 1. What was added

| File | What it is |
|---|---|
| `Lounge/api/_conn_gumroad.js` | Gumroad connector: `fetchGumroadSales`, `toRevenueRows`, `verifyGumroad` (pure, injectable fetch) |
| `Lounge/api/_conn_picktheory.js` | PickTheory facts, setup steps, and a check of a Google token against the channel list |
| `Lounge/conn.gumroad.test.js` | 28 tests (mocked fetch) |
| `Lounge/conn.picktheory.test.js` | 8 tests (mocked fetch) |
| `Lounge/conn.enqueue.test.js` | 14 tests: the proposed SQL below, run on real Postgres in process (PGlite) |
| `reports/ops-proposed-migration-task-enqueue.sql` | PROPOSED additive migration, not applied |
| `.github/workflows/device-sync.yml` | edited locally, not pushed |

Test totals: 50 passed, 0 failed. Existing tests that could be affected still pass with the new files in the tree: `ops.test.js` 10,
`syntax.test.js` 7, `nova.publish.test.js` 13, and BACKEND's `connect.test.js` 33 (it was mid-edit, with 15 failures that were about its own
routes, when I first ran it; it passed in full on my last run). I also drove my modules through BACKEND's real `PROVIDERS.gumroad.check` and
`.rows` to prove the contract holds (section 2.4).

## 2. Gumroad

### 2.1 What the module relies on (read from Gumroad's own source, 2026-11-12)

Gumroad's API is open source (github.com/antiwork/gumroad). The published docs page is rendered by JavaScript, so I read the code that
produces it and the code that serves the API:

- `GET https://api.gumroad.com/v2/sales` (`app/controllers/api/v2/sales_controller.rb`, docs in `ApiDocumentation/Endpoints/Sales.tsx`):
  scope `view_sales` (Gumroad also accepts its broad `account` scope); `after` / `before` are `YYYY-MM-DD` (`created_at >= after`,
  `created_at < before`); `page_key` is the previous answer's `next_page_key`; 10 sales a page, newest first; `next_page_key` and
  `next_page_url` appear only when another page exists (`base_controller.rb`); the old `page` parameter is deprecated.
- The sale object (`app/models/purchase.rb`, `as_json(version: 2)`): `price` is `price_cents`, which is USD cents whatever currency the
  product is listed in. `currency` (lower case) is the LISTING currency. `refunded`, `partially_refunded`, `chargedback`, `disputed`,
  `dispute_won` are flags. For a partial refund only `amount_refundable_in_currency` (a decimal string in the listing currency) says what
  is left; there is no refund amount and no refund date in the API.
- `GET /v2/user`: name, `id` / `user_id`, `url`, `email` (the email needs `view_sales`).
- Errors: 401 token invalid, revoked or expired; 403 scope missing (Doorkeeper answers with a status and an empty body); 400 is
  `{status, error}`; HTTP 200 with `{success:false, message}` is a refusal. There is no documented rate limit; the module honours a 429
  `Retry-After` anyway. The `/earnings` endpoint is annual, US-sellers only and needs a tax scope, so it is not used.
- The Nova OAuth scope for Gumroad was `edit_products view_profile` (no `view_sales`). BACKEND has already changed it to
  `edit_products view_profile view_sales`; a Gumroad connection made before that change has no sales permission until it is reconnected.

### 2.2 Contract (exact)

```js
fetchGumroadSales(accessToken, { after, before, page_key, maxPages = 500, retries = 3, sleep, timeoutMs, api } = {}, fetchImpl = fetch)
  -> { ok: true,  sales, pages, truncated, next_page_key, error: null, code: null }
   | { ok: false, code, error, status? , retry_after_s? }      // code: revoked | missing_scope | rate_limited | bad_request | unavailable | bad_response | refused
toRevenueRows(sales, { connection_id, house_id })
  -> [{ source:'gumroad', connection_id, house_id, product_id, occurred_at (ISO), amount, currency:'USD', kind:'sale'|'refund', external_id, meta }]
verifyGumroad(accessToken, fetchImpl = fetch, { retries, sleep, timeoutMs, api, now } = {})
  -> { ok: true,  external_id, external_name, external_handle, account_label, scopes, can_read_sales, missing_scopes, warning, error: null, code }
   | { ok: false, code, error }
```

- `after` / `before` accept `YYYY-MM-DD`, a `Date` or an ISO timestamp (BACKEND passes an ISO time); anything else, including `10/11/2026`
  and a calendar day that does not exist, is refused before any request.
- Zero sales is `ok: true` with `sales: []`. That is a real, verified zero.
- A failure is NEVER readable as an empty list: reading `.sales` on an `ok:false` result throws (the property is non-enumerable, so it also
  vanishes from JSON). So a caller that forgets to check `ok` stops with the reason instead of recording a zero. A bad page discards the
  pages before it (all or nothing); the caller must not move its sync mark on `ok:false`.
- `truncated: true` means 500 pages (5,000 sales) were read; pass `{ page_key: next_page_key }` to resume.
- Retries: network errors and 500/502/503/504 back off 0.5 s then 1 s; 429 waits for `Retry-After` (up to 30 s, otherwise it is reported as
  `rate_limited` with `retry_after_s`); three attempts in all.
- `verifyGumroad` makes two reads: `/v2/user` (who) and `/v2/sales?after=<tomorrow>` (returns nothing, but proves `view_sales`).
  `scopes` lists only what was proven. A token that works but cannot read sales is `ok: true`, `can_read_sales: false`,
  `missing_scopes: ['view_sales']`, `code: 'missing_scope'`, with a plain `warning` (this is the "partial, no view_sales" state).
  If the probe itself cannot complete, `can_read_sales` is `null` and the token is not condemned.
- The token travels only in the `Authorization: Bearer` header (never a URL), the same as the publisher already does; every error text is
  passed through the shared `redact()`.

### 2.3 Money rules (the part that is easy to get wrong)

- Every amount is USD. Gumroad's `price` is USD cents even for a product listed in rupees, so a rupee listing is NOT an INR row. The
  listing currency, the shown price (`formatted_display_price`) and the fee are kept in `meta`. A revenue screen that wants rupees needs a
  dated exchange rate; it must not relabel these amounts as INR. Zero is zero in any currency.
- Cents are integers divided by 100 once (`1999` becomes `19.99`; ten sales of `$0.10` add to `$1.00` exactly).
- `amount` is never negative; `kind` says which way the money went. This matches BACKEND's ledger (`amount >= 0` check and
  `coco_revenue_upsert`, and `fold()` = sales minus refunds). The brief said "negative-kind rows"; I read that as kind `refund`.
- One refund row per sale at most, id `<sale id>:refund`, holding what has been given back so far (a later, bigger refund updates the same
  row). A full refund and a chargeback (`chargedback` true, i.e. not reversed) give back the whole price once, even if both flags are set;
  a won dispute gives back nothing. A partial refund is exact for a USD listing (price minus `amount_refundable_in_currency`) and for any
  other listing currency the amount is unknown, so the row has amount 0 and `meta.refund_amount_unknown: true` instead of a guess.
- shortcut: Gumroad does not say when a refund happened, so a refund row is dated with its sale (net revenue by sale date).
- Refunds change old sales, so an incremental sync needs overlap. BACKEND re-reads from `last_ok_at` minus 2 days, which misses a refund
  of an older sale; about 35 days of lookback (or an occasional full sync with `after` omitted) would catch the usual refund window.
- `meta` is built from an allow-list (product name and permalink, order number, quantity, listing currency and price, fee, recurring, paid,
  and for a refund the reason). No buyer email, name, address, card, licence key or id can reach a row; a test plants all of them and proves it.

### 2.4 Contract with BACKEND's routes (checked)

`Lounge/api/_connect.js` calls `verifyGumroad(secret, f, opts)` and `fetchGumroadSales(secret, { after, ...opts }, f)` and throws on
`!r.ok`. I ran its real `PROVIDERS.gumroad.check` and `.rows` against my module with mocked answers: a live token is `CONNECTED_VERIFIED`,
a token without sales permission is `CONNECTED_MISSING_PERMISSION`, a revoked token is `CONNECTED_EXPIRED`, and a revoked or under-scoped
token makes `rows` throw with the connector's own words. `conn.gumroad.test.js` test 28 also runs my rows through BACKEND's `normalise()` and
`fold()` when that file is present and gets the right net number.

### 2.5 What the founder must do for Gumroad

1. The old token in `integrations.gumroad-poppy` was printed into a public GitHub Actions log on 2026-10-28. Gumroad has no revoke API and
   hands the same token back until the application is revoked by hand. In Gumroad (Settings, Advanced, Applications; the exact label may
   differ) revoke the Coco application's access, then press Reconnect in COCO. Nothing in the code can do this step.
2. Reconnect so the new token carries `view_sales`. Until then the Revenue "Sync now" answers "approve view sales" instead of a number.
3. Decide how rupees should be shown (section 2.3): per-currency totals, or a rate source for an approximate INR line.

## 3. PickTheory

### 3.1 What it is

PickTheory is not a service with an API key. In the company's own data it is a YouTube channel that does not exist yet:

- `integration_accounts` row `yt-app-web`: provider `youtube`, external name "PickTheory", state `not_connected`, its authorization recorded as
  a file path on a PC (so no cloud run could ever use it), no channel id.
- `offerings` row "PickTheory": House Gigi, kind `channel`, platform `youtube`, status "not in final list (founder to decide)", not connected.
- `company/youtube/categories/app-web` (CocoMaison): the App / Web / Product category. Name ideas PickTheory, ClickTheory, DigitalScout;
  "Final name of the first channel: not chosen yet"; "Channel created on YouTube" is unticked. All Coco channels are brand channels under
  one Google account (your YouTube Google account).
- picktheory.com on the web is an unrelated lifestyle and product review site: no login, no API, no store. There is nothing to paste a key into.

### 3.2 The connection that works

The same Google sign-in every YouTube channel uses, for connection `yt-app-web` (already supported by `api/_oauth.js`):

1. The founder creates the channel on YouTube while signed in as the Google account above (youtube.com/channel_switcher), a new brand
   channel for App / Web / Product, with whatever name is chosen.
2. In COCO: Connections, PickTheory, Connect. This is `POST /api/oauth/begin { provider: 'youtube', connection_id: 'yt-app-web' }`; the
   browser opens `authorize_url`; on Google's chooser pick the new brand channel (not the account) and approve everything.
3. Check now (`POST /api/oauth/verify { connection_id: 'yt-app-web' }`, or `/api/connect/check`) confirms the channel from the cloud; then
   assign it to a team, or nothing publishes with it.

Already true and not a blocker: the Google OAuth app is "In production" (recorded 2026-11-03) and the client is in the vault. Refused by
design: connecting a channel whose id is already bound to another connection, or rebinding a connection to a different channel.

### 3.3 What can and cannot be automated

- Automated: the whole connect and check once the channel exists; identity and the name check; YouTube views and subscribers
  (`yt_stats`, already collected daily).
- Not automatable: creating the channel (needs the Google account, a person); choosing its name; the channel chooser on Google's screen.
- Revenue: there is none. YouTube pays through AdSense, and the documented API (YouTube Analytics `reports.query`, metric
  `estimatedRevenue`, optional `currency` such as INR) needs the `yt-analytics-monetary.readonly` permission, which COCO does not request
  (it asks for `youtube` and `yt-analytics.readonly`), and answers 403 for a channel outside the YouTube Partner Program. So
  `fetchPickTheoryRevenue` is deliberately NOT exported; `api/_connect.js` already treats its absence as "no revenue feed", never a zero.
  If revenue is wanted later it is a founder decision (adding a monetary permission means every channel reconnects, and Google may then
  require app verification for that sensitive scope).

### 3.4 Module contract (exact)

```js
PICKTHEORY        // frozen facts: connection_id 'yt-app-web', provider 'youtube', house_id 'gigi', connect / verify routes and bodies, name ideas
PICKTHEORY_STEPS  // frozen list of the three steps above, for the screen next to Connect
verifyPickTheory(secret, fetchImpl = fetch, { api } = {})
  -> { ok:true, denied:false, account:{id,name}, external_id, external_name, external_handle, name_matches, detail, error:null }
   | { ok:false, denied, status, error, detail }   // status: USE_GOOGLE_SIGN_IN | EXPIRED | QUOTA | NO_CHANNEL | BAD_RESPONSE | UNREACHABLE | ERROR
```

`secret` must be a short-lived Google access token (`ya29.…`, minted from the stored refresh token as `_oauth.js` does). A pasted key of any
other shape is turned away with the way to connect and is never transmitted. A channel whose title is not "PickTheory" is information
(`name_matches: false`), not a failure, because the final name is the founder's choice. A 403 for quota is not a bad token.
BACKEND had already reached the same conclusion in `_connect.js` (`USE_GOOGLE_SIGN_IN`); the migration `20261112b` that removes the
`picktheory_api_key_` vault name is consistent with this.

## 4. The worker, and why "run a task" does nothing yet

### 4.1 What is really failing, workflow by workflow

| Workflow (repo) | State | Real cause |
|---|---|---|
| cloud worker (CocoMaison) | RUNNING: 24 of 24 runs succeeded, last 2026-11-11 22:47 UTC; `QUEUE_ENABLED=true` | It claims nothing because nothing is queued: queue status `done 57, blocked 1`. It is paired as `cloud-worker-1`. |
| cloud cycle (CocoMaison) | RUNNING: 18 of 18 succeeded, last (manual) 2026-11-12 05:39 | Works, but the work it is given fails at the AI gate (4.3). |
| device sync (Coco, main) | FAILING every run since it landed (e.g. 43130284178) | Neither `NOVA_DEVICE_KEY` nor `NOVA_ENGINE_KEY` exists as a secret in GetRichSoon/Coco (it has only the Android, storage and a Supabase service-key secret), so `Cloud/Device Sync.mjs` prints "Set NOVA_DEVICE_KEY ... Nothing was called." and exits 2. Also migration 0037 (`device_sync_audit`) is not applied in production, so `--apply` could not keep its state. |
| youtube publish (CocoMaison) | 2 of 2 failed (2026-11-09, run 42612695989) | Not a publishing failure: its live security test (`scripts/youtube-connect.test.mjs`, run against Nova) has 10 failing checks. Nine are old-gateway expectations that Nova answers differently and safely (401 "no device key"; 404 for `coco_callback_secret` and `coco_publish_secret`, which Nova deliberately does not expose). One is real: the database function `coco_oauth_begin` is still on Nova's RPC list, and the cloud engine key gets a 200 with a connection state, so a worker could open a YouTube connection (the new `/api/oauth/begin` refuses workers). BACKEND should take `coco_oauth_begin` off `RPCS` once `/api/oauth/begin` is deployed. |
| youtube produce (CocoMaison) | 10 of 19 failed, last 2026-11-12 06:08 on a feature branch | Another session's work in progress; not diagnosed here. |
| company run (CocoMaison) | 0 successes, 7 failures | A legacy workflow that exists only on the `cloud/durable-queue` branch, not on main. Ignore. |
| gumroad daily 9/9, queue proof 15/15, android build and ota | healthy | n/a |

GitHub schedules are late and sometimes dropped: the "every 4 hours" worker actually ran every 6 to 10 hours on 10-11 November, and the
twice-daily cycle ran around 09:30 and 20:30 UTC instead of 02:15 and 13:15.

### 4.2 Why COCO shows the cloud worker "offline since 2026-11-02"

`devices.cloud-worker-1.last_seen` is 2026-11-02 12:59 UTC, the day it was paired. `scripts/nova-worker.mjs ensure` only calls
`pair_cloud_worker` (which sets `last_seen = now()`) when the device is NOT yet paired; once `/api/me` answers it prints "paired" and exits,
so a healthy run never refreshes the row. And today's screens call a device online only when `last_seen` is under 150 seconds old
(`index.html`, `_chat.js`), which a job that runs for 15 seconds a few times a day can never satisfy. Two fixes, both needed:
(1) the worker must beat (patches in 4.5); (2) the screens must judge a cloud device by its schedule: for a device with `info.cloud = true`,
online means `last_seen` within 12 hours, and the screen should say "last run 3 h ago", not "offline".

### 4.3 How a task becomes work today

There are three separate paths. None of them is connected to the Start button.

A. AI team work: task, run request, workflow (what exists today).
`tasks` row (needs `cloud`) -> `scripts/task-intake.mjs` (inside the cloud cycle, 2 times a day) -> `coco_request_run(<team>-pick, 'coco-task:<id> ...')`
-> a `run_requests` row, state `pending` -> `scripts/run-requests.mjs` in the same cycle claims it and runs the team workflow through the
executor -> `settle()` writes the task: `failed` with the reason, or `verifying` ("finished, a founder must check it"). Gates, all real:
- The intake takes only the founder's allow-list, `INTAKE_TASKS` in `cloud-cycle.yml`, which holds ONE id (the standing daily task, "yt and
  ebook task only", Boss 2026-11-02). Every other queued task is counted as backlog and left alone: the cycle on 2026-11-12 reported "10
  older queued task(s) were left alone". So pressing Start on an ordinary queued task changes nothing by design.
- The intake needs `needs = 'cloud'` and, to know the team, a first details line `Team: youtube` (or words like "youtube" in the text);
  otherwise it marks the task `blocked: no team could be told`. `submit_task` defaults `needs` to `any`, which the intake ignores. A YouTube
  task must also name its channel in the text (today only "The Flow" is mapped, in `taskInput`); a task for another channel is refused by the gateway.
- Every `<team>-pick` workflow ends in exactly one model step (`decide`), the only AI call; the other steps are deterministic. Today that step
  is refused: the 8 run requests in production failed for these reasons, in order: company-wide stop (3 times: two proofs and one test), team
  paused, Anthropic key needed a workspace header, Anthropic credit balance too low (twice), and on 2026-11-12 "this month would pass the
  agent monthly limit (344313+1000 > 300000, set on agent youtube.marquee)". The agent policies now also say `claude: denied` for
  `youtube.marquee` (set 2026-11-12 06:21, after that run) and `claude: blocked` for `ebooks.ebooks-head`. The company stop is lifted and
  team youtube is not paused. Two refusals that appeared in those reasons are already fixed on CocoMaison main by PR 28 (merged 06:32 UTC,
  after the 05:39 cycle): "a YouTube decision must name a channel_id" (the intake now passes `the-flow` when the task names The Flow) and
  the gateway's 24-hour repeat refusal for the standing daily task (`allow_repeat`); the same PR makes an unset `INTAKE_TASKS` take nothing.
- `coco_request_run` allows one pending or claimed request per workflow at a time ("already waiting to run").
- A founder cannot cancel a pending request (`run_requests` is read-only for founders), and `run-requests.mjs` never looks at the task's
  status, so a task stopped on screen still runs at the next cycle. The proposed `coco_run_request_cancel` fixes that.

B. The durable queue (no AI): `coco_job_submit` -> `jobs` -> the worker claims -> handler -> `coco_job_done`.
`coco_job_submit`, `coco_job_claim`, `coco_job_done` and the others are engine-key only (`private.engine_ok()`); a founder's device can only
read `jobs` and call `coco_job_cancel` (and, once BACKEND's migration lands, `coco_job_retry`). So the only thing that creates jobs is the
company's own scripts (pipelines). The worker runs only when its workflow runs (every 4 h nominal, 6 to 10 h in practice) and has 13 handlers.
The 58 jobs in production are all from the 2026-11-01 and 2026-11-02 proofs: 57 done, 1 blocked (type `teleport`, which has no handler;
it is a proof leftover that a founder can simply Cancel).

C. Inside Nova, immediately (no worker): OAuth verify, Check now, and BACKEND's Sync now run synchronously in a Nova request. These are
the only things that "run now" without waiting for GitHub.

### 4.4 What is missing for Start / Run to cause real execution

1. Nothing links a task to a job or a request. The proposed migration adds the job door and the link back (4.5).
2. The allow-list means ordinary tasks are never picked up. A founder's own Start press is itself the authorisation, so the Start button
   should create the request itself instead of waiting to be listed (sequence below). Widening `INTAKE_TASKS` for unattended pickup is a
   founder decision and is NOT proposed here.
3. Latency: 2 cycles a day, or the next worker run. There is no on-demand trigger. Polling more often costs Actions minutes (the free
   plan has 2,000 a month and November was running at about 2,300); the clean fix is an event: after a Start, Nova dispatches the
   workflow. That needs a GitHub token in Nova (below). Until then the screen must say "waiting for the next cloud run", never "running".
4. AI gate (4.3): until the agent policies and the Anthropic account allow it, an AI team task fails at once with a clear reason, which
   `settle()` writes to the task. That is honest, but it is a failure the founder will see.
5. Status vocabulary: the intake and `settle()` use `working`, `verifying` and `blocked`, which are valid (the table allows `planned, queued,
   working, need_approval, blocked, failed, verifying, done, paused, cancelled, running, waiting_pc, needs_yes, stopped`). The task screens
   must treat `working` as running, `verifying` as "finished, needs a check" and `blocked` as needs attention.
6. `submit_task` merges a new task into an open one with a similar title (similarity 0.45 or more, same House) and returns
   `{merged: true}`: no new task is made and a note is added to the old one. The Create form must handle that answer. Testers: two
   "[COCO TEST]" titles in one House will merge into each other; use distinct wording, and a table insert (not `submit_task`) avoids it.

What the app can already do TODAY with no backend change, for an AI team task (all calls through Nova, all already on its RPC list):

1. Create: `submit_task` with `p_needs: 'cloud'`, the House, and a first details line `Team: <team>` (House to team: gigi youtube, lulu
   software, poppy ebooks, fifi courses, zaza games, mochi comics, tilly commerce).
2. Start: `coco_request_run(p_workflow: '<team>-pick', p_note: 'coco-task:<task id> · <title, 160 chars>')`; the note prefix must be exactly
   `coco-task:` plus the id, it is how the cycle finds the task. If it answers `ok:false`, show its `reason` (company stopped, workflow off,
   already waiting). If `ok:true`, set the task `queued` with the result "Waiting for the next cloud run (request #N)".
3. Progress: read `run_requests?note=like.coco-task:<id>%25` (state, reason, run_id) and the task row; show the state as it is.
4. Cancel: set the task `stopped` and call the proposed `coco_run_request_cancel(request id)`; without it the request still runs.

### 4.5 Fixes

Made locally in this repository (not pushed): `.github/workflows/device-sync.yml`.
- One secret is enough: `NOVA_ENGINE_KEY` (or `SUPABASE_ENGINE_KEY`). The cloud worker's device key is derived from it with the same
  HMAC that `scripts/lib/cloud-creds.mjs` uses (checked: identical output), masked, never stored twice. `NOVA_DEVICE_KEY` still wins if set.
- With neither secret the run ends green with a visible warning and a step summary that names the missing secret, instead of failing red
  every 15 minutes. Nothing is called. Once the secret exists it runs for real (a dry run, until the variable `DEVICE_SYNC_APPLY` is `true`).
- Validated: the YAML parses; the shell logic was run for all three secret combinations; the derivation matches CocoMaison's function.

Proposed for CocoMaison (a different repository; I did not edit its working tree, which other sessions have open):

```diff
--- a/scripts/nova-worker.mjs
+++ b/scripts/nova-worker.mjs
-if (me.ok) { console.log(JSON.stringify({ paired: true, ...(await me.json()) })); process.exit(0); }
+if (me.ok) {
+  // already paired: pair_cloud_worker with the same key only refreshes devices.last_seen, which is what Coco shows as "last seen"
+  const beat = await fetch(`${novaUrl()}/rest/v1/rpc/pair_cloud_worker`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-engine-key': engine }, body: JSON.stringify({ p_device_id: id, p_device_key: key }) });
+  console.log(JSON.stringify({ paired: true, seen: beat.ok, ...(await me.json()) })); process.exit(0);
+}
```
```diff
--- a/.github/workflows/cloud-cycle.yml      (after "uses: actions/setup-node@v4" in the cycle job)
+      - name: this runtime is a Nova device, and is seen
+        run: node scripts/nova-worker.mjs ensure
```

Proposed migration: `reports/ops-proposed-migration-task-enqueue.sql` (additive; rollback notes are inside it; tested on real Postgres in
process, not against production, and not applied):
- `coco_task_enqueue(p_task, p_job_type, p_team, p_payload)`: a founder on a paired device creates one queued job for a task. Only five
  zero-AI job types that take plain data and run no command and publish nothing: `filter-rank, package-research, search-memory,
  validate-output, title-analytics`. `claude_budget` is forced to 0. One job per (task, type): pressing Start twice returns the same job; a
  failed or cancelled job is put back, not duplicated. The task becomes `queued` with "Waiting for a worker: cloud job X".
- Trigger `jobs_task_sync`: when a job that carries `payload.coco_task_id` changes status, the task follows (running, done with evidence,
  failed with the job's error, cancelled becomes stopped, blocked, back to queued). It moves only a task that is still queued or running,
  so a stopped task is never revived, and a failure inside it never blocks a worker.
- `coco_run_request_cancel(p_id)`: cancel a run request that has not started.
- Wiring left to BACKEND: add both RPC names to `RPCS` in `api/_nova.js`; the UI finds a task's jobs with
  `jobs?idempotency_key=like.coco-task:<task id>:%25`.
- Not included on purpose: `build-artifact`, `check-artifact`, `pack-extension` take command-line arguments from the payload, and
  `publish-extension` publishes; they stay pipeline-only.

### 4.6 Work that can run with NO Claude or other AI spend

- All 13 job handlers in `os/cloud/jobs` declare `ai_required: false` and `claude_call_target: 0`, and every job's `claude_budget`
  defaults to 0 (an over-budget model call is a permanent failure, so a loop cannot spend). With credentials or a gate: `store-artifact`
  (storage keys, already set), `store-result` (engine key), `title-analytics` (read-only YouTube or Gumroad analytics), `publish-extension`
  (Chrome Web Store keys AND a founder YES; it publishes).
- Whole workflows with no model step: `ebook-build`, `ebook-aswb-clinical` (brain, build, check, analytics, record) and `extension-release`
  (needs a founder YES before it publishes). Every `<team>-pick` workflow has exactly one model step; the other four are deterministic, so
  a "package only" variant that stops before `decide` and hands the ranked package to a founder would need no AI (a CocoMaison change,
  not proposed here).
- Inside Nova, instantly: Gumroad Sync now, Check now, OAuth verify, YouTube stats reads.
- Gemini is a separate free-tier door (`/api/ai/generate`, enabled by policy `gemini_generate = true`, 40 calls a day) that the team
  workflows do not use today; the pipeline `model` steps call Anthropic.

### 4.7 What the founder must do, honestly

Secrets and settings (names only; values must be entered by the founder, I changed none):
- GetRichSoon/Coco, repository secret `NOVA_ENGINE_KEY`: the same value as CocoMaison's `SUPABASE_ENGINE_KEY`. Optional variable
  `DEVICE_SYNC_APPLY=true`, only after migration 0037 (`device_sync_audit`) is applied.
- For an on-demand run after Start (optional, recommended): a GitHub fine-grained token with Actions write on CocoMaison, entered in
  Vercel for the Nova project as an environment variable (suggested name `GITHUB_DISPATCH_TOKEN`), then BACKEND adds the dispatch after a
  Start. Without it, Start waits for the next scheduled run.
- Gumroad: revoke the leaked application access by hand and reconnect (2.5).
- PickTheory: create the YouTube channel, choose its name, then Connect (3.2).

Decisions (policy, no money): raise or reset the monthly token limit of agent `youtube.marquee` (300,000, used 344,313) and decide whether
Claude stays `denied` for it and `blocked` for `ebooks.ebooks-head`; whether the intake allow-list stays at one task; apply 0037 and the
proposed migration (each needs a founder YES; the production rule is additive migrations only).

Money and quota (nothing here was done): the Anthropic account was out of credit on 2026-11-03 and has not been exercised since; if
Claude is wanted for AI team tasks it needs credit and `ANTHROPIC_API_KEY` plus `ANTHROPIC_WORKSPACE_ID` (both secrets exist in
CocoMaison). GitHub Actions free minutes (2,000 a month, November at about 2,300) are the reason polling every few minutes is not proposed.
The Supabase gateway 402 (egress quota, until about 2026-11-14) does not affect the cloud runtime, which reaches the database through Nova.

## 5. Verification and limits

- Tests: `node conn.gumroad.test.js` 28 passed; `node conn.picktheory.test.js` 8 passed; `node conn.enqueue.test.js` 14 passed.
  `node conn*.test.js` also matches the older `connections.test.js` and BACKEND's `connect.test.js`, so run them one by one.
  They are not yet in `Lounge/package.json`'s `test` script.
- `conn.enqueue.test.js` reads `../reports/ops-proposed-migration-task-enqueue.sql` and skips (exit 0) if it is not there; point it at the
  migration's final path if BACKEND moves it.
- Production: read-only SQL and read-only GETs only (database, GitHub run logs, Nova `/api/health`). I created nothing, so there is nothing to
  clean up. Nothing was pushed, committed, deployed or applied.
- Not checked: the migration against the real production database (only a production-shaped stand-in); the Gumroad API against a real
  token (there is no usable token: the connected one is the leaked one); the Anthropic account balance; GitHub Actions billing (no scope).
- Sources: Gumroad source files named in 2.1; Google's YouTube Analytics `reports.query` reference and channel reports page (scopes,
  `currency`, 403 for non-monetised channels); the CocoMaison workflows and scripts at `origin/main` 0db608a, re-read at 40da81a (only `task-intake.mjs` changed, PR 28); run logs 43130284178
  (Coco device sync), 43114707490 (cloud worker), 43162801829 (cloud cycle), 42612695989 (youtube publish).
