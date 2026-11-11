// Run: ELECTRON_PATH="<path to electron.exe>" node desktop-theme.test.mjs
//
// The themes inside the REAL Electron runtime the desktop app uses (Electron 33, the same file:// loading, contextIsolation and sandbox, the real
// preload.js). The desktop's own main process is NOT started: a stub main process stands in for it, with an isolated profile folder, every
// privileged channel (PC commands, startup, island, rules) answering null, and Nova answered by the same synthetic stand-in as the browser tests.
// So nothing here can touch the PC, the running app or any production service.
// Skips loudly when Electron or Playwright is not available (the worktree has no node_modules; point ELECTRON_PATH at an installed electron.exe).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { novaStandIn } from './ui-harness.mjs';
import { fixture } from './ui-fixture.mjs';
import { loadEngine } from './contract/theme-css.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const electronPath = process.env.ELECTRON_PATH || path.join(here, '..', 'Lounge Desktop', 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
let electron;
try { ({ _electron: electron } = await import('playwright')); } catch { console.log('desktop-theme tests SKIPPED: playwright is not installed'); process.exit(0); }
if (!fs.existsSync(electronPath)) { console.log('desktop-theme tests SKIPPED: no electron.exe (set ELECTRON_PATH)'); process.exit(0); }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-electron-theme-'));
const mainFile = path.join(profile, 'stub-main.cjs');
fs.writeFileSync(mainFile, `
const { app, BrowserWindow, ipcMain } = require('electron'); const path = require('path');
app.setPath('userData', ${JSON.stringify(path.join(profile, 'user'))});
ipcMain.on('at-office', (e) => { e.returnValue = false; }); ipcMain.on('update-state', (e) => { e.returnValue = {}; });
for (const ch of ['get-startup', 'island-enabled-get', 'island-enabled-set', 'live-snapshot', 'pc-command', 'set-startup', 'transcribe']) ipcMain.handle(ch, async () => null);
for (const ch of ['island-push', 'lounge-beat', 'lounge-need', 'save-rules', 'update-restart']) ipcMain.on(ch, () => {});
app.whenReady().then(() => { const w = new BrowserWindow({ width: 1280, height: 860, show: false, webPreferences: { preload: ${JSON.stringify(path.join(here, '..', 'Lounge Desktop', 'preload.js'))}, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } }); w.loadFile(${JSON.stringify(path.join(here, 'index.html'))}); });
`);

let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; process.exitCode = 1; console.log('FAIL ' + name + '\n     ' + String(e.message).split('\n').slice(0, 5).join('\n     ')); } };
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const ok = (v, m = 'expected truthy') => { if (!v) throw new Error(m); };
const { contract, E } = loadEngine();
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };

const launchEnv = { ...process.env }; delete launchEnv.ELECTRON_RUN_AS_NODE;   // when this is set at all, even empty, Electron starts as plain Node and never opens a window
const app = await electron.launch({ executablePath: electronPath, args: [mainFile], env: launchEnv });
const calls = [], fx = fixture({ withRevenue: true });
await app.context().route('http://nova.test/**', novaStandIn(fx, calls));
await app.context().route(/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/, (r) => r.continue());
const win = await app.firstWindow();
const errors = []; win.on('pageerror', (e) => errors.push(e.message));
const dataset = () => win.evaluate(() => ({ palette: document.documentElement.dataset.palette, mode: document.documentElement.dataset.mode }));
const bodyBg = () => win.evaluate(() => getComputedStyle(document.body).backgroundColor);

