// Brings everything Nova knows into Coco's memory (memory/brain.json).
// Reads nova-hq files only; never reads secret values.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { saveBrain, loadBrain } from './brain.mjs';

const NOVA = process.env.NOVA_HQ || 'C:/Users/Lenovo/nova-hq';
const read = (p) => { try { return readFileSync(join(NOVA, p), 'utf8').replace(/^\uFEFF/, ''); } catch { return ''; } };
const json = (p, fb) => { try { return JSON.parse(read(p)); } catch { return fb; } };
const ls = (p) => { try { return readdirSync(join(NOVA, p)); } catch { return []; } };

// Fix Windows-1252 mojibake that some Nova files carry (e.g. "Ã¢â‚¬â€" for "â€”").
export const tidy = (s = '') => s.replace(/Ã¢â‚¬â€/g, 'â€”').replace(/Ã¢â‚¬â€œ/g, 'â€“').replace(/Ã¢â‚¬â„¢/g, 'â€™').replace(/Ã¢â‚¬Å“|Ã¢â‚¬\x9d|Ã¢â‚¬/g, '"').trim();

export function tableRows(md) {
  return md.split(/\r?\n/)
    .filter(l => /^\s*[|-]/.test(l) && l.includes('|') && !/^\s*\|?\s*-{2,}/.test(l))
    .map(l => l.replace(/^\s*-\s*/, '').replace(/^\||\|$/g, '').split('|').map(c => tidy(c.replace(/`/g, ''))))
    .filter(cells => cells.length > 1);
}

function approvals() {
  const rows = tableRows(read('company/APPROVALS.md')).filter(r => /^A-\d+/.test(r[0]));
  return rows.map((r, i) => {
    const status = r[5] || '';
    const state = /^APPROVED/i.test(status) ? 'approved' : /^REJECTED|^NO/i.test(status) ? 'rejected' : /HOLD/i.test(status) ? 'on-hold' : 'waiting';
    return { key: `${r[0]}#${i}`, id: r[0], date: r[1], team: r[2], what: r[3], files: r[4], status, state, decidedBy: (status.match(/\((Mangesh|Shreya)\)/i) || [])[1] || null };
  });
}

function decisions() {
  return tableRows(read('company/DECISIONS.md')).filter(r => /^\d{4}-\d{2}-\d{2}/.test(r[0]))
    .map(r => ({ date: r[0], by: r[1], text: r.slice(2).join(' | ') }));
}

function tasks() {
  return (json('os/state/tasks.json', { tasks: [] }).tasks || []).map(t => ({
    id: t.id, title: tidy(t.title), agent: t.agent, status: t.status, priority: t.priority,
    created: t.created_at, result: tidy(t.result || ''), from: 'nova',
  }));
}

function agents() {
  return ls('.claude/agents').filter(f => f.endsWith('.md')).map(f => {
    const md = read(`.claude/agents/${f}`);
    const field = (k) => (md.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')) || [])[1] || '';
    return { id: f.replace('.md', ''), description: tidy(field('description')), model: field('model') || 'inherit' };
  });
}

function channels() {
  const c = json('company/youtube/channels.json', { channels: [] });
  return (c.channels || []).map(ch => ({
    slug: ch.slug, category: tidy(ch.category), status: ch.status, title: tidy(ch.title || ''),
    nameIdeas: ch.nameIdeas || [], finalName: ch.finalName || ch.name || null,
  }));
}

function videos() {
  return ls('content').filter(d => /^\d{4}-\d{2}-\d{2}-/.test(d) && !/reference/.test(d)).map(d => {
    const pub = json(`content/${d}/published.json`, null);
    const files = ls(`content/${d}`);
    const kind = files.includes('long.mp4') ? 'long' : 'short';
    return {
      slug: d, date: d.slice(0, 10),
      title: d.slice(11).replace(/-/g, ' ').replace(/\b\w/g, m => m.toUpperCase()),
      kind, rendered: files.some(f => f.endsWith('.mp4')) || files.includes('video'),
      published: pub ? { url: pub.url, privacy: pub.privacy, at: pub.published_at } : null,
    };
  }).reverse();
}

function products() {
  const md = read('company/PORTFOLIO.md');
  const ext = tableRows(md.split('## Apps')[0]).filter(r => r[0] && r[0] !== 'Product')
    .map(r => ({ name: r[0], repo: r[1], what: r[2], kind: 'extension' }));
  const apps = (md.split('## Apps')[1] || '').split('##')[0].split(/\r?\n/).filter(l => l.startsWith('- '))
    .map(l => ({ name: tidy(l.slice(2)), kind: 'app' }));
  for (const a of ls('apps')) apps.push({ name: a.replace(/-/g, ' ').replace(/\b\w/g, m => m.toUpperCase()), repo: `nova-hq/apps/${a}`, kind: 'app' });
  return [...ext, ...apps];
}

function backlog() {
  return tableRows(read('company/BACKLOG.md')).filter(r => /^\d+$/.test(r[0]))
    .map(r => ({ rank: +r[0], idea: r[1], score: r[7], reason: r[8] }));
}

function ideasInbox(team) {
  const dir = `company/${team}/inbox`;
  const out = [];
  for (const sub of ['', 'done']) for (const f of ls(sub ? `${dir}/${sub}` : dir).filter(f => f.endsWith('.json'))) {
    const j = json(`${dir}/${sub ? sub + '/' : ''}${f}`, null);
    if (j) out.push({ at: j.at, from: j.from, type: j.type, text: tidy(j.text || ''), done: sub === 'done' });
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

function alerts() {
  return read('company/ALERTS.md').split(/\r?\n/).filter(l => /^- \d{4}-/.test(l))
    .map(l => { const [at, say, todo] = l.slice(2).split(' | '); return { at, say: tidy(say), todo: tidy(todo || '') }; });
}

function history() {
  return read('company/COMMS.md').split(/\r?\n/).filter(l => /^- \d{4}-/.test(l)).slice(-80)
    .map(l => { const [at, from, to, text] = l.slice(2).split(' | '); return { at, from, to, text: tidy(text || '') }; });
}

function connections() {
  const i = json('os/integrations.json', {});
  const pick = (k) => i[k] || {};
  return [
    { id: 'youtube', name: 'YouTube', state: pick('youtube_api').state || 'unknown', detail: tidy(pick('youtube_api').channel || '') },
    { id: 'chrome-store', name: 'Chrome Web Store', state: pick('chrome_store').state || 'unknown', detail: 'One-time Google login (refresh token) still pending' },
    { id: 'github', name: 'GitHub', state: pick('github').state || 'unknown', detail: tidy(pick('github').note || '') },
    { id: 'play', name: 'Google Play Console', state: pick('play_console').state || 'not_connected', detail: tidy(pick('play_console').note || '') },
    { id: 'instagram', name: 'Instagram', state: pick('instagram_api').state || 'not_connected', detail: tidy(pick('instagram_api').note || '') },
    { id: 'facebook', name: 'Facebook', state: pick('facebook_api').state || 'not_connected', detail: tidy(pick('facebook_api').note || '') },
  ];
}

function teamRows() {
  const rows = tableRows(read('company/TEAMS.md'));
  const find = (name) => rows.find(r => r[0].toLowerCase().startsWith(name)) || [];
  const row = (r) => ({ doing: r[1] || '', recent: r[2] || '', blocked: r[3] === 'â€”' ? '' : (r[3] || ''), next: r[4] || '' });
  return { ext: row(find('extensions')), yt: row(find('youtube')), long: row(find('long-form')), growth: row(find('growth')) };
}

// Nova's TEAMS.md goes stale; the videos themselves say what the YouTube team really did.
function youtubeNow(vids, row) {
  const live = vids.filter(v => v.published);
  const longOpen = vids.find(v => v.kind === 'long' && !v.published && v.rendered);
  if (!live.length) return row;
  const last = live[0];
  return {
    doing: `1 Short a day on The Flow${longOpen ? ` Â· long video "${longOpen.title}" ready, waiting for YES` : ''}`,
    recent: `Posted "${last.title}" on ${last.date} (${live.length} videos live)`,
    blocked: row.blocked && !/not connected in cloud/i.test(row.blocked) ? row.blocked : '',
    next: 'Next Short in the Kai and Orbi style (QUALITY_V2 rule 0)',
  };
}

export function importNova() {
  const t = teamRows();
  t.yt = youtubeNow(videos(), t.yt);
  const prev = loadBrain();
  const brain = {
    name: 'Coco',
    company: 'Good Space',
    importedFrom: NOVA,
    importedAt: new Date().toISOString(),
    founders: [{ id: 'mangesh', name: 'Mangesh', callMe: 'Boss' }, { id: 'shreya', name: 'Shreya', callMe: 'Big Boss' }],
    teams: [
      { id: 'youtube', name: 'YouTube Studio', emoji: 'ðŸŽ¬', state: 'active', ...t.yt, longForm: t.long,
        cadence: '1 Short every day, 1 long video every week', publishRule: 'Shorts post automatically (A-006). Long videos need a YES.', playbook: 'teams/YouTube Studio.md' },
      { id: 'extensions', name: 'Extension Atelier', emoji: 'ðŸ§©', state: 'active', ...t.ext,
        cadence: 'Ideas Mon to Thu, shortlist Friday, one release a week', publishRule: 'Every Web Store release needs a YES.', playbook: 'teams/Extension Atelier.md' },
      { id: 'android', name: 'App Garden', emoji: 'ðŸ“±', state: 'active', doing: 'Nova Island and CleanBar builds on the PC', recent: 'Fuselist parked (A-001 on hold)', blocked: 'Play Console not connected (upload is manual)', next: 'Pick the next app to polish',
        cadence: 'One app polished at a time', publishRule: 'Every Play Store release needs a YES.', playbook: 'teams/App Garden.md' },
      { id: 'social', name: 'Social Lounge', emoji: 'ðŸ’¬', state: 'paused', doing: 'Paused by the founder (2026-10-09)', recent: t.growth.recent || '', blocked: 'Instagram and Facebook not connected', next: 'Starts again when the founder says so',
        cadence: 'Paused', publishRule: 'Every post needs a YES.', playbook: 'teams/Social Lounge.md' },
    ],
    agents: agents(),
    tasks: [...tasks(), ...(prev.tasks || []).filter(x => x.from === 'coco')],
    approvals: approvals().map(a => ({ ...a, ...((prev.approvals || []).find(p => p.key === a.key && p.from === 'coco') || {}) })),
    decisions: [...decisions(), ...(prev.decisions || []).filter(d => d.from === 'coco')],
    youtube: { channels: channels(), videos: videos() },
    extensions: { backlog: backlog(), ideas: ideasInbox('extensions'), weekly: ls('company/extensions-weekly') },
    products: products(),
    alerts: alerts(),
    history: history(),
    connections: connections(),
    notes: prev.notes || [],
  };
  if (!brain.decisions.some(d => /Good Space/.test(d.text)))
    brain.decisions.push({ date: '2026-10-14', by: 'Mangesh', text: 'The company is called Good Space. Coco (rebuilt from Nova) manages it.', from: 'coco' });
  saveBrain(brain);
  return brain;
}

if (process.argv[1] && process.argv[1].endsWith('import-nova.mjs')) {
  const b = importNova();
  console.log(`Coco remembers: ${b.teams.length} teams, ${b.agents.length} agents, ${b.tasks.length} tasks, ${b.approvals.length} approvals, ${b.decisions.length} decisions, ${b.youtube.channels.length} channels, ${b.youtube.videos.length} videos, ${b.products.length} products.`);
}

