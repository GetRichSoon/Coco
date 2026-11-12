// PickTheory connector. PickTheory is NOT a service with an API key. In the company's own data it is a YouTube channel:
//   integration_accounts  yt-app-web     provider youtube, external_name "PickTheory", not connected (its authorization is a file on a PC)
//   offerings             "PickTheory"   House Gigi, kind channel, platform youtube, "not in final list (founder to decide)"
//   company/youtube/categories/app-web   the App / Web / Product category: name ideas PickTheory, ClickTheory, DigitalScout; channel not created yet
// picktheory.com is an unrelated third-party review site (no login, no API), so there is nothing to paste a key into and nothing to sync
// automatically. The working connection is Google sign-in for the connection yt-app-web, which api/_oauth.js already does for every channel:
//   POST /api/oauth/begin { provider: 'youtube', connection_id: 'yt-app-web' }  ->  authorize_url  ->  POST /api/oauth/verify { connection_id: 'yt-app-web' }
// This file holds what is specific to the slot: its facts, the exact steps the founder must do, and a check that a Google access token
// (minted from the stored refresh token, as _oauth.js does) reaches a real channel.
//
// Revenue: YouTube pays through AdSense and the channel is not monetised, so there is no feed. The documented API (YouTube Analytics
// reports.query, metric estimatedRevenue) needs the yt-analytics-monetary.readonly permission, which Coco does not ask for, and answers
// 403 for a channel outside the YouTube Partner Program. fetchPickTheoryRevenue is therefore deliberately not exported: api/_connect.js
// reads its absence as "no revenue feed" instead of a made-up zero.
import { redact } from './_publish.js';

export const YT_API = 'https://www.googleapis.com/youtube/v3';

export const PICKTHEORY = Object.freeze({
  id: 'picktheory', label: 'PickTheory', kind: 'YouTube channel (App / Web / Product)', provider: 'youtube', connection_id: 'yt-app-web', house_id: 'gigi',
  google_account: 'your YouTube Google account', name_ideas: Object.freeze(['PickTheory', 'ClickTheory', 'DigitalScout']),
  connect: Object.freeze({ route: '/api/oauth/begin', body: Object.freeze({ provider: 'youtube', connection_id: 'yt-app-web' }) }),
  verify: Object.freeze({ route: '/api/oauth/verify', body: Object.freeze({ connection_id: 'yt-app-web' }) }),
});

// What the founder must do, in order, for the screen to show next to Connect.
export const PICKTHEORY_STEPS = Object.freeze([
  'Create the channel on YouTube while signed in as your YouTube Google account (youtube.com/channel_switcher): a new brand channel for App / Web / Product. The name is your choice (ideas: PickTheory, ClickTheory, DigitalScout).',
  'In Coco open Connections, PickTheory, and press Connect. Google opens: choose the new brand channel on the chooser (not the account itself) and approve everything it asks.',
  'Press Check now: Coco confirms the channel from the cloud. Then assign it to a team in Coco; nothing publishes with it before that.',
]);

const NOT_A_KEY = 'PickTheory is a YouTube channel, not a service with an API key, so there is no key to paste. Connect it with Google sign-in: Connections, PickTheory, Connect.';
const slotName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Does this Google access token reach a real YouTube channel, and which? (the cloud side of "Check now" for yt-app-web)
 * -> { ok:true, denied:false, account:{id,name}, external_id, external_name, external_handle, name_matches, detail, error:null }
 *  | { ok:false, denied, status, error, detail }   denied:true = Google no longer accepts the token (401, or 403 other than quota)
 * status: USE_GOOGLE_SIGN_IN | EXPIRED | QUOTA | NO_CHANNEL | BAD_RESPONSE | UNREACHABLE | ERROR
 * name_matches is information only: the slot's final name is the founder's choice, so a different title is not a failure.
 */
export async function verifyPickTheory(secret, fetchImpl = globalThis.fetch, { api = YT_API } = {}) {
  if (typeof secret !== 'string' || !/^ya29\.[\w.-]{20,}$/.test(secret)) return { ok: false, denied: false, status: 'USE_GOOGLE_SIGN_IN', error: NOT_A_KEY, detail: NOT_A_KEY };
  const no = (denied, status, error) => ({ ok: false, denied, status, error, detail: error });
  let res, text;
  try {
    res = await fetchImpl(`${api}/channels?part=snippet&mine=true`, { method: 'GET', headers: { authorization: `Bearer ${secret}`, accept: 'application/json' } });
    text = await res.text();
  } catch (e) { return no(false, 'UNREACHABLE', `YouTube could not be reached (${redact(e instanceof Error ? e.message : e, secret).slice(0, 200)}).`); }
  let json = null; try { json = JSON.parse(text); } catch { /* handled below */ }
  if (res.status === 401) return no(true, 'EXPIRED', 'YouTube refused the token (401): it expired or was revoked. Connect PickTheory again.');
  if (res.status === 403) {
    const reason = String(json?.error?.errors?.[0]?.reason || json?.error?.status || '');
    return /quota|ratelimit|dailylimit/i.test(reason) ? no(false, 'QUOTA', 'YouTube is over its daily quota for Coco; check again tomorrow.') : no(true, 'EXPIRED', 'YouTube refused the token (403): the permission was withdrawn. Connect PickTheory again.');
  }
  if (!res.ok) return no(false, 'ERROR', `YouTube answered ${res.status}: ${redact(json?.error?.message || text, secret).slice(0, 200)}`);
  if (!json || typeof json !== 'object') return no(false, 'BAD_RESPONSE', 'YouTube returned something that is not JSON.');
  const item = Array.isArray(json.items) ? json.items[0] : null;
  if (!item) return no(false, 'NO_CHANNEL', 'That Google account has no YouTube channel to connect. Create the channel first (sign in as your YouTube Google account), then connect again and choose it on Google\'s chooser.');
  const name = String(item.snippet?.title ?? ''), handle = String(item.snippet?.customUrl ?? '') || null;
  const name_matches = slotName(name).includes('picktheory');
  const detail = `${name || 'the channel'}${handle ? ` (${handle})` : ''} answered from YouTube${name_matches ? '' : `; its name is not PickTheory, which is fine if you chose another name for this slot (${PICKTHEORY.name_ideas.join(', ')}). Check that Google's chooser showed the right channel`}.`;
  return { ok: true, denied: false, account: { id: String(item.id), name }, external_id: String(item.id), external_name: name, external_handle: handle, name_matches, detail, error: null };
}
