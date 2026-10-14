// Builds the SQL that fills Coco Cloud from Good Space files. Prints SQL files into ./cloud-seed/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const GS = 'C:/Users/Lenovo/Good Space';
const brain = JSON.parse(readFileSync(`${GS}/Coco/memory/brain.json`, 'utf8'));
const channels = JSON.parse(readFileSync('C:/Users/Lenovo/nova-hq/company/youtube/channels.json', 'utf8').replace(/^\uFEFF/, '')).channels;
const q = (s) => s == null ? 'null' : `$gs$${String(s).replace(/\$gs\$/g, '')}$gs$`;
const out = {};
const add = (file, sql) => (out[file] = (out[file] || '') + sql + '\n');

// founders, houses, platforms
add('1-base', `insert into founders values ('lokademangesh123@gmail.com','Mangesh','Boss') on conflict do nothing;`);
const houses = [
  ['gigi', 'Gigi', 'Content', 'working', 'YouTube first, then Instagram and Facebook; 1 Short a day, 1 long video a week', 'Shorts post automatically (A-006); long videos need a YES', 1],
  ['lulu', 'Lulu', 'Products', 'working', 'Extensions and apps; one release a week after the founder says final', 'Every store release needs a YES', 2],
  ['fifi', 'Fifi', 'Downloads', 'next', 'Notes, templates, planners, e-books; each sold through a Gigi channel', 'Selling and payments need a YES', 3],
  ['zaza', 'Zaza', 'Games', 'later', 'Roblox first, then small versions on Play Store, Chrome Store and web', 'Every release needs a YES', 4],
];
const yt = brain.teams.find(t => t.id === 'youtube') || {}, ext = brain.teams.find(t => t.id === 'extensions') || {}, app = brain.teams.find(t => t.id === 'android') || {};
const live = { gigi: yt, lulu: { doing: `${ext.doing}; apps: ${app.doing}`, recent: ext.recent, blocked: 'Chrome Web Store one-time Google login pending; Play Console not connected', next: ext.next }, fifi: { doing: 'Starts after payments account (founder YES)', next: 'Finish the Mantra PDF Project' }, zaza: { doing: 'Waiting', next: 'Roblox account and Roblox Studio when Zaza starts' } };
for (const [id, name, role, state, cadence, rule, sort] of houses) {
  const l = live[id] || {};
  add('1-base', `insert into houses (id,name,role,state,cadence,publish_rule,doing,recent,blocked,next,sort) values (${q(id)},${q(name)},${q(role)},${q(state)},${q(cadence)},${q(rule)},${q(l.doing)},${q(l.recent)},${q(l.blocked)},${q(l.next)},${sort}) on conflict (id) do update set doing=excluded.doing, recent=excluded.recent, blocked=excluded.blocked, next=excluded.next, state=excluded.state;`);
}
[['youtube', 'YouTube'], ['play', 'Play Store'], ['chrome', 'Chrome Web Store'], ['roblox', 'Roblox'], ['website', 'Website'], ['social', 'Instagram / Facebook']]
  .forEach(([id, n], i) => add('1-base', `insert into platforms values (${q(id)},${q(n)},${i + 1}) on conflict do nothing;`));

