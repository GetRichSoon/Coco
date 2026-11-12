// Run: node conn.gumroad.test.js   (no network, no database: a scripted stand-in plays Gumroad)
//
// What the Gumroad connector must hold: every page of sales is read and nothing is read twice; a shop with no sales is a real, verified
// zero; a revoked or under-scoped token, a rate limit, an outage and a malformed answer are NEVER readable as "no sales"; money is
// handled in integer cents (Gumroad's `price` is USD cents whatever the listing currency); refunds and chargebacks become their own
// rows; no buyer data and no token ever reaches a row, an error or a URL.
import assert from 'node:assert/strict';
import { fetchGumroadSales, toRevenueRows, verifyGumroad, MAX_PAGES } from './api/_conn_gumroad.js';

let pass = 0, fail = 0, skip = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log(`PASS ${name}`); } catch (e) { fail++; console.log(`FAIL ${name} - ${e.message}`); } };
const TOKEN = 'gum_test_token_SECRET_0123456789';
const res = (status, body, headers = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: (k) => headers[k.toLowerCase()] ?? null }, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
// a scripted provider: the n-th call gets the n-th answer (the last answer repeats); an Error is thrown like a dropped connection
const script = (...answers) => {
  const calls = []; let i = 0;
  const f = async (url, init = {}) => { calls.push({ url: String(url), init }); const a = answers[Math.min(i++, answers.length - 1)]; if (a instanceof Error) throw a; return typeof a === 'function' ? a(String(url), init) : a; };
  f.calls = calls; return f;
};
const delays = []; const sleep = async (ms) => { delays.push(ms); };
const fresh = () => { delays.length = 0; };

// a sale shaped like Gumroad's as_json(version: 2) (docs: ApiDocumentation/Endpoints/Sales.tsx), with SYNTHETIC values; the buyer fields are here so the tests can prove they never leave
const sale = (n, o = {}) => ({
  id: `SALE${n}-dvxYabdavG97Y-Q==`, email: 'buyer@example.test', seller_id: 'SELLER-xyz==', timestamp: 'about 2 months ago', daystamp: ' 5 Nov 2026 11:38 AM', created_at: `2026-11-0${(n % 9) + 1}T10:00:00Z`,
  product_name: 'Synthetic Planner', product_has_variants: false, price: 1999, gumroad_fee: 130, tax_cents: 0, shipping_cents: 0, formatted_display_price: '$19.99', formatted_total_price: '$19.99',
  currency_symbol: '$', currency: 'usd', amount_refundable_in_currency: '19.99', product_id: 'PROD-1==', product_permalink: 'abcde', refunded: false, partially_refunded: false, chargedback: false,
  purchase_email: 'buyer@example.test', full_name: 'Buyer Name', zip_code: '625003', paid: true, order_id: 524459000 + n, purchaser_id: 'PURCHASER-1', license_key: 'LICENSE-SECRET-1234',
  card: { visual: '**** **** **** 4242', type: 'visa' }, recurring_charge: false, quantity: 1, disputed: false, dispute_won: false, ...o });
const page = (from, count, next) => ({ success: true, ...(next ? { next_page_url: `/v2/sales?page_key=${next}`, next_page_key: next } : {}), sales: Array.from({ length: count }, (_, i) => sale(from + i)) });

// ------------------------------------------------------------------ fetchGumroadSales
await t('1 pagination: every page is followed by its page_key, the date filter is a plain day, the token travels only in the header', async () => {
  fresh();
  const f = script(res(200, page(1, 10, 'K1')), res(200, page(11, 10, 'K2')), res(200, page(21, 3)));
  const r = await fetchGumroadSales(TOKEN, { after: '2026-11-10T08:30:00.000Z', sleep }, f);
  assert.equal(r.ok, true); assert.equal(r.sales.length, 23); assert.equal(r.pages, 3); assert.equal(r.truncated, false); assert.equal(r.next_page_key, null); assert.equal(r.error, null);
  assert.equal(f.calls.length, 3);
  const u = f.calls.map((c) => new URL(c.url));
  assert.ok(u.every((x) => x.origin === 'https://api.gumroad.com' && x.pathname === '/v2/sales'));
  assert.equal(u[0].searchParams.get('after'), '2026-11-10'); assert.equal(u[0].searchParams.get('page_key'), null);
  assert.equal(u[1].searchParams.get('page_key'), 'K1'); assert.equal(u[2].searchParams.get('page_key'), 'K2'); assert.ok(u.every((x) => x.searchParams.get('after') === '2026-11-10'));
  assert.ok(f.calls.every((c) => c.init.method === 'GET' && c.init.headers.authorization === `Bearer ${TOKEN}`));
  assert.ok(f.calls.every((c) => !c.url.includes(TOKEN) && !/access_token/.test(c.url)), 'the token must not be in a URL');
  assert.equal(delays.length, 0);
});

