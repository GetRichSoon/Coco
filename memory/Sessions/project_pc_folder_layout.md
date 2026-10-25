---
name: project-pc-folder-layout
description: "Founder's PC folder layout after 2026-10-14 cleanup (5 main folders, games removed, undo logs)"
metadata:
  node_type: memory
  type: project
  originSessionId: d04bdd3a-42fd-4026-a609-62a9f381ce5d
  modified: 2026-10-14T18:16:20.363Z
---

On 2026-10-14 the PC was cleaned (C: free went 6.5 GB -> ~75 GB) and folders were simplified on the founder's request.

Layout (pinned in Quick access):
- OneDrive\PERSONAL DOC: IDs, Resume (was C:\Resume), Hostel Fees Receipt, Didi's Doc
- OneDrive\College: was "Copy Paste University" (SAP LEARNING is under Fourth Yr\SAP)
- OneDrive\Work: AssetCues, Interpe Internship
- OneDrive\Media: YouTube, Capcut Video, Music
- C:\Users\Lenovo\Projects: all code; "From Downloads" has ~183 code projects pulled out of Downloads; "_old" has old Desktop copies of flutter and ai_forgiveness_recommender

All games were removed on the founder's request (NFS installers, Steam, Minecraft/TLauncher, GameLoop, Solitaire); BlueStacks folder may remain until uninstalled from Settings > Apps.
1487 files were renamed to Title Case without dashes; undo logs: OneDrive\PERSONAL DOC\_renames-2026-10-14.csv and _moves-2026-10-14.txt.
Downloads was sorted the same day: important docs -> PERSONAL DOC\Important From Downloads, own media -> Media\My Photos And Videos, songs -> Media\Music, work sheets -> Work\From Downloads, keys -> PERSONAL DOC\Keys To Move Into Vault; 1199 junk items sent to Recycle Bin.
Founder wants only Cursor, Brave+YouTube, VS Code, Chrome, 360, Teams + Nova's tools; app uninstall and the C:\ root sort were blocked by the permission classifier and are still pending (scripts in that session's scratchpad: apps-admin.ps1, croot.ps1).
2026-10-14 later: company renamed **Good Space**, Nova renamed **Coco** (manager of Good Space). Everything company-related goes in C:\Users\Lenovo\Good Space only: Coco (new app, git repo), Coco HQ (was nova-hq), Coco Vault (all keys; ~\.nova-secrets becomes a junction into Coco Vault\Nova Live Keys), Product Gallery (was Projects), Workbench (worktrees), Safe Keeping (backups). nova-hq/Projects move is done by "Good Space\Move Into Good Space.ps1", run by the founder with VS Code closed; check Safe Keeping\Move Log.txt to see if it ran. Old Pip app (Analaysis- clone) recycled on founder request; the GitHub repo and analaya.vercel.app were not touched.
C:\flutter and the mingw folder in Downloads are on PATH; do not move them.

**Why:** founder wants fewer folders and clean names. **How to apply:** put new files into these 5 folders, follow [[feedback-no-dash-in-names]].
