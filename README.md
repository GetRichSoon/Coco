# Coco ✨

Coco is the company's AI chief of staff, rebuilt from Nova in a calmer, managed way.
One core on the PC, one app for the PC and the phone, every Nova memory kept.

## Four folders, nothing more
| Folder | What lives there |
|---|---|
| `heart/` | Coco Core: the server, the memory, the Nova import, tests |
| `face/` | The Coco app (same screens on PC and phone) |
| `memory/` | `brain.json` (everything Coco knows) + `Daily Copies/` |
| `teams/` | One playbook per team: YouTube Studio, Extension Atelier, App Garden, Social Lounge |

Keys never live here. They are in `C:\Users\Lenovo\Coco Vault` (outside OneDrive, never in git).

## Use it
- Double-click **Start Coco.cmd**: wakes Coco Core and opens the app window.
- Phone on the same Wi-Fi: open the address shown on the Connections page, type the PIN from
  `Coco Vault\Coco Keys\Coco App PIN.txt`.
- `npm test` runs the checks. `npm run import` reads Nova again (the ↻ button does the same).

## How Coco and Nova live together (for now)
- Nova (`nova-hq`) still does the daily work: Shorts, playlists, terminals. Coco reads it.
- Tasks typed in Coco go to the YouTube or Extension team inbox on the Laptop Terminal.
- YES/NO in Coco is recorded in Coco's memory with the founder's name; it never publishes,
  spends or deletes anything by itself.
- Nova as it was before Coco: git tag `pre-rebuild-2026-10-14` in nova-hq, and a full copy in
  `C:\Users\Lenovo\Nova Backups\2026-10-14`.
