// Every Nova route goes through one handler: /api/health, /api/me, /api/changes,
// /api/rest/<table>, /api/rest/rpc/<fn> (and /rest/v1/... via the rewrite in vercel.json).
import { vercel } from './_nova.js';
export default vercel;
export const config = { api: { bodyParser: { sizeLimit: '256kb' } } };
