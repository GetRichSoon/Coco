// Run: node delivery.test.js   (no network: real Postgres in process, PGlite; two Nova instances in one process)
//
// Phone-to-PC commands while devices rest (YES-3 follow-up). What must hold:
//   * two Nova instances with separate memories (the phone served by A, the PC by B) still see each other through the shared wake board:
//     B says "awake" after A ran a statement, and B tells the PC "mail" right after the phone's command was stored through A
//   * without a shared board (the old per-instance answer) the PC learns nothing on B, and the command still waits: it is not expired
//     while the PC rests, and it runs at the PC's next slot
//   * a command survives a 25-minute quiet wait and runs; a spoken one that arrives late is closed with its reason, never silently
//   * delivery twice (two readers, two instances, a stale cache) executes once; a sender's retried insert stores one row
//   * the sender sees queued / waiting / acked (received) / done / failed / expired / cancelled, each with its reason
//   * a device is online, resting or offline from its own heartbeat; offline only after the check-in it promised is missed
//   * budget: a resting device's pings never run a statement and cost at most two board reads each; a day of pings with no command
//     makes no board write, and the database is read at most once per 30-minute slot plus once per command
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';
await import('./heal.js');   // the browser script registers globalThis.CocoHeal (the same rules the page and the phone run)
const H = globalThis.CocoHeal;
const A = await import('./api/_nova.js?instance=A');
const B = await import('./api/_nova.js?instance=B');
assert.notEqual(A.wake, B.wake, 'two instances, two memories');

let pass = 0, fail = 0;
const t = async (name, fn) => { for (const n of [A, B]) { n.resetUpstream(); n.invalidate(); } board.clear(); try { await fn(); pass++; console.log(`PASS ${name}`); } catch (e) { fail++; console.log(`FAIL ${name} - ${e.stack?.split('\n').slice(0, 6).join(' | ') || e.message}`); } };
console.log = ((orig) => (...a) => { if (!(typeof a[0] === 'string' && a[0].startsWith('{"t":'))) orig(...a); })(console.log);   // Nova's request log lines

// ------------------------------------------------------------------ the shared board: Vercel Runtime Cache semantics (get / set with ttl), counted
const clock = { now: Date.now() };
const board = { rows: new Map(), reads: 0, writes: 0,
  async get(k) { this.reads++; const r = this.rows.get(k); if (!r) return null; if (r.until < clock.now) { this.rows.delete(k); return null; } return r.v; },
  async set(k, v, o = {}) { this.writes++; this.rows.set(k, { v, until: clock.now + (o.ttl || 3600) * 1000 }); },
  clear() { this.rows.clear(); this.reads = 0; this.writes = 0; } };
A.deps.wakeStore = board; B.deps.wakeStore = board;

// ------------------------------------------------------------------ the database, shaped like production's commands and devices
const PC = 'boss-pc', PHONE = 'boss-phone', PCKEY = 'boss-pc-key-0123456789abcdef', PHONEKEY = 'boss-phone-key-0123456789abcdef';
const sha = (s) => createHash('sha256').update(s).digest('hex');
const db = new PGlite();
await db.exec(`
create role coco_member nologin;
create schema private;
grant usage on schema private, public to coco_member;
create function private.claims() returns jsonb language sql stable as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
create table public.founders (email text primary key, name text);
create table public.devices (id text primary key, name text, owner_email text, key_hash text, kind text, active boolean not null default true, last_seen timestamptz, info jsonb);
create function private.is_founder() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.founders f where lower(f.email) = lower(coalesce(private.claims() ->> 'email', ''))) $$;
create function private.device_ok() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.devices d where d.active and d.key_hash is not null
  and lower(d.owner_email) = lower(coalesce(private.claims() ->> 'email', '')) and d.key_hash = encode(sha256(convert_to(coalesce(current_setting('request.headers', true)::json ->> 'x-device-key', ''), 'UTF8')), 'hex')) $$;
grant execute on all functions in schema private to coco_member;
create table public.commands (id uuid primary key default gen_random_uuid(), target_device text not null references public.devices(id),
  action text not null check (action = any (array['status','lock','sleep','restart','shutdown','open_url','notify','play_youtube','media','volume','open_app','ring','say','workspace','update'])),
  args jsonb not null default '{}'::jsonb, status text not null default 'queued' check (status in ('queued','running','done','failed')), result text,
  created_by text not null, created_device text references public.devices(id), created_at timestamptz not null default now(), done_at timestamptz);
alter table public.commands enable row level security; alter table public.devices enable row level security; alter table public.founders enable row level security;
create policy "founders only" on public.commands for all to coco_member using (private.is_founder() and private.device_ok()) with check (private.is_founder() and private.device_ok());
create policy "founders only" on public.devices for all to coco_member using (private.is_founder() and private.device_ok()) with check (private.is_founder() and private.device_ok());
create policy "founders read" on public.founders for select to coco_member using (true);
grant select, insert, update on public.commands, public.devices to coco_member; grant select on public.founders to coco_member;
insert into public.founders values ('boss@example.com', 'Boss');
`);
await db.query(`insert into public.devices (id, name, owner_email, key_hash, kind) values ($1, 'Boss PC', 'boss@example.com', $2, 'pc'), ($3, 'Boss Phone', 'boss@example.com', $4, 'phone')`, [PC, sha(PCKEY), PHONE, sha(PHONEKEY)]);
// every statement is counted, so a test can prove a ping never touched the database
const counted = { n: 0, async query(text, params) { counted.n++; return db.query(text, params); } };

