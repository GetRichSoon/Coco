# Access broker

Before this, any holder of the engine key could ask Nova for any provider's credential (a YouTube job could mint a Gumroad token). The broker makes the credential-bearing routes ask one question first: may THIS job's team use THIS provider, capability and connection?

Code: `api/_broker.js` (decision, recording, mode), `api/_access_policy.js` (the policy, as data). Tests: `nova.broker.test.js`.

## What is checked

1. Device: already verified by Nova's device-key check (`who`).
2. Job identity, read from `public.jobs`, never from the request: the `job_id` must exist, be `running`, and its `lease_owner` must be the caller's device id or the worker label the caller presents (the queue stores the worker label, e.g. `gh-<run>-<pid>`, as the lease owner). The job's own `team_id` and `channel_id` decide the rights; a team name in the request body is ignored.
3. Policy (default deny): team -> providers -> capabilities, plus the connections it may touch. A job with a `channel_id` may use only that channel's connection (the id itself or `yt-<channel_id>`).
4. Environment must be in `policy.environments`.
5. `anthropic` is granted to no team; only server code on the AI gateway path sets `via: 'ai_gateway'`, and no request field can.

Wired into: `/api/publish/token` (token_mint), `/api/publish/stats` (stats), `/api/publish` (publish), `/api/ai/generate` (gemini ai_generate). Not guarded: `/api/ai/gemini/models` (returns no credential), `/api/publish/platforms`.

## Modes

`public.policies` row scope `company`, key `access_broker_mode`, value `"off"`, `"shadow"` or `"enforce"` (also `{"mode": "..."}`).

| Mode | Behaviour |
|---|---|
| absent | `shadow` |
| `off` | nothing checked, nothing recorded |
| `shadow` | every decision is recorded; a would-be denial is recorded as `shadow_deny` and the call proceeds |
| `enforce` | a denial returns 403 `ACCESS_DENIED` with a reason that names no secret; the credential is never read |
| unreadable / unknown value | treated as `enforce` (fail closed) |

In `enforce`, an identity lookup error, a policy error, or a decision that cannot be recorded all deny. In `shadow` a recording failure is logged and the call proceeds.

There is no override parameter. A founder cannot lift a denial through a request; the only ways to change access are a reviewed edit to `_access_policy.js` and the mode row.

## What is recorded

One row per decision in `public.capability_uses` (no schema change needed): `capability_id = access:<provider>.<capability>`, `where_run = cloud`, `run_id` = job id (or `gha-<id>`), `team_id` = the job's team, `ok` = allowed in effect, `note` = JSON `{decision: allow|shadow_deny|deny, mode, reason, provider, capability, connection, env, identity}`. The note passes through the redaction gate first.

## Workflow identity (runs that are not queue jobs)

A GitHub workflow run has no job. It sends `workflow` (file name, e.g. `youtube-publish.yml`) and `run_label` (`gha-<number>`; a `gha-` `run_id` also works). Accepted only when the device is in `policy.workflow_devices` (the paired cloud worker) and the file is mapped in `policy.workflows` to a team; the run then gets that team's rights with no channel narrowing. Limit: the workflow name and run number are self-declared by the cloud worker and not verified against GitHub, so a compromised cloud worker could claim another workflow. Mitigation: only one device may do this, every use is recorded, and the next hardening is a GitHub API check of the run (not built).

## Adding a team or agent

A new team has no rights. Open a pull request adding `teams.<team_id>` in `api/_access_policy.js` (providers, capabilities, and `channels` for publishing providers), add a test case, merge, deploy. Agents inherit their team's rights through the job's `team_id`; an agent not in a listed team gets nothing.

## Rollout

1. Deploy with no policy row (shadow). Nothing existing breaks; callers that send no `job_id` appear as `shadow_deny` ("no job_id or workflow identity").
2. Update the workers/publishers to send `job_id` + `worker` (or `workflow` + `run_label`) on `/api/publish/*` and `/api/ai/generate`.
3. Review `capability_uses` for a week: `select note->>'decision', count(*) from capability_uses where capability_id like 'access:%' group by 1` and read every `shadow_deny`. Fix policy or callers until there are none for legitimate work.
4. Enforce. APPROVAL NEEDED: a founder YES (this changes who can publish and generate in production), then `coco_control('company', null, 'access_broker_mode', '"enforce"')` (or the Coco control). Rollback is the same call with `"shadow"`.

## Known limits

- The worker label is chosen by the worker at claim time and not bound to a device by the database, so the lease check proves "the caller holds this running job's label", not "this device claimed it". Binding it needs a `lease_device` column set by `coco_job_claim` (not built; would be an engine-repo migration).
- Anyone holding a valid engine key and device key plus a live job's id and worker label can act as that job. Job ids are not secret to the engine.
- The vault RPC `coco_publish_secret` is called by Nova after the check; the database still trusts the engine key for it. The broker protects the Nova routes, not a direct database connection with the engine key.
- Policy is code, so it needs a deploy; the `channels` lists are `'*'` per provider for the publishing teams and rely on the job's `channel_id` for narrowing.
- RPC bodies are now redacted by default (`RPC_CREDENTIAL_OK` in `_nova.js` is empty: no Nova-exposed RPC needs a raw credential).
