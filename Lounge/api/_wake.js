// The wake board (YES-3 follow-up): how a resting device learns, without waking the database, that the database is awake anyway
// or that a command is waiting for it - correctly across Nova instances.
//
//   sender's request (instance A) -> statement runs -> board.set('awake') at most once a minute; a new command -> board.set('mail:<target>')
//   resting device (instance B)   -> GET /api/awake?d=<device> -> board.get('awake'), board.get('mail:<device>') -> { warm, mail_at }
//
// The board is Vercel's Runtime Cache: shared by every instance of this function in the region (Nova runs in bom1 only), part of the
// platform (no env var, no store to create, no package), reached the same way the official @vercel/functions getCache() reaches it: the
// cache client the runtime puts on the request context. Outside Vercel, or if the runtime offers none, the board is this instance's
// memory only, and /api/health says so (wake.store = 'instance'). Nothing durable lives here: the commands are rows in the database;
// the board only tells a device "look now". Lose the board and the worst case is the old one: the device reads at its next 30-minute
// slot, and nothing expires while it rests (Lounge/heal.js sweepVerdict / runVerdict).
const AWAKE_MS = 4 * 60e3;              // a statement less than 4 minutes ago: the compute has not begun to suspend (Neon: 5 idle minutes)
const AWAKE_WRITE_EVERY_MS = 60e3;      // each instance tells the board at most once a minute while it runs statements
const READ_MEMO_MS = 10e3;              // each instance asks the board at most every 10 s per key, however many devices ping it
const MAIL_TTL_S = 7 * 24 * 3600;       // a mail flag outlives any absence that still has a queued command worth telling about

const SYMBOL = Symbol.for('@vercel/request-context');
// shortcut: the runtime's own cache client, the one @vercel/functions getCache() uses (that package pulls 25 packages into Nova for these
// two calls). If Vercel moves it, store() returns null and Nova falls back to instance memory, visible in /api/health. Upgrade: the package.
export function runtimeStore() {
  try { const c = globalThis[SYMBOL]?.get?.()?.cache; return c && typeof c.get === 'function' && typeof c.set === 'function' ? c : null; } catch { return null; }
}
// keys hashed the way getCache() hashes them (djb2), under one namespace
const keyOf = (k) => { let h = 5381; for (let i = 0; i < k.length; i++) h = (h * 33) ^ k.charCodeAt(i); return 'coco-wake$' + (h >>> 0).toString(16); };
// a board write never slows the answer: handed to the runtime's waitUntil when there is one (awaited otherwise, as in the tests)
const later = (p) => { try { const w = globalThis[SYMBOL]?.get?.()?.waitUntil; if (typeof w === 'function') { w(p); return; } } catch {} return p; };

// One board per Nova instance (its memory) over one shared store. `store()` returns the shared store or null.
export function createWake({ store = runtimeStore } = {}) {
  const mem = { awakeAt: 0, wroteAwakeAt: -Infinity, mail: new Map(), memo: new Map() };
  const stats = { board_reads: 0, board_writes: 0, board_errors: 0, store: 'instance' };
  const shared = () => { const s = store(); stats.store = s ? 'shared' : 'instance'; return s; };
  async function put(k, v, ttl) { const s = shared(); if (!s) return; try { stats.board_writes++; await s.set(keyOf(k), v, { ttl }); } catch { stats.board_errors++; } }
  async function get(k, now) {
    const m = mem.memo.get(k); if (m && now - m.at < READ_MEMO_MS) return m.v;
    const s = shared(); let v = null;
    if (s) { try { stats.board_reads++; v = await s.get(keyOf(k)); } catch { stats.board_errors++; v = null; } }
    mem.memo.set(k, { at: now, v }); return v;
  }
  return {
    stats,
    /** A request that is not quiet ran a statement: the database is awake. */
    async touched(now) {
      mem.awakeAt = Math.max(mem.awakeAt, now);
      if (now - mem.wroteAwakeAt >= AWAKE_WRITE_EVERY_MS) { mem.wroteAwakeAt = now; mem.memo.delete('awake'); await later(put('awake', now, Math.ceil(AWAKE_MS / 1000) + 60)); }
    },
    /** A command was written for these devices: tell them to look. */
    async mail(devices, now) {
      for (const d of new Set(devices.filter(Boolean).map(String))) { mem.mail.set(d, now); mem.memo.delete('mail:' + d); await later(put('mail:' + d, now, MAIL_TTL_S)); }
    },
    /** GET /api/awake: never the database. */
    async answer(device, now) {
      let at = mem.awakeAt;
      if (now - at >= AWAKE_MS) at = Math.max(at, Number(await get('awake', now)) || 0);
      let mailAt = null;
      if (device) { const v = Math.max(mem.mail.get(device) || 0, Number(await get('mail:' + device, now)) || 0); mailAt = v ? new Date(v).toISOString() : null; }
      return { warm: now - at < AWAKE_MS, mail_at: mailAt, now: new Date(now).toISOString() };
    },
    reset() { mem.awakeAt = 0; mem.wroteAwakeAt = -Infinity; mem.mail.clear(); mem.memo.clear(); },
  };
}
