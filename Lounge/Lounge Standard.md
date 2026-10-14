# Coco Lounge Standard

One app, the same on all four devices (Boss PC, Boss phone, Big Boss PC, Big Boss phone).
Every version (desktop, Android, any future one) follows this page exactly.

## Connection
- One data source: Coco Cloud (Supabase project Good Space). No device keeps its own copy of the truth.
- Every request carries the founder login and that device's key (`x-device-key`).
- Live: listen to the `pulse` table; on any signal refresh within 1 second. Reconnect automatically
  (network back, app back to the front, every 60 seconds heartbeat to `devices.last_seen`).
- New tasks only through `submit_task` (Coco merges the same work). Merges by meaning through `merge_task`.
- Rules come only from the `rules` table and apply to every device and every Coco worker at once.

## Screens, in this order
| # | Screen | Icon (Material Symbols Rounded) | What it shows |
|---|---|---|---|
| 1 | Home | home | greeting, YES count, running tasks, Houses, devices online, latest activity |
| 2 | Board | view_kanban | give Coco a task; open and finished tasks; who gave it, where it runs, notes |
| 3 | Approvals | verified | waiting first with YES / No; decided with who decided |
| 4 | Company | apartment | each House: categories and channels/products; Decisions tab |
| 5 | Club | diversity_3 | Bonbon Club by Think / Make / Care with model, Houses helped, tools |
| 6 | Rules | gavel | set a rule for everyone; all rules |
| 7 | Devices | devices | the four devices, online state, pairing codes, switch off |
Phones show 1 to 5 in the bottom bar and 6, 7 from Home; PCs show all 7 in the side rail.

## Look (from the Design Atelier)
- Colours: Coco Rose primary, Estate Gold accents only, Pearl and Silk surfaces, Velvet Ink text; full dark set.
- Type: Fraunces (soft) for titles, Nunito for everything else.
- Shapes: 26-32 px cards, pill buttons, 8 px grid. Status chips: Working / Running green, Waiting / Needs YES gold-yellow, Failed red, others neutral.
- Words: plain English, founders called Boss and Big Boss, no emoji, no dashes in names.

## Notifications (same on every device)
- New approval waiting, task done, task merged by Coco, task or rule from the other founder.
- Never for a device's own actions.

## Security
Sign in with email + password, then pair the device once with a one-time code. Max four devices.
A switched-off device stops at once. Personal documents and keys never pass through the app.