await t('Electron loads the page from disk and the saved theme is on screen at boot: Original Signature, Space Grotesk from the bundled font files', async () => {
  await win.waitForLoadState('domcontentloaded'); await win.waitForFunction(() => !!window.CocoTheme, null, { timeout: 15000 });
  eq((await dataset()).palette, 'signature'); ok(await win.evaluate(() => /file:/.test(location.href)), 'loaded with file://');
  ok(await win.evaluate(async () => { await document.fonts.load('16px "Space Grotesk"'); return document.fonts.check('16px "Space Grotesk"'); }), 'the vendored Space Grotesk loaded (no network font needed)');
  ok(/Space Grotesk/.test(await win.evaluate(() => getComputedStyle(document.body).fontFamily)));
});
await t('the desktop bridge is intact: the real preload exposes cocoDesktop, and the sync channels answer', async () => {
  const keys = await win.evaluate(() => Object.keys(window.cocoDesktop || {}));
  for (const k of ['pcCommand', 'getIsland', 'setIsland', 'getStartup', 'setStartup', 'beat', 'transcribe', 'atOffice', 'updateState', 'onUpdate', 'onApprove', 'restartForUpdate']) ok(keys.includes(k), 'missing ' + k);
  eq(await win.evaluate(() => window.cocoDesktop.atOffice()), false); eq(JSON.stringify(await win.evaluate(() => window.cocoDesktop.updateState())), '{}');
});
// pair this window with the stand-in Nova (localStorage is the desktop's own store) and reload
await win.evaluate(() => { localStorage.setItem('gs-device-key', 'test-device-key-0123456789'); localStorage.setItem('gs-device-id', 'boss-pc'); localStorage.setItem('gs-nova-url', 'http://nova.test'); });
await win.reload({ waitUntil: 'domcontentloaded' }); await win.waitForFunction(() => { const a = document.getElementById('app'); return a && !a.hidden && document.getElementById('view').children.length > 0; }, null, { timeout: 30000 }); await win.waitForTimeout(800);
await t('the themed app runs in Electron: black navigation and cards on the lavender page, hot pink selection', async () => {
  eq(await bodyBg(), hexRgb('#F0EAF7')); eq(await win.locator('.rail').evaluate((e) => getComputedStyle(e).backgroundColor), hexRgb('#151313')); eq(await win.locator('.nav a.on').evaluate((e) => getComputedStyle(e).backgroundColor), hexRgb('#FF39A8'));
});
await t('the Appearance page works in Electron: all six themes apply, light and dark, and the choice survives a reload', async () => {
  await win.evaluate(() => { location.hash = '#themes'; }); await win.waitForSelector('.th-card'); eq(await win.locator('.th-card').count(), 6);
  for (const id of ['cobalt', 'emerald', 'orchid', 'signature']) { await win.evaluate((i) => window.CocoTheme.apply(i), id); await win.waitForTimeout(700); eq((await dataset()).palette, id); eq(await win.locator('.rail').evaluate((e) => getComputedStyle(e).backgroundColor), hexRgb(E.cssFor(id, (await dataset()).mode)['--p-surface-1']), id + ' navigation'); }
  await win.evaluate(() => { window.CocoTheme.apply('cobalt'); window.CocoTheme.setAppearance('dark'); }); await win.waitForTimeout(700); eq(await bodyBg(), hexRgb(E.cssFor('cobalt', 'dark')['--surface']));
  await win.reload({ waitUntil: 'domcontentloaded' }); eq(JSON.stringify(await dataset()), JSON.stringify({ palette: 'cobalt', mode: 'dark' }), 'painted at boot, before the app');
});
await t('a theme change is written to the shared settings row through Nova, like on the phone', async () => {
  await win.waitForFunction(() => !document.getElementById('app').hidden, null, { timeout: 20000 }); await win.evaluate(() => window.CocoTheme.apply('violet')); await win.waitForTimeout(2500);
  const row = fx.tables.controls.find((r) => r.id === 'ui_theme.boss@example.com'); ok(row && row.value.themeId === 'violet', 'shared row: ' + JSON.stringify(row && row.value.themeId));
});
await t('every launch rotation: a reload is not a launch, and a fresh window session is', async () => {
  await win.evaluate(() => window.CocoTheme.setRotation({ enabled: true, frequency: 'launch', order: 'sequential' })); await win.waitForTimeout(400); const before = (await dataset()).palette;
  await win.reload({ waitUntil: 'domcontentloaded' }); eq((await dataset()).palette, before, 'a reload keeps the theme');
  await win.evaluate(() => sessionStorage.clear()); await win.reload({ waitUntil: 'domcontentloaded' }); ok((await dataset()).palette !== before, 'a new session (the app opened again) switches: ' + before + ' -> ' + (await dataset()).palette);
});
await t('no script error in the desktop window', async () => { eq(errors.length, 0, errors.join(' | ')); });

await app.close(); fs.rmSync(profile, { recursive: true, force: true });
console.log(`\ndesktop theme (Electron 33): ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
