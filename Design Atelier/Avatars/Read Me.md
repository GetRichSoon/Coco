# Default profile avatars

18 default profile pictures in our Material You style: 5 men, 5 women, 5 kids and 3 fun ones (cat, robot, panda). Made 2026-10-25 for the Screen Time Tracker profiles, guests and leaderboard. Boss asked for a normal, casual Western look, with no religious headwear.

- **Files:** `svg/<id>.svg`, 256x256, round. Ids are man_1 to man_5, woman_1 to woman_5, kid_1 to kid_5, fun_cat, fun_robot and fun_panda.
- **Preview:** `preview.png`, or open `preview.html`.
- **Edit or remake:** change `make_avatars.py`, then run `python make_avatars.py`.
- **Copyright:** 100% our own art, drawn in code. No third-party images, so it is safe for paid products.
- **Colours:** from the Material You Theme palette in this folder's parent (`../Material You Theme/tokens.json`).
- **Use in products:** copy the `svg` folder into the extension. Store only the avatar id on the server (for example `man_3`). New guests get a random one.
