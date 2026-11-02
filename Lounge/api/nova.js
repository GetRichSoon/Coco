// Every Nova route goes through this one function. Vercel serves only single-segment api paths from a
// file, so vercel.json rewrites /api/* and /rest/v1/* here with the original path in ?__path=...
import { vercel } from './_nova.js';
export default vercel;
export const config = { api: { bodyParser: { sizeLimit: '256kb' } } };