await t('2 the date filter takes a day, a Date or an ISO time; a calendar day that does not exist is refused before any call', async () => {
  for (const after of ['2026-11-10', new Date('2026-11-10T23:59:00Z'), '2026-11-10T23:59:00+05:30']) {
    const f = script(res(200, page(1, 1))); const r = await fetchGumroadSales(TOKEN, { after, sleep }, f);
    assert.equal(r.ok, true); assert.equal(new URL(f.calls[0].url).searchParams.get('after'), '2026-11-10', String(after));
  }
  const f = script(res(200, page(1, 1)));
  for (const bad of ['2026-02-30', 'yesterday', '10/11/2026']) { const r = await fetchGumroadSales(TOKEN, { after: bad, sleep }, f); assert.equal(r.ok, false); assert.equal(r.code, 'bad_request'); }
  assert.equal((await fetchGumroadSales(TOKEN, { before: 'nope', sleep }, f)).code, 'bad_request');
  assert.equal(f.calls.length, 0, 'no request for a bad date');
  const none = script(res(200, page(1, 0))); await fetchGumroadSales(TOKEN, { after: null, sleep }, none); assert.equal(new URL(none.calls[0].url).search, '', 'no after, no query');
});

await t('3 zero sales is ok with an empty list: a real, verified zero', async () => {
  const r = await fetchGumroadSales(TOKEN, { sleep }, script(res(200, { success: true, sales: [] })));
  assert.equal(r.ok, true); assert.deepEqual(r.sales, []); assert.equal(r.pages, 1); assert.equal(r.error, null);
  assert.deepEqual(toRevenueRows(r.sales, { connection_id: 'poppy' }), []);
});

await t('4 a sale that appears on two pages is kept once', async () => {
  const dup = sale(5); const r = await fetchGumroadSales(TOKEN, { sleep }, script(res(200, { success: true, next_page_key: 'K1', sales: [sale(4), dup] }), res(200, { success: true, sales: [dup, sale(6)] })));
  assert.equal(r.sales.length, 3); assert.deepEqual(r.sales.map((s) => s.id), [sale(4).id, dup.id, sale(6).id]);
});

await t('5 a big history stops at maxPages, says so, and can be resumed from next_page_key', async () => {
  assert.equal(MAX_PAGES, 500);
  const f = script((url) => res(200, page(1, 2, `K${new URL(url).searchParams.get('page_key') || '0'}x`)));
  const r = await fetchGumroadSales(TOKEN, { maxPages: 2, sleep }, f);
  assert.equal(r.ok, true); assert.equal(r.truncated, true); assert.equal(r.pages, 2); assert.equal(f.calls.length, 2); assert.ok(r.next_page_key);
  const g = script(res(200, page(1, 1))); await fetchGumroadSales(TOKEN, { page_key: r.next_page_key, sleep }, g); assert.equal(new URL(g.calls[0].url).searchParams.get('page_key'), r.next_page_key);
});

await t('6 a page key that repeats stops the loop instead of spinning', async () => {
  const f = script(res(200, page(1, 1, 'SAME'))); const r = await fetchGumroadSales(TOKEN, { sleep }, f);
  assert.equal(r.ok, false); assert.equal(r.code, 'bad_response'); assert.ok(f.calls.length <= 3);
});

await t('7 a revoked token (401) is a named failure and can never be read as an empty sales list', async () => {
  const r = await fetchGumroadSales(TOKEN, { sleep }, script(res(401, '')));
  assert.equal(r.ok, false); assert.equal(r.code, 'revoked'); assert.equal(r.status, 401); assert.match(r.error, /Reconnect Gumroad/);
  assert.throws(() => r.sales, /revoked/, 'reading .sales of a failure must throw');
  assert.ok(!('sales' in JSON.parse(JSON.stringify(r))), 'a failure serialises without a sales key');
  assert.ok(!JSON.stringify(r).includes(TOKEN));
  // the way api/_connect.js reads the result today: a failure must stop the sync, not become []
  assert.throws(() => (Array.isArray(r) ? r : (r?.sales ?? [])), /Reconnect Gumroad/);
});

