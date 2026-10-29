// Run: node assign.test.js
//
// Why this file exists, and why connections.test.js did not catch the bug it covers.
//
// The Assign button did nothing for a founder, with no error and no audit row. The cause was not in
// the submit handler, which is correct, nor in the RPC, which has one overload and is SECURITY
// DEFINER. It was two silent failures stacked on top of each other:
//
//   1. The desktop app loads index.html with win.loadFile(), so the page origin is file://. The
//      snapshot is read with fetch('control-plane.json'), and fetch cannot read a file:// URL at
//      all - it rejects the scheme. The result is `catch { CP = null; }`, which says nothing.
//   2. With CP null, structureTree() has no team nodes, so optionsFor(tree,'team') returns an EMPTY
//      STRING and the Team <select> contains only "Choose...". The founder cannot pick a team, the
//      handler's own guard refuses, and nothing is ever sent. Every symptom follows from that: no
//      RPC call, no control_ops row, no error.
//
// connections.test.js passes a populated CP, so it could never see this. These tests pin the
// CP-is-missing case, which is the normal case on the desktop app.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let pass = 0;
const fails = [];
const ok = (name, fn) => {
  try { fn(); pass++; console.log(`ok    ${name}`); }
  catch (e) { fails.push(`${name} -> ${e.message}`); console.log(`FAIL  ${name} -> ${e.message}`); }
};

const lift = (startRe, endRe, what) => {
  const i = src.search(startRe);
  assert.ok(i > 0, `could not find ${what}`);
  const j = src.indexOf(endRe, i);
  assert.ok(j > i, `could not close ${what}`);
  return src.slice(i, j + endRe.length);
};

const treeSrc = lift(/function structureTree\(\) \{/, '\n}', 'structureTree');
const optionsSrc = lift(/const optionsFor = /, ';\n', 'optionsFor');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Run the real functions with whatever snapshot and live-structure state we choose.
function withState({ CP, STRUCT = [] }) {
  const fn = new Function('CP', 'STRUCT', 'esc',
    `${treeSrc}\n${optionsSrc}\nreturn { structureTree, optionsFor };`);
  return fn(CP, STRUCT, esc);
}

// What the cloud actually holds: ebooks sub-teams and categories, and NO team rows at all.
const LIVE_STRUCTURE = [
  { id: 'ebooks/practical-skills', kind: 'subteam', parent_id: 'ebooks', name: 'Practical Skills', state: 'active' },
  { id: 'ebooks/practical-skills/home-repair-basics', kind: 'category', parent_id: 'ebooks/practical-skills', name: 'Home Repair', state: 'active' },
];

const FULL_CP = { teams: [{ id: 'youtube', name: 'YouTube Studio', subteams: [], categories: [], channels: [] }] };

// ---------------------------------------------------------------- the bug, reproduced
ok('THE BUG: with no snapshot there is not one team to choose, so Assign cannot be used', () => {
  const { structureTree, optionsFor } = withState({ CP: null, STRUCT: LIVE_STRUCTURE });
  const tree = structureTree();
  assert.equal(tree.roots.length, 0, 'the cloud structure holds no team rows, so roots must be empty');
  const html = optionsFor(tree, 'team', null);
  assert.equal(html, '', 'this empty string is the whole bug: the Team select has only "Choose..."');
});

ok('and the sub-team, category and channel lists are empty too, so nothing can be narrowed', () => {
  const { structureTree, optionsFor } = withState({ CP: null, STRUCT: [] });
  const tree = structureTree();
  for (const kind of ['subteam', 'category', 'channel']) {
    assert.equal(optionsFor(tree, kind, null), '', `${kind} had options with no snapshot`);
  }
});

ok('with the snapshot present, YouTube Studio IS offered - so the data was never the problem', () => {
  const { structureTree, optionsFor } = withState({ CP: FULL_CP, STRUCT: LIVE_STRUCTURE });
  const tree = structureTree();
  assert.equal(tree.roots.length, 1);
  const html = optionsFor(tree, 'team', null);
  assert.match(html, /value="youtube"/);
  assert.match(html, /YouTube Studio/);
});

// ---------------------------------------------------------------- the fix
ok('the snapshot loader does not rely on fetch alone, because fetch cannot read file://', () => {
  const loader = lift(/async function loadControlPlane\(/, '\n}', 'loadControlPlane');
  // fetch for the https build, a script tag for the file:// build. A relative <script src> loads
  // from a file:// page; fetch() rejects the scheme outright.
  assert.match(loader, /fetch\(/, 'the https path is gone');
  assert.match(loader, /COCO_CONTROL_PLANE|createElement\('script'\)/, 'there is no file:// fallback');
});

ok('a snapshot that cannot be read is REPORTED, not swallowed', () => {
  // `catch { CP = null; }` is what turned a load failure into "the company has no teams".
  const loader = lift(/async function loadControlPlane\(/, '\n}', 'loadControlPlane');
  assert.ok(/CP_ERROR/.test(loader), 'the failure is still silent');
  // Comments are stripped first. The fix QUOTES the old line to explain itself, and an assertion
  // that cannot tell code from prose would fail on its own documentation.
  const code = src.replace(/^\s*\/\/.*$/gm, '');
  assert.match(code, /CP = await loadControlPlane\(\);/, 'the call site does not use the loader');
  assert.ok(!/catch\s*\{\s*CP = null;\s*\}/.test(code), 'a silent swallow is still in the code');
});

ok('the Assign form says why it cannot be used instead of showing an empty dropdown', () => {
  // The founder-facing half of the bug: an unusable control that looks usable. The explanation
  // REPLACES the form rather than sitting inside it, so the whole assign block is what must be
  // checked - lifting just the <form> would miss the branch that matters.
  const block = lift(/const assigning = connAssign/, 'const adding =', 'the assign block');
  assert.match(block, /noTeams/, 'nothing checks whether there are any teams to choose');
  assert.match(block, /Cannot be assigned yet/, 'there is no founder-facing explanation');
  assert.match(block, /CP_ERROR/, 'the real reason is not surfaced to the founder');
  assert.match(block, /<form id="assignConn"/, 'the working form was removed');
});

ok('the generated snapshot ships in a form a file:// page can load', () => {
  const js = path.join(__dirname, 'control-plane.js');
  assert.ok(fs.existsSync(js), 'control-plane.js was not generated next to control-plane.json');
  const text = fs.readFileSync(js, 'utf8');
  assert.match(text, /COCO_CONTROL_PLANE/, 'it does not set the global the loader reads');
  const json = JSON.parse(fs.readFileSync(path.join(__dirname, 'control-plane.json'), 'utf8'));
  // the two must agree, or the desktop app and the web app would show different companies
  const inJs = JSON.parse(text.replace(/^[^{]*/, '').replace(/;\s*$/, ''));
  assert.deepEqual((inJs.teams || []).map((t) => t.id), (json.teams || []).map((t) => t.id),
    'the .js and .json snapshots disagree about the team list');
  assert.ok((inJs.teams || []).some((t) => t.id === 'youtube'), 'the youtube team is missing from the shipped snapshot');
});

console.log(`\nassign: ${pass}/${pass + fails.length} passed`);
if (fails.length) { for (const f of fails) console.log(`  ${f}`); process.exit(1); }
