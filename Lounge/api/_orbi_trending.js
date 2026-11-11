// Orbi wallpaper "Trending" on Nova: /api/orbi/wall/pick and /api/orbi/wall/trending (SQL: _orbi_trending.sql).
//
// Anonymous by design: the extension sends only the name of a built-in design when someone picks it, at most
// once per design per day per browser. Nova keeps a daily count per design, nothing about the person (no
// account, no device, the IP is only used for a per-instance rate limit in memory and never stored).
// The trending list is the same for everyone, so it is cached here and in the browser.
const DESIGN = /^[a-z0-9-]{2,40}$/;
const PICKS_PER_HOUR = 30;      // per IP, per instance: a browser picks a handful of wallpapers, not dozens
const CACHE_MS = 10 * 60 * 1000;

const hits = new Map();
let cached = null;

function allowed(ip, now) {
  const b = hits.get(ip) || { n: 0, at: now };
  if (now - b.at > 3600000) { b.n = 0; b.at = now; }
  b.n++; hits.set(ip, b);
  if (hits.size > 20000) for (const [k, v] of hits) if (now - v.at > 3600000) hits.delete(k);
  return b.n <= PICKS_PER_HOUR;
}

/** → { status, body } for /api/orbi/wall/*, or null when the path is not one of ours. */
export async function handleOrbiTrending(db, req, now = Date.now()) {
  if (!req.path.startsWith("/api/orbi/wall/")) return null;
  if (req.method === "OPTIONS") return { status: 204, body: null };
  if (req.path === "/api/orbi/wall/trending" && req.method === "GET") {
    if (!cached || now - cached.at > CACHE_MS) {
      const r = await db.query("SELECT public.orbi_wall_trending(7, 3, 20) AS v");
      cached = { at: now, list: (r.rows[0]?.v || []).map((x) => x.design) };
    }
    return { status: 200, body: { ok: true, trending: cached.list, updatedAt: cached.at }, headers: { "cache-control": "public, max-age=600" } };
  }
  if (req.path === "/api/orbi/wall/pick" && req.method === "POST") {
    const design = req.body && typeof req.body.design === "string" ? req.body.design : "";
    if (!DESIGN.test(design)) return { status: 400, body: { ok: false } };
    const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
    if (!allowed(ip, now)) return { status: 429, body: { ok: false } };
    await db.query("SELECT public.orbi_wall_pick($1)", [design]);
    return { status: 204, body: null };
  }
  return { status: 404, body: { ok: false } };
}

export function _resetTrendingCache() { cached = null; hits.clear(); }
