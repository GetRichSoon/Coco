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
  // 'update' never expires. Every other command is a thing a founder asked for a moment ago, and
  // running it late is worse than dropping it. An update is the opposite: a device that was off for
  // two days must still take it the moment it comes back, or the cloud loses the only instruction
  // that matters. The cloud re-offers it anyway, so expiry would only add a window where it is lost.
  const ageLimitMs = (action) => (action === 'update' ? Infinity : LATE_OK.has(action) ? 120 * MIN : VOICE.has(action) ? 2 * MIN : 10 * MIN);
  // ---------- Delivery while devices rest (YES-3 follow-up): a command never vanishes because its device is quiet ----------
  // A device says in its heartbeat (devices.info.presence) whether it is on screen ('active') or resting ('quiet') and by when it
  // will check in next. A resting device reads at least once per shared 30-minute slot and within about a minute of a command
  // being sent to it (Nova's wake board, GET /api/awake?d=<device>). So "not seen for 3 minutes" no longer means "gone".
  const SLOT_MS = 30 * MIN, ACTIVE_GRACE_MS = 150000, QUIET_GRACE_MS = 5 * MIN, OFFLINE_EXPIRE_MS = 30 * MIN;
  const nextCheckBy = (mode, now) => (mode === 'quiet' ? (Math.floor(now / SLOT_MS) + 1) * SLOT_MS + QUIET_GRACE_MS : now + ACTIVE_GRACE_MS);
  const presenceInfo = (mode, now) => ({ mode: mode === 'quiet' ? 'quiet' : 'active', next_by: new Date(nextCheckBy(mode, now)).toISOString() });
  // online | resting | offline. A device row without presence (an older app) is judged the old way: a heartbeat in the last 150 s.
  // A string is read as last_seen, so older callers keep working.
  function presence(dev, now) {
    if (typeof dev === 'string') dev = { last_seen: dev };
    const seen = dev && dev.last_seen ? Date.parse(dev.last_seen) : NaN;
    const p = dev && dev.info && dev.info.presence;
    let by = p && p.next_by ? Date.parse(p.next_by) : NaN;
    if (!isFinite(by) && isFinite(seen)) by = seen + ACTIVE_GRACE_MS;
    if (!isFinite(by)) return { state: 'offline', since: null, next_by: null };
    if (now <= by) return { state: p && p.mode === 'quiet' ? 'resting' : 'online', since: null, next_by: by };
    return { state: 'offline', since: by, next_by: null };
  }
  // What the sender sees: queued -> waiting (device resting or briefly away) -> acked (the device claimed it) -> done | failed | expired | cancelled.
  // The claim (queued -> running, conditional) IS the acknowledgement: it is atomic, so a command runs at most once.
  function commandState(row, target, now) {
    const r = String(row.result || '');
    if (row.status === 'done') return { state: 'done', label: 'Done' };
    if (row.status === 'failed') {
      if (/^(expired|stale|too old)/i.test(r)) return { state: 'expired', label: 'Expired', why: r };
      if (/^cancelled/i.test(r)) return { state: 'cancelled', label: 'Cancelled', why: r };
      return { state: 'failed', label: 'Failed', why: r };
    }
    if (row.status === 'running') return { state: 'acked', label: 'Received', why: 'the device took it and is running it' };
    const p = presence(target, now);
    if (p.state === 'online') return { state: 'queued', label: 'Sending', why: 'the device checks every few seconds' };
    if (p.state === 'resting') return { state: 'waiting', label: 'Waiting', why: 'the device is resting; it picks this up within a minute', by: p.next_by };
    return { state: 'waiting', label: 'Waiting', why: 'the device is offline; this waits for it, and is reported as expired if it stays away 30 min', since: p.since };
  }
  // The runner's age check. A command that waited only because THIS device was resting (it was running the whole time:
  // aliveSince <= created_at) is still valid and runs, except a spoken wish, which is never run late (Boss, 2026-10-26) and says so.
  // A command sent while this device was off or asleep keeps the old safety limits. Either way the reason is written back.
  function runVerdict(row, now, aliveSince) {
    const created = new Date(row.created_at).getTime(), age = now - created, limit = ageLimitMs(row.action);
    if (!(age > limit)) return { run: true };
    const restedOnly = isFinite(aliveSince) && created >= aliveSince, mins = Math.round(age / MIN);
    if (restedOnly && !VOICE.has(row.action)) return { run: true, late: true };
    return { run: false, result: restedOnly ? `expired: arrived ${mins} min after it was sent; spoken requests are never run late` : `expired: this device was off or asleep when it was sent (${mins} min ago); commands older than ${limit / MIN} min are not run late, for safety` };
  }

  // What the sweep does with a row so the queue never clogs (null = leave it). 'now' in ms. `target` is the target's device row
  // (or, from older callers, its last_seen text). A queued command is closed only once its device has been OFFLINE (not resting)
  // for 30 minutes, with that reason; a resting device's commands wait for it.
  function sweepVerdict(row, now, target) {
    const age = now - new Date(row.created_at).getTime(), args = row.args || {};
    if (row.status === 'failed' && !/^(stale|expired|cancelled)/i.test(row.result || '') && age > 24 * 60 * MIN) return { status: 'failed', result: 'stale: ' + (row.result || 'no reason recorded') };
    if (row.status === 'queued' && age > OFFLINE_EXPIRE_MS) {
      const p = presence(target, now), seen = typeof target === 'string' ? target : target && target.last_seen;
      if (p.state === 'offline' && (p.since === null || now - p.since > OFFLINE_EXPIRE_MS)) return { status: 'failed', result: 'stale: target device offline (' + (seen ? 'last seen ' + new Date(seen).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'never seen') + '), not run' };
      return null;
    }
    // Claimed by this app but never finished (restart, crash, hang): run once more if that is safe and still fresh.
    if (row.status === 'running' && age > 3 * MIN) {
      if (RETRY_SAFE.has(row.action) && !args._retried && age < ageLimitMs(row.action)) return { status: 'queued', args: { ...args, _retried: 1 } };
      return { status: 'failed', result: 'interrupted: the app stopped before this finished, not run again' };
    }
    return null;
  }
  // A new command gets its id on the sender (the idempotency key): a retried insert with the same id is refused as a duplicate
  // by the database, so a flaky network can never create the same command twice.
  const newCommandId = () => (globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
  const isDuplicate = (err) => !!err && (String(err.code) === '23505' || /duplicate key|already exists/i.test(String(err.message || '')));
  const api = { VOICE, RETRY_SAFE, LATE_OK, SLOT_MS, OFFLINE_EXPIRE_MS, classify, prep, canRetry, ageLimitMs, sweepVerdict, nextCheckBy, presenceInfo, presence, commandState, runVerdict, newCommandId, isDuplicate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CocoHeal = api;
})(typeof window !== 'undefined' ? window : globalThis);
