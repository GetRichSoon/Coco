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
    title: 'Coco Lounge', icon: ICON, backgroundColor: '#fff4e6', autoHideMenuBar: true,
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

// ---------- PC Control mode: a fixed list of actions the founders can send from their phones ----------
const { execFile } = require('node:child_process');
const os = require('node:os');
// Apps a founder phone may open on this PC (fixed list, nothing else runs).
const local = (...p) => { const f = path.join(process.env.LOCALAPPDATA || '', ...p); return fs.existsSync(f) ? f : null; };
const PC_APPS = {
  chrome: () => 'chrome', brave: () => 'brave', edge: () => 'msedge', notepad: () => 'notepad', calculator: () => 'calc',
  files: () => 'explorer', settings: () => 'ms-settings:', spotify: () => 'spotify:', whatsapp: () => 'whatsapp:',
  vscode: () => local('Programs', 'Microsoft VS Code', 'Code.exe'), cursor: () => local('Programs', 'cursor', 'Cursor.exe') || [path.join(process.env.ProgramFiles || '', 'Cursor', 'Cursor.exe')].find((f) => fs.existsSync(f)) || null,
  lounge: () => process.execPath,
};
// First YouTube result for a search, so "play <song>" starts the video instead of showing a list.
async function firstVideo(q) {
  try {
    const r = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=en`, { headers: { 'accept-language': 'en' } });
    return ((await r.text()).match(/"videoId":"([\w-]{11})"/) || [])[1] || null;
  } catch { return null; }
}
const exec = (cmd, args) => new Promise((r) => execFile(cmd, args, { windowsHide: true }, (e, so, se) => r(e ? `failed: ${(se || e.message).slice(0, 160)}` : String(so || 'ok').trim())));
// Plain words (English or Hinglish) into one of the fixed actions. Same rules as the phone app's PhoneRemote.understand.
const APP_WORDS = [[/\b(vs ?code|visual studio|code)\b/, 'vscode'], [/\bcursor\b/, 'cursor'], [/\bchrome\b/, 'chrome'], [/\bbrave\b/, 'brave'], [/\bedge\b/, 'edge'],
  [/\bnotepad\b/, 'notepad'], [/\b(calculator|calc)\b/, 'calculator'], [/\b(files?|explorer|folder)\b/, 'files'], [/\bsettings?\b/, 'settings'], [/\bspotify\b/, 'spotify'],
  [/\bwhats ?app\b/, 'whatsapp'], [/\b(yt|youtube) ?music\b/, 'ytmusic'], [/\b(yt|youtube)\b/, 'youtube'], [/\b(insta|instagram)\b/, 'instagram'], [/\bmaps?\b/, 'maps'],
  [/\b(gmail|mail)\b/, 'gmail'], [/\bcamera\b/, 'camera'], [/\b(lounge|coco)\b/, 'lounge']];
function understand(text, kind) {
  const t = String(text || '').toLowerCase().replace(/[.!?,]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const url = t.match(/https?:\/\/\S+/); if (url) return { action: 'open_url', args: { url: url[0].replace(/^http:/, 'https:') } };
  const play = t.match(/^(?:play|chala(?:o)?|bajao|baja|laga(?:o)?|sunao|suna)\s+(.+)$/) || t.match(/^(.+?)\s+(?:chala(?:o|do)?|bajao|baja do|laga(?:o|do)?|sunao|play kar(?:o|do)?|play)$/);
  if (play && !/^(music|song|gaana|video)$/.test(play[1])) return { action: 'play_youtube', args: { q: play[1].replace(/\b(song|gaana|gana|ke gaane|gaane|on youtube|youtube pe|youtube par)\b/g, ' ').replace(/\s+/g, ' ').trim() || play[1] } };
  const open = t.match(/^(?:open|khol(?:o|do)?|start|launch|chalu kar(?:o)?)\s+(.+)$/) || t.match(/^(.+?)\s+(?:khol(?:o|do)?|open kar(?:o|do)?|open|chalu kar(?:o|do)?)$/);
  if (open) { const hit = APP_WORDS.find(([re]) => re.test(open[1])); if (hit) return kind === 'pc' && hit[1] === 'youtube' ? { action: 'open_url', args: { url: 'https://www.youtube.com' } } : { action: 'open_app', args: { app: hit[1] } }; }
  if (/\b(volume|awaaz|awaz|aawaz|sound|louder|quieter)\b/.test(t)) {
    const steps = Number((t.match(/\b(\d{1,2})\b/) || [])[1]) || 3;
    if (/\b(mute|band|chup)\b/.test(t)) return { action: 'volume', args: { key: 'mute' } };
    if (/\b(down|kam|low|dheere|dheema|quieter)\b/.test(t)) return { action: 'volume', args: { key: 'down', steps } };
    return { action: 'volume', args: { key: 'up', steps } };
  }
  if (/^(mute|chup)\b/.test(t)) return { action: 'volume', args: { key: 'mute' } };
  if (/^(next|agla|skip)\b/.test(t)) return { action: 'media', args: { key: 'next' } };
  if (/^(previous|prev|pichla|back)\b/.test(t)) return { action: 'media', args: { key: 'prev' } };
  if (/^(pause|resume|play|ruko|rok|stop music|gaana rok)\b/.test(t)) return { action: 'media', args: { key: 'playpause' } };
  if (/\b(status|battery|kya haal)\b/.test(t)) return { action: 'status', args: {} };
  if (/\b(ring|find (my )?phone|phone dhundo)\b/.test(t)) return { action: 'ring', args: {} };
  if (/\block\b/.test(t)) return { action: 'lock', args: {} };
  if (/\b(cancel|mat karo|ruk ja)\b/.test(t)) return { action: 'cancel_power', args: {} };
  if (/\b(restart|reboot)\b/.test(t)) return { action: 'restart', args: {} };
  if (/\b(shut ?down|switch off|power off|band kar(o|do)?)\b/.test(t)) return { action: 'shutdown', args: {} };
  if (/\b(sleep|so ja(o)?)\b/.test(t)) return { action: 'sleep', args: {} };
  const say = t.match(/^(?:say|message|msg|bol(?:o)?|likho)\s+(.+)$/); if (say) return { action: 'notify', args: { text: say[1] } };
  return null;
}
ipcMain.handle('pc-command', (_e, { action, args = {} }) => runAction(action, args));
async function runAction(action, args = {}) {
  switch (action) {
    case 'say': { const p = understand(args.text, 'pc'); return p && p.action !== 'say' ? runAction(p.action, p.args) : 'Not understood. Try: play <song>, open <app>, volume up, next, pause, lock, restart, status'; }
    case 'status': {
      const disk = fs.statfsSync ? fs.statfsSync('C:\\') : null;
      const battery = await exec('powershell.exe', ['-NoProfile', '-Command', '(Get-CimInstance Win32_Battery | Select-Object -First 1).EstimatedChargeRemaining']);
      return `${os.hostname()} · on for ${(os.uptime() / 3600).toFixed(1)} h · battery ${/^\d+$/.test(battery) ? battery + '%' : 'n/a'} · C: free ${disk ? Math.round(disk.bavail * disk.bsize / 1e9) + ' GB' : 'n/a'} · memory free ${(os.freemem() / 1e9).toFixed(1)} of ${(os.totalmem() / 1e9).toFixed(0)} GB`;
    }
    case 'lock': await exec('rundll32.exe', ['user32.dll,LockWorkStation']); return 'Locked';
    case 'sleep': setTimeout(() => exec('rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0']), 3000); return 'Sleeping in 3 seconds';
    case 'restart': await exec('shutdown.exe', ['/r', '/t', '60', '/c', 'Coco: restart asked from a founder phone. Cancel from Coco Lounge within 60 seconds.']); return 'Restarting in 60 seconds';
    case 'shutdown': await exec('shutdown.exe', ['/s', '/t', '60', '/c', 'Coco: switch off asked from a founder phone. Cancel from Coco Lounge within 60 seconds.']); return 'Switching off in 60 seconds';
    case 'cancel_power': await exec('shutdown.exe', ['/a']); return 'Restart or switch off cancelled';
    case 'open_url': if (!/^https:\/\//.test(String(args.url || ''))) return 'Only https links'; await shell.openExternal(args.url); return 'Opened ' + args.url;
    case 'notify': { const { Notification } = require('electron'); new Notification({ title: 'Coco', body: String(args.text || '').slice(0, 200) }).show(); return 'Shown on screen'; }
    case 'play_youtube': {
      const q = String(args.q || '').trim().slice(0, 120); if (!q) return 'Say what to play';
      const id = await firstVideo(q);
      const url = id ? `https://www.youtube.com/watch?v=${id}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      await shell.openExternal(url); return id ? `Playing "${q}" on YouTube` : `Opened YouTube search for "${q}"`;
    }
    case 'media': case 'volume': {
      const key = { playpause: 179, next: 176, prev: 177, mute: 173, down: 174, up: 175 }[String(args.key)];
      if (!key) return 'Unknown key';
      const times = action === 'volume' ? Math.min(10, Math.max(1, Number(args.steps) || 5)) : 1;
      await exec('powershell.exe', ['-NoProfile', '-Command', `$w = New-Object -ComObject WScript.Shell; 1..${times} | % { $w.SendKeys([char]${key}) }`]);
      return { playpause: 'Play / pause', next: 'Next track', prev: 'Previous track', mute: 'Mute toggled', down: 'Volume down', up: 'Volume up' }[args.key];
    }
    case 'open_app': {
      const target = PC_APPS[String(args.app)]; if (!target) return 'This app is not on the allowed list';
      const file = target();
      if (!file) return 'App not found on this PC';
      await exec('cmd.exe', ['/c', 'start', '""', file]); return 'Opened ' + args.app;
    }
    case 'ring': return 'A PC cannot ring; try: say hello';
    default: return 'This action is not allowed';
  }
}

ipcMain.handle('get-startup', () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle('set-startup', (_e, on) => { app.setLoginItemSettings({ openAtLogin: !!on, args: ['--hidden'] }); return !!on; });

app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
app.whenReady().then(() => {
  if (!app.getLoginItemSettings().openAtLogin) app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });
  createWindow(); createTray();
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => {});
