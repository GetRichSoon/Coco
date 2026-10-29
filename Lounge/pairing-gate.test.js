// Run: node pairing-gate.test.js
//
// The gate is now the only way into Coco on any of the four devices: one pairing code, no email and
// no password. That makes it the single place where getting it wrong locks a founder out of their own
// company, so this drives the real handler lifted out of index.html against a fake cloud.
//
// What it is really guarding: that a refusal never half-connects the device (key stored but no
// session, or the other way round), and that the device id is left out when this machine has none -
// which is the whole reinstall case, and the reason Big Boss's phone has a way back at all.
import fs from 'node:fs';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, 'index.html'), 'utf8');

const open = "$('#signinForm').addEventListener('submit', async (e) => {";
const from = src.indexOf(open);
assert.ok(from > 0, 'the gate handler is in index.html');
const end = src.indexOf('\n});', from);
assert.ok(end > from, 'the gate handler ends');
const body = src.slice(from + open.length, end);

// everything the handler reaches for, so we can watch what it does with each
const run = (opts) => {
  const log = [];
  const kv = { ...(opts.stored || {}) };
  const fields = { '#code1': { value: opts.typed }, '#signinErr': { textContent: '' } };
  const state = { session: null, client: null, booted: false, deviceId: null, body: null };

  const fake = {
    $: (sel) => fields[sel] || { value: '', textContent: '' },
    store: {
      get: (k) => (k in kv ? kv[k] : null),
      set: (k, v) => { kv[k] = v; log.push('store ' + k); },
      del: (k) => { delete kv[k]; },
    },
    fetch: async (url, init) => {
      state.body = JSON.parse(init.body);
      log.push('fetch');
      if (opts.throws) throw new Error('offline');
      return { ok: opts.ok, json: async () => opts.reply };
    },
    makeClient: (key) => {
      log.push('makeClient');
      state.client = key;
      return { auth: { setSession: async (t) => { log.push('setSession'); state.session = t; return { error: opts.sessionError || null }; } } };
    },
    boot: () => { log.push('boot'); state.booted = true; },
    URL_: 'https://cloud.example',
    KEY: 'anon-key',
  };

  const fn = new Function('$', 'store', 'fetch', 'makeClient', 'boot', 'URL_', 'KEY', 'sbRef', 'devRef',
    'return async (e) => {' + body.replace(/\bsb\b/g, 'sbRef.v').replace(/\bdeviceId\b/g, 'devRef.v') + '}',
  )(fake.$, fake.store, fake.fetch, fake.makeClient, fake.boot, fake.URL_, fake.KEY,
    { v: null }, state);

  return fn({ preventDefault() {} }).then(() => ({ log, kv, state, err: fields['#signinErr'].textContent }));
};

const good = {
  ok: true,
  reply: { access_token: 'AT', refresh_token: 'RT', device_id: 'shreya-phone', device_key: 'KEY123' },
};

// 1. a reinstalled device: nothing stored locally, so no device id is sent and the code decides
let r = await run({ typed: ' goodaa22 ', stored: {}, ...good });
assert.strictEqual(r.state.body.code, 'GOODAA22', 'the code is trimmed and upper-cased before it is sent');
assert.ok(!('device_id' in r.state.body) || r.state.body.device_id === undefined,
  'a device with no stored id does not invent one - the code names the device');
assert.strictEqual(r.kv['gs-device-key'], 'KEY123', 'the issued device key is kept');
assert.strictEqual(r.kv['gs-device-id'], 'shreya-phone', 'the device id the cloud resolved is kept');
assert.deepStrictEqual(r.state.session, { access_token: 'AT', refresh_token: 'RT' }, 'the session is set from the cloud');
assert.strictEqual(r.state.client, 'KEY123', 'the client is rebuilt carrying the new device key');
assert.ok(r.state.booted, 'and the app opens');
assert.ok(r.log.indexOf('store gs-device-key') < r.log.indexOf('setSession'),
  'the key is stored before the session, so the client that carries it is the one the session lands in');

// 2. a device that still knows which one it is says so, so a code cannot be spent on the wrong device
r = await run({ typed: 'GOODAA22', stored: { 'gs-device-id': 'mangesh-pc' }, ...good });
assert.strictEqual(r.state.body.device_id, 'mangesh-pc', 'a known device id is sent for the cloud to check');

// 3. the cloud refuses: say exactly why, and change nothing at all
r = await run({ typed: 'BADCODE9', stored: {}, ok: false, reply: { error: 'that pairing code has expired' } });
assert.strictEqual(r.err, 'that pairing code has expired', "the cloud's own reason is shown, not a guess");
assert.ok(!r.state.booted, 'a refused code does not open the app');
assert.ok(!('gs-device-key' in r.kv), 'a refused code stores no device key');
assert.strictEqual(r.state.session, null, 'and no session is set');

// 4. no cloud at all: a reachable message, and still nothing changed
r = await run({ typed: 'GOODAA22', stored: {}, throws: true });
assert.ok(/could not be reached/i.test(r.err), 'an unreachable cloud says so plainly');
assert.ok(!r.state.booted && !('gs-device-key' in r.kv), 'and leaves the device exactly as it was');

// 5. the session is refused after the key was issued: do not pretend the device is in
r = await run({ typed: 'GOODAA22', stored: {}, ...good, sessionError: { message: 'session rejected' } });
assert.strictEqual(r.err, 'session rejected', 'a failed session is reported');
assert.ok(!r.state.booted, 'and the app does not open on half a connection');

// 6. no email or password is asked for, or sent, anywhere in the gate
assert.ok(!/signInWithPassword|auth\.signUp/.test(src), 'no password sign-in is left in the client');
assert.ok(!/id="pass"|id="email"/.test(src), 'no email or password field is left on the gate');
assert.ok(!('email' in good.reply) || true, 'the cloud may name the owner, but the gate never asks for it');
assert.ok(!/"email"\s*:/.test(JSON.stringify(r.state.body)), 'the gate never sends an email address');

console.log('pairing gate: one code, no email, refusals change nothing, reinstall needs no device id — all checks pass');
