// Run: node syntax.test.js
//
// Does index.html actually parse?
//
// Nothing checked this, and it needed to. Every other test in this folder LIFTS a function out of
// index.html with a regular expression and runs that fragment, so a syntax error anywhere outside
// the lifted range passes all of them while the real app is dead on launch. That is not
// hypothetical: a scripted edit to add timeouts replaced `const toast = (t) =>` with
// `const toast = (t) =`, swallowing the arrow. assign, connections, morph and chat all stayed green,
// and the desktop app - which loads this file straight off disk - would have shown a blank screen.
//
// So this test parses the whole thing, the way the browser will.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pass = 0;
const fails = [];
const ok = (name, fn) => {
  try { fn(); pass++; console.log(`ok    ${name}`); }
  catch (e) { fails.push(`${name} -> ${e.message}`); console.log(`FAIL  ${name} -> ${e.message}`); }
};

// Every inline <script> block in the page, in order, with the line it starts on so a failure can be
// pointed at the real file rather than at an extract.
function inlineScripts(file) {
  const lines = fs.readFileSync(path.join(__dirname, file), 'utf8').split('\n');
  const blocks = [];
  let open = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    // only a block that OPENS and CLOSES on its own line, which is how this page is written. A
    // <script src=...> one-liner has no body to check.
    if (open < 0 && /^<script(\s+type="module")?>$/.test(t)) { open = i; continue; }
    if (open >= 0 && t === '</script>') { blocks.push({ startLine: open + 2, code: lines.slice(open + 1, i).join('\n') }); open = -1; }
  }
  return blocks;
}

const check = (code) => {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'coco-syntax-')), 'block.mjs');
  fs.writeFileSync(tmp, code);
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: ['ignore', 'pipe', 'pipe'] });
    return null;
  } catch (e) {
    return String(e.stderr || e.message).split('\n').filter((l) => l.trim()).slice(0, 3).join(' | ');
  } finally {
    try { fs.rmSync(path.dirname(tmp), { recursive: true, force: true }); } catch { /* temp */ }
  }
};

for (const file of ['index.html', 'morph.test.html']) {
  if (!fs.existsSync(path.join(__dirname, file))) continue;
  const blocks = inlineScripts(file);
  ok(`${file} has an app script to check`, () => {
    assert.ok(blocks.length > 0, 'no inline <script> block was found, so nothing was checked');
  });
  blocks.forEach((b, n) => {
    ok(`${file} script #${n + 1} (from line ${b.startLine}) parses`, () => {
      const why = check(b.code);
      assert.equal(why, null, why === null ? '' : `${why} - the line number above is relative to line ${b.startLine} of ${file}`);
    });
  });
}

// The standalone scripts the page loads are real files and must parse too.
for (const file of ['heal.js', 'control-plane.js']) {
  const full = path.join(__dirname, file);
  if (!fs.existsSync(full)) continue;
  ok(`${file} parses`, () => {
    const why = check(fs.readFileSync(full, 'utf8'));
    assert.equal(why, null, why || '');
  });
}

ok('control-plane.js sets the global the loader reads, and nothing else', () => {
  const text = fs.readFileSync(path.join(__dirname, 'control-plane.js'), 'utf8');
  assert.match(text, /^\s*(\/\/[^\n]*\n)*\s*window\.COCO_CONTROL_PLANE\s*=/, 'it does not start by setting the global');
  // a snapshot is data. Anything executable in here runs on the founder's machine with the page's
  // own privileges, so it must be an assignment and a literal, not a program.
  assert.ok(!/\b(function|=>|eval|fetch|XMLHttpRequest|import)\b/.test(text.replace(/^\s*\/\/.*$/gm, '')),
    'the snapshot contains executable code, not just data');
});

console.log(`\nsyntax: ${pass}/${pass + fails.length} passed`);
if (fails.length) { for (const f of fails) console.log(`  ${f}`); process.exit(1); }
