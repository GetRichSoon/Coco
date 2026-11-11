# Read-only audit of every YouTube channel reachable through the saved logins in ~/.nova-secrets (youtube*.env).
# Writes channels.json + recent_videos.json here. Never prints or stores a token. Shorts are classed by length
# (<= 60 s) because the Data API does not expose the Shorts flag; that is an approximation and is labelled so.
#   python audit.py
import os, sys, json, glob, re, urllib.error, datetime
sys.path.insert(0, r'C:\Users\Lenovo\nova-hq\scripts'); import yt_upload as y
SEC = os.path.expanduser('~/.nova-secrets'); HERE = os.path.dirname(os.path.abspath(__file__))
def read_env(p):
    d = {}
    for l in open(p, encoding='utf-8'):
        if '=' in l and not l.startswith('#'): k, v = l.strip().split('=', 1); d[k] = v
    return d
app = read_env(os.path.join(SEC, 'youtube.env'))
os.environ['YT_CLIENT_ID'] = app.get('CLIENT_ID') or os.environ.get('YT_CLIENT_ID', '')
os.environ['YT_CLIENT_SECRET'] = app.get('CLIENT_SECRET') or os.environ.get('YT_CLIENT_SECRET', '')
def iso_s(d):
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', d or ''); h, mi, s = (int(x or 0) for x in m.groups()) if m else (0, 0, 0)
    return h * 3600 + mi * 60 + s
chans, vids, dead = [], [], []
files = sorted(f for f in glob.glob(os.path.join(SEC, 'youtube*.env')) if f.endswith('.env'))
seen = set()
for f in files:
    tok = read_env(f).get('YT_REFRESH_TOKEN')
    if not tok: continue
    os.environ['YT_REFRESH_TOKEN'] = tok
    try:
        t = y.token()
        _, o = y.call('GET', 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails,status,brandingSettings&mine=true', t)
        items = json.loads(o).get('items', [])
    except Exception as e:
        dead.append({'file': os.path.basename(f), 'error': str(e)[:80]}); continue
    for c in items:
        if c['id'] in seen: continue
        seen.add(c['id']); sn, st, br = c['snippet'], c['statistics'], c.get('brandingSettings', {}).get('channel', {})
        row = {'file': os.path.basename(f), 'id': c['id'], 'title': sn['title'], 'handle': sn.get('customUrl', ''), 'url': f"https://www.youtube.com/channel/{c['id']}",
               'created': sn['publishedAt'][:10], 'country': sn.get('country', ''), 'subscribers': int(st.get('subscriberCount', 0)), 'views': int(st.get('viewCount', 0)),
               'videos': int(st.get('videoCount', 0)), 'description': (br.get('description') or sn.get('description', ''))[:300], 'keywords': br.get('keywords', '')[:200],
               'long_uploads': c.get('status', {}).get('longUploadsStatus'), 'has_banner': bool(c.get('brandingSettings', {}).get('image')), 'playlists': []}
        try:
            _, o = y.call('GET', f'https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId={c["id"]}&maxResults=50', t)
            row['playlists'] = [{'title': p['snippet']['title'], 'items': p['contentDetails']['itemCount']} for p in json.loads(o).get('items', [])]
        except Exception: pass
        up = c['contentDetails']['relatedPlaylists']['uploads']
        try:
            _, o = y.call('GET', f'https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId={up}', t)
            ids = [i['contentDetails']['videoId'] for i in json.loads(o).get('items', [])]
        except Exception: ids = []
        shorts = longs = 0
        for k in range(0, len(ids), 50):
            _, o = y.call('GET', f'https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics,status&id={",".join(ids[k:k+50])}', t)
            for v in json.loads(o).get('items', []):
                secs = iso_s(v['contentDetails']['duration']); kind = 'short(<=60s)' if secs <= 60 else 'long'
                shorts += kind != 'long'; longs += kind == 'long'
                vids.append({'channel': sn['title'], 'id': v['id'], 'url': f"https://youtu.be/{v['id']}", 'title': v['snippet']['title'], 'published': v['snippet']['publishedAt'],
                             'seconds': secs, 'kind': kind, 'privacy': v['status']['privacyStatus'], 'views': int(v['statistics'].get('viewCount', 0)),
                             'likes': int(v['statistics'].get('likeCount', 0)), 'comments': int(v['statistics'].get('commentCount', 0)),
                             'description': v['snippet']['description'][:200], 'thumb': v['snippet']['thumbnails'].get('high', {}).get('url', '')})
        row['recent_sampled'] = len(ids); row['recent_shorts'] = shorts; row['recent_long'] = longs
        chans.append(row); print('ok', sn['title'], '| subs', row['subscribers'], '| videos', row['videos'], flush=True)
json.dump({'checked_at': datetime.datetime.now().isoformat(), 'channels': chans, 'dead_logins': dead}, open(os.path.join(HERE, 'channels.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
json.dump(vids, open(os.path.join(HERE, 'recent_videos.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('channels', len(chans), '| videos sampled', len(vids), '| dead logins', len(dead))
