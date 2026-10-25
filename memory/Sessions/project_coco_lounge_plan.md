---
name: project-coco-lounge-plan
description: Coco Lounge roadmap (2026-10-15) - tonight's phone APK list, PC app updates done/next, cloud pieces; plan file in Good Space\Coco\Lounge\Coco Lounge Plan.md
metadata:
  type: project
---
Boss wants all 4 devices always connected and controllable from each other by voice in any language (Hindi/English/Marathi), multi-step (WhatsApp message, notepad + type, find a file on the laptop and send it to the phone, and vice versa).
Plan file (keep updated): `Good Space\Coco\Lounge\Coco Lounge Plan.md`.
- Tonight's APK batch (Boss said build APK only tonight, not before): foreground service always connected, Flow update notifications (Alerts.kt done, unbuilt), new PC command words in PhoneRemote.understand, any-language mic via coco-chat, device-to-device files, WhatsApp prefilled message.
- PC app: update any time (done 2026-10-15: type, keys, screenshot, speak, close, fun corner, update notifications).
- Needs from Boss: Gemini API key into Supabase secrets (GEMINI_API_KEY).
Related: [[project-coco-remote]], [[feedback-cloud-first]].

**2026-10-21:** Big upgrade plan v3 written in the plan file (all 4 devices, live data, command bar brain, Coco Save, habits, control v2). Boss gave YES to auto-update and to building. Coco Cloud (Supabase bfnhnkxvppqmklfpslfm) is owned by mangesh.lokade.dev@gmail.com. APK 2.2.0 (Updater.kt, silent self-update via private bucket `apk` + latest.json) is built with JDK at ~/.nova-tools/jdk-17.0.20.1+1 (set JAVA_HOME). Publish: `node "Lounge Android/publish-update.mjs"` needs `Coco Vault\Coco Keys\Coco Cloud Service Key.txt`. Supabase MCP execute_sql is auto-declined in this setup; Boss runs SQL in the dashboard. Gemini key file exists in the vault (Gemini API Key.txt).
