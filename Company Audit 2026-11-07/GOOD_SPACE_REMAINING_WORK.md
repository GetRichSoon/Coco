# GOOD SPACE: Remaining Work (from the 2026-11-07 audit)

Nothing here has been started. Items marked FOUNDER need a login, approval, payment or personal decision that Claude cannot make. Owner key: F = founder, C = Claude or a session can do it after approval, A = automation already exists.
Statuses: COMPLETED, WORKING, PARTIALLY COMPLETED, NOT STARTED, BLOCKED, NEEDS VERIFICATION.
Nothing is listed as missing if the audit found it exists.

## A. Urgent safety (days)
| # | Item | Status | Owner | Evidence |
|---|---|---|---|---|
| A1 | C: drive has 2.5 GB free (474 GB used). Big folders: Videos 29.5 GB, Projects 24.4 GB, Good Space 24.0 GB, nova-hq 14.5 GB, Downloads 5.0 GB | BLOCKED risk | F approves, C lists exact files first | PC inventory 2026-11-07 |
| A2 | G: (Google Drive) not mounted, nightly Supabase backup to Drive fails | BLOCKED | F | Coco Cloud Backup task result 1 |
| A3 | Rotate leaked Gumroad token (leaked in Actions run 40706424460, 2026-10-28); reconnect with view_sales (A-023) | BLOCKED | F | STATUS, APPROVALS |
| A4 | Rotate QuickCast service_role key (in history of PUBLIC Coco repo, commit 3ee62e0); decide to make Coco private again | BLOCKED | F | memory project_coco_repo_public_gate |
| A5 | Rotate leaked YouTube refresh token (A-031) | BLOCKED | F | APPROVALS |
| A6 | Check whether Supabase Good Space is still HTTP 402 (egress) and decide plan | NEEDS VERIFICATION | F decides, C checks | SUPABASE-402.md |
| A7 | Uncommitted work at risk: Moonveil scripts/PLAN.json/006/007, Penthouse folder, Flow brain files, company-registry fix in a dev worktree | PARTIALLY COMPLETED | C (commit needs approval; do not touch others' files) | git status |

## B. YouTube
| # | Item | Status | Owner |
|---|---|---|---|
| B1 | Reconnect 12 dead channel logins: `node scripts/yt-local.mjs connect <slug>` for BodyDecode, PastWoven, DreamFrame, QuiteMindFiles, MindSpark, SuccessHasal, UntoldUniverse, UnveilAI, TasteOdessey, SanatanEchoes, Streebellion, Kahani Ghar TV | BLOCKED | F |
| B2 | Create channels human-info and app-web | NOT STARTED | F |
| B3 | Add Penthouse Frequency to channels.json and the Coco registry | NOT STARTED | C |
| B4 | Restore The Flow cadence (gap since 11-02); decide the production path (cloud produce failed 4 of 5; old PC tasks status unknown) | PARTIALLY COMPLETED | F decides, C builds |
| B5 | Add subscribe line / conversion test (1.5 subs per 1,000 views) | NOT STARTED | C |
| B6 | Moonveil 006 "Built For More" package, Penthouse video 2, Kahani Ghar ep1, mantis long audio check (Kai voice) | PARTIALLY COMPLETED | F reviews, C finishes |
| B7 | File YouTube API quota extension request before many-channel daily uploads | NEEDS VERIFICATION | F |
| B8 | Analytics for Moonveil and Penthouse (only The Flow has daily analytics) | NOT STARTED | C |
| B9 | Confirm Penthouse "altered or synthetic content" flag and that CocoFlowMake/CocoFlowPost are disabled | NEEDS VERIFICATION | F/C |
| B10 | Fix cloud youtube-produce and youtube-publish failures; cloud credentials exist for only 2 channels | PARTIALLY COMPLETED | C |

## C. Publishing (The Velvet Foundry)
| # | Item | Status | Owner |
|---|---|---|---|
| C1 | Approve and apply improvements to books 1 to 4: fix AWS accuracy, fix Retake EPUB and thumbnail, move 3 books out of category "Other", better covers (3 concepts each prepared) | PARTIALLY COMPLETED (prepared, not applied) | F approves, C applies |
| C2 | Books 5 to 9: upload free samples, add refund policy, finish Q41 to Q100 answers, human edit of manuscripts 02 to 05 | PARTIALLY COMPLETED | C after approval |
| C3 | Teach the Gumroad engine about books 5 to 9 (it tracks only 4) | NOT STARTED | C |
| C4 | Pending approvals: A-032, A-023, A-024, A-025, A-014, A-015; fix stale A-033; fix reused IDs A-023/24/25 | PARTIALLY COMPLETED | F answers, C tidies file |
| C5 | KDP, Google Play Books, Apple Books, Kobo, Payhip: upload packs exist; author name decision; tax and identity | NOT STARTED | F |
| C6 | Connect Gumroad payout method | BLOCKED | F |
| C7 | Traffic: all 19 views are probably the owner's; no outside traffic source exists | NOT STARTED | decision |
| C8 | Tenth manuscript First Apartment Repair Basics: needs pen name | BLOCKED | F |
| C9 | Student Reset workbook: confirm whether it ever went live on lokademan.gumroad.com | NEEDS VERIFICATION | F |

## D. Software and extensions
| # | Item | Status | Owner |
|---|---|---|---|
| D1 | Verify STT 5.7.1 state (portfolio says live, memory says pending) | NEEDS VERIFICATION | C |
| D2 | Orbi: refresh listing text (A-034), fix P1 music play-state bug, get shipping source on GitHub (A-025) | PARTIALLY COMPLETED | F/C |
| D3 | 2-Step Verification for each extension Google account (A-022, A-027) | NEEDS VERIFICATION | F |
| D4 | Typewave, Breakwater, Loudleaf, SpaceGuard, QuickCast, Idea Saver and about 35 older: find store id and review state, decide which have Pro tier and checkout (rule: paid extensions only) | NEEDS VERIFICATION | C |
| D5 | Pro revenue figures from the payment server (Razorpay/PayPal) | NEEDS VERIFICATION | F |
| D6 | Play Console account type and $25 fee for Unfold/Lounge | BLOCKED | F |
| D7 | Vercel plan: Hobby forbids commercial use; decide Pro | NEEDS VERIFICATION | F |
| D8 | Two phones failed the 2.9.2 update | PARTIALLY COMPLETED | F/C |

## E. Houses not started or blocked
| House | Remaining | Status | Owner |
|---|---|---|---|
| Mochi | Big Boss watches ep1 and answers A-013; render eps 2 to 6; accounts | BLOCKED | Big Boss |
| Zaza | Roblox Studio play-test, product IDs, Creator Dashboard login, YES; India payout check | BLOCKED | F |
| Fifi | Lessons beyond the pilot, recording, checkout account, A-015 | BLOCKED | F |
| Tilly | 5 answers from Boss, then niche proof | NOT STARTED | F |
| Gigi social | Decision on Instagram/Facebook (paused by Boss 2026-10-09), Pinterest, X | NOT STARTED | F |
| Juno Jobs | Resume, targets, TPO links | NOT STARTED | F |
| Services, micro-drama | Decide whether to start | NOT STARTED | F |
| Lulu Windows, Web, Samsung, Apple | no product yet | NOT STARTED | F |
| Design guild | brain and references empty | NOT STARTED | C |

## F. Automation and infrastructure
| # | Item | Status | Owner |
|---|---|---|---|
| F1 | Add a non-Claude fallback to scripts/lib/model.mjs (Gemini key present, Ollama not running) | NOT STARTED | C |
| F2 | Fix PC tasks: Cloud Backup, Daily Summary, NovaDailyStatus, watchdogs, playlist slots | BLOCKED | C/F |
| F3 | Prove the cloud replacements for DB backup and daily summary live | PARTIALLY COMPLETED | C |
| F4 | B2 key limited to proof/; no lifecycle rule; verify id proof-mvy3p93o | BLOCKED | F |
| F5 | Apply migrations 0031 (brains store) and 0026 (Neon) only if Boss says yes; 0034 org tables | NOT STARTED | F |
| F6 | Access broker not enforced (0 rows in capability_uses) | NOT STARTED | C |
| F7 | Reconcile the two token ledgers | NEEDS VERIFICATION | C |
| F8 | Decide whether the emergency stop in os/controls.json stays | NEEDS VERIFICATION | F |
| F9 | Move the local nova-hq clone forward (337 commits behind) | NEEDS VERIFICATION | C (clean tree first) |
| F10 | Confirm Claude cloud routines and 30-minute checks are running | NEEDS VERIFICATION | C |
| F11 | Gatekeeper and Ollama state | NEEDS VERIFICATION | C |

## G. Documentation and brains
- Refresh stale docs: HANDOFF.md, TEAMS.md, COORDINATION.md, FACTS.md, company/BRAIN.md, youtube/BRAIN.md, extensions/BRAIN.md, METRICS.md, capabilities.json, the PC folder layout memory.
- Fill the 12 stub BRAIN.md files from real lessons; extend the "note every mistake" rule beyond Extensions and YouTube.
- Settle category counts and the canonical channel list.
- Bonbon Club members without agent files (Lola, Remy, Margot, Cleo, Elise, Kiki, Didi, Bibi): decide to create or retire.
