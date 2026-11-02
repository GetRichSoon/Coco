// Copy of CocoMaison scripts/lib/storage.mjs, the proven B2/S3 adapter. Update by copying, never by editing here.
// Coco object storage: ONE interface for every team, provider-independent.
//
// Everything in Coco that stores bytes - a rendered video waiting for a YES, an EPUB, a cover, an
// APK, a game build, a CWS zip - goes through this file and nothing else. The provider is a config
// value: any S3-compatible endpoint (Backblaze B2 today; the same code signed into R2 or Oracle
// yesterday). Swapping providers is a change to five environment variables, not to any caller.
//
// Zero dependencies, on purpose: this repo has no package.json and every other uploader here is
// fetch + node:crypto (see scripts/publish/gumroad.mjs). AWS Signature V4 is ~40 lines and is
// exactly what every S3-compatible provider verifies, so the first real request against the
// provider is also the test of this signer.
//
//   STORAGE_ENDPOINT        https://s3.<region>.backblazeb2.com   (path-style: /<bucket>/<key>)
//   STORAGE_REGION          us-west-004
//   STORAGE_BUCKET          coco_proof
//   STORAGE_ACCESS_KEY_ID   the key id       (B2: keyID)           never logged, never committed
//   STORAGE_SECRET_ACCESS_KEY the secret     (B2: applicationKey)  never logged, never committed
//   STORAGE_VERSIONED       "1" when the bucket keeps old versions (B2 always does). Then delete()
//                           removes EVERY version of the key, because a plain DeleteObject on a
//                           versioned bucket only writes a hide/delete marker and the bytes stay.
//
// The key for an artifact is a pure function of ids Coco already has BEFORE any upload (the
// Supabase output/run id and the sha256 of the bytes), so a retry computes the same key and a
// HEAD can say "already there". That is the whole duplicate-upload defence; no lock, no list.
import crypto from 'node:crypto';

const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const hmac = (k, s) => crypto.createHmac('sha256', k).update(s).digest();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const xml = (body, tag) => [...body.matchAll(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'g'))].map((m) => m[1]);

// Deterministic key. Same bytes for the same output -> same key, every time, on every machine.
export function objectKey({ tier, team = 'coco', kind = 'file', id, version = 1, sha256: h, ext, run_id, stage }) {
  if (!h || h.length < 12) throw new Error('objectKey needs the sha256 of the bytes');
  const s = h.slice(0, 12), e = String(ext || 'bin').replace(/^\./, '').toLowerCase();
  if (tier === 'tmp') return `tmp/${run_id}/${stage}/${id}_${s}.${e}`;
  if (tier === 'hold') return `hold/${id}/v${version}/${s}.${e}`;
  if (tier === 'final') return `final/${team}/${kind}/${id}/v${version}/${s}.${e}`;
  if (tier === 'manifest') return `manifest/${id}.json`;
  if (tier === 'dist') return `dist/${team}/${version}/${id}.${e}`;
  if (tier === 'backup') return `backup/${team}/${id}/${kind}.${e}`;
  throw new Error(`unknown tier ${tier}`);
}

