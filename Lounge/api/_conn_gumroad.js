// Gumroad connector for COCO Revenue: read the seller's sales, turn them into ledger rows, check a stored token.
// Pure: no database, no vault, no environment. Nova (api/_connect.js) hands in a token and a fetch; nothing here logs,
// stores or returns the token, and a provider answer is redacted before it becomes an error text.
//
// Verified 2026-11-12 against Gumroad's own source (github.com/antiwork/gumroad, the code that serves api.gumroad.com):
//   GET /v2/sales   app/controllers/api/v2/sales_controller.rb   needs scope view_sales (Gumroad also accepts its broad `account` scope)
//                   after / before = YYYY-MM-DD (created_at >= after, created_at < before), page_key = the previous page's next_page_key;
//                   10 sales a page, newest first; next_page_key and next_page_url exist ONLY when another page exists (base_controller.rb)
//   sale JSON       app/models/purchase.rb as_json(version: 2): `price` is price_cents = USD CENTS whatever currency the product is listed in;
//                   `currency` is the LISTING currency (lower case); flags refunded / partially_refunded / chargedback; for a partial refund
//                   only `amount_refundable_in_currency` (decimal string, in the listing currency) says what is left to refund
//   GET /v2/user    the account: name, id / user_id, url, email (email needs view_sales)
//   errors          401 = token invalid, revoked or expired; 403 = scope missing (Doorkeeper: empty body, status only);
//                   400 = { status, error }; 200 with { success: false, message } = refused
// So every amount below is USD, and the listing currency is kept in meta.
import { redact } from './_publish.js';

export const GUMROAD_API = 'https://api.gumroad.com';
export const MAX_PAGES = 500;                                   // 10 sales a page: 5,000 sales a call; `truncated` + `next_page_key` let the caller resume
const RETRY_ON = new Set([500, 502, 503, 504]);
const sleepReal = (ms) => new Promise((r) => setTimeout(r, ms));
const cap = (v, n) => (v === undefined || v === null ? null : String(v).slice(0, n));
const safe = (v, token) => redact(String(v ?? ''), token).slice(0, 300);

// A failed read must never be readable as "no sales": reading `.sales` of a failure throws, so a caller that forgets to look at `ok`
// stops with the reason instead of recording a verified zero.
function failure(code, error, extra = {}) {
  const out = { ok: false, code, error, ...extra };
  Object.defineProperty(out, 'sales', { enumerable: false, get() { throw Object.assign(new Error(error), { code }); } });
  return out;
}

// 'YYYY-MM-DD' | Date | ISO-8601 timestamp -> 'YYYY-MM-DD' (UTC). undefined = absent, null = not a date ("10/11/2026" is ambiguous, so it is refused).
function day(v) {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v ? v : null;
  if (typeof v === 'string' && !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v)) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// One GET with a bounded retry: network errors and 5xx back off, 429 waits for Retry-After. Returns { json } or a failure().
async function get(url, token, f, { retries, sleep, timeoutMs }) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await f(url, { method: 'GET', headers: { authorization: `Bearer ${token}`, accept: 'application/json' }, ...(typeof AbortSignal?.timeout === 'function' ? { signal: AbortSignal.timeout(timeoutMs) } : {}) });
    } catch (e) {
      if (attempt < retries) { await sleep(500 * 2 ** (attempt - 1)); continue; }
      return failure('unavailable', `Gumroad could not be reached (${safe(e instanceof Error ? e.message : e, token)}).`);
    }
    if (RETRY_ON.has(res.status) && attempt < retries) { await sleep(500 * 2 ** (attempt - 1)); continue; }
    if (res.status === 429) {
      const wait = Number(res.headers?.get?.('retry-after')) || 2;
      if (attempt < retries && wait <= 30) { await sleep(wait * 1000); continue; }
      return failure('rate_limited', `Gumroad is rate-limiting this account (429); wait ${wait} s and sync again.`, { status: 429, retry_after_s: wait });
    }
    const text = await res.text().catch(() => '');
    if (res.status === 401) return failure('revoked', 'Gumroad refused the token (401): it was revoked or has expired. Reconnect Gumroad in Coco.', { status: 401 });
    if (res.status === 403) return failure('missing_scope', 'Gumroad refused the token (403): it does not carry the view_sales permission. Reconnect Gumroad in Coco and approve "view sales".', { status: 403 });
    let json = null; try { json = JSON.parse(text); } catch { /* handled below */ }
    if (res.status === 400) return failure('bad_request', `Gumroad rejected the request: ${safe(json?.error || json?.message || text, token)}`, { status: 400 });
    if (!res.ok) return failure('unavailable', `Gumroad answered ${res.status}.`, { status: res.status });
    if (!json || typeof json !== 'object' || Array.isArray(json)) return failure('bad_response', 'Gumroad returned something that is not JSON.', { status: res.status });
    if (json.success === false) return failure('refused', `Gumroad refused the request: ${safe(json.message || 'no reason given', token)}`, { status: res.status });
    return { json };
  }
}

