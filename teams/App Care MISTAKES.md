# App Care mistakes (Nono)

- 2026-10-26 | Nono | Test script inserted real historical founder utterances ("bhai gana laga de koi", "hello kya chal raha hai") as `say` commands on Boss's PC, three times (the script crashed halfway and was re-run). The PC played a song and spoke status lines Boss never asked for. Heal code itself never inserts commands. Fix: tests use only inert text ("[Nono selftest]") through `notify`, never `say`/`play_youtube`; voice intents expire after 2 min and are never retried or re-queued; regression asserts in `Lounge Desktop/heal.test.js` and `HealTest.kt`.
- 2026-10-26 | Nono | Restarting the app from a Claude shell failed silently twice because `ELECTRON_RUN_AS_NODE=1` was set (electron ran as plain node). Remove the variable before starting Electron.
