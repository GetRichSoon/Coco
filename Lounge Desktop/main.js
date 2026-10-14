// Coco Lounge for Windows: the shared Lounge screens in a real desktop app with a tray icon.
// Starts with Windows, stays connected in the tray, single instance, saves the cloud rules for Claude sessions.
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const UI = path.join(__dirname, '..', 'Lounge', 'index.html');
const ICON = path.join(__dirname, 'coco.ico');
const RULES_FILE = path.join(__dirname, '..', 'memory', 'Cloud Rules.md');
let win = null, tray = null, quitting = false;

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.setAppUserModelId('GoodSpace.CocoLounge');

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 380, minHeight: 600, show: false,
    title: 'Coco Lounge', icon: ICON, backgroundColor: '#fdf7f4', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile(UI);
  win.once('ready-to-show', () => { if (!process.argv.includes('--hidden')) win.show(); });
  win.on('close', (e) => { if (!quitting) { e.preventDefault(); win.hide(); } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON));
  tray.setToolTip('Coco Lounge · Good Space');
  const open = (hash) => { win.show(); win.focus(); if (hash) win.webContents.executeJavaScript(`location.hash = '${hash}'`); };
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Coco Lounge', click: () => open() },
    { label: 'Board', click: () => open('board') },
    { label: 'Approvals', click: () => open('approvals') },
    { type: 'separator' },
    { label: 'Start with Windows', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked, args: ['--hidden'] }) },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', () => open());
}

ipcMain.on('save-rules', (_e, text) => {
  try {
    fs.mkdirSync(path.dirname(RULES_FILE), { recursive: true });
    fs.writeFileSync(RULES_FILE, `# Good Space rules (from Coco Cloud, kept current by Coco Lounge)\n\n${String(text).slice(0, 200000)}\n`);
  } catch {}
});

ipcMain.handle('get-startup', () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle('set-startup', (_e, on) => { app.setLoginItemSettings({ openAtLogin: !!on, args: ['--hidden'] }); return !!on; });

app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
app.whenReady().then(() => {
  if (!app.getLoginItemSettings().openAtLogin) app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });
  createWindow(); createTray();
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => {});