// categories
const cats = {
  gigi: ['Science', 'Biology & Health', 'History & Geography', 'Stories', 'Human Behaviour', 'Study', 'Human Information', 'Money', 'Mixed', 'AI & Software', 'App & Web', 'Food', 'Devotional', 'Feminism'],
  lulu: ['AI Tools', 'Productivity', 'Look & Style', 'Video & Audio', 'Social & Messaging', 'Files & PDF', 'Jobs & Career', 'Privacy & Safety', 'Shopping & Money', 'Games & Fun'],
  fifi: ['Study', 'Career', 'Money', 'AI & Tech', 'Health & Fitness', 'Food', 'Devotional', 'Planners'],
  zaza: ['Obby & Adventure', 'Simulator & Tycoon', 'Racing & Driving', 'Horror & Mystery', 'Puzzle & Brain', 'Quiz & Trivia', 'Classic & Board'],
};
const links = { fifi: ['Gigi Study', 'Lulu Jobs & Career', 'Gigi Money', 'Gigi AI & Software', 'Gigi Biology & Health', 'Gigi Food', 'Gigi Devotional', 'Lulu Productivity'] };
for (const h in cats) cats[h].forEach((n, i) => add('2-catalog', `insert into categories (house_id,code,name,linked_to) values (${q(h)},${i + 1},${q(n)},${q(links[h]?.[i] || null)}) on conflict do nothing;`));
const cat = (h, n) => `(select id from categories where house_id=${q(h)} and name=${q(n)})`;

// offerings: Gigi channels
const chanCat = { 'the-flow': 'Science', 'biology-health': 'Biology & Health', 'history-geography': 'History & Geography', stories: 'Stories', 'human-behaviour': 'Human Behaviour', study: 'Study', 'human-info': 'Human Information', money: 'Money', mixed: 'Mixed', 'ai-software': 'AI & Software', 'app-web': 'App & Web', food: 'Food', devotional: 'Devotional', feminism: 'Feminism' };
for (const c of channels) {
  const name = c.slug === 'the-flow' ? 'The Flow' : (c.finalName || (c.nameIdeas || [])[0] || c.slug);
  const status = c.status === 'connected' ? 'live' : c.status === 'waiting-founder' ? 'needs name' : 'name ready, create channel';
  add('2-catalog', `insert into offerings (house_id,category_id,platform_id,kind,name,status,notes) values ('gigi',${cat('gigi', chanCat[c.slug])},'youtube','channel',${q(name)},${q(status)},${q('Name ideas: ' + (c.nameIdeas || []).join(', '))});`);
}
// Lulu extensions + apps
const lulu = {
  'AI Tools': ['Claude Enhancer', 'ChatGPT Enhancer', 'Gemini Enhancer', 'My Local AI', 'CentrAlign'],
  'Productivity': ['Breakwater', 'Screen Time Tracker', 'Typewave', 'TapIn', 'Motivation'],
  'Look & Style': ['Orbi'],
  'Video & Audio': ['QuickCast', 'Fenwick Recorder', 'Meeting Recorder', 'Volume Booster', 'Tempo Controller', 'Loudleaf'],
  'Social & Messaging': ['YouTube Financer', 'YouTube Screenshot', 'WhatsApp Enhancer', 'WhatsApp Smart Assistant'],
  'Files & PDF': ['OhMyPDF', 'Neon Converter', 'PDF Smart Converter', 'File Converter', 'Snapora'],
  'Jobs & Career': ['Applyline', 'JobFitCheck', 'HirePilot'],
  'Privacy & Safety': ['Shield', 'TempLogin'],
  'Shopping & Money': ['DealFinder'],
};
for (const c in lulu) for (const n of lulu[c]) add('2-catalog', `insert into offerings (house_id,category_id,platform_id,kind,name,status) values ('lulu',${cat('lulu', c)},'chrome','extension',${q(n)},'built');`);
[['Screen Time Tracker', 'Productivity', 'v5.4.61 APK'], ['Fuselist', 'Productivity', 'parked (A-001 on hold)'], ['Nova Island', 'Look & Style', 'in progress'], ['CleanBar', 'Look & Style', 'in progress'], ['Android Dark Clock', 'Look & Style', 'built'], ['Bloom Clock', 'Look & Style', 'built']]
  .forEach(([n, c, s]) => add('2-catalog', `insert into offerings (house_id,category_id,platform_id,kind,name,status) values ('lulu',${cat('lulu', c)},'play','app',${q(n)},${q(s)});`));