// A sale this connector can trust to put money in a ledger: an id, an integer number of USD cents, a real date.
const readable = (s) => Boolean(s) && typeof s === 'object' && typeof s.id === 'string' && s.id !== '' && typeof s.price === 'number' && Number.isFinite(s.price) && s.price >= 0 && typeof s.created_at === 'string' && !Number.isNaN(Date.parse(s.created_at));

/**
 * Every sale since `after`, newest first.
 * -> { ok:true, sales, pages, truncated, next_page_key, error:null }   zero sales is ok with an empty list: a real, verified zero
 *  | { ok:false, code, error, status? }                               code: revoked | missing_scope | rate_limited | bad_request | unavailable | bad_response | refused
 * On ok:false nothing partial is exposed (`.sales` throws) and the caller must not advance its sync mark.
 * opts: after / before ('YYYY-MM-DD', Date or ISO timestamp), page_key (resume), maxPages, retries (3), sleep, timeoutMs, api
 */
export async function fetchGumroadSales(accessToken, opts = {}, fetchImpl = globalThis.fetch) {
  const { after, before, page_key = null, maxPages = MAX_PAGES, retries = 3, sleep = sleepReal, timeoutMs = 20000, api = GUMROAD_API } = opts || {};
  if (typeof accessToken !== 'string' || accessToken.length < 6) return failure('bad_request', 'no Gumroad token was given.');
  const a = day(after), b = day(before);
  if (a === null || b === null) return failure('bad_request', `${a === null ? 'after' : 'before'} is not a date (use YYYY-MM-DD).`);
  const sales = new Map();
  let key = page_key || null, pages = 0;
  for (;;) {
    if (pages >= maxPages) return { ok: true, sales: [...sales.values()], pages, truncated: true, next_page_key: key, error: null, code: null };
    const q = new URLSearchParams(); if (a) q.set('after', a); if (b) q.set('before', b); if (key) q.set('page_key', key);
    const qs = q.toString();
    const r = await get(`${api}/v2/sales${qs ? `?${qs}` : ''}`, accessToken, fetchImpl, { retries, sleep, timeoutMs });
    if (!r.json) return r;
    const list = r.json.sales;
    if (!Array.isArray(list)) return failure('bad_response', 'Gumroad answered without a sales list.');
    const bad = list.filter((s) => !readable(s)).length;
    if (bad) return failure('bad_response', `Gumroad returned ${bad} sale(s) this connector cannot read (no id, price or date); nothing was kept.`);
    for (const s of list) sales.set(s.id, s);
    pages++;
    const next = typeof r.json.next_page_key === 'string' && r.json.next_page_key ? r.json.next_page_key : null;
    if (!next) return { ok: true, sales: [...sales.values()], pages, truncated: false, next_page_key: null, error: null, code: null };
    if (next === key) return failure('bad_response', 'Gumroad repeated the same page key; stopping instead of looping.');
    key = next;
  }
}

