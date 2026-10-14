# Coco Cloud

The live, private board of Good Space for all four devices. Supabase (free plan), project **Good Space**,
region Mumbai (ap-south-1), project id `bfnhnkxvppqmklfpslfm`. Opened 2026-10-15.

## What lives there
| Table | What |
|---|---|
| founders | who may log in (Mangesh now; Shreya's email to add) |
| houses, platforms, categories, offerings | the company: 4 Houses, 6 platforms, 39 categories, 57 channels and products |
| members, member_houses, tools, member_tools | the Bonbon Club: 10 members, 54 tools, who uses what |
| tasks, task_notes | the live board; one device per task (claim_task), duplicate check (similar_open_tasks) |
| approvals, decisions | founder YES/NO and every decision (12 approvals, 43 decisions) |
| devices | the four owner devices and when each was last seen |
| rules | Company Structure, Toolkit, Token Treasury, Quality Promise, Privacy, Devices |
| activity | who did what, from which device |

## Privacy: four devices only
- Every table needs a founder login AND one of the 4 paired device keys (header `x-device-key`; only the hash is stored).
- Max 4 active devices: one PC and one phone per founder; a 5th is refused.
- New device: one-time pairing code (10 minutes) from a trusted device, then `pair_device`. Lost device: set `active = false`.
- Live updates use the `pulse` table (no data); devices refetch with their key.
- First pairing codes are created by Coco from the PC (admin) because no device has a key yet.
- Security advisor: clean except `pair_device` (intended).

## Not in the cloud (on purpose)
Blender, Ollama local AI and other installed programs run on the PCs; the tools table records where.
Keys stay in Coco Vault (later Bitwarden / cloud secret settings).

## Next
1. Add Shreya's email as a founder and register her PC and phone.
2. Coco app on phones (Vercel, free) with founder login.
3. Coco Core on each PC as a background worker that claims tasks and runs Claude headless.
