// Coco auto-heal rules for remote commands (Nono, 2026-10-26). Pure functions, shared by the Lounge page and the tests.
// Error classes come from the real failed rows of Coco Cloud (84 failed of 420): see COMPLETION CHECKLIST 2026-10-26.
(function (root) {
  // Safe to run a second time (no side effect that doubles): one automatic retry is allowed only for these.
  const RETRY_SAFE = new Set(['status', 'notify', 'open_app', 'open_url', 'screenshot', 'find_file', 'fun']);
  // Harmless even when late: a status or a notice that waited for a sleeping PC is still worth running (up to 2 h).
  const LATE_OK = new Set(['status', 'notify', 'screenshot']);
  // Voice intents go stale fast: a spoken wish (say, a song, media keys, volume, keys) is never run late and never run twice (Boss, 2026-10-26).
  const VOICE = new Set(['say', 'play_youtube', 'media', 'volume', 'key', 'type_text', 'speak', 'close_player']);
  const MIN = 60000;

  // Which class is this result? ok | not_understood | no_browser | app_missing | timeout | transient | failed_other
  function classify(result) {
    const r = String(result == null ? '' : result);
    if (/^not understood/i.test(r)) return 'not_understood';
    if (/no browser window is open/i.test(r)) return 'no_browser';
    if (/^no app called|^app not found|^do not know which program/i.test(r)) return 'app_missing';
    if (/^failed: took longer than/i.test(r)) return 'timeout';
    if (/^failed: .*(fetch|ETIMEDOUT|ECONN|ENOTFOUND|EAI_AGAIN|network|timed out)/i.test(r)) return 'transient';
    if (/^failed|not allowed/i.test(r) || r === '') return 'failed_other';
    return 'ok';
  }
  // Steps to run before the single retry, once the class is known (corrected context). Empty = just run it again.
  function prep(cls) {
    if (cls === 'no_browser') return [{ action: 'open_app', args: { app: 'brave' } }, { action: 'wait', args: { ms: 2500 } }];
    return [];
  }
  // Is one automatic retry right for this failure? Never twice (args._retried), never for actions that could double.
  function canRetry(action, args, cls) {
    if ((args || {})._retried) return false;
    if (cls === 'no_browser') return action === 'key';
    return (cls === 'timeout' || cls === 'transient') && RETRY_SAFE.has(action);
  }
  // How long a queued command may wait for its PC: 10 min; voice intents 2 min; harmless ones 2 h.
  const ageLimitMs = (action) => (LATE_OK.has(action) ? 120 * MIN : VOICE.has(action) ? 2 * MIN : 10 * MIN);
  // What the sweep does with a row so the queue never clogs (null = leave it). 'now' in ms.
  function sweepVerdict(row, now, deviceLastSeen) {
    const age = now - new Date(row.created_at).getTime(), args = row.args || {};
    if (row.status === 'failed' && !/^stale/i.test(row.result || '') && age > 24 * 60 * MIN) return { status: 'failed', result: 'stale: ' + (row.result || 'no reason recorded') };
    if (row.status === 'queued' && age > 30 * MIN) return { status: 'failed', result: 'stale: target device offline (' + (deviceLastSeen ? 'last seen ' + new Date(deviceLastSeen).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'never seen') + '), not run' };
    // Claimed by this app but never finished (restart, crash, hang): run once more if that is safe and still fresh.
    if (row.status === 'running' && age > 3 * MIN) {
      if (RETRY_SAFE.has(row.action) && !args._retried && age < ageLimitMs(row.action)) return { status: 'queued', args: { ...args, _retried: 1 } };
      return { status: 'failed', result: 'interrupted: the app stopped before this finished, not run again' };
    }
    return null;
  }
  const api = { VOICE, RETRY_SAFE, LATE_OK, classify, prep, canRetry, ageLimitMs, sweepVerdict };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CocoHeal = api;
})(typeof window !== 'undefined' ? window : globalThis);