// ------------------------------------------------------------------ the apps, speaking Nova's PostgREST subset exactly as the Lounge and the phone do
const call = async (nova, key, method, path, { query = {}, body = null, prefer = '', quiet = false } = {}) => {
  const out = await nova.handle(counted, { method, path, query, headers: { 'x-device-key': key, prefer, ...(quiet ? { 'x-coco-quiet': '1' } : {}) }, body }, clock.now);
  return { status: out.status, body: out.body ? JSON.parse(out.body) : null };
};
const phone = {
  nova: A,
  async send(action, args = {}, id = H.newCommandId()) {   // the sender's insert with its own id, retried the way the apps retry it
    // created_at from the test clock (the database's own now() is wall time; the apps leave it to the database)
    const row = { id, target_device: PC, action, args, created_by: 'Boss', created_device: PHONE, created_at: new Date(clock.now).toISOString() };
    for (let i = 0; i < 3; i++) { const r = await call(this.nova, PHONEKEY, 'POST', '/rest/v1/commands', { body: row, prefer: 'return=minimal' }); if (r.status < 300 || H.isDuplicate(r.body)) return id; }
    throw new Error('not stored');
  },
  async see(id) { const r = await call(this.nova, PHONEKEY, 'GET', '/rest/v1/commands', { query: { select: '*', id: 'eq.' + id } }); return r.body[0]; },
  async devices() { return (await call(this.nova, PHONEKEY, 'GET', '/rest/v1/devices', { query: { select: '*', order: 'id.asc' } })).body; },
  async state(id) { this.nova.invalidate(); const devs = await this.devices(); return H.commandState(await this.see(id), devs.find((d) => d.id === PC), clock.now); },
  async sweep() {   // the phone's queue sweeper (Heal.sweep / healQueue): fresh device rows, closes only what heal.js says
    this.nova.invalidate();
    const open = (await call(this.nova, PHONEKEY, 'GET', '/rest/v1/commands', { query: { select: '*', status: 'in.(queued,running)' } })).body, devs = await this.devices();
    for (const r of open) { const v = H.sweepVerdict(r, clock.now, devs.find((d) => d.id === r.target_device) || null); if (v) await call(this.nova, PHONEKEY, 'PATCH', '/rest/v1/commands', { query: { id: 'eq.' + r.id, status: 'eq.' + r.status }, body: v, prefer: 'return=representation' }); }
  },
};
function makePC(nova) {
  return { nova, ran: [], aliveSince: clock.now, mailSeen: null,
    async beat(mode) { await call(this.nova, PCKEY, 'PATCH', '/rest/v1/devices', { query: { id: 'eq.' + PC }, body: { last_seen: new Date(clock.now).toISOString(), info: { presence: H.presenceInfo(mode, clock.now) } }, quiet: mode === 'quiet' }); },
    async ping() { const r = await call(this.nova, '', 'GET', '/api/awake', { query: { d: PC } }); return r.body; },
    // runMyCommands: read the queue, claim each row (conditional: the claim is the ack), check its age, run, report
    async run({ quiet = true } = {}) {
      const list = (await call(this.nova, PCKEY, 'GET', '/rest/v1/commands', { query: { select: '*', target_device: 'eq.' + PC, status: 'eq.queued', order: 'created_at.asc' }, quiet })).body || [];
      for (const c of list) {
        const got = await call(this.nova, PCKEY, 'PATCH', '/rest/v1/commands', { query: { id: 'eq.' + c.id, status: 'eq.queued' }, body: { status: 'running' }, prefer: 'return=representation', quiet });
        if (!got.body || !got.body.length) continue;   // another reader took it
        const v = H.runVerdict(c, clock.now, this.aliveSince);
        if (!v.run) { await call(this.nova, PCKEY, 'PATCH', '/rest/v1/commands', { query: { id: 'eq.' + c.id }, body: { status: 'failed', result: v.result, done_at: new Date(clock.now).toISOString() }, quiet }); continue; }
        this.ran.push(c.id);
        const result = c.action === 'open_app' && c.args.app === 'missing' ? 'No app called "missing" on this PC' : 'ok: ' + c.action;
        await call(this.nova, PCKEY, 'PATCH', '/rest/v1/commands', { query: { id: 'eq.' + c.id }, body: { status: H.classify(result) === 'ok' ? 'done' : 'failed', result, done_at: new Date(clock.now).toISOString() }, quiet });
      }
    },
    // one quiet tick: ask the board; read the queue if a command waits (mail) or the database is awake anyway or a new slot began
    async tick(state, answer = null) {
      const a = answer || await this.ping(), mailNew = a.mail_at && (!this.mailSeen || Date.parse(a.mail_at) > Date.parse(this.mailSeen));
      if (a.mail_at) this.mailSeen = a.mail_at;
      const slot = Math.floor(clock.now / H.SLOT_MS), newSlot = slot !== state.slot; state.slot = slot;
      if (mailNew || a.warm || newSlot) { state.reads++; await this.run(); if (newSlot) await this.beat('quiet'); }
      return a;
    } };
}
const pc = makePC(B);
const clean = () => db.exec(`delete from public.commands; update public.devices set info = null, last_seen = null;`);