await t('8 a token without view_sales (403) says exactly that', async () => {
  const r = await fetchGumroadSales(TOKEN, { sleep }, script(res(403, '')));
  assert.equal(r.ok, false); assert.equal(r.code, 'missing_scope'); assert.equal(r.status, 403); assert.match(r.error, /view_sales/); assert.match(r.error, /Reconnect Gumroad/);
  assert.throws(() => r.sales, /view_sales/);
});

await t('9 rate limit: Retry-After is honoured, then it succeeds; a limit that never lifts is rate_limited', async () => {
  fresh();
  const ok = await fetchGumroadSales(TOKEN, { sleep }, script(res(429, '', { 'retry-after': '1' }), res(200, page(1, 2))));
  assert.equal(ok.ok, true); assert.equal(ok.sales.length, 2); assert.deepEqual(delays, [1000]);
  fresh();
  const f = script(res(429, '', { 'retry-after': '7' })); const r = await fetchGumroadSales(TOKEN, { sleep }, f);
  assert.equal(r.ok, false); assert.equal(r.code, 'rate_limited'); assert.equal(r.retry_after_s, 7); assert.equal(f.calls.length, 3); assert.deepEqual(delays, [7000, 7000]);
  assert.throws(() => r.sales);
  fresh();
  const long = await fetchGumroadSales(TOKEN, { sleep }, script(res(429, '', { 'retry-after': '600' })));
  assert.equal(long.code, 'rate_limited'); assert.deepEqual(delays, [], 'a wait of ten minutes is reported, not slept through');
});

await t('10 an outage backs off and recovers; one that does not end is unavailable, with the token scrubbed from the reason', async () => {
  fresh();
  const rec = await fetchGumroadSales(TOKEN, { sleep }, script(res(503, 'busy'), new Error('socket hang up'), res(200, page(1, 1))));
  assert.equal(rec.ok, true); assert.deepEqual(delays, [500, 1000]);
  const down = await fetchGumroadSales(TOKEN, { sleep }, script(new Error(`ECONNRESET while sending Bearer ${TOKEN}`)));
  assert.equal(down.ok, false); assert.equal(down.code, 'unavailable'); assert.ok(!JSON.stringify(down).includes(TOKEN)); assert.match(down.error, /redacted/);
  const five = await fetchGumroadSales(TOKEN, { sleep }, script(res(502, '<html>bad gateway</html>')));
  assert.equal(five.code, 'unavailable'); assert.equal(five.status, 502);
});

await t('11 malformed answers fail closed: not JSON, wrong shape, success:false, a sale that cannot be read, a 400', async () => {
  const cases = [
    [res(200, 'not json at all'), 'bad_response'], [res(200, '<html>login</html>'), 'bad_response'], [res(200, '[1,2]'), 'bad_response'], [res(200, { success: true }), 'bad_response'],
    [res(200, { success: true, sales: 'x' }), 'bad_response'], [res(200, { success: false, message: `bad token ${TOKEN}` }), 'refused'],
    [res(200, { success: true, sales: [sale(1), { id: 'X', created_at: '2026-11-01T00:00:00Z' }] }), 'bad_response'],       // no price
    [res(200, { success: true, sales: [sale(1), { ...sale(2), price: '1999' }] }), 'bad_response'],                         // price as text
    [res(200, { success: true, sales: [sale(1), { ...sale(2), created_at: 'soon' }] }), 'bad_response'],
    [res(400, { status: 400, error: `Invalid page_key. ${TOKEN}` }), 'bad_request'],
  ];
  for (const [answer, code] of cases) {
    const r = await fetchGumroadSales(TOKEN, { sleep }, script(answer)); assert.equal(r.ok, false, code); assert.equal(r.code, code); assert.ok(!JSON.stringify(r).includes(TOKEN), 'token leaked');
    assert.throws(() => r.sales);
  }
  const partial = await fetchGumroadSales(TOKEN, { sleep }, script(res(200, page(1, 10, 'K1')), res(200, { success: true, sales: [{ id: 'X' }] })));
  assert.equal(partial.ok, false, 'a bad second page discards the first'); assert.match(partial.error, /nothing was kept/);
});

await t('12 no token, or a token that cannot be one, is refused before any call', async () => {
  const f = script(res(200, page(1, 1)));
  for (const bad of [undefined, null, '', 'abc', 12345678]) { const r = await fetchGumroadSales(bad, { sleep }, f); assert.equal(r.ok, false); assert.equal(r.code, 'bad_request'); }
  assert.equal(f.calls.length, 0);
});