// ---------------------------------------------------------------- sales -> ledger rows
const usd = (cents) => { const v = Math.round(cents) / 100; return v === 0 ? 0 : v; };       // integer cents -> major units, never -0
const decimal = (s) => { if (s === null || s === undefined || String(s).trim() === '') return null; const n = Number(String(s).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };

// What was given back for a sale: { cents (USD), reason, unknown? } or null. A chargeback takes the whole sale; a partial refund
// is exact for a USD listing and unknown for any other (Gumroad gives the remainder only in the listing currency).
function refundOf(s) {
  const price = Math.round(Number(s.price));
  if (!(price > 0)) return null;
  if (s.chargedback === true) return { cents: price, reason: 'chargeback' };
  if (s.refunded === true) return { cents: price, reason: 'refund' };
  if (s.partially_refunded === true) {
    const left = decimal(s.amount_refundable_in_currency);
    if (String(s.currency || 'usd').toLowerCase() === 'usd' && left !== null) return { cents: Math.min(price, Math.max(0, price - Math.round(left * 100))), reason: 'partial refund' };
    return { cents: 0, reason: 'partial refund', unknown: true };
  }
  return null;
}

/**
 * Gumroad sales -> ledger rows { source, connection_id, house_id, product_id, occurred_at, amount, currency, kind, external_id, meta }.
 * amount is in major units and never negative: kind ('sale' | 'refund') says which way the money went, as the ledger's check (amount >= 0)
 * and fold() (sales minus refunds) expect. currency is always 'USD' (see the header); the listing currency, the shown price and the fee
 * are in meta. At most one refund row per sale, holding what has been given back so far, so a repeat sync that sees a bigger refund
 * updates the same row.
 * meta is built from a short allow-list: never a buyer's email, name, address, card or licence key.
 * shortcut: Gumroad does not say WHEN a refund happened, so a refund is dated with its sale (net revenue by sale date); upgrade if the API ever adds it.
 */
export function toRevenueRows(sales, { connection_id = null, house_id = null } = {}) {
  const rows = [];
  for (const s of Array.isArray(sales) ? sales : []) {
    if (!readable(s)) continue;
    const base = { source: 'gumroad', connection_id, house_id, product_id: s.product_id ?? null, occurred_at: new Date(s.created_at).toISOString(), currency: 'USD' };
    const meta = { product_name: cap(s.product_name, 120), product_permalink: cap(s.product_permalink, 60), order_id: s.order_id ?? null, quantity: Number.isFinite(Number(s.quantity)) ? Number(s.quantity) : 1,
      listed_currency: String(s.currency || 'usd').toUpperCase(), listed_price: cap(s.formatted_display_price, 40), fee_usd: Number.isFinite(Number(s.gumroad_fee)) ? usd(Number(s.gumroad_fee)) : null,
      recurring: s.recurring_charge === true, paid: Number(s.price) > 0 };
    rows.push({ ...base, amount: usd(Number(s.price)), kind: 'sale', external_id: s.id, meta });
    const refund = refundOf(s);
    if (refund) rows.push({ ...base, amount: usd(refund.cents), kind: 'refund', external_id: `${s.id}:refund`, meta: { ...meta, reason: refund.reason, ...(refund.unknown ? { refund_amount_unknown: true } : {}) } });
  }
  return rows;
}

/**
 * Is this token alive, whose is it, and can it read sales? (the "Check now" button)
 * -> { ok:true, external_id, external_name, external_handle, account_label, scopes, can_read_sales, missing_scopes, warning, error:null }
 *  | { ok:false, code, error }
 * `scopes` lists only what was PROVEN: view_profile by GET /v2/user, view_sales by a read of /v2/sales that returns nothing (after = tomorrow).
 * can_read_sales is true / false / null (the probe itself could not complete). A token without view_sales is ok:true with can_read_sales:false.
 */
export async function verifyGumroad(accessToken, fetchImpl = globalThis.fetch, opts = {}) {
  const { retries = 3, sleep = sleepReal, timeoutMs = 20000, api = GUMROAD_API, now = Date.now() } = opts || {};
  if (typeof accessToken !== 'string' || accessToken.length < 6) return failure('bad_request', 'no Gumroad token was given.');
  const o = { retries, sleep, timeoutMs };
  const u = await get(`${api}/v2/user`, accessToken, fetchImpl, o);
  if (!u.json) return u;
  const user = u.json.user;
  if (!user || typeof user !== 'object') return failure('bad_response', 'Gumroad answered without an account.');
  const out = { ok: true, external_id: String(user.user_id ?? user.id ?? '') || null, external_name: cap(user.name ?? user.email, 120), external_handle: cap(user.url, 200), account_label: cap(user.email ?? user.name, 120),
    scopes: ['view_profile'], can_read_sales: null, missing_scopes: [], warning: null, error: null, code: null };
  const tomorrow = new Date(now + 86400000).toISOString().slice(0, 10);
  const s = await get(`${api}/v2/sales?after=${tomorrow}`, accessToken, fetchImpl, o);
  if (s.json && Array.isArray(s.json.sales)) { out.scopes.push('view_sales'); out.can_read_sales = true; return out; }
  if (s.code === 'missing_scope') { out.can_read_sales = false; out.missing_scopes = ['view_sales']; out.code = 'missing_scope'; out.warning = 'Connected, but this token cannot read sales. Reconnect Gumroad in Coco and approve "view sales".'; return out; }
  if (s.code === 'revoked') return s;
  out.warning = `Connected, but the sales permission could not be checked right now (${s.json ? 'unexpected answer' : s.error}).`;
  return out;
}