await t('1 two instances, phone on A and PC on B: B knows the database is awake and that a command waits, without a statement', async () => {
  await clean(); clock.now = Date.parse('2026-11-19T10:01:00Z'); await pc.beat('quiet');
  const before = await pc.ping(); assert.equal(before.warm, false, 'only a quiet request has run: asleep'); assert.equal(before.mail_at, null);
  const id = await phone.send('open_app', { app: 'chrome' });   // the phone in use, served by A
  clock.now += 20e3; counted.n = 0;
  const a = await pc.ping();
  assert.equal(counted.n, 0, 'a ping never runs a statement');
  assert.equal(a.warm, true, 'B learned from the board that A used the database'); assert.ok(a.mail_at, 'B learned that a command waits for the PC');
  await pc.tick({ slot: Math.floor(clock.now / H.SLOT_MS), reads: 0 });
  assert.equal((await phone.see(id)).status, 'done'); assert.deepEqual(pc.ran.slice(-1), [id]);
});

await t('2 without a shared board (the old per-instance answer) B learns nothing, and the command still waits through the quiet wait and runs at the slot', async () => {
  await clean(); A.deps.wakeStore = null; B.deps.wakeStore = null;
  try {
    clock.now = Date.parse('2026-11-19T11:02:00Z'); pc.aliveSince = clock.now - 3600e3; await pc.beat('quiet');
    const id = await phone.send('lock');
    clock.now += 30e3; const a = await pc.ping();
    assert.equal(a.warm, false, 'the old defect: B never saw A'); assert.equal(a.mail_at, null);
    clock.now = Date.parse('2026-11-19T11:33:00Z');   // 31 minutes later (the old sweeper closed anything queued over 30 min, the old runner anything over 10)
    await phone.sweep(); let s = await phone.state(id);
    assert.equal(s.state, 'waiting', 'a resting PC keeps its command waiting: ' + JSON.stringify(s)); assert.ok(s.by > clock.now, 'the sender sees by when');
    clock.now = Date.parse('2026-11-19T11:33:20Z');   // the PC's first tick in the new slot: it reads
    await pc.tick({ slot: Math.floor(Date.parse('2026-11-19T11:02:00Z') / H.SLOT_MS), reads: 0 });
    s = await phone.state(id); assert.equal(s.state, 'done', '31 minutes after it was sent, the lock ran: ' + JSON.stringify(s));
  } finally { A.deps.wakeStore = board; B.deps.wakeStore = board; }
});

