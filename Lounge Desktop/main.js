// Coco Lounge for Windows: the shared Lounge screens in a real desktop app with a tray icon.
// Starts with Windows, stays connected in the tray, single instance, saves the cloud rules for Claude sessions.
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const UI = path.join(__dirname, '..', 'Lounge', 'index.html');
const ICON = path.join(__dirname, 'coco.ico');
const RULES_FILE = path.join(__dirname, '..', 'memory', 'Cloud Rules.md');
let win = null, tray = null, quitting = false, trayMenu = null;

// Office mode (founder rule): at the office the Lounge never pops up; it stays in the tray, connected,
// so phone commands still run. The place comes from the Home/Office switcher.
const PLACE_FILE = path.join(process.env.USERPROFILE || '', 'nova-hq', 'os', 'state', 'local', 'last-place.txt');
const atOffice = () => { try { return fs.readFileSync(PLACE_FILE, 'utf8').trim().toLowerCase() === 'office'; } catch { return false; } };
// One line into userData\island.log. The same file the island, dock and updater already write to.
const logLine = (m) => { try { fs.appendFileSync(path.join(app.getPath('userData'), 'island.log'), `${new Date().toISOString()} ${m}
`); } catch {} };
setInterval(() => { if (atOffice() && win && win.isVisible() && !win.isFocused()) win.hide(); }, 30000);

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.setAppUserModelId('GoodSpace.CocoLounge');
// Unpackaged Electron needs the app folder in the start-up command, or Windows starts a bare electron.exe (the bug: Coco was not running after restart).
const loginArgs = (on) => ({ openAtLogin: on, path: process.execPath, args: app.isPackaged ? ['--hidden'] : ['"' + path.resolve(__dirname) + '"', '--hidden'] });