add('2-catalog', `insert into offerings (house_id,category_id,platform_id,kind,name,status,notes) values ('fifi',${cat('fifi', 'Devotional')},'website','download','Mantra Collection','in progress','Mantra PDF Project, 94 files');`);
[['Puzzle Game', 'Puzzle & Brain'], ['Food Quiz', 'Quiz & Trivia'], ['TicTacToe', 'Classic & Board'], ['Game Arena', 'Classic & Board']]
  .forEach(([n, c]) => add('2-catalog', `insert into offerings (house_id,category_id,platform_id,kind,name,status) values ('zaza',${cat('zaza', c)},'chrome','game',${q(n)},'built');`));

// Bonbon Club
const members = [
  ['lola', 'Lola', 'Think', 'Finds ideas and trends, scores each one', 'haiku', 'scout', false, 'gigi,lulu,fifi,zaza'],
  ['lili', 'Lili', 'Think', 'Checks the market; after launch tracks views, installs, sales', 'haiku', 'scout', false, 'gigi,lulu,fifi,zaza'],
  ['remy', 'Remy', 'Make', 'Builds extensions, apps, websites, games', 'sonnet', 'builder', false, 'lulu,fifi,zaza'],
  ['vivi', 'Vivi', 'Make', 'UI and UX: screens, icons, store images, Material You look', 'sonnet', null, true, 'gigi,lulu,fifi,zaza'],
  ['margot', 'Margot', 'Make', 'Writes scripts, titles, captions, store text, e-books', 'sonnet', 'content-writer', false, 'gigi,lulu,fifi,zaza'],
  ['cleo', 'Cleo', 'Make', 'Makes videos, thumbnails, trailers', 'sonnet', 'video-producer', false, 'gigi,fifi,zaza'],
  ['elise', 'Elise', 'Care', 'Checks quality (never her own work), packs the release', 'sonnet', 'release-qa', false, 'gigi,lulu,fifi,zaza'],
  ['kiki', 'Kiki', 'Care', 'Growth: SEO, store pages, links, email drafts', 'haiku', 'growth', false, 'gigi,lulu,fifi,zaza'],
  ['didi', 'Didi', 'Care', 'Customer care: reviews and reply drafts', 'haiku', null, true, 'lulu,fifi,zaza'],
  ['bibi', 'Bibi', 'Care', 'Money, weekly scoreboard, approvals, token report', 'haiku', null, true, 'gigi,lulu,fifi,zaza'],
];
members.forEach(([id, n, g, j, m, a, nw, hs], i) => {
  add('3-club', `insert into members values (${q(id)},${q(n)},${q(g)},${q(j)},${q(m)},${q(a)},${nw},${i + 1}) on conflict do nothing;`);
  hs.split(',').forEach(h => add('3-club', `insert into member_houses values (${q(id)},${q(h)}) on conflict do nothing;`));
});
// tools: [name, purpose, status, location/url, members]
const tools = [
  ['Google Trends', 'what people search, rising or falling', 'web', 'https://trends.google.com', 'lola'],
  ['Google Alerts', 'emails when a topic is in the news', 'web', 'https://www.google.com/alerts', 'lola'],
  ['Exploding Topics', 'fast-growing topics early (free list)', 'web', 'https://explodingtopics.com', 'lola'],
  ['Reddit', 'real complaints and wishes', 'web', 'https://www.reddit.com', 'lola'],
  ['TikTok Creative Center', 'rising topics and sounds', 'web', 'https://ads.tiktok.com/business/creativecenter', 'lola'],
  ['Pinterest Trends', 'rising topics', 'web', 'https://trends.pinterest.com', 'lola'],
  ['Product Hunt', 'new tools people like', 'web', 'https://www.producthunt.com', 'lola'],
  ['AppBrain', 'top and rising Android apps', 'web', 'https://www.appbrain.com', 'lola'],
  ['Etsy and Gumroad search', 'what downloads sell', 'web', 'https://www.etsy.com', 'lola'],
  ['Roblox Charts', 'top and rising games', 'web', 'https://www.roblox.com/charts', 'lola'],
  ['YouTube Studio Research', 'our channel searches and results', 'web', 'https://studio.youtube.com', 'lili'],
  ['vidIQ', 'keyword scores, trends (free plan)', 'extension', 'https://vidiq.com', 'lili'],
  ['TubeBuddy', 'keyword scores (free plan)', 'extension', 'https://www.tubebuddy.com', 'lili'],
  ['Similarweb', 'competitor website traffic', 'extension', 'https://www.similarweb.com', 'lili'],
  ['AnswerThePublic', 'questions people ask (free searches)', 'web', 'https://answerthepublic.com', 'lili'],
  ['RoMonitor Stats', 'Roblox player numbers', 'web', 'https://romonitorstats.com', 'lili'],
  ['Microsoft Clarity', 'heatmaps and recordings on our websites', 'web', 'https://clarity.microsoft.com', 'lili'],
  ['Figma', 'screen design, Material 3 kit (free Starter; View seat)', 'connected', 'https://www.figma.com', 'vivi'],
  ['Figma Community', 'free UI kits as reference', 'connected', 'https://www.figma.com/community', 'vivi'],
  ['Material Theme Builder', 'Material You colour sets', 'web', 'https://material-foundation.github.io/material-theme-builder/', 'vivi'],
  ['Material Symbols', 'icons', 'web', 'https://fonts.google.com/icons', 'vivi,remy'],
  ['Google Fonts', 'type (Fraunces, Nunito)', 'web', 'https://fonts.google.com', 'vivi,margot'],
  ['Realtime Colors', 'try palettes on a page', 'web', 'https://www.realtimecolors.com', 'vivi'],
  ['Photopea', 'photo editing in the browser', 'web', 'https://www.photopea.com', 'vivi'],
  ['Krita', 'illustration and drawing', 'to_install', 'https://krita.org', 'vivi'],
  ['Penpot', 'free design editor', 'web', 'https://penpot.app', 'vivi'],
  ['Design Atelier', 'the Good Space look and tokens', 'connected', 'Good Space/Coco/Design Atelier', 'vivi,remy'],
  ['Material Web', 'Material You for websites and popups', 'library', 'https://material-web.dev', 'remy'],
  ['Jetpack Compose Material 3', 'Material You for Android apps', 'library', 'https://developer.android.com/jetpack/compose/designsystems/material3', 'remy'],
  ['Lucide', 'icons in code', 'library', 'https://lucide.dev', 'remy'],
  ['Roblox Studio', 'Roblox games', 'to_install', 'https://create.roblox.com', 'remy'],
  ['Canva', 'e-books, templates, thumbnails, banners (free plan)', 'connected', 'https://www.canva.com', 'margot,cleo'],
  ['Blender', '3D scenes and films (4.2.3, PC)', 'installed', '%LOCALAPPDATA%/Programs/blender-4.2.3-windows-x64', 'cleo'],
  ['DaVinci Resolve', 'video editing (free version)', 'to_install', 'https://www.blackmagicdesign.com/products/davinciresolve', 'cleo'],
  ['Audacity', 'clean voice and audio', 'to_install', 'https://www.audacityteam.org', 'cleo'],
  ['OBS Studio', 'screen recording for demos', 'to_install', 'https://obsproject.com', 'cleo'],
  ['LottieFiles', 'small animations', 'web', 'https://lottiefiles.com', 'cleo'],
  ['Rive', 'interactive animations', 'web', 'https://rive.app', 'cleo'],
  ['YouTube Audio Library', 'free music and sound', 'web', 'https://studio.youtube.com', 'cleo'],
  ['Lighthouse', 'speed and accessibility score', 'web', 'built into Chrome', 'elise'],
  ['axe DevTools', 'accessibility problems', 'extension', 'https://www.deque.com/axe/devtools/', 'elise'],
  ['Accessibility Scanner', 'Android app checks', 'app', 'Google Play', 'elise'],
  ['WebAIM Contrast Checker', 'readable text', 'web', 'https://webaim.org/resources/contrastchecker/', 'elise,vivi'],
  ['Play pre-launch report', 'real-device tests', 'web', 'https://play.google.com/console', 'elise'],
  ['Google Search Console', 'how people find our sites', 'web', 'https://search.google.com/search-console', 'kiki'],
  ['Google Keyword Planner', 'search volume (no spending)', 'web', 'https://ads.google.com', 'kiki'],
  ['Shots.so', 'store screenshot mockups', 'web', 'https://shots.so', 'kiki'],
  ['YouTube Test & Compare', 'best thumbnail', 'web', 'https://studio.youtube.com', 'kiki'],
  ['Play store listing experiments', 'best store page', 'web', 'https://play.google.com/console', 'kiki'],
  ['Gmail drafts', 'reply drafts (sent only with a founder YES)', 'connected', 'https://mail.google.com', 'didi'],
  ['Google Forms', 'feedback surveys', 'web', 'https://forms.google.com', 'didi'],
  ['Google Sheets', 'earnings and costs per House', 'web', 'https://sheets.google.com', 'bibi'],
  ['Ollama local AI (Qwen 3 8B, Gemma 3 4B)', 'free private AI for rough internal work (PC)', 'installed', '%LOCALAPPDATA%/Programs/Ollama', 'lola,lili,didi,bibi'],
  ['Mobbin', 'screen library (needs paid plan, not used)', 'skipped_paid', 'https://mobbin.com', ''],
];
for (const [n, p, s, l, ms] of tools) {
  const isUrl = /^https?:/.test(l);
  add('3-club', `insert into tools (name,purpose,status,location,url) values (${q(n)},${q(p)},${q(s)},${isUrl ? 'null' : q(l)},${isUrl ? q(l) : 'null'}) on conflict (name) do nothing;`);
  ms.split(',').filter(Boolean).forEach(m => add('3-club', `insert into member_tools values (${q(m)},(select id from tools where name=${q(n)})) on conflict do nothing;`));
}