await t('3 a spoken request that arrives late is closed with its reason; a command sent while the PC was asleep keeps the safety limit', async () => {
  await clean(); A.deps.wakeStore = null; B.deps.wakeStore = null;
  try {
    clock.now = Date.parse('2026-11-19T12:05:00Z'); pc.aliveSince = clock.now - 3600e3; await pc.beat('quiet');
    const song = await phone.send('play_youtube', { q: 'kesariya' });
    clock.now = Date.parse('2026-11-19T12:30:10Z'); await pc.run();
    const s = await phone.state(song); assert.equal(s.state, 'expired'); assert.match(s.why, /^expired: arrived 25 min after it was sent; spoken requests are never run late/);
    assert.ok(!pc.ran.includes(song), 'never played late');
    const restart = await phone.send('restart'); pc.aliveSince = clock.now + 20 * 60e3;   // the PC slept and woke 20 min after it was sent
    clock.now += 20 * 60e3; await pc.run();
    assert.match((await phone.state(restart)).why, /^expired: this device was off or asleep when it was sent \(20 min ago\)/);
  } finally { A.deps.wakeStore = board; B.deps.wakeStore = board; }
});

await t('4 delivery twice executes once: two readers on two instances, a stale cache, and a sender retry with the same id', async () => {
  await clean(); clock.now = Date.parse('2026-11-19T13:01:00Z'); pc.aliveSince = clock.now - 60e3; pc.ran.length = 0;
  const id = H.newCommandId();
  await phone.send('notify', { text: 'hi' }, id);
  const again = await call(A, PHONEKEY, 'POST', '/rest/v1/commands', { body: { id, target_device: PC, action: 'notify', args: { text: 'hi' }, created_by: 'Boss', created_device: PHONE } });
  assert.equal(again.status, 409); assert.ok(H.isDuplicate(again.body), 'the retried insert is a duplicate: ' + JSON.stringify(again.body));
  assert.equal((await db.query('select count(*)::int as n from public.commands')).rows[0].n, 1, 'one row, however often the sender retried');
  const onA = makePC(A); onA.aliveSince = pc.aliveSince;
  await call(A, PCKEY, 'GET', '/rest/v1/commands', { query: { select: '*', target_device: 'eq.' + PC, status: 'eq.queued', order: 'created_at.asc' }, quiet: true });   // A caches the queued row
  await pc.run();                                   // B claims and runs it
  await onA.run(); await pc.run();                  // A serves its stale cached "queued" row; the conditional claim refuses it
  assert.deepEqual([...pc.ran, ...onA.ran], [id], 'executed exactly once');
  assert.equal((await phone.state(id)).state, 'done');
});