// Office mode (Boss, 2026-10-23): no notifications at all on the PC at the office. The page's own Windows notifications
// are refused here; main-process pop-ups check atOffice() themselves; the island gets no toasts (see island 'quiet').
app.whenReady().then(() => {
  const { session } = require('electron');
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => !(permission === 'notifications' && atOffice()));
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(!(permission === 'notifications' && atOffice())));
});
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 380, minHeight: 600, show: false,
    title: 'Coco Lounge', icon: ICON, backgroundColor: '#fff4e6', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false }, // keep the cloud link and commands live while hidden in the tray
  });
  win.loadFile(UI);
  logWindow(win, 'lounge');   // page errors (failed heartbeats, sign-in problems) land in island.log
  // --hidden decides whether the window comes up, and nothing else. Autostart and the self-update
  // restart both pass it, so Coco still never appears by itself - at the office or anywhere else.
  // Without it, a person launched Coco on purpose, and that is answered the same way the tray's
  // "Open Coco Lounge" is answered at the office: by opening. The place used to veto this too, and
  // on 29 October that left Boss with no way in at all - the Dock was off, so the tray icon was
  // buried in the overflow, and the shortcut did nothing while Coco ran and heartbeated all along.
  // Office mode keeps its real job: no pop-ups, no toasts, no island chatter.
  win.once('ready-to-show', () => {
    if (!process.argv.includes('--hidden')) return win.show();
    logLine(`window kept hidden (${process.argv.includes('--hidden') ? 'started hidden' : 'shown on demand'}${atOffice() ? ', office mode' : ''}). Coco is running; open it from the Dock or tray menu: Open Coco Lounge.`);
  });
  win.on('close', (e) => { if (!quitting) { e.preventDefault(); win.hide(); } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON));
  tray.setToolTip('Coco Lounge · Good Space');
  const open = (hash) => { win.show(); win.focus(); if (hash) win.webContents.executeJavaScript(`location.hash = '${hash}'`); };
  trayMenu = () => Menu.buildFromTemplate([
    { label: 'Open Coco Lounge', click: () => open() },
    { label: 'Board', click: () => open('board') },
    { label: 'Approvals', click: () => open('approvals') },
    { type: 'separator' },
    { label: 'Show Coco Island', type: 'checkbox', checked: islandSettings().enabled, click: (i) => setIslandEnabled(i.checked) },
    { label: 'Coco Dock (hides the Windows taskbar)', type: 'checkbox', checked: islandSettings().dock !== false, click: (i) => { const s = islandSettings(); s.dock = i.checked; saveIsland(s); if (i.checked) createDock(); else removeDock(); } },
    { label: 'Island modules', submenu: [['coco', 'Coco Brain'], ['music', 'Music'], ['control', 'Control Center'], ['focus', 'Focus']].map(([k, label]) => ({ label, type: 'checkbox', checked: islandSettings().modules[k] !== false,
      click: (i) => { const s = islandSettings(); s.modules = { ...s.modules, [k]: i.checked }; saveIsland(s); sendModules(true); } })) },
    { label: 'Start with Windows', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (i) => app.setLoginItemSettings(loginArgs(i.checked)) },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(trayMenu());
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
  blender: () => [path.join(os.homedir(), 'tools', 'blender-4.5.14-windows-x64', 'blender.exe')].find((f) => fs.existsSync(f)) || null,
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
// It used to press Win+Up 2.5 s later on whatever window was in front, which resized VS Code when an app opened slowly.
// New windows come to the front by themselves, so nothing is pressed now.
const front = () => {};
let lastPlayAt = 0;
// Opens a program without waiting for it (with exec, a GUI app kept the pipe open, so the command waited until it was closed).
const launchDetached = (file) => { require('node:child_process').spawn('cmd.exe', ['/c', 'start', '""', file], { detached: true, stdio: 'ignore', windowsHide: true }).unref(); };
// "home mode · Wi-Fi X · home saved 2026-10-22 01:52 · office saved ..." for the status line on every device.
async function workspaceLine() {
  const dir = path.dirname(PLACE_FILE); let place = '?'; try { place = fs.readFileSync(PLACE_FILE, 'utf8').trim() || '?'; } catch {}
  const ssid = ((await exec('netsh.exe', ['wlan', 'show', 'interfaces'])).match(/^\s*SSID\s*:\s*(.+)$/m) || [])[1] || 'no Wi-Fi';
  const saved = ['home', 'office'].map((p) => { try { return p + ' saved ' + (fs.readFileSync(path.join(dir, p + '-session.json'), 'utf8').match(/"saved":\s*"([^"]+)"/) || [])[1]; } catch { return p + ' not saved'; } });
  return [place + ' mode', 'Wi-Fi ' + ssid.trim(), ...saved].join(' · ');
}
const exec = (cmd, args) => new Promise((r) => execFile(cmd, args, { windowsHide: true, timeout: 15000 }, (e, so, se) => r(e ? `failed: ${(se || e.message).slice(0, 160)}` : String(so || 'ok').trim())));   // a stuck program can never hold the runner
// Plain words (English or Hinglish) into one of the fixed actions. Same rules as the phone app's PhoneRemote.understand.
const APP_WORDS = [[/\b(vs ?code|visual studio|code)\b/, 'vscode'], [/\bcursor\b/, 'cursor'], [/\bchrome\b/, 'chrome'], [/\bbrave\b/, 'brave'], [/\bedge\b/, 'edge'],
  [/\bnotepad\b/, 'notepad'], [/\b(calculator|calc)\b/, 'calculator'], [/\b(files?|explorer|folder)\b/, 'files'], [/\bsettings?\b/, 'settings'], [/\bspotify\b/, 'spotify'],
  [/\bwhats ?app\b/, 'whatsapp'], [/\b(yt|youtube) ?music\b/, 'ytmusic'], [/\b(yt|youtube)\b/, 'youtube'], [/\b(insta|instagram)\b/, 'instagram'], [/\bmaps?\b/, 'maps'],
  [/\b(gmail|mail)\b/, 'gmail'], [/\bcamera\b/, 'camera'], [/\b(lounge|coco)\b/, 'lounge']];
// Phone mics write Hindi and Marathi in Devanagari. These turn the common command words into the Roman forms below.
// Free text after "likho / bolo / type" stays as spoken. Keep the same list in the phone app (PhoneRemote.kt).
const WORDS = [
  [/आणि|और|फिर|मग|नंतर/g, ' aur '], [/खोलो|खोल दो|खोल|उघडा|उघड/g, ' kholo '], [/चलाओ|चला दो|चालू करो|चालू कर|लावा|लाव|सुरू कर|सुरू करा/g, ' chalao '],
  [/बजाओ|बजा दो|वाजव/g, ' bajao '], [/लिखो|लिख दो|लिहा|टाइप करो|टाइप/g, ' likho '], [/बोलो|बोल दो|सांगा|सांग|म्हण/g, ' bolo '],
  [/ढूंढो|ढूँढो|ढूंढ|ढूँढ|शोधा|शोध/g, ' dhundo '], [/बंद करो|बंद कर|बंद करा|बंद/g, ' band karo '], [/आवाज़|आवाज|आवाज़/g, ' awaaz '],
  [/बढ़ाओ|बढाओ|वाढव/g, ' badhao '], [/कम करो|कमी कर|कम/g, ' kam '], [/स्क्रीनशॉट|स्क्रीन शॉट/g, ' screenshot '], [/पार्टी/g, ' party '],
  [/चुटकुला|जोक|विनोद/g, ' joke '], [/लॉक/g, ' lock '], [/अगला|पुढचं|पुढचा/g, ' next '], [/पिछला|मागचं|मागचा/g, ' previous '],
  [/रुको|थांब|थांबा/g, ' pause '], [/लैपटॉप|लॅपटॉप/g, ' laptop '], [/नोटपैड|नोटपॅड/g, ' notepad '], [/यूट्यूब|युट्यूब/g, ' youtube '],
  [/क्रोम/g, ' chrome '], [/व्हाट्सएप|व्हॉट्सअॅप|व्हाट्सऐप/g, ' whatsapp '], [/गाना|गाणं|गाणे/g, ' gaana '],
  [/\b(ughad|ughda)\b/gi, 'kholo'], [/\b(lav|lava|chalu kar)\b/gi, 'chalao'], [/\b(liha)\b/gi, 'likho'], [/\b(sang|saang)\b/gi, 'bolo'], [/\b(shodh|shodha)\b/gi, 'dhundo'], [/\b(ani|aani|mag|phir|then)\b/gi, 'aur'],
];
const toRoman = (s) => WORDS.reduce((x, [re, w]) => x.replace(re, w), String(s || '')).replace(/\s+/g, ' ').trim();
// "notepad kholo aur likho kal meeting 10 baje": several steps, run one after another.
function plan(text, kind) {
  // Filler words ("yaar", "please", "bhai"...) carry no meaning and broke the rules ("gaana bajao yaar").
  const r = toRoman(text).replace(/[!?.]+/g, ' ').replace(/\b(yaar|yar|please|plz|pls|zara|jara|bhai|bro|jaldi|na|ji)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  // Split a whole sentence into steps: aur / phir / fir / then / and / uske baad / iske baad / commas.
  // "likho ..." / "type ..." keeps the rest of the sentence as the text to type.
  // Hindi order: "notepad kholo aur usme kal meeting likho" = open notepad, then type "kal meeting".
  const hi = r.match(/^(.*?)\b(?:usme|isme|us me|is me|wahan|waha|uspe|ispe)\s+(.+?)\s+(?:likho|likh do|likhdo|type karo|type kar do)\s*$/i);
  if (hi) return [...plan(hi[1].replace(/\s*\b(aur|phir|fir|and|then)\s*$/i, ''), kind), { action: 'type_text', args: { text: hi[2] } }];
  const typeAt = r.search(/\b(likho|type)\b/i);
  const head = typeAt > 0 ? r.slice(0, typeAt) : r, tail = typeAt > 0 ? r.slice(typeAt) : '';
  const parts = head.split(/\s*(?:,|\buske baad\b|\biske baad\b|\baur phir\b|\baur fir\b|\bphir\b|\bfir\b|\bthen\b|\band\b|\baur\b)\s*/i).map((s) => s.trim()).filter(Boolean);
  if (tail) parts.push(tail.trim());
  const steps = parts.map((s) => understand(s, kind)).filter(Boolean);
  return steps.length ? steps : [understand(r, kind)].filter(Boolean);
}
function understand(text, kind) {
  text = toRoman(text);
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
  // Failed as "Not understood" 10 times in the cloud log (2026-10-26): greetings, "which screen is on", and a song asked without a name.
  if (/\bscreen\b.*\bdikha(?:o|do)?$/.test(t) && !/full/.test(t)) return { action: 'screenshot', args: {} };
  if ((/^(hi+e*|hello+|hey+|namaste|yes|ok|okay|haan|thanks|thank you)\b/.test(t) && t.split(' ').length <= 2) || (/\bkya chal raha hai\b/.test(t) && t.split(' ').length <= 5)) return { action: 'status', args: {} };
  if (/\b(gaana|gana|gaane|song|music)\b/.test(t) && /\b(laga|lagao|lagado|lagana|chala|chalao|bajao|baja|sunao|suna|play)/.test(t)) {
    const q = t.replace(/\b(i'm|laga|lagao|lagado|lagana|dena|de|do|chala|chalao|baja|bajao|sunao|suna|play|koi|ek|to|se|ya|nahin|nahi|youtube|yt|per|pe|par|mein|me|gaana|gana|gaane|song|music|ka|ki|ke|kar|karo|bro)\b/g, ' ').replace(/\s+/g, ' ').trim();
    return { action: 'play_youtube', args: { q: !q ? 'trending hindi songs' : q.split(' ').length <= 1 ? q + ' songs' : q } };
  }
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
  // Tabs and Coco's own player (before the general "close an app" rule).
  if (/\bnew tab\b|\bnaya tab\b/.test(t)) return { action: 'key', args: { combo: 'ctrl+t' } };
  if (/\btab\b/.test(t) && /\b(close|band)\b/.test(t)) return { action: 'key', args: { combo: 'ctrl+w' } };
  if (/\b(video|gaana|gana|song|music|player)\b/.test(t) && /\b(band|close|hatao|stop karo)\b/.test(t)) return { action: 'close_player', args: {} };
  if (/\b(close|band kar(?:o|do)?|hata(?:o|do)?|exit)\b/.test(t) && !/\b(pc|laptop|computer|system)\b/.test(t)) {
    const name = t.replace(/\b(close|band kar(?:o|do)?|hata(?:o|do)?|exit|app|application|ko|wala|wali|sab|all)\b/g, ' ').trim();
    return { action: 'close_app', args: name ? { app: name } : {} };
  }
  if (/\b(desktop dikha(?:o)?|sab minimi[sz]e|show desktop)\b/.test(t)) return { action: 'key', args: { combo: 'win+d' } };
  const open = t.match(/^(?:open|khol(?:o|do)?|start|launch|chalu kar(?:o)?)\s+(.+)$/) || t.match(/^(.+?)\s+(?:khol(?:o|do)?|open kar(?:o|do)?|open|chalu kar(?:o|do)?)$/);
  if (open) { const hit = APP_WORDS.find(([re]) => re.test(open[1])); if (hit) return openIt(hit[1]); if (kind === 'pc') return { action: 'open_app', args: { app: open[1].replace(/\b(app|application|ko|ka|pe|par|laptop|pc)\b/g, ' ').trim() } }; }
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
  const win = [[/\b(maximi[sz]e|bada kar|full window)/, 'win+up'], [/\b(minimi[sz]e|chhota kar|chota kar|chhupa)/, 'win+down'], [/\b(left|baaye|baye) ?(half|side|me)\b/, 'win+left'], [/\b(right|daaye|daye) ?(half|side|me)\b/, 'win+right'], [/\bhalf ?screen\b/, 'win+left'], [/\b(desktop dikhao|show desktop)\b/, 'win+d']].find(([re]) => re.test(t));
  if (win) return { action: 'key', args: { combo: win[1] } };
  if (/\b(full ?screen|poori screen|screen (pe|per|par) dikh)/.test(t)) return { action: 'key', args: { combo: 'f' } };
  // Seek inside the playing video (YouTube keys: j = back 10 s, l = forward 10 s).
  if (/\b(piche|peeche|pichhe|back|rewind)\b/.test(t) && /\b(video|yt|youtube|karo|kar do|thoda)\b/.test(t)) return { action: 'key', args: { combo: 'j' } };
  if (/\b(aage|forward|skip)\b/.test(t) && /\b(video|yt|youtube|karo|kar do|thoda|second)\b/.test(t)) return { action: 'key', args: { combo: 'l' } };
  // Anything else short: search it on YouTube. Long sentences are never searched; the AI or a question handles them.
  if (kind === 'pc' && t.split(' ').length <= 4) return { action: 'play_youtube', args: { q: t }, guess: true };
  return null;
}
// ---------- AI planner (Boss, 2026-10-21): any language / any wording -> steps from the fixed action list only ----------
// Gemini key from the Coco Vault (never printed). If there is no internet or no key, the rules above still work.
const ACTIONS = ['open_app{app}', 'open_url{url,browser?}', 'play_youtube{q}', 'type_text{text}', 'key{combo e.g. ctrl+t, win+left, f, k, l, j}',
  'close_app{app?}', 'media{key: playpause|next|prev}', 'volume{key: up|down|mute, steps?}', 'screenshot{}', 'find_file{q}',
  'close_player{} (stops the song/video Coco is playing)', 'notify{text}', 'speak{text}', 'status{}', 'lock{}', 'sleep{}', 'fun{kind: party|joke|fact|motivate|beep}', 'wait{ms}'];
let geminiKey = null;
function readGeminiKey() {
  if (geminiKey !== null) return geminiKey;
  try { const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'Coco Vault', 'Coco Keys', 'Gemini API Key.txt'), 'utf8'); geminiKey = (raw.match(/(?:=|:)\s*(\S{20,})/) || raw.match(/(\S{30,})/) || [])[1] || ''; } catch { geminiKey = ''; }
  return geminiKey;
}
async function aiPlan(text) {
  const key = readGeminiKey(); if (!key || !text.trim()) return null;
  const prompt = `You control a Windows PC for its owner (Boss). He speaks Hindi, Marathi, English or a mix, often via rough voice typing.
Turn his sentence into steps. Use ONLY these actions: ${ACTIONS.join('; ')}.
Rules: keep his words exactly for type_text; YouTube keys: k pause, l +10s, j -10s, f fullscreen; "half screen left" = key win+left.
Restart/shutdown/payments/messages are NOT allowed here. If the sentence is unclear, return {"ask":"one short question in his language"}.
Return JSON only: {"steps":[{"action":"...","args":{...}}]}.
Sentence: ${text}`;
  // Fastest model first (about 2 s measured 2026-10-21), a stronger one if it is busy.
  let j = null;
  for (const [model, cfg, ms] of [['gemini-3.1-flash-lite', { thinkingConfig: { thinkingLevel: 'minimal' } }, 7000], ['gemini-flash-latest', {}, 9000]]) {
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1, ...cfg } }),
      });
      if (r.ok) { j = await r.json(); break; }
    } catch { /* timed out: try the next model */ } finally { clearTimeout(timer); }
  }
  if (!j) return null;
  {
    const out = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
    const allowed = new Set(ACTIONS.map((a) => a.split('{')[0]));
    if (Array.isArray(out.steps)) out.steps = out.steps.filter((s) => s && allowed.has(s.action)).slice(0, 8).map((s) => ({ action: s.action, args: s.args || {} }));
    // Safety: AI steps may never open the Run box, Task Manager or a power menu (that would run any program).
    if (Array.isArray(out.steps) && out.steps.some((s) => s.action === 'key' && /win\s*\+\s*[rx]|ctrl\s*\+\s*shift\s*\+\s*esc|ctrl\s*\+\s*alt\s*\+\s*del/i.test(String(s.args.combo || '')))) return { ask: 'Ye kaam main AI se nahi karunga. Seedha bolo kya kholna hai.' };
    return out;
  }
}