// ------------------------------------------------------------------ toRevenueRows
const ctx = { connection_id: 'poppy', house_id: 'poppy' };
const KEYS = ['amount', 'connection_id', 'currency', 'external_id', 'house_id', 'kind', 'meta', 'occurred_at', 'product_id', 'source'];

await t('13 a sale becomes one exact row; connection and house pass through; the date is ISO', () => {
  const [row, ...more] = toRevenueRows([sale(1)], ctx);
  assert.equal(more.length, 0); assert.deepEqual(Object.keys(row).sort(), KEYS);
  assert.equal(row.source, 'gumroad'); assert.equal(row.connection_id, 'poppy'); assert.equal(row.house_id, 'poppy'); assert.equal(row.product_id, 'PROD-1==');
  assert.equal(row.amount, 19.99); assert.equal(row.currency, 'USD'); assert.equal(row.kind, 'sale'); assert.equal(row.external_id, sale(1).id); assert.equal(row.occurred_at, '2026-11-02T10:00:00.000Z');
  assert.deepEqual(toRevenueRows([sale(1)]).map((r) => [r.connection_id, r.house_id]), [[null, null]]);
});

await t('14 cents are exact: Gumroad price is integer USD cents, never a float', () => {
  const table = [[0, 0], [1, 0.01], [5, 0.05], [99, 0.99], [100, 1], [1999, 19.99], [2990, 29.9], [100000, 1000], [123456, 1234.56], [7, 0.07]];
  for (const [cents, major] of table) assert.equal(toRevenueRows([sale(1, { price: cents })], ctx)[0].amount, major, `${cents} cents`);
  const total = toRevenueRows(Array.from({ length: 10 }, (_, i) => sale(i, { id: `S${i}`, price: 10 })), ctx).reduce((s, r) => s + Math.round(r.amount * 100), 0);
  assert.equal(total, 100, 'ten sales of $0.10 are $1.00 to the cent');
});

await t('15 a product listed in rupees is still USD: price stays USD cents, the listing is kept in meta', () => {
  const [row] = toRevenueRows([sale(1, { price: 600, currency: 'inr', formatted_display_price: '₹499', amount_refundable_in_currency: '499' })], ctx);
  assert.equal(row.amount, 6); assert.equal(row.currency, 'USD'); assert.equal(row.meta.listed_currency, 'INR'); assert.equal(row.meta.listed_price, '₹499');
});

await t('16 a free claim is a sale of 0 and never has a refund row', () => {
  const rows = toRevenueRows([sale(1, { price: 0, paid: false, refunded: true })], ctx);
  assert.equal(rows.length, 1); assert.equal(rows[0].amount, 0); assert.equal(rows[0].meta.paid, false);
});

await t('17 a full refund adds a refund row with its own stable id and the same amount (never negative), so net revenue is zero', () => {
  const rows = toRevenueRows([sale(1, { refunded: true, amount_refundable_in_currency: '0' })], ctx);
  assert.equal(rows.length, 2); assert.equal(rows[0].kind, 'sale'); assert.equal(rows[1].kind, 'refund'); assert.equal(rows[1].amount, 19.99); assert.equal(rows[1].external_id, `${sale(1).id}:refund`);
  assert.equal(rows[1].meta.reason, 'refund'); assert.equal(rows[1].occurred_at, rows[0].occurred_at); assert.equal(Math.round((rows[0].amount - rows[1].amount) * 100), 0); assert.ok(rows.every((r) => r.amount >= 0), 'the ledger check is amount >= 0');
  assert.equal(new Set(rows.map((r) => r.external_id)).size, 2);
});

await t('18 a chargeback takes the whole sale, once, even when it was also refunded; a won dispute takes nothing', () => {
  const lost = toRevenueRows([sale(1, { chargedback: true, disputed: true })], ctx); assert.equal(lost.length, 2); assert.equal(lost[1].amount, 19.99); assert.equal(lost[1].meta.reason, 'chargeback');
  const both = toRevenueRows([sale(1, { chargedback: true, refunded: true })], ctx); assert.equal(both.length, 2);
  const won = toRevenueRows([sale(1, { disputed: true, dispute_won: true, chargedback: false })], ctx); assert.equal(won.length, 1);
});

