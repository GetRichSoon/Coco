// Run: node morph.test.js
//
// Drives morph.test.html in a real browser. DOM patching is the one thing a stub DOM cannot test
// honestly — a fake would pass whatever it was written to pass — so this serves the folder, loads
// the page and reads the verdict the page itself computed.
//
// It needs the headless browser from the browser-automation skill. Without it the test SKIPS loudly
// rather than passing quietly: open morph.test.html in any browser to see the same result.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const driver = path.join(process.env.USERPROFILE || process.env.HOME, '.claude', 'skills', 'browser-automation', 'browser.mjs');
if (!fs.existsSync(driver)) {
  console.log('morph tests SKIPPED: no headless browser driver at ' + driver);
  console.log('open morph.test.html in a browser instead — it prints the same PASS/FAIL list');
  process.exit(0);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(here, rel);
  if (!file.startsWith(here) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end('no'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/morph.test.html`;

const run = spawn(process.execPath, [driver, url, '--wait', 'body[data-done]', '--eval', 'document.body.dataset.done'], { encoding: 'utf8' });
let out = '';
run.stdout.on('data', (d) => { out += d; });
run.stderr.on('data', (d) => { out += d; });
const code = await new Promise((r) => run.on('close', r));
server.close();

// the page puts its own verdict on <body data-done="pass/fail">, which the driver prints as: eval "14/0"
const result = (out.match(/^eval\s+"(\d+)\/(\d+)"/m) || []).slice(1).map(Number);
if (code !== 0 || result.length !== 2) {
  console.error(out.trim().split('\n').slice(-12).join('\n'));
  console.error('\nmorph tests: could not read a verdict from the page');
  process.exit(1);
}
const [pass, fail] = result;
console.log(`morph tests: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
