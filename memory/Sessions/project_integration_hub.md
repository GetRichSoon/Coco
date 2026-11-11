---
name: project-integration-hub
description: "2026-11-11 COCO integration hub + cloud portability - 0041 portable vault, provider registry, gated switch workflow; branches, tests, what waits for the founder"
metadata:
  node_type: memory
  type: project
  originSessionId: a4503653-a1ce-4894-9850-f2f9d7768cc3
  modified: 2026-11-11T08:14:51.255Z
---

Founder directive 2026-11-11: COCO is the permanent control/integration system; cloud providers are interchangeable; a provider change = controlled migration, never reconnecting YouTube/Gumroad/Canva.

Built (LOCAL commits only, nothing applied live):
- CocoMaison `org/unified` 1e578d7 (worktree C:\Users\Lenovo\org-unified): migration 0041_integration_hub (+down that refuses to drop a non-empty vault); scripts/ops/provider-switch.mjs (manifests rows+sha256, parent-first copy, storage copy with sha256, rehearse), vault-migrate.mjs (Supabase Vault -> portable vault, keygen), hub-fixtures.mjs; tests integration-hub 13/13, provider-switch drill 9/9; docs/CLOUD_PORTABILITY.md (procedures + remaining Supabase couplings).
- Coco `org/unified-ui` e69db7c (worktree C:\Users\Lenovo\coco-cloud-ui, sparse Lounge + Lounge Android/app/src/main/java): Lounge/api/_vault.js (AES-256-GCM in Nova, name as AAD, COCO_VAULT_KEYS/KEY_ID/BACKEND, default backend 'supabase' = unchanged prod), _publish.js company().secret/client through the vault, _nova.js allow-lists, index.html Integrations page sections + Settings link, Android Connections/Cloud providers (compiled offline OK, no APK built). Tests vault 7/7, hub render 6/6.
- Existing pieces reused, not duplicated: integrations/integration_links (0011), integration_accounts (0014), integration_health (0035), access broker (_broker.js), publishing layer.

Waits for founder YES: apply 0041 live (needs verified backup), vault keys in Vercel + COCO_VAULT_BACKEND=coco, legacy vault copy (needs Supabase DB password once), any cut-over, custom domain for OAuth callbacks (callbacks still on Supabase Edge Functions).
Coco log entries for this are parked in nova-hq/os/state/local/coco-pending/ (Coco Cloud 402 egress restriction); send with `node scripts/coco_log.mjs <file>` when it lifts.

**Why:** founder wants providers swappable without rebuilding Good Space. **How to apply:** extend these tables/modules; never add a second registry; never read a credential outside Nova's vault. Related [[neon-b2-target-architecture]], [[project-supabase-egress-restriction]], [[project-nova-control-api]].
