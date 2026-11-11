// Nova's door to object storage (Backblaze B2 or any S3-compatible provider): short-lived SIGNED URLs so a browser or a worker moves the bytes
// directly (Nova never carries a video), and a signed HEAD to check that an upload really arrived. It is the same AWS Signature V4 as the
// company adapter (scripts/lib/storage.mjs in the engine repo); a parity test there proves both produce identical URLs for identical input.
//
// Env (Nova only): STORAGE_ENDPOINT, STORAGE_REGION, STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY.
// The key is the least-privilege application key of ONE bucket; this code can only reach that bucket.
import crypto from 'node:crypto';

const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const hmac = (k, s) => crypto.createHmac('sha256', k).update(s).digest();

export function storageFromEnv(env = process.env) {
  const { STORAGE_ENDPOINT: e, STORAGE_REGION: r, STORAGE_BUCKET: b, STORAGE_ACCESS_KEY_ID: k, STORAGE_SECRET_ACCESS_KEY: s } = env;
  if (![e, r, b, k, s].every((x) => x && String(x).trim())) return null;
  let origin; try { origin = new URL(/^[a-z]+:\/\//i.test(e.trim()) ? e.trim() : `https://${e.trim()}`).origin; } catch { return null; }
  return createPresigner({ endpoint: origin, region: r.trim(), bucket: b.trim(), accessKeyId: k.trim(), secretAccessKey: s.trim() });
}

export function createPresigner(cfg, { fetch: f = globalThis.fetch, now = () => new Date() } = {}) {
  const host = new URL(cfg.endpoint).host;
  function sign({ method, path, headers = {}, payloadHash = 'UNSIGNED-PAYLOAD', presignExpires = null }) {
    const d = now(), amzDate = d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'), date = amzDate.slice(0, 8), scope = `${date}/${cfg.region}/s3/aws4_request`;
    const h = { host, ...(presignExpires ? {} : { 'x-amz-date': amzDate, 'x-amz-content-sha256': payloadHash }), ...headers };
    const q = presignExpires ? { 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${cfg.accessKeyId}/${scope}`, 'X-Amz-Date': amzDate, 'X-Amz-Expires': String(presignExpires), 'X-Amz-SignedHeaders': 'host' } : {};
    const signed = presignExpires ? ['host'] : Object.keys(h).map((k) => k.toLowerCase()).sort();
    const canonQ = Object.keys(q).sort().map((k) => `${enc(k)}=${enc(q[k])}`).join('&');
    const canonical = [method, path.split('/').map(enc).join('/'), canonQ, signed.map((k) => `${k}:${String(h[k]).trim()}\n`).join(''), signed.join(';'), payloadHash].join('\n');
    const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
    const sig = crypto.createHmac('sha256', hmac(hmac(hmac(hmac(`AWS4${cfg.secretAccessKey}`, date), cfg.region), 's3'), 'aws4_request')).update(toSign).digest('hex');
    if (presignExpires) return `${cfg.endpoint}${path}?${canonQ}&X-Amz-Signature=${sig}`;
    return { ...h, authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signed.join(';')}, Signature=${sig}` };
  }
  const pathOf = (key) => `/${cfg.bucket}/${key}`;
  return {
    bucket: cfg.bucket, provider: 's3',
    // a URL that allows exactly one method on exactly one key for a short time (GET to read, PUT to upload)
    presign: (method, key, { expires = 900 } = {}) => sign({ method: method.toUpperCase(), path: pathOf(key), presignExpires: Math.min(3600, Math.max(30, expires)) }),
    // proves an upload arrived: size and (if the uploader sent it) the sha256 it declared
    async head(key) {
      const res = await f(`${cfg.endpoint}${pathOf(key)}`, { method: 'HEAD', headers: sign({ method: 'HEAD', path: pathOf(key), payloadHash: sha256('') }) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`storage HEAD ${res.status}`);
      const meta = {}; res.headers.forEach((v, k) => { if (k.startsWith('x-amz-meta-')) meta[k.slice(11)] = v; });
      return { bytes: Number(res.headers.get('content-length')), sha256: meta.sha256 || null, contentType: res.headers.get('content-type') };
    },
  };
}
