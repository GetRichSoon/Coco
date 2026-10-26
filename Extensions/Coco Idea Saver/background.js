// Coco Idea Saver service worker: context menu + save transport. Only talks to localhost.
import { API, buildPayload, saveNote, flushQueue } from './lib.mjs';

const io = {
  post: async (note) => {
    const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(note) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
  },
  store: chrome.storage.local,
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'coco-save', title: 'Save to Coco Notes', contexts: ['page', 'link', 'selection', 'image'] });
  chrome.alarms.create('coco-flush', { periodInMinutes: 5 });
});

chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'coco-flush') flushQueue(io).catch(() => {}); });

chrome.contextMenus.onClicked.addListener((info, tab) => { saveNote(buildPayload(info, tab), io); });

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg && msg.type === 'coco-save') { saveNote(msg.note, io).then((ok) => respond({ ok })); return true; }
});
