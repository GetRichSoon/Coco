import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveNote } from './notes_route.mjs';

test('notes route rejects an empty note before touching key or cloud', async () => {
  assert.deepEqual(await saveNote({}), { code: 400, ok: false, error: 'text or source_url needed' });
  assert.equal((await saveNote({ source_url: 'javascript:alert(1)' })).code, 400); // only http(s) counts
});
