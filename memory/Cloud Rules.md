# Good Space rules (from Coco Cloud, kept current by Coco Lounge)

## Company Structure
Coco manages Good Space. Houses (main teams): Gigi content (YouTube 14 categories, Instagram, Facebook), Lulu products (Chrome extensions, Android apps, websites; 10 categories), Fifi downloads (8 categories, each tied to a Gigi channel), Zaza games (Roblox first, 7 categories). Platforms are shared by every House: YouTube, Play Store, Chrome Web Store, Roblox, Website, Instagram/Facebook. Every idea goes to 3+ platforms. Bonbon Club (support): Think = Lola, Lili; Make = Remy, Vivi, Margot, Cleo; Care = Elise, Kiki, Didi, Bibi. Shared Shelf: 80% own work, 20% helping the others. Only 2-3 Houses active. Terminals: 1 Coco, 2 Make, 3 Gigi studio on each PC. Full text: GetRichSoon/Coco teams/Company Structure.md

## Bonbon Club Toolkit
Every tool belongs to one Bonbon Club member; the Houses judge the results and use the Design Atelier. Free tools and free plans only; nothing paid without a founder YES. Every product keeps a Licence Log that Elise checks. The full tool list with status lives in the tools and member_tools tables. Full text: GetRichSoon/Coco teams/Bonbon Club Toolkit.md

## Token Treasury
Plan: Claude Pro now (1 cycle a day, max 4 tasks, no Opus); Claude Max in a few days (founder says 5x or 20x, then plan-set). Models: free local AI (Qwen 3 8B, Gemma 3 4B) for rough internal work; Haiku for Lola, Lili, Kiki, Didi, Bibi; Sonnet for Vivi, Remy, Margot, Cleo, Elise; Opus only for hard work. 70/20/10 pools, small exact tasks, reuse before redo, no task more than 3 times a day, stop at 3x usual tokens, Bibi weekly token report. Full text: GetRichSoon/Coco teams/Token Treasury.md

## Quality Promise
Everything a user gets is high quality. User-facing work is made with Claude and passes Elise's gate: it works (really tested), looks like Good Space, is correct, is ours (Licence Log), is useful, follows platform rules, and has a founder YES before anything public, paid or deleted. Local or cheap AI never sends work to users as is. Full text: GetRichSoon/Coco teams/Quality Promise.md

## Privacy
Only the two founders can log in. Each device has its own PIN and can be switched off. Personal documents (Aadhaar, PAN, bank) never go to any cloud AI. Keys only in Coco Vault, Bitwarden or cloud secret settings, never in git, the database or chat. Every action records who did it and from which device.

## One brain, four devices
Mangesh PC, Mangesh phone, Shreya PC, Shreya phone are all owner devices with the same access. A task is claimed by one device only (claim_task). Before adding a task Coco checks similar_open_tasks and asks: add to the running task or stop it. Thinking work runs in Claude's cloud; heavy work on whichever PC is on; if both PCs are off the task shows "waiting for a PC".