await t('19 a partial refund: exact for a USD listing, flagged unknown for any other currency', () => {
  const usd = toRevenueRows([sale(1, { partially_refunded: true, amount_refundable_in_currency: '9.99' })], ctx);
  assert.equal(usd.length, 2); assert.equal(usd[1].amount, 10); assert.equal(usd[1].meta.reason, 'partial refund'); assert.equal(usd[1].meta.refund_amount_unknown, undefined);
  const grown = toRevenueRows([sale(1, { partially_refunded: true, amount_refundable_in_currency: '4.99' })], ctx); assert.equal(grown[1].amount, 15, 'a later, bigger refund updates the same row');
  assert.equal(grown[1].external_id, usd[1].external_id);
  const inr = toRevenueRows([sale(1, { price: 600, currency: 'inr', partially_refunded: true, amount_refundable_in_currency: '250' })], ctx);
  assert.equal(inr.length, 2); assert.equal(inr[1].amount, 0); assert.equal(inr[1].meta.refund_amount_unknown, true);
  for (const missing of [undefined, null, '', 'n/a']) { const m = toRevenueRows([sale(1, { partially_refunded: true, amount_refundable_in_currency: missing })], ctx); assert.equal(m[1].amount, 0, `remainder ${String(missing)}`); assert.equal(m[1].meta.refund_amount_unknown, true); }
  const over = toRevenueRows([sale(1, { partially_refunded: true, amount_refundable_in_currency: '1,999.00' })], ctx); assert.equal(over[1].amount, 0, 'a remainder above the price cannot make a negative refund');
});

await t('20 no buyer data, no licence key, no card, no token reaches a row', () => {
  const rows = toRevenueRows([sale(1, { refunded: true }), sale(2)], ctx); const text = JSON.stringify(rows);
  for (const needle of ['buyer@example.test', 'Buyer Name', '625003', 'LICENSE-SECRET', '4242', 'SELLER-xyz', 'PURCHASER-1']) assert.ok(!text.includes(needle), `leaked ${needle}`);
  assert.deepEqual(Object.keys(rows[0].meta).sort(), ['fee_usd', 'listed_currency', 'listed_price', 'order_id', 'paid', 'product_name', 'product_permalink', 'quantity', 'recurring']);
  assert.equal(rows[0].meta.fee_usd, 1.3);
});

await t('21 external ids are unique and identical on a repeat run (an idempotent ledger upsert key)', () => {
  const sales = Array.from({ length: 12 }, (_, i) => sale(i, { id: `ID${i}`, refunded: i % 3 === 0 }));
  const a = toRevenueRows(sales, ctx), b = toRevenueRows(sales, ctx);
  assert.deepEqual(a, b); assert.equal(new Set(a.map((r) => r.external_id)).size, a.length);
});

await t('22 an unreadable entry never becomes money', () => {
  assert.deepEqual(toRevenueRows(null, ctx), []); assert.deepEqual(toRevenueRows('x', ctx), []);
  assert.equal(toRevenueRows([null, 7, {}, { id: 'a' }, { id: 'a', price: '5', created_at: '2026-11-01T00:00:00Z' }, { id: 'a', price: -1, created_at: '2026-11-01T00:00:00Z' }, sale(1)], ctx).length, 1);
});

// ------------------------------------------------------------------ verifyGumroad
const USER = { success: true, user: { name: 'Synthetic Store', user_id: 'USER-1==', id: 'USER-1==', email: 'owner@example.test', url: 'https://synthetic.gumroad.com', profile_picture_url: 'https://assets.example.test/a' } };
const NOW = Date.parse('2026-11-12T10:00:00Z');

await t('23 verify: a live token with view_sales is proven by two reads, and the probe asks for nothing', async () => {
  const f = script(res(200, USER), res(200, { success: true, sales: [] }));
  const v = await verifyGumroad(TOKEN, f, { sleep, now: NOW });
  assert.equal(v.ok, true); assert.equal(v.external_name, 'Synthetic Store'); assert.equal(v.external_id, 'USER-1=='); assert.equal(v.external_handle, 'https://synthetic.gumroad.com'); assert.equal(v.account_label, 'owner@example.test');
  assert.deepEqual(v.scopes, ['view_profile', 'view_sales']); assert.equal(v.can_read_sales, true); assert.deepEqual(v.missing_scopes, []); assert.equal(v.warning, null); assert.equal(v.error, null);
  assert.equal(f.calls.length, 2); assert.equal(new URL(f.calls[0].url).pathname, '/v2/user'); assert.equal(new URL(f.calls[1].url).pathname, '/v2/sales'); assert.equal(new URL(f.calls[1].url).searchParams.get('after'), '2026-11-13');
  assert.ok(f.calls.every((c) => !c.url.includes(TOKEN))); assert.ok(!JSON.stringify(v).includes(TOKEN));
});

