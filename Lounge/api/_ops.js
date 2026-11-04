// Internal company status served to paired founders only: GET /api/ops/<name>. Lounge/ is a PUBLIC repository, so no snapshot lives
// here: the engine upserts each one into public.ops_snapshots (through Nova, redacted) and this route reads it back through
// runAs(), as the authenticated founder, so row-level security decides who sees it. Wired in _nova.js handle(), after authenticate().
const NAMES = { 'company-structure': 1, 'security-status': 1, 'ops-status': 1, 'pc-dependencies': 1, 'device-sync': 1 };
const MISSING_TABLE = (e) => e && (e.code === '42P01' || /relation "?(public\.)?ops_snapshots"? does not exist/i.test(String(e.message)));

export async function handleOps(req, who, { json, log, read }) {
  const m = req.method === 'GET' && req.path.match(/^\/api\/ops\/([a-z-]+)$/);
  if (!m || !Object.hasOwn(NAMES, m[1])) return json(404, { message: 'not found' });
  let row = null;
  try { row = await read(m[1]); } catch (e) { if (!MISSING_TABLE(e)) throw e; }   // any other failure reaches handle(): 503 upstream, 403 RLS, never a silent 404
  if (!row) { log(404, { device: who.device_id, ops: m[1], state: 'NOT_COLLECTED' }); return json(404, { state: 'NOT_COLLECTED', name: m[1], message: 'this snapshot has not been collected yet' }); }
  log(200, { device: who.device_id, ops: m[1] });
  return json(200, row.payload, row.collected_at ? { 'x-collected-at': new Date(row.collected_at).toISOString() } : {});
}
