// Coco Lounge for Windows: the shared Lounge screens in a real desktop app with a tray icon.
// Starts with Windows, stays connected in the tray, single instance, saves the cloud rules for Claude sessions.
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const UI = path.join(__dirname, '..', 'Lounge', 'index.html');
const ICON = path.join(__dirname, 'coco.ico');
const RULES_FILE = path.join(__dirname, '..', 'memory', 'Cloud Rules.md');
let win = null, tray = null, quitting = false;

// Office mode (founder rule): at the office the Lounge never pops up; it stays in the tray, connected,
// so phone commands still run. The place comes from the Home/Office switcher.
const PLACE_FILE = path.join(process.env.USERPROFILE || '', 'nova-hq', 'os', 'state', 'local', 'last-place.txt');
const atOffice = () => { try { return fs.readFileSync(PLACE_FILE, 'utf8').trim().toLowerCase() === 'office'; } catch { return false; } };
setInterval(() => { if (atOffice() && win && win.isVisible() && !win.isFocused()) win.hide(); }, 30000);

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.setAppUserModelId('GoodSpace.CocoLounge');

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 380, minHeight: 600, show: false,
    title: 'Coco Lounge', icon: ICON, backgroundColor: '#fff4e6', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile(UI);
  win.once('ready-to-show', () => { if (!process.argv.includes('--hidden') && !atOffice()) win.show(); });
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
// Browsers by name; YouTube opens in Brave (the founders' YouTube browser) when it is installed.
const pf = (...p) => [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean).map((r) => path.join(r, ...p)).find((x) => fs.existsSync(x)) || null;
const BROWSERS = { brave: () => pf('BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'), chrome: () => pf('Google', 'Chrome', 'Application', 'chrome.exe'), edge: () => pf('Microsoft', 'Edge', 'Application', 'msedge.exe') };
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
  // Wider PC control (Boss YES 2026-10-15): type, shortcuts, screenshot, speak, close the front app; plus the fun ones.
  const raw = String(text || '').trim();
  const typed = raw.match(/^(?:type|likh(?:o|do)?)\s+([\s\S]+)$/i); if (typed) return { action: 'type_text', args: { text: typed[1] } };
  const spoken = raw.match(/^(?:speak|bolo|bol)\s+([\s\S]+)$/i); if (spoken) return { action: 'speak', args: { text: spoken[1] } };
  const pressed = t.match(/^(?:press|dabao|key)\s+(.+)$/); if (pressed) return { action: 'key', args: { combo: pressed[1].replace(/\s*(\+|plus|and|aur)\s*|\s+/g, '+') } };
  if (/\b(screenshot|screen ?shot|ss|screen dikha(?:o)?|screen bhej(?:o)?)\b/.test(t)) return { action: 'screenshot', args: {} };
  const found = raw.match(/^(?:find|search|dhundo|dhoondo|dhund)\s+(.+?)(?:\s+(?:file|files|wali file))?$/i) || raw.match(/^(.+?)\s+(?:wali )?(?:file )?(?:dhundo|dhoondo|dhund do|find karo|search karo)$/i);
  if (found && !/\b(pc|laptop|phone)\b$/i.test(found[1].trim())) return { action: 'find_file', args: { q: found[1].trim() } };
  if (/\b(confetti|party|celebrate|jashn)\b/.test(t)) return { action: 'fun', args: { kind: 'party' } };
  if (/\b(joke|chutkula|hasao|hasa do)\b/.test(t)) return { action: 'fun', args: { kind: 'joke' } };
  if (/\b(fact|gyaan|kuch naya batao)\b/.test(t)) return { action: 'fun', args: { kind: 'fact' } };
  if (/\b(find (my )?(pc|laptop)|laptop dhundo|pc dhundo|beep)\b/.test(t)) return { action: 'fun', args: { kind: 'beep' } };
  if (/\b(motivate|motivation|josh)\b/.test(t)) return { action: 'fun', args: { kind: 'motivate' } };
  const play = t.match(/^(?:play|chala(?:o)?|bajao|baja|laga(?:o)?|sunao|suna)\s+(.+)$/) || t.match(/^(.+?)\s+(?:chala(?:o|do)?|bajao|baja do|laga(?:o|do)?|sunao|play kar(?:o|do)?|play)$/);
  if (play && !/^(music|song|gaana|video)$/.test(play[1])) return { action: 'play_youtube', args: { q: play[1].replace(/\b(song|gaana|gana|ke gaane|gaane|on youtube|youtube pe|youtube par)\b/g, ' ').replace(/\s+/g, ' ').trim() || play[1] } };
  const browser = (t.match(/\b(brave|chrome|edge)\b/) || [])[1];
  const webApp = (app) => kind === 'pc' && { youtube: 'https://www.youtube.com', ytmusic: 'https://music.youtube.com', instagram: 'https://www.instagram.com', gmail: 'https://mail.google.com', maps: 'https://maps.google.com' }[app];
  const openIt = (app) => webApp(app) ? { action: 'open_url', args: { url: webApp(app), browser: browser || 'brave' } } : { action: 'open_app', args: { app } };
  // "youtube brave app", "youtube brave chalu kar": YouTube in that browser
  if (/\b(yt|youtube)\b/.test(t) && !/\bmusic\b/.test(t) && (browser || t.split(' ').length <= 4)) return openIt('youtube');
  if (/\b(close|band kar(?:o|do)?|hata(?:o|do)?|exit)\b/.test(t) && !/\b(pc|laptop|computer|system)\b/.test(t)) return { action: 'close_app', args: {} };
  const open = t.match(/^(?:open|khol(?:o|do)?|start|launch|chalu kar(?:o)?)\s+(.+)$/) || t.match(/^(.+?)\s+(?:khol(?:o|do)?|open kar(?:o|do)?|open|chalu kar(?:o|do)?)$/);
  if (open) { const hit = APP_WORDS.find(([re]) => re.test(open[1])); if (hit) return openIt(hit[1]); }
  // Just an app name ("chrome", "vs code app")
  if (t.split(' ').length <= 3 && !/\b(volume|awaaz|play|chala|bajao|status|lock)\b/.test(t)) { const hit = APP_WORDS.find(([re]) => re.test(t)); if (hit) return openIt(hit[1]); }
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
// Media and volume keys through CocoKeys.exe (built from CocoKeys.cs): about 0.3 s, where PowerShell
// can take over 10 s to start on a busy PC.
const KEYS_EXE = path.join(__dirname, 'CocoKeys.exe');
const keys = (name, times = 1) => exec(KEYS_EXE, [name, String(times)]);
let batteryCache = 'n/a', batteryBusy = false;
function refreshBattery() {
  if (batteryBusy) return; batteryBusy = true;
  exec('powershell.exe', ['-NoProfile', '-Command', '(Get-CimInstance Win32_Battery | Select-Object -First 1).EstimatedChargeRemaining']).then((b) => { if (/^\d+$/.test(b)) batteryCache = b; batteryBusy = false; });
}
refreshBattery(); setInterval(refreshBattery, 120000);
ipcMain.handle('pc-command', (_e, { action, args = {} }) => runAction(action, args));
async function runAction(action, args = {}) {
  switch (action) {
    case 'say': { const p = understand(args.text, 'pc'); return p && p.action !== 'say' ? runAction(p.action, p.args) : `Not understood: "${String(args.text || '').slice(0, 60)}". Try: kesariya chalao, youtube kholo, chrome kholo, awaaz badhao, next, pause, lock, status`; }
    case 'status': {
      const disk = fs.statfsSync ? fs.statfsSync('C:\\') : null;
      // Battery comes from a slow Windows query, so answer at once with the last reading and refresh it in the background.
      const battery = batteryCache; refreshBattery();
      return `${os.hostname()} · on for ${(os.uptime() / 3600).toFixed(1)} h · battery ${/^\d+$/.test(battery) ? battery + '%' : 'n/a'} · C: free ${disk ? Math.round(disk.bavail * disk.bsize / 1e9) + ' GB' : 'n/a'} · memory free ${(os.freemem() / 1e9).toFixed(1)} of ${(os.totalmem() / 1e9).toFixed(0)} GB`;
    }
    case 'lock': await exec('rundll32.exe', ['user32.dll,LockWorkStation']); return 'Locked';
    case 'sleep': setTimeout(() => exec('rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0']), 3000); return 'Sleeping in 3 seconds';
    case 'restart': await exec('shutdown.exe', ['/r', '/t', '60', '/c', 'Coco: restart asked from a founder phone. Cancel from Coco Lounge within 60 seconds.']); return 'Restarting in 60 seconds';
    case 'shutdown': await exec('shutdown.exe', ['/s', '/t', '60', '/c', 'Coco: switch off asked from a founder phone. Cancel from Coco Lounge within 60 seconds.']); return 'Switching off in 60 seconds';
    case 'cancel_power': await exec('shutdown.exe', ['/a']); return 'Restart or switch off cancelled';
    case 'open_url': {
      if (!/^https:\/\//.test(String(args.url || ''))) return 'Only https links';
      const exe = BROWSERS[String(args.browser || '')] && BROWSERS[String(args.browser)]();
      if (exe) await exec(exe, [args.url]); else await shell.openExternal(args.url);
      return 'Opened ' + args.url + (exe ? ' in ' + args.browser : '');
    }
    case 'close_app': await exec(KEYS_EXE, ['combo', 'alt+f4']); return 'Closed the app in front';
    case 'type_text': { const s = String(args.text || '').slice(0, 2000); if (!s) return 'Nothing to type'; await exec(KEYS_EXE, ['type', s]); return 'Typed ' + s.length + ' characters'; }
    case 'key': { const r = await exec(KEYS_EXE, ['combo', String(args.combo || '')]); return /failed/.test(r) ? 'Unknown keys: ' + args.combo : 'Pressed ' + args.combo; }
    case 'speak': { const s = String(args.text || '').slice(0, 300); exec(KEYS_EXE, ['speak', s]); return 'Saying: ' + s; }
    case 'screenshot': {
      const { desktopCapturer, screen } = require('electron');
      const d = screen.getPrimaryDisplay().size; const w = 900; const h = Math.round(w * d.height / d.width);
      const [src] = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: w, height: h } });
      if (!src) return 'Screenshot failed';
      return 'data:image/jpeg;base64,' + src.thumbnail.toJPEG(62).toString('base64');
    }
    case 'fun': return fun(String(args.kind || 'party'));
    case 'find_file': return findFiles(String(args.q || ''));
    case 'notify': { const { Notification } = require('electron'); new Notification({ title: 'Coco', body: String(args.text || '').slice(0, 200) }).show(); return 'Shown on screen'; }
    case 'play_youtube': {
      const q = String(args.q || '').trim().slice(0, 120); if (!q) return 'Say what to play';
      const id = await firstVideo(q);
      const url = id ? `https://www.youtube.com/watch?v=${id}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      const brave = BROWSERS.brave(); if (brave) await exec(brave, [url]); else await shell.openExternal(url); return id ? `Playing "${q}" on YouTube` : `Opened YouTube search for "${q}"`;
    }
    case 'media': case 'volume': {
      const key = { playpause: 179, next: 176, prev: 177, mute: 173, down: 174, up: 175 }[String(args.key)];
      if (!key) return 'Unknown key';
      const times = action === 'volume' ? Math.min(10, Math.max(1, Number(args.steps) || 5)) : 1;
      await keys(String(args.key), times);
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

// ---------- find files (Desktop, Documents, Downloads, Pictures, Good Space; names only, never contents) ----------
function findFiles(q) {
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1 && !/^(the|a|my|meri|mera|wali|wala|ka|ki|ke)$/.test(w));
  if (!words.length) return 'Say what to find, e.g. "resume pdf dhundo"';
  const home = os.homedir();
  const roots = ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Videos', 'Good Space', 'OneDrive'].map((d) => path.join(home, d)).filter((d) => fs.existsSync(d));
  const hits = []; let seen = 0;
  const skip = /^(node_modules|\.git|\.gradle|build|AppData|Coco Vault|Safe Keeping|\$Recycle\.Bin)$/i;
  const walk = (dir, depth) => {
    if (depth > 5 || hits.length >= 8 || seen > 40000) return;
    let list; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      seen++;
      if (skip.test(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full, depth + 1); if (hits.length >= 8) return; continue; }
      const n = e.name.toLowerCase();
      if (words.every((w) => n.includes(w))) hits.push(full);
      if (hits.length >= 8) return;
    }
  };
  roots.forEach((r) => walk(r, 0));
  return hits.length ? 'Found ' + hits.length + ':\n' + hits.map((h) => h.replace(home, '~')).join('\n') : 'Nothing found for "' + q + '"';
}

// ---------- fun corner ----------
const JOKES = [
  'Why did the laptop go to the doctor? It had a terrible case of Windows updates.',
  'My PC and I have a lot in common. We both stop working when it gets too hot.',
  'Boss, I tried to take a break, but my RAM said: not enough memory for fun.',
  'Why do programmers prefer dark mode? Because light attracts bugs.',
  'I told my charger a joke. It did not get it, it was not plugged in.',
  'Coco tip of the day: if the Short is not posting, just stare at the laptop. It works for cats.',
];
const FACTS = [
  'Honey never spoils. Archaeologists found three thousand year old honey that was still good to eat.',
  'Octopuses have three hearts and blue blood.',
  'A day on Venus is longer than its year.',
  'Bananas are berries, but strawberries are not.',
  'Your phone has more computing power than the computers that took Apollo eleven to the Moon.',
  'Hot phones charge slower on purpose. They protect the battery from heat.',
];
const MOTIVATE = ['Boss, one Short a day becomes three hundred sixty five a year. Keep going.', 'Big things are built one small step at a time. Today counts.', 'Good Space is growing. Let us make today the best day yet.'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function popup(title, body) { const { Notification } = require('electron'); new Notification({ title, body }).show(); }
function confetti(seconds = 5) {
  const { screen } = require('electron'); const { width, height } = screen.getPrimaryDisplay().bounds;
  const w = new BrowserWindow({ x: 0, y: 0, width, height, transparent: true, frame: false, alwaysOnTop: true, skipTaskbar: true, focusable: false, hasShadow: false, webPreferences: { contextIsolation: true } });
  w.setIgnoreMouseEvents(true); w.setAlwaysOnTop(true, 'screen-saver');
  const html = '<html><body style="margin:0;overflow:hidden;background:transparent"><canvas id=c></canvas><script>' +
    'const c=document.getElementById("c"),x=c.getContext("2d");c.width=innerWidth;c.height=innerHeight;' +
    'const col=["#8E6BFF","#4FE3F2","#FFD166","#FF6B9A","#34D399","#FF9F0A"];' +
    'const P=[...Array(260)].map(()=>({x:Math.random()*c.width,y:-Math.random()*c.height,s:6+Math.random()*8,v:2+Math.random()*4,a:Math.random()*6,r:(Math.random()-.5)*.2,c:col[Math.floor(Math.random()*col.length)]}));' +
    'function f(){x.clearRect(0,0,c.width,c.height);for(const p of P){p.y+=p.v;p.x+=Math.sin(p.a+=.05)*1.5;x.save();x.translate(p.x,p.y);x.rotate(p.a);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);x.restore();}requestAnimationFrame(f)}f();' +
    '</script></body></html>';
  w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  setTimeout(() => { if (!w.isDestroyed()) w.close(); }, seconds * 1000);
}
async function fun(kind) {
  switch (kind) {
    case 'party': confetti(6); exec(KEYS_EXE, ['speak', 'Party time, Boss!']); return 'Confetti on the PC screen';
    case 'joke': { const j = pick(JOKES); popup('Coco joke', j); exec(KEYS_EXE, ['speak', j]); return j; }
    case 'fact': { const f = pick(FACTS); popup('Coco fact', f); exec(KEYS_EXE, ['speak', f]); return f; }
    case 'motivate': { const m = pick(MOTIVATE); popup('Coco', m); exec(KEYS_EXE, ['speak', m]); return m; }
    case 'beep': exec(KEYS_EXE, ['beep']); popup('Coco', 'Here I am! (find my PC)'); return 'Beeping on the PC';
    default: return 'Unknown fun';
  }
}

ipcMain.handle('get-startup', () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle('set-startup', (_e, on) => { app.setLoginItemSettings({ openAtLogin: !!on, args: ['--hidden'] }); return !!on; });

app.on('second-instance', () => { if (win && !atOffice()) { win.show(); win.focus(); } }); // at the office only the tray icon opens it
app.whenReady().then(() => {
  if (!app.getLoginItemSettings().openAtLogin) app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });
  createWindow(); createTray();
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => {});