// ---------- Live work (Boss, 2026-10-21: "not hardcoded, show what is really happening") ----------
// Every minute the Lounge page asks for this snapshot and writes it to Coco Cloud `houses`, so every device shows real work.
// Sources on this PC: Claude sessions active in the last 5 minutes (their last step), the team hand-off log (COMMS.md)
// and the YouTube brain snapshot. Only safe text is kept: a tool name, a short description, the first line of a message.
const HQ = path.join(os.homedir(), 'nova-hq');
const HOUSE_HINTS = [['gigi', /youtube|\byt\b|yt-|video|short|render|channel|thumbnail|the flow|kahani|blender|upload/i],
  ['lulu', /extension|chrome web store|apk|android|play store|\bapp\b|lounge|coco|island|cleanbar/i]];
function liveSessions() {
  const root = path.join(os.homedir(), '.claude', 'projects'); const out = [];
  let dirs = []; try { dirs = fs.readdirSync(root); } catch { return out; }
  for (const d of dirs) {
    let files = []; try { files = fs.readdirSync(path.join(root, d)).filter((n) => n.endsWith('.jsonl')); } catch { continue; }
    for (const n of files) {
      const f = path.join(root, d, n); let st; try { st = fs.statSync(f); } catch { continue; }
      if (Date.now() - st.mtimeMs > 5 * 60 * 1000) continue;
      let text = ''; try { const fd = fs.openSync(f, 'r'); const len = Math.min(st.size, 200000); const b = Buffer.alloc(len); fs.readSync(fd, b, 0, len, st.size - len); fs.closeSync(fd); text = b.toString('utf8'); } catch { continue; }
      const steps = [];
      for (const raw of text.split('\n').slice(1)) {
        let e; try { e = JSON.parse(raw); } catch { continue; }
        if (e.type !== 'assistant' || !Array.isArray(e.message && e.message.content)) continue;
        for (const c of e.message.content) {
          if (c.type === 'tool_use') { const i = c.input || {}; const w = i.description || (i.file_path ? path.basename(String(i.file_path)) : ''); if (w && !/token|secret|password|key/i.test(w)) steps.push(String(w).slice(0, 90)); }
        }
      }
      if (steps.length) out.push({ steps: steps.slice(-6), at: st.mtimeMs });
    }
  }
  return out;
}
ipcMain.handle('live-snapshot', () => {
  const houses = {};
  for (const s of liveSessions()) {
    const hay = s.steps.join(' ');
    const hit = HOUSE_HINTS.find(([, re]) => re.test(hay)); if (!hit) continue;
    const h = houses[hit[0]] || (houses[hit[0]] = { state: 'working', doing: [], at: 0 });
    h.doing.push(s.steps[s.steps.length - 1]); h.at = Math.max(h.at, s.at);
  }
  // Last real hand-off per house from the team log, as "recent".
  try {
    const lines = fs.readFileSync(path.join(HQ, 'company', 'COMMS.md'), 'utf8').split('\n').filter((l) => l.startsWith('- 20')).slice(-60).reverse();
    for (const [id, re] of HOUSE_HINTS) {
      const l = lines.find((x) => re.test(x)); if (!l) continue;
      const p = l.slice(2).split(' | ');
      (houses[id] || (houses[id] = { doing: [] })).recent = `${p[1]} → ${p[2]}: ${(p[3] || '').slice(0, 140)} (${p[0].slice(5, 16).replace('T', ' ')})`;
    }
  } catch {}
  try {
    const perf = (fs.readFileSync(path.join(HQ, 'company', 'youtube', 'BRAIN.md'), 'utf8').match(/Channel: [^\n]+/) || [])[0];
    if (perf) (houses.gigi || (houses.gigi = { doing: [] })).stats = perf;
  } catch {}
  return houses;
});

// ---------- Learning from the control log (Boss, 2026-10-21) ----------
// What the AI understood and what then worked is kept in memory\Learned Commands.json (shared through git with the
// other PC): the same sentence runs at once next time. Misses go to memory\Control Misses.md for the nightly fix.
const LEARN_FILE = path.join(__dirname, '..', 'memory', 'Learned Commands.json');
const MISS_FILE = path.join(__dirname, '..', 'memory', 'Control Misses.md');
const learnKey = (t) => toRoman(String(t || '')).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
let learnedCache = null;
function learned() {
  if (!learnedCache) { try { learnedCache = JSON.parse(fs.readFileSync(LEARN_FILE, 'utf8')); } catch { learnedCache = {}; } }
  return learnedCache;
}
function learn(said, steps) {
  const k = learnKey(said); if (!k || k.split(' ').length > 25) return;
  learned()[k] = steps.map((s) => ({ action: s.action, args: s.args || {} }));
  try { fs.mkdirSync(path.dirname(LEARN_FILE), { recursive: true }); fs.writeFileSync(LEARN_FILE, JSON.stringify(learnedCache, null, 1)); } catch {}
}
function learnMiss(said, why) {
  try { fs.mkdirSync(path.dirname(MISS_FILE), { recursive: true }); fs.appendFileSync(MISS_FILE, `- ${new Date().toISOString()} | "${String(said).slice(0, 160)}" | ${String(why).slice(0, 200)}\n`); } catch {}
}

