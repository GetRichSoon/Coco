// Run: node cloud-compute.test.js
// Drives the REAL cloudComputeTab() copied out of index.html against a REAL cloud section (cloud-compute.fixture.json,
// produced by nova-hq scripts/cloud-monitor.mjs from six recorded Kaggle sessions). Checks the founder rules:
// provider-reported / COCO-measured / estimated stay apart, unknown is never drawn as 0, VRAM is per card.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
const start = src.indexOf('function cloudComputeTab() {'); assert.ok(start > 0, 'cloudComputeTab is missing');
let i = src.indexOf('{', start), d = 0; for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; }
const body = src.slice(start, i + 1);
assert.ok(/\['compute', 'Compute'\]/.test(src), 'Compute tab missing from CLOUD_TABS');
assert.ok(src.includes("if (tab === 'compute') return bar + cloudComputeTab();"), 'Compute tab not routed');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = () => 'just now';
const run = (CP) => new Function('CP', 'esc', 'ago', `${body}; return cloudComputeTab();`)(CP, esc, ago);
const fx = JSON.parse(fs.readFileSync(path.join(here, 'cloud-compute.fixture.json'), 'utf8'));
let n = 0; const ok = (m) => console.log(`ok ${++n} - ${m}`);

const html = run({ cloud: fx });
for (const t of ['Cloud overview', 'Provider manager', 'CPU monitor', 'GPU monitor', 'RAM and storage', 'Quota manager', 'Job manager', 'Worker health', 'Bandwidth', 'Cost and usage', 'Cloud notices', 'Historical performance']) assert.ok(html.includes(t), `${t} section missing`);
ok('all twelve compute sections render from the real snapshot');
assert.ok(html.includes('Provider quota: Not available through supported API')); assert.ok(html.includes('none (needs a founder-confirmed number)'));
ok('Kaggle provider quota shows the exact "not available" text and no invented estimate');
assert.equal((html.match(/GPU \d · Tesla T4/g) || []).length, 2); assert.ok(html.includes('Their memory is not shared'));
ok('two T4 cards listed separately, memory not pooled');
assert.ok(html.includes('not connected')); assert.ok(!/Neon egress: <b>0/.test(html)); assert.ok(html.includes('(unknown)') || !html.includes('<b>0</b><span>GPUs'));
ok('not-connected providers say so instead of showing 0');
assert.equal((html.match(/<rect /g) || []).length, fx.providers.kaggle.history.length); assert.equal((html.match(/stroke="var\(--bad/g) || []).length, fx.providers.kaggle.history.filter((h) => h.mismatch).length);
ok('history chart: one bar per real session, red edge exactly on the GPU-asked-but-not-given sessions');
assert.ok(run({}).includes('arrives with the next control-plane snapshot')); assert.ok(run({ cloud: { error: 'cloud monitor failed: x' } }).includes('cloud monitor failed'));
ok('missing snapshot and monitor failure each show a plain message, not a broken page');
const evil = JSON.parse(JSON.stringify(fx)); evil.notifications = [{ key: 'x', severity: 'warning', text: '<img src=x onerror=alert(1)>' }];
assert.ok(!run({ cloud: evil }).includes('<img src=x')); ok('provider text is escaped');
console.log(`\n${n} checks passed`);
