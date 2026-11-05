// Run: node orbi-trending.test.js
// Orbi wallpaper "Trending" on Nova, tested for real: api/_orbi_trending.sql on real Postgres (PGlite, in
// process), requests through Nova's real handle(). Nothing about a person is stored, only design + day + count.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const { handle } = await import('./api/_nova.js');
const { _resetTrendingCache } = await import('./api/_orbi_trending.js');

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
const quiet = console.log; console.log = (...a) => { if (!(typeof a[0] === 'string' && a[0].startsWith('{"t":'))) quiet(...a); };

const db = new PGlite();
await db.exec('create role anon nologin; create role authenticated nologin;');
const sql = readFileSync(new URL('./api/_orbi_trending.sql', import.meta.url), 'utf8');
await db.exec(sql); await db.exec(sql);   // safe to run twice

let ip = 0;
const pick = async (design, from) => (await handle(db, { method: 'POST', path: '/api/orbi/wall/pick', query: {}, headers: { 'x-forwarded-for': from || `10.0.0.${++ip % 250}` }, body: { design } })).status;
const trending = async () => { const r = await handle(db, { method: 'GET', path: '/api/orbi/wall/trending', query: {}, headers: {}, body: null }); return { status: r.status, body: JSON.parse(r.body) }; };

ok('a pick is accepted', await pick('aurora-halo') === 204);
ok('a made-up path is refused', (await handle(db, { method: 'GET', path: '/api/orbi/wall/nope', query: {}, headers: {}, body: null })).status === 404);
ok('a bad design name is refused', await pick("x'; drop table orbi_wall_picks;--") === 400);
ok('an empty body is refused', (await handle(db, { method: 'POST', path: '/api/orbi/wall/pick', query: {}, headers: {}, body: null })).status === 400);
ok('no Coco device key is needed (Orbi users are not devices)', true);

// below the minimum, nothing is trending yet
ok('a handful of picks does not make anything trending', (await trending()).body.trending.length === 0);
for (let i = 0; i < 40; i++) await pick('coral-embers');
for (let i = 0; i < 30; i++) await pick('lagoon-reef');
for (let i = 0; i < 25; i++) await pick('aurora-halo');
for (let i = 0; i < 22; i++) await pick('bloom');
for (let i = 0; i < 5; i++) await pick('coral-silk');
_resetTrendingCache();
const t = await trending();
ok('the top 3 of the week, most picked first', JSON.stringify(t.body.trending) === JSON.stringify(['coral-embers', 'lagoon-reef', 'aurora-halo']), JSON.stringify(t.body));
ok('the list is the same for everyone and can be cached', t.status === 200 && t.body.updatedAt > 0);

// old picks fall out of the week
await db.exec(`insert into orbi_wall_picks (day, design, picks) values (current_date - 20, 'waves', 999)`);
_resetTrendingCache();
ok('picks older than a week do not count', !(await trending()).body.trending.includes('waves'));

// rate limit: one address cannot push a design up on its own
let refused = 0;
for (let i = 0; i < 40; i++) if (await pick('orbit', '9.9.9.9') === 429) refused++;
ok('one address is limited to 30 picks an hour', refused === 10, `refused ${refused}`);

// what is stored is only design, day and a count
const cols = (await db.query(`select column_name from information_schema.columns where table_name = 'orbi_wall_picks' order by ordinal_position`)).rows.map((r) => r.column_name);
ok('nothing about the person is stored (only day, design, picks)', JSON.stringify(cols) === JSON.stringify(['day', 'design', 'picks']), JSON.stringify(cols));
const rows = (await db.query(`select count(*)::int n from orbi_wall_picks where day = current_date`)).rows[0].n;
ok('one row per design per day, not per pick', rows === 6, `rows ${rows}`);

// the database itself refuses everyone but Nova's own role
for (const role of ['anon', 'authenticated']) {
  await db.exec(`reset role; set role ${role}`);
  const r1 = await db.query('select * from orbi_wall_picks').then(() => 'read', (e) => /permission denied/.test(e.message) ? 'denied' : e.message);
  const r2 = await db.query(`select orbi_wall_pick('bloom')`).then(() => 'ran', (e) => /permission denied/.test(e.message) ? 'denied' : e.message);
  await db.exec('reset role');
  ok(`${role} cannot read the counts or add picks directly`, r1 === 'denied' && r2 === 'denied', `${r1}/${r2}`);
}

quiet(`\norbi-trending.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
