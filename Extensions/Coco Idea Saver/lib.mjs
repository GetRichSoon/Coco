// Pure logic shared by background.js and test.mjs (so node can test it without chrome.*).
export const API = 'http://localhost:7777/api/notes';
export const QUEUE_CAP = 200; // oldest saves drop first if the heart server is down for days

// Context-menu click -> note payload. Selection beats image beats link beats page.
export function buildPayload(info, tab) {
  const pageUrl = (tab && tab.url) || info.pageUrl || '';
  const pageTitle = ((tab && tab.title) || '').slice(0, 200);
  if (info.selectionText) return { kind: 'idea', source_url: pageUrl, title: pageTitle, text: info.selectionText.slice(0, 4000) };
  const media = info.srcUrl || info.linkUrl; // image src or link target
  if (media) return { kind: 'link', source_url: media.slice(0, 2000), title: pageTitle, text: `from ${pageUrl} — ${pageTitle}`.slice(0, 4000) };
  return { kind: 'link', source_url: pageUrl, title: pageTitle, text: pageTitle || pageUrl };
}

// Save with one quiet retry; on failure queue for the 5-min flush alarm.
// io = { post(note) -> throws on failure, store: chrome.storage.local-like {get, set} }
export async function saveNote(note, io) {
  for (let i = 0; i < 2; i++) {
    try { await io.post(note); flushQueue(io).catch(() => {}); return true; } catch {}
  }
  const { queue = [] } = await io.store.get('queue');
  await io.store.set({ queue: [...queue, note].slice(-QUEUE_CAP) });
  return false;
}

export async function flushQueue(io) {
  const { queue = [] } = await io.store.get('queue');
  while (queue.length) { await io.post(queue[0]); queue.shift(); await io.store.set({ queue }); }
}