// Mic on the Control page (Boss, 2026-10-21): the recorded voice goes to Gemini once and comes back as plain text
// (any language; Hindi/Marathi written in Roman letters so the rules can read it).
ipcMain.handle('transcribe', async (_e, { bytes, mime }) => {
  const key = readGeminiKey(); if (!key) return { error: 'No Gemini key on this PC' };
  const audio = Buffer.from(bytes).toString('base64');
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent', {
      method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [
        { inline_data: { mime_type: String(mime || 'audio/webm').split(';')[0], data: audio } },
        { text: 'Write down exactly what is said, nothing else. Hindi or Marathi: write it in Roman letters (Hinglish). No quotes.' },
      ] }], generationConfig: { temperature: 0, thinkingConfig: { thinkingLevel: 'minimal' } } }),
    });
    if (!r.ok) return { error: 'Speech service error ' + r.status };
    const j = await r.json();
    return { text: String(j.candidates?.[0]?.content?.parts?.[0]?.text || '').trim() };
  } catch (e) { return { error: e.name === 'AbortError' ? 'Speech took too long' : e.message }; } finally { clearTimeout(timer); }
});

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
    case 'say': {
      const said = String(args.text || '');
      let steps = plan(said, 'pc').filter((s) => s.action !== 'say'), viaAi = false;
      // Learned from earlier commands: a sentence the AI already understood (and that worked) runs at once.
      const known = learned()[learnKey(said)];
      if (known && (!steps.length || steps.some((s) => s.guess))) steps = known;
      // Rules missed or only guessed: ask the AI planner (Boss: "understand anything, like Claude").
      else if (!steps.length || steps.some((s) => s.guess)) {   // rules first (instant); AI only when they miss
        const ai = await aiPlan(said).catch(() => null);
        if (ai && ai.ask) { learnMiss(said, 'AI asked: ' + ai.ask); return 'Question: ' + ai.ask; }
        if (ai && ai.steps && ai.steps.length) { steps = ai.steps; viaAi = true; }
      }
      if (!steps.length) { learnMiss(said, 'not understood'); return `Not understood: "${said.slice(0, 60)}". Try: kesariya chalao, youtube kholo, chrome kholo, awaaz badhao, next, pause, lock, status`; }
      const out = [];
      for (const s of steps.slice(0, 8)) {
        out.push(await runAction(s.action, s.args));
        if (steps.length > 1) await new Promise((r) => setTimeout(r, s.action === 'open_app' || s.action === 'open_url' ? 1800 : 400));
      }
      const failed = out.some((o) => /^failed|not allowed|not understood|no app called|not found/i.test(String(o)));
      if (failed) learnMiss(said, out.join(' → '));
      else if (viaAi) learn(said, steps);
      if (out.length === 1) return out[0];   // one step: keep its own result (a screenshot is an image)
      return out.map((o) => String(o).startsWith('data:image') ? 'Screenshot taken' : o).join(' → '); }
    case 'status': {
      const disk = fs.statfsSync ? fs.statfsSync('C:\\') : null;
      // Battery comes from a slow Windows query, so answer at once with the last reading and refresh it in the background.
      const battery = batteryCache; refreshBattery();
      return `${await workspaceLine()} · ${os.hostname()} · on for ${(os.uptime() / 3600).toFixed(1)} h · battery ${/^\d+$/.test(battery) ? battery + '%' : 'n/a'} · C: free ${disk ? Math.round(disk.bavail * disk.bsize / 1e9) + ' GB' : 'n/a'} · memory free ${(os.freemem() / 1e9).toFixed(1)} of ${(os.totalmem() / 1e9).toFixed(0)} GB`;
    }
    case 'wait': await new Promise((r) => setTimeout(r, Math.min(10000, Number(args.ms) || 1000))); return 'Waited';
    case 'lock': await exec('rundll32.exe', ['user32.dll,LockWorkStation']); return 'Locked';
    case 'sleep': setTimeout(() => exec('rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0']), 3000); return 'Sleeping in 3 seconds';
    case 'restart': await exec('shutdown.exe', ['/r', '/t', '60', '/c', 'Coco: restart asked from a founder phone. Cancel from Coco Lounge within 60 seconds.']); return 'Restarting in 60 seconds';
    case 'shutdown': await exec('shutdown.exe', ['/s', '/t', '60', '/c', 'Coco: switch off asked from a founder phone. Cancel from Coco Lounge within 60 seconds.']); return 'Switching off in 60 seconds';
    case 'cancel_power': await exec('shutdown.exe', ['/a']); return 'Restart or switch off cancelled';
    case 'open_url': {
      if (!/^https:\/\//.test(String(args.url || ''))) return 'Only https links';
      const exe = BROWSERS[String(args.browser || '')] && BROWSERS[String(args.browser)]();
      if (exe) await exec(exe, [args.url]); else await shell.openExternal(args.url); front();
      return 'Opened ' + args.url + (exe ? ' in ' + args.browser : '');
    }
    case 'close_app': {
      if (!args.app) { await exec(KEYS_EXE, ['combo', 'alt+f4']); return 'Closed the app in front'; }
      const exe = processFor(String(args.app));
      if (!exe) return 'Do not know which program "' + args.app + '" is';
      if (/^(explorer|winlogon|csrss|lsass|svchost|services|system|dwm|electron)$/i.test(exe)) return 'Coco will not close ' + exe;
      const r = await exec('taskkill.exe', ['/IM', exe + '.exe']);
      return /SUCCESS/i.test(r) ? 'Closed ' + args.app : (/not found/i.test(r) ? args.app + ' is not running' : r);
    }
    case 'type_text': { const s = String(args.text || '').slice(0, 2000); if (!s) return 'Nothing to type'; await exec(KEYS_EXE, ['type', s]); return 'Typed ' + s.length + ' characters'; }
    case 'key': {
      const combo = String(args.combo || '').toLowerCase().replace(/\s+/g, '');
      // Video keys go only to Coco's player and tab keys only to a browser, never to whatever is in front (it was VS Code).
      const to = /^(j|k|l|f|m|shift\+n|shift\+p)$/.test(combo) ? 'player' : /^ctrl\+(t|w|tab|shift\+t|shift\+tab|l)$/.test(combo) ? 'browser' : null;
      if (to) {
        let r = await exec(KEYS_EXE, ['keyto', to, combo]);
        // A player that just opened has no title yet: look again twice before saying it is not there.
        for (let i = 0; i < 2 && r !== '1' && to === 'player' && Date.now() - lastPlayAt < 15000; i++) { await new Promise((ok) => setTimeout(ok, 1200)); r = await exec(KEYS_EXE, ['keyto', to, combo]); }
        return r === '1' ? `Pressed ${combo} in the ${to === 'player' ? 'video' : 'browser'}` : (to === 'player' ? 'No Coco video is open' : 'No browser window is open'); }
      const r = await exec(KEYS_EXE, ['combo', combo]); return /failed/.test(r) ? 'Unknown keys: ' + args.combo : 'Pressed ' + combo; }
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
    case 'notify': { if (atOffice()) return 'Not shown: office mode (no notifications at the office)'; const { Notification } = require('electron'); new Notification({ title: 'Coco', body: String(args.text || '').slice(0, 200) }).show(); return 'Shown on screen'; }
    case 'play_youtube': {
      const q = String(args.q || '').trim().slice(0, 120); if (!q) return 'Say what to play';
      const id = await firstVideo(q);
      const url = id ? `https://www.youtube.com/watch?v=${id}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      lastPlayAt = Date.now();
      // One song at a time (Boss, 2026-10-21): close the last Coco player window, then play in a fresh one.
      await exec(KEYS_EXE, ['closeplayer']);
      const brave = BROWSERS.brave();
      if (brave) require('node:child_process').spawn(brave, ['--app=' + url, '--autoplay-policy=no-user-gesture-required'], { detached: true, stdio: 'ignore' }).unref();
      else await shell.openExternal(url);
      front(); return id ? `Playing "${q}" on YouTube` : `Opened YouTube search for "${q}"`;
    }
    case 'media': case 'volume': {
      const key = { playpause: 179, next: 176, prev: 177, mute: 173, down: 174, up: 175 }[String(args.key)];
      if (!key) return 'Unknown key';
      const times = action === 'volume' ? Math.min(10, Math.max(1, Number(args.steps) || 5)) : 1;
      await keys(String(args.key), times);
      return { playpause: 'Play / pause', next: 'Next track', prev: 'Previous track', mute: 'Mute toggled', down: 'Volume down', up: 'Volume up' }[args.key];
    }
    case 'open_app': {
      const target = PC_APPS[String(args.app)];
      if (!target) { const lnk = startMenuApp(String(args.app)); if (!lnk) return 'No app called "' + args.app + '" on this PC'; launchDetached(lnk); front(); return 'Opened ' + path.basename(lnk, '.lnk'); }
      const file = target();
      if (!file) return 'App not found on this PC';
      launchDetached(file); front(); return 'Opened ' + args.app;
    }
    // Home / Office workspace (Boss, 2026-10-22): office-mode.exe saves (verified), closes, restores and switches; its report is the result.
    case 'workspace': {
      const flag = { close_all: ['--close-all'], save: ['--save-session'], restore_home: ['--restore', 'home'], restore_office: ['--restore', 'office'], switch_home: ['--switch', 'home'], switch_office: ['--switch', 'office'] }[String(args.op)];
      if (!flag) return 'failed: unknown workspace step ' + args.op;
      const dir = path.dirname(PLACE_FILE), exe = path.join(dir, 'office-mode.exe');
      if (!fs.existsSync(exe)) return 'failed: office-mode.exe not found';
      const code = await new Promise((r) => execFile(exe, flag, { windowsHide: true, timeout: 110000 }, (e) => r(e ? (e.code ?? 'timeout') : 0)));
      let out = ''; try { out = fs.readFileSync(path.join(dir, 'office-mode.out.txt'), 'utf8').replace(/^﻿/, ''); } catch {}
      const report = out.split(/\r?\n/).filter((l) => /^\d{4}-/.test(l)).map((l) => l.slice(20)).join(' · ').slice(0, 900);
      return (code === 0 ? '' : 'failed: ') + (report || 'no report (exit ' + code + ')');
    }
    case 'close_player': { const n = await exec(KEYS_EXE, ['closeplayer']); return Number(n) > 0 ? 'Closed the song/video' : 'No Coco song/video is open'; }
    case 'ring': return 'A PC cannot ring; try: say hello';
    default: return 'This action is not allowed';
  }
}

// ---------- any installed app (Start Menu shortcuts) ----------
function startMenuApp(name) {
  const want = name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (!want.length) return null;
  const dirs = [path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'), path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'), path.join(os.homedir(), 'Desktop')];
  let best = null, bestScore = 0;
  const walk = (d, depth) => {
    if (depth > 3) return;
    let list; try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { walk(f, depth + 1); continue; }
      if (!/\.(lnk|url)$/i.test(e.name) || /uninstall/i.test(e.name)) continue;
      const n = e.name.toLowerCase().replace(/\.(lnk|url)$/, '');
      const score = want.filter((w) => n.includes(w)).length / want.length - n.length / 1000;
      if (score > bestScore) { bestScore = score; best = f; }
    }
  };
  dirs.forEach((d) => walk(d, 0));
  return bestScore >= 0.99 - 0.1 ? best : null;
}
// App name as spoken into its program file name, for closing.
const PROC = { chrome: 'chrome', brave: 'brave', edge: 'msedge', notepad: 'notepad', calculator: 'CalculatorApp', calc: 'CalculatorApp', 'vs code': 'Code', vscode: 'Code', code: 'Code', cursor: 'Cursor', spotify: 'Spotify', whatsapp: 'WhatsApp', word: 'WINWORD', excel: 'EXCEL', powerpoint: 'POWERPNT', teams: 'ms-teams', zoom: 'Zoom', discord: 'Discord', telegram: 'Telegram', blender: 'blender', 'android studio': 'studio64', vlc: 'vlc', obs: 'obs64', paint: 'mspaint', photos: 'Photos' };
function processFor(name) {
  const n = name.toLowerCase().trim();
  if (PROC[n]) return PROC[n];
  const key = Object.keys(PROC).find((k) => n.includes(k));
  return key ? PROC[key] : (/^[a-z0-9_.-]+$/i.test(n) ? n : null);
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
function popup(title, body) { if (atOffice()) return; const { Notification } = require('electron'); new Notification({ title, body }).show(); }   // silent at the office (Boss, 2026-10-23)
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
ipcMain.handle('set-startup', (_e, on) => { app.setLoginItemSettings(loginArgs(!!on)); return !!on; });

// ---------- Coco Island (Boss, 2026-10-22): Bloom-style black pill at the top of the screen ----------
// A transparent, click-through, never-focused window at the top centre of the main display. The Lounge page pushes
// tasks/approvals the moment they change (island-push); CocoIslandHelper.exe reports the song and full-screen apps.
// Hidden only while a full-screen app is in front (at the office too, Boss 2026-10-22).
const ISLAND_FILE = () => path.join(app.getPath('userData'), 'island.json');
let island = null, islandHelper = null, islandFull = false, islandMax = false, islandLast = null;
const islandSettings = () => { try { return { enabled: true, modules: { coco: true, music: true, control: true, focus: true }, ...JSON.parse(fs.readFileSync(ISLAND_FILE(), 'utf8')) }; } catch { return { enabled: true, modules: { coco: true, music: true, control: true, focus: true } }; } };
const saveIsland = (s) => { try { fs.writeFileSync(ISLAND_FILE(), JSON.stringify(s)); } catch {} };

// Errors from the island and dock pages go to userData\island.log, so a broken screen can be traced after the fact.
function logWindow(w, name) {
  w.webContents.on('console-message', (e, level, message, line) => { if (e && e.message !== undefined) { level = { error: 3, warning: 2 }[e.level] || 0; message = e.message; line = e.lineNumber; }   // newer Electron passes one event object
    if (level >= 2) try { fs.appendFileSync(path.join(app.getPath('userData'), 'island.log'), `${new Date().toISOString()} ${name}:${line} ${message}
`); } catch {} });
}
function placeIsland() {
  if (!island) return;
  const { screen } = require('electron');
  const d = screen.getPrimaryDisplay().bounds, W = 460, H = 310;   // flush with the top edge of the screen, like a notch
  island.setBounds({ x: Math.round(d.x + (d.width - W) / 2), y: d.y, width: W, height: H });
}
// At the office the island shows ONLY approvals (Boss, 2026-10-26): no other Coco status, no toasts (quiet).
let sentModules = '';
const islandModules = () => { const m = { ...islandSettings().modules }; if (atOffice()) { if (m.coco !== false) m.coco = 'approvals'; m.quiet = true; } return m; };   // quiet = no toasts
function sendModules(force) { const m = islandModules(), k = JSON.stringify(m); if (island && (force || k !== sentModules)) { sentModules = k; island.webContents.send('island-modules', m); } }
function islandVisible() {
  sendModules(false);
  if (!island) return;
  const show = islandSettings().enabled && !islandFull;   // shows at the office too (Boss, 2026-10-22); only the big window stays hidden there
  if (show && !island.isVisible()) island.showInactive(); else if (!show && island.isVisible()) island.hide();
}
// Island ON/OFF (Boss, 2026-10-26): one switch for the island's chip, the tray, the Dock menu and the Lounge settings.
// Saved in island.json (restart-safe). Hidden = only the floating overlay goes; approvals still count in the app window.
function setIslandEnabled(on) {
  const s = islandSettings(); s.enabled = !!on; saveIsland(s);
  if (on) createIsland();
  islandVisible();
  if (tray && trayMenu) tray.setContextMenu(trayMenu());
  if (win) win.webContents.send('island-enabled', s.enabled);
  return s.enabled;
}
ipcMain.handle('island-enabled-get', () => islandSettings().enabled);
ipcMain.handle('island-enabled-set', (_e, on) => setIslandEnabled(!!on));
function createIsland() {
  if (island || !islandSettings().enabled) return;
  island = new BrowserWindow({
    width: 460, height: 310, frame: false, transparent: true, resizable: false, movable: false, skipTaskbar: true, focusable: true,
    show: false, alwaysOnTop: true, hasShadow: false, title: 'Coco Island',
    webPreferences: { preload: path.join(__dirname, 'island-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  island.setAlwaysOnTop(true, 'screen-saver'); island.setVisibleOnAllWorkspaces(true);
  island.setIgnoreMouseEvents(true, { forward: true });   // clicks pass through until the mouse is over the pill
  island.loadFile(path.join(__dirname, 'island.html'));
  island.webContents.on('did-finish-load', () => { sendModules(true); islandSend(); sendAccent(); });
  island.on('closed', () => { island = null; });
  logWindow(island, 'island');
  placeIsland(); islandVisible();
  const { screen } = require('electron');
  for (const ev of ['display-metrics-changed', 'display-added', 'display-removed']) screen.on(ev, () => { placeIsland(); placeDock(); });
  require('electron').powerMonitor.on('resume', () => { placeIsland(); islandVisible(); placeDock(); });
  startIslandHelper();
}
function startIslandHelper() {
  const exe = path.join(__dirname, 'CocoIslandHelper.exe');
  if (!fs.existsSync(exe) || islandHelper) return;
  islandHelper = require('node:child_process').spawn(exe, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
  let buf = '';
  islandHelper.stdout.on('data', (b) => {
    buf += b.toString('utf8'); let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      let m; try { m = JSON.parse(line); } catch { continue; }
      if (m.t === 'media' && island) island.webContents.send('island-media', m);
      if (m.t === 'full') { islandFull = !!m.on; islandVisible(); dockVisible(); }
      if (['net', 'bright', 'max', 'vol', 'radio', 'wifilist', 'wifiresult', 'wifipass', 'btlist'].includes(m.t) && island) island.webContents.send('island-sys', m);
      if (m.t === 'wins') { dockWins = m.list; dockFront = m.front || 0; sendDockWins(); }
      if (m.t === 'max') islandMax = !!m.on;
    }
  });
  islandHelper.on('exit', () => { islandHelper = null; if (!quitting && (island || dock)) setTimeout(() => { startIslandHelper(); if (dock) setTimeout(() => islandHelper && islandHelper.stdin.write('taskbar hide\n'), 1000); }, 5000); });   // crashed: start again
}
// Claude Code sessions that wrote in the last 5 minutes (liveSessions above) ride along with every push.
function islandSend() {
  if (!islandLast) return;
  const sessions = liveSessions().sort((a, b) => b.at - a.at).map((x) => ({ now: x.steps[x.steps.length - 1], ago: Math.max(0, Math.round((Date.now() - x.at) / 60000)) + ' min ago' }));
  if (island) island.webContents.send('island-data', { ...islandLast, sessions });
}
ipcMain.on('at-office', (e) => { e.returnValue = atOffice(); });
ipcMain.on('island-push', (_e, d) => { islandLast = d; islandSend(); sendDockWins(); });
setInterval(islandSend, 60000);   // session files have no change event worth watching across every project folder
// Material You: the island tints itself from the Windows accent colour (same idea as the phone using the wallpaper).
function sendAccent() {
  try { if (island) island.webContents.send('island-sys', { t: 'accent', hex: '#' + require('electron').systemPreferences.getAccentColor().slice(0, 6) }); } catch {}
}
try { require('electron').systemPreferences.on('accent-color-changed', sendAccent); } catch {}
// ---- hover like Bloom: an 8 px band at the top centre, 200 ms dwell, pointer checked every 40 ms ----
// Works with the Coco window open or closed (this is the background process). The island never takes focus from the
// hover; clicks pass through everywhere except the pill itself.
const BAND_PX = 8, BAND_W = 420, DWELL_MS = 120, LEAVE_MS = 250;   // Boss 2026-10-22: quicker than Bloom's 200 ms
let pillRect = { w: 200, h: 32 }, hoverOpen = false, bandSince = 0, leftSince = 0, clickable = false;
ipcMain.on('island-rect', (_e, r) => { pillRect = r; });
ipcMain.on('island-close', () => { hoverOpen = false; if (island) island.webContents.send('island-hover', false); });
function islandPointer() {
  if (!island || !island.isVisible()) { if (hoverOpen) { hoverOpen = false; island && island.webContents.send('island-hover', false); } return; }
  const { screen } = require('electron');
  const p = screen.getCursorScreenPoint(), d = screen.getPrimaryDisplay().bounds, b = island.getBounds(), now = Date.now();
  const cx = d.x + d.width / 2;
  const inBand = p.y <= d.y + BAND_PX && Math.abs(p.x - cx) <= BAND_W / 2;
  // Over a maximised app (Chrome tabs, VS Code title bar) the pill is faded out and lets every click through; only the
  // top-edge band with its dwell opens it, so the new-tab button and tabs under it keep working.
  const onPill = (hoverOpen || !islandMax) && p.y >= b.y && p.y <= b.y + pillRect.h && Math.abs(p.x - (b.x + b.width / 2)) <= pillRect.w / 2;
  if (onPill !== clickable) { clickable = onPill; island.setIgnoreMouseEvents(!onPill, { forward: true }); }
  if (!hoverOpen) {
    bandSince = inBand || onPill ? bandSince || now : 0;
    if (bandSince && now - bandSince >= DWELL_MS) { hoverOpen = true; leftSince = 0; island.webContents.send('island-hover', true); }
  } else if (inBand || onPill) leftSince = 0;
  else if (!leftSince) leftSince = now;
  else if (now - leftSince >= LEAVE_MS) { hoverOpen = false; bandSince = 0; island.webContents.send('island-hover', false); }
}
setInterval(islandPointer, 40);

// ---------- Coco Dock (Boss, 2026-10-22): our taskbar, Bloom-style look; the Windows taskbar is hidden while it runs ----------
// Pinned apps = the taskbar's own pinned shortcuts. Open windows come from the helper (every top-level app window, like
// the taskbar), the front window too. Hover previews are live pictures from Windows (desktopCapturer).
const PINNED = path.join(process.env.APPDATA || '', 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'TaskBar');
let dock = null, dockWins = [], dockFront = 0, dockRects = [];
const dockOn = () => islandSettings().dock !== false;
const exeIcons = new Map();
// getFileIcon can hang when called many times at once: one at a time, and never longer than 2 s each.
let iconQueue = Promise.resolve();
function fileIcon(file) {
  const job = iconQueue.then(() => Promise.race([app.getFileIcon(file, { size: 'large' }).then((i) => i.toDataURL()).catch(() => ''), new Promise((r) => setTimeout(() => r(''), 2000))]));
  iconQueue = job.catch(() => '');
  return job;
}
// Pins = the taskbar's pinned shortcuts minus the ones unpinned in the Dock, plus apps added in the Dock (island.json).
function pinPaths() {
  const s = islandSettings(), gone = new Set(s.unpinned || []);
  let files = []; try { files = fs.readdirSync(PINNED).filter((f) => f.toLowerCase().endsWith('.lnk')).map((f) => path.join(PINNED, f)); } catch {}
  return [...files.filter((p) => !gone.has(p)), ...(s.pins || []).filter((p) => fs.existsSync(p))];
}
async function dockApps() {
  const out = [];
  for (const p of pinPaths()) {
    const f = path.basename(p);
    if (/\.exe$/i.test(p)) { out.push({ name: f.replace(/\.exe$/i, ''), path: p, proc: f.replace(/\.exe$/i, '').toLowerCase(), icon: await fileIcon(p) }); continue; }
    let target = '', iconFile = '';
    try { const l = shell.readShortcutLink(p); target = l.target || ''; iconFile = l.icon || ''; } catch {}
    // A web app's shortcut points at an .ico file: read the picture itself (getFileIcon would give the .ico file-type icon).
    let icon = '';
    if (/\.(ico|png)$/i.test(iconFile) && fs.existsSync(iconFile)) { const im = nativeImage.createFromPath(iconFile); if (!im.isEmpty()) icon = im.resize({ width: 64, height: 64 }).toDataURL(); }
    for (const f2 of [iconFile, target]) { if (!icon && f2 && fs.existsSync(f2)) icon = await fileIcon(f2); }
    if (!icon && /explorer/i.test(f)) icon = await fileIcon(path.join(process.env.WINDIR || 'C:\\Windows', 'explorer.exe'));
    // A web app (YouTube installed from Brave) runs inside brave.exe: its windows are found by its name in the title instead.
    const webApp = /--app-id=/.test(String((() => { try { return shell.readShortcutLink(p).args; } catch { return ''; } })()));
    out.push({ name: f.replace(/\.lnk$/i, ''), path: p, proc: webApp ? '' : (path.basename(target, path.extname(target)) || (/explorer/i.test(f) ? 'explorer' : '')).toLowerCase(), icon });
  }
  return out;
}
// Store apps (Teams, Terminal, Settings) live under WindowsApps, where getFileIcon gives a blank window: their icon comes
// from the window itself (desktopCapturer appIcon), read once per program.
const winIcons = new Map();
// A Store app's logo sits in its package folder (AppxManifest.xml names it; the file has scale variants: take the biggest).
function packageLogo(exe) {
  try {
    const parts = exe.split(path.sep), at = parts.findIndex((x) => x.toLowerCase() === 'windowsapps');
    if (at < 0 || at + 1 >= parts.length) return '';
    const m = [null, parts.slice(0, at + 2).join(path.sep)];   // ...\WindowsApps\<package folder>
    const xml = fs.readFileSync(path.join(m[1], 'AppxManifest.xml'), 'utf8');
    const rel = (xml.match(/Square44x44Logo="([^"]+)"/) || xml.match(/<Logo>([^<]+)<\/Logo>/) || [])[1]; if (!rel) return '';
    const dir = path.join(m[1], path.dirname(rel)), base = path.basename(rel, path.extname(rel));
    const files = fs.readdirSync(dir).filter((f) => f.startsWith(base) && /\.png$/i.test(f) && !/contrast|light/i.test(f))
      .map((f) => ({ f, n: Number((f.match(/(?:targetsize|scale)-(\d+)/) || [])[1] || 0) })).sort((x, y) => y.n - x.n);
    if (!files.length) return '';
    const im = nativeImage.createFromPath(path.join(dir, files[0].f)); return im.isEmpty() ? '' : im.resize({ width: 64, height: 64 }).toDataURL();
  } catch { return ''; }
}
async function storeIcons(need) {
  for (const w of need) { const logo = w.path ? packageLogo(w.path) : ''; if (logo) winIcons.set(w.name, logo); }
  need = need.filter((w) => !winIcons.has(w.name)); if (!need.length) return;
  try {
    const { desktopCapturer } = require('electron');
    const src = await desktopCapturer.getSources({ types: ['window'], fetchWindowIcons: true, thumbnailSize: { width: 0, height: 0 } });
    for (const w of need) { const s = src.find((x) => x.id === `window:${w.hwnd}:0`); if (s && s.appIcon && !s.appIcon.isEmpty()) winIcons.set(w.name, s.appIcon.resize({ width: 64, height: 64 }).toDataURL()); }
  } catch {}
}
async function sendDockWins() {
  if (!dock) return;
  const list = [];
  const store = dockWins.filter((w) => (!w.path || /\\WindowsApps\\|applicationframehost/i.test(w.path)) && !winIcons.has(w.name));
  if (store.length) await storeIcons(store);
  for (const w of dockWins) {
    const isStore = !w.path || /\\WindowsApps\\|applicationframehost/i.test(w.path);
    if (!isStore && !exeIcons.has(w.path)) exeIcons.set(w.path, await fileIcon(w.path));
    list.push({ hwnd: w.hwnd, name: w.name, title: w.title, path: isStore ? '' : w.path, icon: isStore ? winIcons.get(w.name) || '' : exeIcons.get(w.path) });
  }
  const badge = atOffice() ? 0 : ((islandLast && islandLast.approvals) || []).length;   // no Coco status at the office
  if (dock) dock.webContents.send('dock-wins', { list, badge, front: dockFront });
}
function placeDock() {   // full width, 300 px tall at the bottom: room for previews; all of it but the bar and preview lets clicks through
  if (!dock) return;
  const { screen } = require('electron'); const d = screen.getPrimaryDisplay().bounds;
  dock.setBounds({ x: d.x, y: d.y + d.height - 300, width: d.width, height: 300 });
}
function dockVisible() { if (!dock) return; const show = dockOn() && !islandFull; if (show && !dock.isVisible()) dock.showInactive(); else if (!show && dock.isVisible()) dock.hide(); }
function createDock() {
  if (dock || !dockOn()) return;
  dock = new BrowserWindow({ width: 800, height: 300, frame: false, transparent: true, resizable: false, movable: false, skipTaskbar: true, show: false,
    alwaysOnTop: true, hasShadow: false, title: 'Coco Dock', webPreferences: { preload: path.join(__dirname, 'dock-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  dock.setAlwaysOnTop(true, 'screen-saver'); dock.setIgnoreMouseEvents(true, { forward: true });
  dock.loadFile(path.join(__dirname, 'dock.html'));
  dock.webContents.on('did-finish-load', async () => {
    try { dock.webContents.send('dock-apps', await dockApps()); await sendDockWins(); }
    catch (e) { try { fs.appendFileSync(path.join(app.getPath('userData'), 'island.log'), `${new Date().toISOString()} dock main: ${e.stack}\n`); } catch {} }
  });
  dock.on('closed', () => { dock = null; });
  logWindow(dock, 'dock');
  try { fs.watch(PINNED, async () => { if (dock) dock.webContents.send('dock-apps', await dockApps()); }); } catch {}
  placeDock(); dockVisible();
  startIslandHelper(); setTimeout(() => islandHelper && islandHelper.stdin.write('taskbar hide\n'), 1500);
}
function removeDock() { if (dock) dock.destroy(); dock = null; if (islandHelper) islandHelper.stdin.write('taskbar show\n'); }
// With the taskbar hidden the tray icon is hidden too, so the Dock's right-click menu carries the same switches.
function dockMenu() {
  return Menu.buildFromTemplate([
    { label: 'Open Coco Lounge', click: () => { win.show(); win.focus(); } },
    { label: 'Approvals', click: () => { win.show(); win.focus(); win.webContents.executeJavaScript(`location.hash = 'approvals'`); } },
    { type: 'separator' },
    { label: 'Show Coco Island', type: 'checkbox', checked: islandSettings().enabled, click: (i) => setIslandEnabled(i.checked) },
    { label: 'Turn off Coco Dock (Windows taskbar back)', click: () => { const s = islandSettings(); s.dock = false; saveIsland(s); removeDock(); } },
    { label: 'Task Manager', click: () => shell.openPath('taskmgr.exe') },
    { label: 'Taskbar settings', click: () => shell.openExternal('ms-settings:taskbar') },
  ]);
}
const say = (c) => { if (islandHelper) islandHelper.stdin.write(c + '\n'); };
ipcMain.on('dock-rects', (_e, r) => { dockRects = Array.isArray(r) ? r.slice(0, 4) : []; });
ipcMain.on('dock-start', () => say('start'));
ipcMain.on('dock-menu', () => { if (dock) dockMenu().popup({ window: dock }); });
ipcMain.on('dock-coco', () => { win.show(); win.focus(); if (!atOffice() && islandLast && islandLast.approvals && islandLast.approvals.length) win.webContents.executeJavaScript(`location.hash = 'approvals'`); });
ipcMain.on('dock-focuswin', (_e, n) => { n = Math.trunc(Number(n)); if (!n) return; if (n > 0) say('focushwnd ' + n); else say('minhwnd ' + -n); });
ipcMain.on('dock-launch', (_e, lnk) => { if (pinPaths().includes(String(lnk))) shell.openPath(lnk); });   // only what is pinned
const resendApps = async () => { if (dock) dock.webContents.send('dock-apps', await dockApps()); };
function setPin(p, on) {
  const s = islandSettings(); s.pins = s.pins || []; s.unpinned = s.unpinned || [];
  if (on) { if (p.startsWith(PINNED)) s.unpinned = s.unpinned.filter((x) => x !== p); else if (!s.pins.includes(p)) s.pins.push(p); }
  else { if (p.startsWith(PINNED)) s.unpinned.push(p); else s.pins = s.pins.filter((x) => x !== p); }
  saveIsland(s); resendApps();
}
// "+" on the Dock: pick any app (Start menu shortcut or a program) to pin.
ipcMain.on('dock-add', async () => {
  const { dialog } = require('electron');
  const r = await dialog.showOpenDialog({ title: 'Pin an app to the Coco Dock', defaultPath: path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    properties: ['openFile'], filters: [{ name: 'Apps', extensions: ['lnk', 'exe'] }] });
  if (!r.canceled && r.filePaths[0] && /\.(lnk|exe)$/i.test(r.filePaths[0])) setPin(r.filePaths[0], true);
});
// Right-click on an app: pin or unpin, new window, close its windows.
ipcMain.on('dock-appmenu', (_e, a) => {
  if (!dock || !a) return;
  const pinned = pinPaths(), lnk = String(a.lnk || ''), exe = String(a.exe || ''), hwnds = (a.hwnds || []).map((h) => Math.trunc(Number(h))).filter(Boolean);
  const items = [];
  if (lnk && pinned.includes(lnk)) items.push({ label: 'Unpin from Dock', click: () => setPin(lnk, false) });
  else if (exe && fs.existsSync(exe)) items.push({ label: 'Pin to Dock', click: () => setPin(exe, true) });
  if (lnk && pinned.includes(lnk)) items.push({ label: 'New window', click: () => shell.openPath(lnk) });
  else if (exe && fs.existsSync(exe)) items.push({ label: 'New window', click: () => shell.openPath(exe) });
  if (hwnds.length) items.push({ type: 'separator' }, { label: hwnds.length > 1 ? `Close ${hwnds.length} windows` : 'Close window', click: () => hwnds.forEach((h) => say('closehwnd ' + h)) });
  if (items.length) Menu.buildFromTemplate(items).popup({ window: dock });
});
ipcMain.handle('dock-preview', async (_e, hwnds) => {
  const want = new Set((hwnds || []).slice(0, 8).map((h) => `window:${Math.trunc(h)}:0`));
  try {
    const { desktopCapturer } = require('electron');
    const src = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 376, height: 236 } });
    return src.filter((s) => want.has(s.id)).map((s) => ({ hwnd: Number(s.id.split(':')[1]), thumb: s.thumbnail.isEmpty() ? '' : s.thumbnail.toDataURL() }));
  } catch { return []; }
});
let dockHot = false;
setInterval(() => {   // clicks reach the Dock only on the bar and the open preview; everywhere else they pass through
  if (!dock || !dock.isVisible()) return;
  const { screen } = require('electron'); const p = screen.getCursorScreenPoint(), b = dock.getBounds();
  const x = p.x - b.x, y = p.y - b.y;
  const hot = dockRects.some((r) => x >= r.x - 4 && x <= r.x + r.w + 4 && y >= r.y - 4 && y <= r.y + r.h + 4);
  if (hot !== dockHot) { dockHot = hot; dock.setIgnoreMouseEvents(!hot, { forward: true }); }
}, 40);
ipcMain.on('island-blur', () => { if (island) island.blur(); });
ipcMain.on('island-open', (_e, page) => { if (!/^[a-z]+$/.test(page) || !win) return; win.show(); win.focus(); win.webContents.executeJavaScript(`location.hash = '${page}'`); });
ipcMain.on('island-settings', (_e, uri) => { if (/^ms-settings:[a-z-]+$/.test(uri)) shell.openExternal(uri); });
ipcMain.handle('island-act', (_e, { action, args }) => {
  const say = (c) => { if (islandHelper) islandHelper.stdin.write(c + '\n'); return 'ok'; };
  if (action === 'vol') { const n = Math.round(Number(args && args.level)); return n >= 0 && n <= 100 ? say('vol ' + n) : 'bad'; }
  if (action === 'mute') return say('mute');
  if (action === 'wifiscan') return say('wifi scan');
  if (action === 'btlist') return say('bt list');
  if (action === 'wificonnect') {   // the password goes straight to the helper's stdin, never to a log or a file
    const ssid = String((args && args.ssid) || ''), pw = args && args.password != null ? String(args.password) : null;
    if (!ssid || ssid.length > 64 || /[\r\n\t]/.test(ssid) || (pw != null && (pw.length > 128 || /[\r\n]/.test(pw)))) return 'bad';
    return say(pw == null ? 'wifi connect ' + ssid : 'wifi join ' + ssid + '\t' + pw);
  }
  if (action === 'radio') { const k = args && args.kind, on = !!(args && args.on); return k === 'wifi' || k === 'bt' ? say(`radio ${k} ${on ? 'on' : 'off'}`) : 'bad'; }
  // Show a password THIS PC already saved (own networks only). The value never touches a log or disk; it goes straight to the island window.
  if (action === 'wifipass') { const s = String(args && args.ssid || ''); return s ? say('wifi pass ' + s) : 'bad'; }
  // After joining an open network, open the sign-in page (captive portal) at a place.
  if (action === 'portal') { shell.openExternal('http://www.msftconnecttest.com/redirect'); return 'ok'; }
  // YES/NO on an approval from the island (Boss, 2026-10-26): the Lounge page writes it to Coco Cloud
  // with its signed-in Supabase client — the exact same path as the Approvals page buttons.
  if (action === 'module') { const k = String(args && args.k); if (!['coco', 'music', 'control', 'focus'].includes(k)) return 'bad'; const s = islandSettings(); s.modules = { ...s.modules, [k]: !!args.on }; saveIsland(s); sendModules(true); if (tray && trayMenu) tray.setContextMenu(trayMenu()); return 'ok'; }
  if (action === 'hide') { setIslandEnabled(false); return 'ok'; }
  if (action === 'approve') { const id = String((args && args.id) || ''); if (!id || !win) return 'bad'; win.webContents.send('island-approve', { id, yes: !!(args && args.yes) }); return 'ok'; }
  if (action === 'bright') { const n = Math.round(Number(args && args.level)); if (islandHelper && n >= 0 && n <= 100) islandHelper.stdin.write('bright ' + n + '\n'); return 'ok'; }
  return ['media', 'volume', 'notify'].includes(action) ? runAction(action, args || {}) : 'not allowed';
});
setInterval(islandVisible, 30000);   // home/office switch
// Quitting: the helper brings the taskbar back when its input closes, then exits by itself.
app.on('before-quit', () => { quitting = true; try { if (islandHelper) { if (dock) islandHelper.stdin.write('taskbar show\n'); islandHelper.stdin.end(); } } catch {} });

// ---------- always connected (Boss, 2026-10-23) ----------
// The page reports every heartbeat that really reached Coco Cloud. No beat for 4 minutes (sleep, Wi-Fi change, expired
// login, a hung page) -> reload the page, which reconnects everything. A crashed page reloads at once, and so does
// waking or unlocking the PC. A beat file lets the 5-minute keepalive restart the whole app if even that fails.
const BEAT_FILE = () => path.join(app.getPath('userData'), 'last-beat.txt');
let lastBeat = Date.now();
const beatNow = () => { lastBeat = Date.now(); try { fs.writeFileSync(BEAT_FILE(), String(lastBeat)); } catch {} };
ipcMain.on('lounge-beat', beatNow);
// The page needs a person (sign in again, or pair again): show the window and a Windows notification once.
let needShown = 0;
ipcMain.on('lounge-need', (_e, which) => {
  lastBeat = Date.now();   // reloading would not help; a person must act
  if (Date.now() - needShown < 30 * 60 * 1000 || atOffice()) return;   // at the office: no pop-up; the Dock menu still opens Coco
  needShown = Date.now();
  const { Notification } = require('electron');
  new Notification({ title: 'Coco is not connected', body: which === 'pair' ? 'Pair this PC again in Coco Lounge (it opened for you).' : 'Sign in to Coco Lounge again (it opened for you).' }).show();
  if (win) { win.show(); win.focus(); }
});
function reconnect(why) {
  if (!win || win.isDestroyed()) return;
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'island.log'), `${new Date().toISOString()} reconnect: ${why}
`); } catch {}
  lastBeat = Date.now();   // give the reload its own 4 minutes
  win.webContents.reloadIgnoringCache();
}
setInterval(() => { if (Date.now() - lastBeat > 4 * 60 * 1000) reconnect('no heartbeat for 4 min'); }, 60 * 1000);
app.whenReady().then(() => {
  const { powerMonitor } = require('electron');
  powerMonitor.on('resume', () => setTimeout(() => reconnect('PC woke up'), 8000));
  powerMonitor.on('unlock-screen', () => { if (Date.now() - lastBeat > 90 * 1000) reconnect('PC unlocked'); });
});
app.on('web-contents-created', (_e, wc) => wc.on('render-process-gone', (_e2, d) => { if (win && wc === win.webContents) setTimeout(() => reconnect('page crashed: ' + d.reason), 2000); }));

app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });   // launching Coco again is a person asking for it, office or not
app.whenReady().then(() => {
  app.setLoginItemSettings(loginArgs(true)); // always rewrite, so an old broken entry gets fixed
  createWindow(); createTray(); createIsland(); createDock();
  setTimeout(selfUpdate, 60 * 1000); setInterval(selfUpdate, 30 * 60 * 1000);
});

// ---------- self update (Boss, 2026-10-15): both founders' PCs stay on the latest Coco from GitHub GetRichSoon/Coco ----------
// Every 30 minutes: fast-forward pull only (never overwrites local edits). If the Lounge changed, restart into it.
const COCO_DIR = path.join(__dirname, '..');
// startHead = the commit this process started on. Updating = "HEAD is no longer startHead and Lounge files differ", so a pull by
// anything (this timer, a session, Daily Seal) is noticed, and after the restart startHead is the new HEAD: no restart loop is possible.
// Extra guard: never restart twice within 10 minutes. Runs 1 min after start, then every 30 min (so at least daily).
let startHead = null;
exec('git', ['-C', COCO_DIR, 'rev-parse', 'HEAD']).then((h) => { startHead = /^[0-9a-f]{40}$/.test(h) ? h : null; });
const RESTART_FILE = () => path.join(app.getPath('userData'), 'last-update-restart.txt');
async function selfUpdate() {
  if (!startHead) return;
  const log = (m) => { try { fs.appendFileSync(path.join(app.getPath('userData'), 'island.log'), `${new Date().toISOString()} update: ${m}\n`); } catch {} };
  updateState = 'downloading';
  const pull = await new Promise((r) => execFile('git', ['-C', COCO_DIR, 'pull', '--ff-only', '--quiet'], { windowsHide: true, timeout: 90000 }, (e, so, se) => r(e ? `failed: ${(e.killed ? 'timed out after 90 s' : (se || e.message)).toString().slice(0, 160)}` : 'ok')));   // the shared exec() gives up after 15 s, too short for a pull right after wake-up
  if (/failed/.test(pull)) log('pull did not run: ' + pull.slice(0, 120));
  const after = await exec('git', ['-C', COCO_DIR, 'rev-parse', 'HEAD']);
  updateState = null;   // nothing came down, or nothing to restart for: idle again, not stuck mid-update
  if (after === startHead || !/^[0-9a-f]{40}$/.test(after)) return;
  // Bounded to the folders that matter, and never node_modules. The diff spanning the commit that
  // untracked 60,972 files is 67 MB of path names, far past execFile's 1 MB buffer, so exec() came
  // back 'failed', nothing matched, and the app quietly stopped updating itself while looking fine.
  // Bounded, the same diff is 51 bytes.
  const changed = await exec('git', ['-C', COCO_DIR, 'diff', '--name-only', startHead, after, '--', 'Lounge', 'Lounge Desktop', ':(exclude)Lounge Desktop/node_modules']);
  if (/package\.json/.test(changed)) await exec('cmd.exe', ['/c', 'npm', 'install', '--no-audit', '--no-fund', '--prefix', __dirname]);
  if (!/^(Lounge|Lounge Desktop)\//m.test(changed)) { startHead = after; return; }   // memory, teams, the phone app: nothing to restart for
  let last = 0; try { last = Number(fs.readFileSync(RESTART_FILE(), 'utf8')) || 0; } catch {}
  if (Date.now() - last < 10 * 60 * 1000) { log('restart held back (updated less than 10 min ago)'); return; }
  if (!(await versionChecks(log))) return;   // stay on the version that works
  offerRestart(after, log);
}

// Never restart into a commit that fails its own version check. release.test.js is the canonical
// source for what version the four clients are on, and it is what catches a Lounge whose release.json,
// package.json and phone build have come apart - exactly the state that made 2.9.0 unpublishable. A
// restart into that is a restart into a Coco that reports the wrong thing to the cloud.
// If node itself cannot run, that is not a failing check and the restart goes ahead as it always did:
// a missing tool must not be able to freeze updates forever.
async function versionChecks(log) {
  const out = await exec('node', [path.join(COCO_DIR, 'Lounge', 'release.test.js')]);
  if (/^release:/.test(out)) return true;
  if (/ENOENT|not recognized|cannot find|no such file/i.test(out)) { log('version check skipped, node could not run it: ' + out.slice(0, 90)); return true; }
  log('NOT restarting: the new commit fails its own version check - ' + out.slice(0, 140));
  return false;
}

// An update used to close the app under the founder mid-sentence. Now: if nobody is looking - the
// window is hidden in the tray or minimised, which is most of the time - it restarts straight away
// exactly as before. If the window IS open, the Lounge says an update is ready and waits to be told.
// Either way the new code is already on disk; only the restart into it waits.
let pendingUpdate = null;
// What the updater is doing right now, in the words the Release Center shows: a founder looking at
// four devices needs to tell "behind and stuck" from "behind and busy". Read by the Lounge with its
// heartbeat, so the cloud carries it; null means idle and the dashboard compares versions instead.
let updateState = null;
ipcMain.on('update-state', (e) => { e.returnValue = updateState; });
function restartNow() {
  try { fs.writeFileSync(RESTART_FILE(), String(Date.now())); } catch {}
  app.relaunch({ args: [...(app.isPackaged ? [] : [path.resolve(__dirname)]), '--hidden'] }); app.exit(0);   // keep the app folder, or a bare electron.exe starts
}
function offerRestart(after, log) {
  pendingUpdate = after;
  updateState = 'installing';   // the new code is on disk; only the restart into it is left
  const inUse = win && !win.isDestroyed() && win.isVisible() && !win.isMinimized();
  if (!inUse) { log(`restarting into ${after.slice(0, 7)} (was ${startHead.slice(0, 7)}, window not in use)`); restartNow(); return; }
  log(`update ${after.slice(0, 7)} ready; waiting for the founder to restart`);
  try { win.webContents.send('update-ready', { commit: after.slice(0, 7) }); } catch {}
}
ipcMain.on('update-restart', () => { if (pendingUpdate) restartNow(); });