await t('24 verify: a token that works but lacks view_sales is ok, partial, and says what to do (the Gumroad "partial, no view_sales" state)', async () => {
  const v = await verifyGumroad(TOKEN, script(res(200, USER), res(403, '')), { sleep, now: NOW });
  assert.equal(v.ok, true); assert.equal(v.can_read_sales, false); assert.deepEqual(v.missing_scopes, ['view_sales']); assert.deepEqual(v.scopes, ['view_profile']); assert.equal(v.code, 'missing_scope'); assert.match(v.warning, /view sales/);
});

await t('25 verify: a revoked token fails at the first read or the second, and the failure cannot be read as a list', async () => {
  const a = await verifyGumroad(TOKEN, script(res(401, '')), { sleep, now: NOW }); assert.equal(a.ok, false); assert.equal(a.code, 'revoked');
  const b = await verifyGumroad(TOKEN, script(res(200, USER), res(401, '')), { sleep, now: NOW }); assert.equal(b.ok, false); assert.equal(b.code, 'revoked'); assert.throws(() => b.sales);
});

await t('26 verify: the sales probe failing for a transient reason does not condemn the token', async () => {
  const v = await verifyGumroad(TOKEN, script(res(200, USER), res(503, 'busy')), { sleep, now: NOW });
  assert.equal(v.ok, true); assert.equal(v.can_read_sales, null); assert.deepEqual(v.scopes, ['view_profile']); assert.match(v.warning, /could not be checked/);
  const odd = await verifyGumroad(TOKEN, script(res(200, USER), res(200, { success: true })), { sleep, now: NOW }); assert.equal(odd.can_read_sales, null);
});

await t('27 verify: malformed or empty account answers fail closed; short tokens are refused without a call', async () => {
  for (const [answer, code] of [[res(200, 'nope'), 'bad_response'], [res(200, { success: true }), 'bad_response'], [res(200, { success: false, message: 'x' }), 'refused'], [res(500, 'err'), 'unavailable'], [res(429, '', { 'retry-after': '90' }), 'rate_limited']]) {
    const v = await verifyGumroad(TOKEN, script(answer), { sleep, now: NOW }); assert.equal(v.ok, false, code); assert.equal(v.code, code);
  }
  const f = script(res(200, USER)); assert.equal((await verifyGumroad('tok', f, { sleep })).code, 'bad_request'); assert.equal(f.calls.length, 0);
  const named = await verifyGumroad(TOKEN, script(res(200, { success: true, user: { email: 'only@example.test', id: 'U2' } }), res(200, { success: true, sales: [] })), { sleep, now: NOW });
  assert.equal(named.external_name, 'only@example.test'); assert.equal(named.external_id, 'U2');
});

// ------------------------------------------------------------------ the contract with Nova's route (api/_connect.js), when that file is present
await t('28 the rows pass api/_connect.js normalise() and fold() into the right net number', async () => {
  let C = null; try { C = await import('./api/_connect.js'); } catch { /* not installed in this tree */ }
  if (!C || typeof C.normalise !== 'function' || typeof C.fold !== 'function') { skip++; console.log('SKIP 28 api/_connect.js has no normalise/fold here'); return; }
  const rows = toRevenueRows([sale(1), sale(2, { price: 1000, refunded: true }), sale(3, { price: 500, partially_refunded: true, amount_refundable_in_currency: '2.50' })], ctx);
  const clean = C.normalise(rows, { provider: 'gumroad', connection_id: 'poppy', house_id: 'poppy' });
  assert.ok(clean.every((r) => r.amount >= 0 && r.currency === 'USD' && ['sale', 'refund'].includes(r.kind)), 'normalise keeps kind and makes the amount positive');
  const sum = (kind) => Math.round(clean.filter((r) => r.kind === kind).reduce((s, r) => s + r.amount, 0) * 100) / 100;
  const ledger = [{ connection_id: 'poppy', currency: 'USD', sales: sum('sale'), refunds: sum('refund'), sales_30d: 0, refunds_30d: 0, orders: 3, refund_count: 2, last_sale_at: null }];
  assert.equal(sum('sale'), 34.99); assert.equal(sum('refund'), 12.5);
  assert.deepEqual(C.fold(ledger, 'poppy').revenue, { USD: 22.49 });
});

console.log(`\nconn.gumroad.test: ${pass} passed, ${fail} failed${skip ? `, ${skip} skipped` : ''}`);
process.exit(fail ? 1 : 0);
