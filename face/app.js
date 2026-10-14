// Coco app: one screen set for PC and phone. Talks only to Coco Core (/api).
const PAGES = [
  { id: 'home', name: 'Home', ic: '🏠' },
  { id: 'teams', name: 'Teams', ic: '👑' },
  { id: 'approvals', name: 'Approvals', ic: '✨' },
  { id: 'youtube', name: 'YouTube', ic: '🎬' },
  { id: 'extensions', name: 'Extensions', ic: '🧩' },
  { id: 'connections', name: 'Connections', ic: '🔗' },
];
let brain = null;
let page = location.hash.slice(1) || 'home';
let ytTab = 'videos';
const $ = (s) => document.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pin = () => { try { return localStorage.getItem('coco-pin') || ''; } catch { return ''; } };
const who = () => $('#who').value;
const callName = () => (who() === 'shreya' ? 'Big Boss' : 'Boss');
const day = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');

async function api(path, data) {
  const res = await fetch(`/api/${path}`, {
    method: data ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'x-coco-pin': pin() },
    body: data ? JSON.stringify({ ...data, by: who() }) : undefined,
  });
  if (res.status === 401) { $('#pin').showModal(); throw new Error('pin'); }
  return res.json();
}
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2600); }

const waiting = () => (brain.approvals || []).filter(a => a.state === 'waiting');
const chip = (state) => {
  const map = { connected: ['good', 'Connected'], almost: ['warn', 'Almost'], missing: ['bad', 'Missing'], off: ['soft', 'Not connected'],
    active: ['good', 'Working'], paused: ['soft', 'Paused'], approved: ['good', 'Approved'], rejected: ['bad', 'No'], waiting: ['warn', 'Waiting for you'], 'on-hold': ['soft', 'On hold'] };
  const [cls, label] = map[state] || ['soft', state];
  return `<span class="chip ${cls}">${label}</span>`;
};

function nav() {
  const n = waiting().length;
  const link = (p) => `<a href="#${p.id}" class="${p.id === page ? 'on' : ''}"><span class="ic">${p.ic}</span><span>${p.name}</span>${p.id === 'approvals' && n ? `<span class="badge">${n}</span>` : ''}</a>`;
  $('#nav').innerHTML = PAGES.map(link).join('');
  $('#bottom').innerHTML = PAGES.filter(p => p.id !== 'connections').map(link).join('');
}

function teamCard(t) {
  return `<div class="card">
    <div class="team-head"><div class="team-emoji">${t.emoji}</div><div class="grow"><h2 style="margin:0">${esc(t.name)}</h2>${chip(t.state)}</div></div>
    <dl>
      <dt>Doing</dt><dd>${esc(t.doing) || '—'}</dd>
      <dt>Done</dt><dd>${esc(t.recent) || '—'}</dd>
      <dt>Blocked</dt><dd>${esc(t.blocked) || 'Nothing'}</dd>
      <dt>Next</dt><dd>${esc(t.next) || '—'}</dd>
      <dt>Rhythm</dt><dd>${esc(t.cadence)}</dd>
      <dt>Publish</dt><dd>${esc(t.publishRule)}</dd>
      <dt>Support</dt><dd>${(t.support || []).map(esc).join(', ') || '—'}</dd>
    </dl>
    <form class="ask" data-team="${t.id}"><input name="t" placeholder="Give ${esc(t.name)} a task…" required><button class="tonal">Send</button></form>
  </div>`;
}

function approvalRow(a) {
  return `<div class="row"><div class="grow">
      <h3>${esc(a.id)} · ${esc(a.team)} ${chip(a.state)}</h3>
      <div>${esc(a.what)}</div>
      <div class="muted">${esc(a.date)}${a.files ? ' · ' + esc(a.files) : ''}${a.decidedBy ? ' · decided by ' + esc(a.decidedBy) : ''}</div>
      ${a.state === 'waiting' ? `<div class="actions"><button class="filled" data-yes="${esc(a.key)}">YES</button><button class="text" data-no="${esc(a.key)}">No</button></div>` : ''}
    </div></div>`;
}