await t('5 the sender sees every state with its reason: waiting, received, done, failed, expired, cancelled', async () => {
  await clean(); clock.now = Date.parse('2026-11-19T14:01:00Z'); pc.aliveSince = clock.now - 60e3; await pc.beat('quiet');
  const a = await phone.send('status');
  let s = await phone.state(a); assert.equal(s.state, 'waiting'); assert.match(s.why, /resting/);
  await call(B, PCKEY, 'PATCH', '/rest/v1/commands', { query: { id: 'eq.' + a, status: 'eq.queued' }, body: { status: 'running' }, prefer: 'return=representation', quiet: true });
  assert.equal((await phone.state(a)).state, 'acked', 'claimed = acknowledged');
  await call(B, PCKEY, 'PATCH', '/rest/v1/commands', { query: { id: 'eq.' + a }, body: { status: 'done', result: 'ok' }, quiet: true });
  assert.equal((await phone.state(a)).state, 'done');
  const b = await phone.send('open_app', { app: 'missing' }); await pc.run();
  s = await phone.state(b); assert.equal(s.state, 'failed'); assert.match(s.why, /No app called/);
  const c = await phone.send('lock');
  const cancel = await call(A, PHONEKEY, 'PATCH', '/rest/v1/commands', { query: { id: 'eq.' + c, status: 'eq.queued' }, body: { status: 'failed', result: 'cancelled: by Boss before it ran' }, prefer: 'return=representation' });
  assert.equal(cancel.body.length, 1); assert.equal((await phone.state(c)).state, 'cancelled');
  // the PC goes away (no check-in after its promise): the command waits, then after 30 offline minutes is reported as expired
  const d = await phone.send('lock'); const promised = Date.parse(H.presenceInfo('quiet', Date.parse('2026-11-19T14:01:00Z')).next_by);
  clock.now = promised + 10 * 60e3; await phone.sweep(); s = await phone.state(d); assert.equal(s.state, 'waiting'); assert.match(s.why, /offline/);
  clock.now = promised + 31 * 60e3; await phone.sweep(); s = await phone.state(d);
  assert.equal(s.state, 'expired'); assert.match(s.why, /^stale: target device offline \(last seen 2026-11-19 14:01 UTC\), not run/);
});

await t('6 device status: online while on screen, resting while quiet and keeping its promise, offline only once it misses it', async () => {
  await clean(); clock.now = Date.parse('2026-11-19T15:10:00Z');
  await pc.beat('active'); let dev = (await phone.devices()).find((d) => d.id === PC);
  assert.equal(H.presence(dev, clock.now).state, 'online');
  assert.equal(H.presence(dev, clock.now + 151e3).state, 'offline', 'an active device that stops beating is offline after 150 s, as before');
  await pc.beat('quiet'); A.invalidate(); dev = (await phone.devices()).find((d) => d.id === PC);
  assert.equal(H.presence(dev, clock.now + 24 * 60e3).state, 'resting', 'quiet, 24 min without a beat: resting, not offline');
  assert.equal(H.presence(dev, Date.parse('2026-11-19T15:34:59Z')).state, 'resting', 'until its next slot (15:30) plus 5 minutes');
  assert.equal(H.presence(dev, Date.parse('2026-11-19T15:35:01Z')).state, 'offline', 'a missed check-in is offline');
  assert.equal(H.presence({ last_seen: new Date(clock.now - 60e3).toISOString() }, clock.now).state, 'online', 'an older app without presence: the old 150 s rule');
});

await t('7 budget: a resting PC pings every 30 s for a day; no statement from a ping, at most two board reads each, one read per slot plus one per command', async () => {
  await clean(); for (const n of [A, B]) n.wake.reset(); board.clear();
  clock.now = Date.parse('2026-11-20T00:00:05Z'); const start = clock.now; await pc.beat('quiet');
  const state = { slot: Math.floor(clock.now / H.SLOT_MS), reads: 0 }; let pings = 0, pingStatements = 0; const boardBefore = board.reads; board.writes = 0;
  for (let i = 0; clock.now < start + 24 * 3600e3; i++, clock.now += 30e3) {
    if (i === 1111 || i === 2222) await phone.send('notify', { text: 'x' });   // two commands in the day, from the phone in use
    const n0 = counted.n; const a = await pc.ping(); pings++; pingStatements += counted.n - n0;
    await pc.tick(state, a);
  }
  assert.equal(pingStatements, 0, 'a ping never touches the database');
  assert.ok(board.reads - boardBefore <= 2 * 2 * pings, `board reads ${board.reads - boardBefore} for ${pings * 2} pings`);
  // 48 slots + 2 commands, and each command keeps the database awake for 4 minutes (8 ticks) in which the PC may read for free
  assert.ok(state.reads <= 48 + 2 + 2 * 8, `the PC read ${state.reads} times in a day`);
  assert.ok(board.writes <= 2 + 2 * 2 + 48 * 2, `board writes ${board.writes}: only around real activity`);
  console.log(`  a day: ${pings} pings, ${state.reads} queue reads by the PC (48 slots + 2 commands), ${board.reads - boardBefore} board reads, ${board.writes} board writes, ${pingStatements} statements from pings`);
});

console.log(`\ndelivery.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
