// node "Extensions/Coco Idea Saver/test.mjs" — asserts for the pure logic (no chrome needed).
import assert from 'node:assert/strict';
import { buildPayload, saveNote, flushQueue, QUEUE_CAP } from './lib.mjs';

const tab = { url: 'https://example.com/post', title: 'A Post' };

// selection beats everything
let p = buildPayload({ selectionText: 'great hook idea', linkUrl: 'https://x.com/a' }, tab);
assert.deepEqual(p, { kind: 'idea', source_url: 'https://example.com/post', title: 'A Post', text: 'great hook idea' });
// image: srcUrl wins, page url+title in text
p = buildPayload({ srcUrl: 'https://i.pinimg.com/pin.jpg' }, tab);
assert.equal(p.kind, 'link');
assert.equal(p.source_url, 'https://i.pinimg.com/pin.jpg');
assert.ok(p.text.includes('https://example.com/post') && p.text.includes('A Post'));
// link
p = buildPayload({ linkUrl: 'https://youtu.be/abc' }, tab);
assert.equal(p.source_url, 'https://youtu.be/abc');
// plain page
p = buildPayload({}, tab);
assert.deepEqual(p, { kind: 'link', source_url: 'https://example.com/post', title: 'A Post', text: 'A Post' });

// fake chrome.storage.local
const mem = {};
const store = { get: async (k) => (k in mem ? { [k]: mem[k] } : {}), set: async (o) => Object.assign(mem, o) };

// success path posts once and returns true
let posts = [];
assert.equal(await saveNote({ text: 'a' }, { post: async (n) => posts.push(n), store }), true);
assert.equal(posts.length, 1);

// failure path: retries once (2 posts), then queues
posts = [];
const failing = { post: async (n) => { posts.push(n); throw new Error('down'); }, store };
assert.equal(await saveNote({ text: 'b' }, failing), false);
assert.equal(posts.length, 2);
assert.equal(mem.queue.length, 1);

// queue is capped
mem.queue = Array.from({ length: QUEUE_CAP }, (_, i) => ({ text: String(i) }));
await saveNote({ text: 'newest' }, failing);
assert.equal(mem.queue.length, QUEUE_CAP);
assert.equal(mem.queue.at(-1).text, 'newest');

// flush empties the queue in order, and a successful save flushes old queued notes too
mem.queue = [{ text: 'q1' }, { text: 'q2' }];
posts = [];
await flushQueue({ post: async (n) => posts.push(n), store });
assert.deepEqual(posts.map((n) => n.text), ['q1', 'q2']);
assert.equal(mem.queue.length, 0);

console.log('coco idea saver: all asserts passed');