// approvals + decisions
for (const a of brain.approvals || []) add('4-history', `insert into approvals (code,team,what,files,state,decided_by,raised_on) values (${q(a.id)},${q(a.team)},${q(a.what)},${q(a.files)},${q(a.state)},${q(a.decidedBy)},${/^\d{4}-\d{2}-\d{2}$/.test(a.date) ? q(a.date) : 'null'});`);
for (const d of brain.decisions || []) if (/^\d{4}-\d{2}-\d{2}$/.test(d.date)) add('4-history', `insert into decisions (decided_on,by_name,text) values (${q(d.date)},${q(d.by)},${q(d.text)});`);

// rules: the company documents
const doc = (f) => readFileSync(`${GS}/Coco/teams/${f}`, 'utf8').replace(/^\uFEFF/, '');
[['company-structure', 'Company Structure', 'Company Structure.md'], ['bonbon-toolkit', 'Bonbon Club Toolkit', 'Bonbon Club Toolkit.md'], ['token-treasury', 'Token Treasury', 'Token Treasury.md'], ['quality-promise', 'Quality Promise', 'Quality Promise.md'], ['support-team', 'Support Team', 'Support Team.md']]
  .forEach(([id, t, f]) => add('5-rules', `insert into rules (id,title,body) values (${q(id)},${q(t)},${q(doc(f))}) on conflict (id) do update set body=excluded.body, updated_at=now();`));
add('5-rules', `insert into activity (actor,action,detail) values ('coco','cloud opened','Good Space moved into Coco Cloud from the PC (Coco memory + team documents)');`);

mkdirSync('cloud-seed', { recursive: true });
for (const f in out) { writeFileSync(`cloud-seed/${f}.sql`, out[f]); console.log(f, out[f].length, 'chars,', out[f].split('\n').length - 1, 'statements'); }
