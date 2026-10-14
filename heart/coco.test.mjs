import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';

// Point Coco at a throwaway brain, vault and fake Nova so tests never touch real data.
const tmp = mkdtempSync(join(tmpdir(), 'coco-'));
const nova = join(tmp, 'nova');
for (const d of ['company/youtube', 'content/2026-10-09-phone-charging', 'os/state', '.claude/agents']) mkdirSync(join(nova, d), { recursive: true });
writeFileSync(join(nova, 'company/APPROVALS.md'), '| ID | Date | Team | What | Files | Status |\n|---|---|---|---|---|---|\n| A-001 | 2026-10-07 | YouTube | Post a video | `x/` | PENDING |\n| A-002 | 2026-10-08 | Build | Ship it | | APPROVED (Mangesh) |\n');
writeFileSync(join(nova, 'company/DECISIONS.md'), '| Date | By | Decision |\n|---|---|---|\n| 2026-10-06 | Mangesh | Teams run in the cloud. |\n');
writeFileSync(join(nova, 'company/TEAMS.md'), '| Team | Doing | Done | Blocked | Next |\n|---|---|---|---|---|\n| YouTube Shorts | Ep03 | Plan | — | Render |\n');
writeFileSync(join(nova, 'company/youtube/channels.json'), JSON.stringify({ channels: [{ slug: 'the-flow', category: 'Science', status: 'connected', title: 'The Flow' }] }));
writeFileSync(join(nova, 'content/2026-10-09-phone-charging/published.json'), JSON.stringify({ url: 'https://youtube.com/shorts/x', privacy: 'public', published_at: '2026-10-09T00:00:00Z' }));
writeFileSync(join(nova, 'os/state/tasks.json'), JSON.stringify({ tasks: [{ id: 't1', title: 'Find ideas', status: 'done' }] }));
writeFileSync(join(nova, 'os/integrations.json'), JSON.stringify({ youtube_api: { state: 'connected_local', channel: 'The Flow' }, chrome_store: { state: 'credentials_saved' } }));
writeFileSync(join(nova, '.claude/agents/scout.md'), '---\nname: scout\ndescription: Finds ideas\nmodel: haiku\n---\n');
process.env.NOVA_HQ = nova;
process.env.COCO_BRAIN = join(tmp, 'memory', 'brain.json');
process.env.COCO_VAULT = join(tmp, 'vault');

const { importNova, tableRows, tidy } = await import('./import-nova.mjs');
const { handle } = await import('./server.mjs');

test('import keeps every Nova record', () => {
  const b = importNova();
  assert.equal(b.name, 'Coco');
  assert.equal(b.teams.length, 4);
  assert.equal(b.approvals.length, 2);
  assert.equal(b.approvals[0].state, 'waiting');
  assert.equal(b.approvals[1].decidedBy, 'Mangesh');
  assert.equal(b.decisions.length, 1);
  assert.equal(b.tasks.length, 1);
  assert.equal(b.youtube.videos[0].published.url, 'https://youtube.com/shorts/x');
  assert.equal(b.agents[0].model, 'haiku');
  assert.match(b.teams.find(t => t.id === 'youtube').recent, /Phone Charging/);
});

test('tidy fixes broken dashes', () => assert.equal(tidy('The Flow â€“ Daily'), 'The Flow – Daily'));
test('tableRows skips separator lines', () => assert.equal(tableRows('| a | b |\n|---|---|\n| c | d |').length, 2));

test('app answers locally, saves a YES and keeps it after re-import', async () => {
  importNova();
  const srv = createServer(handle).listen(0, '127.0.0.1');
  await new Promise(r => srv.once('listening', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const brain = await (await fetch(`${base}/api/brain`)).json();
  const key = brain.approvals[0].key;
  const r = await fetch(`${base}/api/approve`, { method: 'POST', body: JSON.stringify({ key, answer: 'yes', by: 'shreya' }) });
  assert.equal(r.status, 200);
  importNova();
  const after = await (await fetch(`${base}/api/brain`)).json();
  assert.equal(after.approvals[0].state, 'approved');
  assert.equal(after.approvals[0].decidedBy, 'Shreya');
  assert.ok(after.decisions.some(d => d.from === 'coco'));
  assert.equal((await fetch(`${base}/`)).status, 200);
  assert.equal((await fetch(`${base}/../package.json`)).status, 404);
  srv.close();
});