export function configFromEnv(env = process.env) {
  const need = (k) => { const v = (env[k] || '').trim(); if (!v) throw new Error(`storage: ${k} is not set`); return v; };
  // Consoles show the endpoint as a bare host (s3.us-west-004.backblazeb2.com) and people paste it
  // with quotes or a bucket path; accept all of that and keep only the origin. If it still is not a
  // URL, say what its SHAPE is (letters -> a, digits -> 0) so the fix is obvious without ever
  // printing the value.
  let ep = need('STORAGE_ENDPOINT').replace(/^["'\s]+|["'\s]+$/g, '');
  if (!/^[a-z]+:\/\//i.test(ep)) ep = `https://${ep}`;
  let origin;
  try { origin = new URL(ep).origin; } catch { throw new Error(`storage: STORAGE_ENDPOINT is not a URL (shape: ${ep.replace(/[a-z]/gi, 'a').replace(/\d/g, '0')})`); }
  return {
    endpoint: origin, region: need('STORAGE_REGION').replace(/^["'\s]+|["'\s]+$/g, ''), bucket: need('STORAGE_BUCKET').replace(/^["'\s]+|["'\s]+$/g, ''),
    accessKeyId: need('STORAGE_ACCESS_KEY_ID'), secretAccessKey: need('STORAGE_SECRET_ACCESS_KEY'),
    versioned: env.STORAGE_VERSIONED === '1', provider: env.STORAGE_PROVIDER || 's3',
  };
}

export function createStorage(cfg, { fetch: f = globalThis.fetch, now = () => new Date() } = {}) {
  const host = new URL(cfg.endpoint).host;
  const stats = { A: 0, B: 0, C: 0 };             // B2's transaction classes, so the proof can count
  const cls = { PUT: 'A', DELETE: 'A', POST: 'A', GET: 'B', HEAD: 'B', LIST: 'C' };

  function sign({ method, path, query = {}, headers = {}, payloadHash, presignExpires = null }) {
    const d = now(), amzDate = d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'), date = amzDate.slice(0, 8);
    const scope = `${date}/${cfg.region}/s3/aws4_request`;
    const h = { host, ...(presignExpires ? {} : { 'x-amz-date': amzDate, 'x-amz-content-sha256': payloadHash }), ...headers };
    const q = { ...query };
    if (presignExpires) Object.assign(q, { 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${cfg.accessKeyId}/${scope}`,
      'X-Amz-Date': amzDate, 'X-Amz-Expires': String(presignExpires), 'X-Amz-SignedHeaders': 'host' });
    const signed = presignExpires ? ['host'] : Object.keys(h).map((k) => k.toLowerCase()).sort();
    const canonQ = Object.keys(q).sort().map((k) => `${enc(k)}=${enc(q[k])}`).join('&');
    const canonH = signed.map((k) => `${k}:${String(h[k]).trim()}\n`).join('');
    const canonical = [method, path.split('/').map(enc).join('/'), canonQ, canonH, signed.join(';'), payloadHash].join('\n');
    const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
    const kSign = hmac(hmac(hmac(hmac(`AWS4${cfg.secretAccessKey}`, date), cfg.region), 's3'), 'aws4_request');
    const sig = crypto.createHmac('sha256', kSign).update(toSign).digest('hex');
    if (presignExpires) return `${cfg.endpoint}${path}?${canonQ}&X-Amz-Signature=${sig}`;
    return { ...h, authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signed.join(';')}, Signature=${sig}` };
  }

  // One request, bounded retries on the provider's transient answers. Every op here is idempotent
  // (same bytes to the same key, or a read, or a delete), so a retry can never create a second thing.
  async function req(method, key, { query = {}, headers = {}, body = null, klass = null, attempts = 4 } = {}) {
    const path = `/${cfg.bucket}${key ? `/${key}` : ''}`;
    const payloadHash = sha256(body || '');
    const url = `${cfg.endpoint}${path}${Object.keys(query).length ? '?' + Object.keys(query).sort().map((k) => `${enc(k)}=${enc(query[k])}`).join('&') : ''}`;
    stats[klass || cls[method]]++;
    let last;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await f(url, { method, headers: sign({ method, path, query, headers, payloadHash }), body });
        if (res.status < 500 && res.status !== 429) return res;
        last = new Error(`${method} ${key || ''}: ${res.status} ${(await res.text()).slice(0, 160)}`);
      } catch (e) { last = e; }
      await sleep(400 * 2 ** i);
    }
    throw last;
  }
  const ok = (res, what) => { if (!res.ok) throw Object.assign(new Error(`${what}: ${res.status}`), { status: res.status }); return res; };

  return {
    stats, bucket: cfg.bucket, provider: cfg.provider,

    // headBucket(): 'ok' | 'not_found' | 'forbidden'. Tells a wrong bucket name (404) apart from a
    // key that may not touch it (403) before any object call, which would otherwise all answer 404.
    async headBucket() {
      const res = await req('HEAD', null, { klass: 'C' });
      return res.ok ? 'ok' : res.status === 404 ? 'not_found' : res.status === 403 || res.status === 401 ? 'forbidden' : `http_${res.status}`;
    },

    // put(key, bytes, {contentType, meta}) -> {etag, sha256, bytes}. The sha256 travels as object
    // metadata so a HEAD can prove identity without a download.
    async put(key, bytes, { contentType = 'application/octet-stream', meta = {} } = {}) {
      const h = sha256(bytes);
      const headers = { 'content-type': contentType, 'content-length': String(bytes.length), 'x-amz-meta-sha256': h };
      for (const [k, v] of Object.entries(meta)) headers[`x-amz-meta-${k.toLowerCase()}`] = String(v);
      const res = ok(await req('PUT', key, { headers, body: bytes }), `put ${key}`);
      return { etag: res.headers.get('etag'), sha256: h, bytes: bytes.length, versionId: res.headers.get('x-amz-version-id') };
    },
    async head(key) {
      const res = await req('HEAD', key);
      if (res.status === 404) return null;
      ok(res, `head ${key}`);
      const meta = {}; res.headers.forEach((v, k) => { if (k.startsWith('x-amz-meta-')) meta[k.slice(11)] = v; });
      return { bytes: Number(res.headers.get('content-length')), etag: res.headers.get('etag'), contentType: res.headers.get('content-type'), sha256: meta.sha256 || null, meta, versionId: res.headers.get('x-amz-version-id') };
    },
    async exists(key) { return (await this.head(key)) !== null; },
    async get(key, { expectSha256 = null } = {}) {
      const res = ok(await req('GET', key), `get ${key}`);
      const bytes = Buffer.from(await res.arrayBuffer()), h = sha256(bytes);
      if (expectSha256 && h !== expectSha256) throw Object.assign(new Error(`get ${key}: checksum mismatch`), { status: 'CHECKSUM_MISMATCH', got: h, want: expectSha256 });
      return { bytes, sha256: h };
    },
    presign(key, { expires = 3600 } = {}) { return sign({ method: 'GET', path: `/${cfg.bucket}/${key}`, payloadHash: 'UNSIGNED-PAYLOAD', presignExpires: expires }); },

    // Every version of the key, newest first, including delete/hide markers. This is the only way to
    // know what a versioned bucket really holds after a "delete".
    async listVersions(prefix) {
      const res = ok(await req('GET', null, { query: { versions: '', prefix }, klass: 'C' }), `listVersions ${prefix}`);
      const body = await res.text(), out = [];
      for (const [, blk] of body.matchAll(/<(?:Version|DeleteMarker)>([\s\S]*?)<\/(?:Version|DeleteMarker)>/g))
        out.push({ key: xml(blk, 'Key')[0], versionId: xml(blk, 'VersionId')[0], isLatest: xml(blk, 'IsLatest')[0] === 'true', size: Number(xml(blk, 'Size')[0] || 0), marker: /<DeleteMarker>/.test(body.slice(body.indexOf(blk) - 14, body.indexOf(blk))) });
      return out;
    },
    // delete(key): on a versioned bucket a bare DeleteObject only writes a marker and the bytes
    // stay billable; so remove every version explicitly, then prove the prefix is empty.
    async delete(key) {
      if (!cfg.versioned) { ok(await req('DELETE', key), `delete ${key}`); return { removed: 1 }; }
      const versions = await this.listVersions(key);
      let removed = 0;
      for (const v of versions.filter((x) => x.key === key)) { ok(await req('DELETE', key, { query: { versionId: v.versionId } }), `delete ${key}@${v.versionId}`); removed++; }
      const left = (await this.listVersions(key)).filter((x) => x.key === key);
      if (left.length) throw new Error(`delete ${key}: ${left.length} version(s) still present`);
      return { removed };
    },

    multipart: {
      async create(key, { contentType = 'application/octet-stream', meta = {} } = {}) {
        const headers = { 'content-type': contentType }; for (const [k, v] of Object.entries(meta)) headers[`x-amz-meta-${k.toLowerCase()}`] = String(v);
        const res = ok(await req('POST', key, { query: { uploads: '' }, headers }), `multipart create ${key}`);
        return xml(await res.text(), 'UploadId')[0];
      },
      async uploadPart(key, uploadId, partNumber, bytes) {
        const res = ok(await req('PUT', key, { query: { partNumber: String(partNumber), uploadId }, headers: { 'content-length': String(bytes.length) }, body: bytes }), `part ${partNumber}`);
        return { partNumber, etag: res.headers.get('etag') };
      },
      async complete(key, uploadId, parts) {
        const body = `<CompleteMultipartUpload>${parts.map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag}</ETag></Part>`).join('')}</CompleteMultipartUpload>`;
        ok(await req('POST', key, { query: { uploadId }, headers: { 'content-type': 'application/xml' }, body }), `multipart complete ${key}`);
      },
      async abort(key, uploadId) { ok(await req('DELETE', key, { query: { uploadId } }), `multipart abort ${key}`); },
      async listUnfinished(prefix = '') {
        const res = ok(await req('GET', null, { query: { uploads: '', prefix }, klass: 'C' }), 'listUnfinished');
        return xml(await res.text(), 'UploadId');
      },
    },
  };
}