const VIEWS = {
  home() {
    const yt = brain.youtube || { videos: [], channels: [] };
    const live = yt.videos.filter(v => v.published);
    const conns = brain.connections || [];
    const latest = live[0];
    return `<div class="card hero">
        <h2>Hello ${callName()} ✨</h2>
        <div>${waiting().length ? `${waiting().length} things wait for your YES.` : 'Nothing waits for you right now.'} ${latest ? `Latest video: <b>${esc(latest.title)}</b>.` : ''}</div>
        <div class="stats">
          <div class="stat"><b>${(brain.teams || []).filter(t => t.state === 'active').length}</b><span>teams working</span></div>
          <div class="stat"><b>${live.length}</b><span>videos live</span></div>
          <div class="stat"><b>${(brain.products || []).length}</b><span>products</span></div>
          <div class="stat"><b>${conns.filter(c => c.state === 'connected').length}/${conns.length}</b><span>connected</span></div>
        </div>
      </div>
      <h2 style="margin-top:24px">Teams today</h2>
      <div class="grid">${(brain.teams || []).map(t => `<div class="card"><div class="team-head"><div class="team-emoji">${t.emoji}</div><div><h3>${esc(t.name)}</h3>${chip(t.state)}</div></div><div>${esc(t.doing)}</div><div class="muted" style="margin-top:6px">Next: ${esc(t.next)}</div></div>`).join('')}</div>
      <h2 style="margin-top:24px">Needs you</h2>
      <div class="card">${(brain.alerts || []).slice(0, 3).map(a => `<div class="row"><div class="grow"><div>${esc(a.say)}</div><div class="muted">${esc(a.todo)} · ${day(a.at)}</div></div></div>`).join('') || '<div class="empty">No alerts. All calm.</div>'}</div>`;
  },
  teams() {
    const tasks = (brain.tasks || []).slice(0, 12);
    return `<div class="grid">${(brain.teams || []).map(teamCard).join('')}</div>
      <h2 style="margin-top:24px">🤝 Support Team <span class="muted">· shared by every main team</span></h2>
      <div class="card">${(brain.agents || []).map(a => `<div class="row"><div class="grow"><h3>${esc(a.name || a.id)}</h3><div>${esc(a.job || a.description)}</div><div class="muted">Helps: ${(a.serves || []).map(id => esc(((brain.teams || []).find(t => t.id === id) || {}).name || id)).join(', ')}</div></div><span class="chip soft">${esc(a.model)}</span></div>`).join('')}</div>
      <h2 style="margin-top:24px">Latest tasks</h2>
      <div class="card">${tasks.map(t => `<div class="row"><div class="grow"><div>${esc(t.title)}</div><div class="muted">${esc(t.team || t.agent || '')} · ${day(t.created)}</div></div><span class="chip soft">${esc(t.status)}</span></div>`).join('') || '<div class="empty">No tasks yet.</div>'}</div>`;
  },
  approvals() {
    const all = brain.approvals || [];
    const w = all.filter(a => a.state === 'waiting');
    const rest = all.filter(a => a.state !== 'waiting');
    return `<p class="muted">YES only records your decision. Coco never publishes, spends or deletes without it.</p>
      <h2>Waiting (${w.length})</h2><div class="card">${w.map(approvalRow).join('') || '<div class="empty">All clear ✨</div>'}</div>
      <h2 style="margin-top:24px">Decided</h2><div class="card">${rest.map(approvalRow).join('')}</div>`;
  },
  youtube() {
    const yt = brain.youtube || { videos: [], channels: [] };
    const tabs = `<div class="tabs"><button data-yt="videos" class="${ytTab === 'videos' ? 'on' : ''}">Videos</button><button data-yt="channels" class="${ytTab === 'channels' ? 'on' : ''}">Channels (${yt.channels.length})</button></div>`;
    if (ytTab === 'channels') return tabs + `<div class="grid">${yt.channels.map(c => `<div class="card"><h3>${esc(c.title || c.finalName || c.nameIdeas[0] || c.slug)}</h3><div class="muted">${esc(c.category)}</div><div style="margin-top:8px">${chip(c.status === 'connected' ? 'connected' : 'off')} <span class="muted">${esc(c.status)}</span></div>${c.nameIdeas.length ? `<div class="muted" style="margin-top:6px">Name ideas: ${c.nameIdeas.map(esc).join(', ')}</div>` : ''}</div>`).join('')}</div>`;
    return tabs + `<div class="card">${yt.videos.map(v => `<div class="row"><div class="grow"><h3>${esc(v.title)}</h3><div class="muted">${v.kind === 'long' ? 'Long video' : 'Short'} · ${esc(v.date)}</div></div>${v.published ? `<a class="chip good" href="${esc(v.published.url)}" target="_blank" rel="noopener">Live ↗</a>` : `<span class="chip ${v.rendered ? 'warn' : 'soft'}">${v.rendered ? 'Ready' : 'Draft'}</span>`}</div>`).join('')}</div>
      ${teamCard((brain.teams || []).find(t => t.id === 'youtube') || {})}`;
  },
  extensions() {
    const ex = brain.extensions || { backlog: [], ideas: [] };
    const prods = (brain.products || []).filter(p => p.kind === 'extension');
    return `${teamCard((brain.teams || []).find(t => t.id === 'extensions') || {})}
      <h2 style="margin-top:24px">Best ideas</h2>
      <div class="card">${ex.backlog.slice(0, 8).map(b => `<div class="row"><div class="grow"><h3>#${b.rank} ${esc(b.idea.split(':')[0])}</h3><div class="muted">${esc(b.reason)}</div></div><span class="chip warn">${esc(b.score)}/50</span></div>`).join('') || '<div class="empty">No ideas yet.</div>'}</div>
      <h2 style="margin-top:24px">Our extensions (${prods.length})</h2>
      <div class="grid">${prods.map(p => `<div class="card"><h3>${esc(p.name)}</h3><div class="muted">${esc(p.what || '')}</div></div>`).join('')}</div>`;
  },
  connections() {
    return `<div class="grid">${(brain.connections || []).map(c => `<div class="card"><h3>${esc(c.name)}</h3><div style="margin:6px 0">${chip(c.state)}</div><div class="muted">${esc(c.detail)}</div></div>`).join('')}</div>
      <div class="card" style="margin-top:16px"><h2>Open Coco on your phone</h2>
      <div>${brain.phoneUrl ? `Same Wi-Fi as the PC: <b>${esc(brain.phoneUrl)}</b>, then type the PIN from <b>Coco Vault › Coco Keys › Coco App PIN.txt</b>.` : 'Connect the PC to Wi-Fi to open Coco on your phone.'}</div></div>`;
  },
};

function render() {
  if (!brain) return;
  if (!VIEWS[page]) page = 'home';
  nav();
  $('#title').textContent = PAGES.find(p => p.id === page).name;
  $('#hello').textContent = `${brain.company || 'Good Space'} · Coco for ${callName()}`;
  $('#view').innerHTML = VIEWS[page]();
}

async function load() {
  try { brain = await api('brain'); render(); } catch (e) { if (e.message !== 'pin') toast('Coco Core is not running on the PC'); }
}

addEventListener('hashchange', () => { page = location.hash.slice(1) || 'home'; render(); scrollTo(0, 0); });
$('#who').addEventListener('change', () => { try { localStorage.setItem('coco-who', who()); } catch {} render(); });
try { const w = localStorage.getItem('coco-who'); if (w) $('#who').value = w; } catch {}
$('#refresh').addEventListener('click', async () => { await api('refresh', {}); await load(); toast('Coco read Nova again ✨'); });
$('#pin').addEventListener('close', () => { try { localStorage.setItem('coco-pin', $('#pinInput').value.trim()); } catch {} load(); });
document.addEventListener('click', async (e) => {
  const yes = e.target.dataset.yes, no = e.target.dataset.no, yt = e.target.dataset.yt;
  if (yt) { ytTab = yt; render(); }
  if (yes || no) { await api('approve', { key: yes || no, answer: yes ? 'yes' : 'no' }); toast(yes ? 'YES saved ✨' : 'No saved'); load(); }
});
document.addEventListener('submit', async (e) => {
  const team = e.target.dataset.team; if (!team) return;
  e.preventDefault();
  const title = e.target.t.value.trim(); if (!title) return;
  const r = await api('task', { team, title });
  toast(r.handed ? 'Sent to the team on the Laptop Terminal ✨' : 'Saved in Coco ✨');
  e.target.reset(); load();
});
load();
setInterval(load, 15000);
