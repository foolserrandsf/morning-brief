#!/usr/bin/env python3
"""Morning Brief publisher.

Everything personal is encrypted before it lands in this public repo.
The passphrase comes from the MB_KEY environment variable and is never
written to disk.

Commands
  state                 print the decrypted learning state (what's been taught, counters)
  brief FILE.json       validate a day's brief, add its quiz items to the pool, encrypt + write
  recs FILE.json        publish a Tue/Sat bottle-recs card (shows in the app until replaced)
  check                 decrypt every file to prove the passphrase and files are good
  progress FILE         decrypt the synced quiz progress (the joined column A of the "sync" tab
                        in the "Morning Brief Sync" sheet, saved to FILE) and list what she
                        struggles with, so the brief can revisit it
"""
import base64, json, os, sys, hashlib, datetime, re
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
ITER = 1000000
TRACKS = {'kanji', 'bottle', 'wset', 'stocks', 'crypto', 'filipino'}

# Furigana markup: {漢字|かんじ} shows kana under the kanji; {漢字|-} keeps it bare on purpose
# (used when a quiz is testing that very reading). Kanji she has learned never need it.
NUMBERS = set('一二三四五六七八九十百千万')
RUBY = re.compile(r'\{([^{}|]+)\|([^{}]*)\}')
KANJI = re.compile(r'[\u4e00-\u9fff\u3005]')
KANA = re.compile(r'^[\u3040-\u30ff\u30fc・ー\s]+$')
SKIP_KEYS = {'url', 'photo', 'img', 'ref'}


def plain(t):
    return RUBY.sub(lambda m: m.group(1), t)


def learned_kanji(st, upto):
    have = set(NUMBERS)
    for x in st.get('taught', {}).get('kanji', []):
        if x['date'] <= upto:
            have.update(KANJI.findall(x.get('ref', '')))
    return have


def check_furigana(b, have, errs):
    def walk(o, path):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in SKIP_KEYS or path + '.' + k == '.kanji.kanji':
                    continue
                walk(v, path + '.' + k)
        elif isinstance(o, list):
            for i, v in enumerate(o):
                walk(v, f'{path}[{i}]')
        elif isinstance(o, str):
            for m in RUBY.finditer(o):
                if m.group(2) != '-' and not KANA.match(m.group(2)):
                    errs.append(f'{path}: reading for {m.group(1)} must be kana: {m.group(2)}')
            bare = [c for c in KANJI.findall(RUBY.sub('', o)) if c not in have]
            if bare:
                errs.append(f'{path}: add furigana for unlearned kanji {"".join(dict.fromkeys(bare))} in: {o[:60]}')
    walk(b, '')


def b64(b): return base64.b64encode(b).decode()


def salt():
    p = os.path.join(DATA, 'salt.json')
    if not os.path.exists(p):
        os.makedirs(DATA, exist_ok=True)
        json.dump({'salt': b64(os.urandom(16)), 'iter': ITER}, open(p, 'w'))
    j = json.load(open(p))
    return base64.b64decode(j['salt']), j['iter']


def key():
    pw = os.environ.get('MB_KEY')
    if not pw:
        sys.exit('MB_KEY is not set')
    s, it = salt()
    return PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=s, iterations=it).derive(pw.encode())


def enc(obj, path):
    n = os.urandom(12)
    c = AESGCM(key()).encrypt(n, json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode(), None)
    json.dump({'v': 1, 'n': b64(n), 'c': b64(c)}, open(path, 'w'))


def dec(path):
    j = json.load(open(path))
    return json.loads(AESGCM(key()).decrypt(base64.b64decode(j['n']), base64.b64decode(j['c']), None))


def load_state():
    p = os.path.join(DATA, 'state.enc')
    st = dec(p) if os.path.exists(p) else {}
    st.setdefault('pool', {})          # quiz items ever taught, by id
    st.setdefault('dates', [])         # published brief dates, newest last
    st.setdefault('taught', {})        # track -> list of {date, ref, title}
    st.setdefault('counters', {'kanji_next': 1, 'wset': 0, 'stocks': 0, 'crypto': 0, 'filipino': 0})
    st.setdefault('recs', None)
    return st


def save_state(st):
    enc(st, os.path.join(DATA, 'state.enc'))


def bump_version(date):
    json.dump({'date': date, 'v': datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None).strftime('%Y%m%d%H%M%S')},
              open(os.path.join(DATA, 'latest.json'), 'w'))


def check_quiz(items, where, errs):
    for i, q in enumerate(items or []):
        tag = f'{where}[{i}]'
        for k in ('q', 'o', 'a', 'w'):
            if k not in q:
                errs.append(f'{tag} missing "{k}"')
        if isinstance(q.get('o'), list):
            if not 2 <= len(q['o']) <= 5:
                errs.append(f'{tag} needs 2-5 options')
            if not isinstance(q.get('a'), int) or not 0 <= q['a'] < len(q['o']):
                errs.append(f'{tag} answer index out of range')


def validate(b):
    errs = []
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', b.get('date', '')):
        errs.append('date must be YYYY-MM-DD')
    for k in ('focus', 'calendar', 'inbox', 'news', 'kanji', 'bottle', 'wset', 'stocks', 'crypto', 'filipino'):
        if k not in b:
            errs.append(f'missing section "{k}"')
    for k in ('kanji', 'bottle', 'wset', 'stocks', 'crypto', 'filipino'):
        sec = b.get(k) or {}
        if not sec.get('quiz'):
            errs.append(f'{k}.quiz is empty (every lesson ends in a check)')
        check_quiz(sec.get('quiz'), k + '.quiz', errs)
    for i, n in enumerate(b.get('news') or []):
        if not n.get('url'):
            errs.append(f'news[{i}] has no url')
    bt = b.get('bottle') or {}
    if bt and not bt.get('photo'):
        errs.append('bottle.photo missing (label photo is required)')
    return errs


def cmd_brief(path):
    b = json.load(open(path))
    errs = validate(b)
    st = load_state()
    d = b['date']
    have = learned_kanji(st, d)
    have.update(KANJI.findall(b.get('kanji', {}).get('kanji', '')))
    check_furigana(b, have, errs)
    if errs:
        sys.exit('Brief not published:\n  ' + '\n  '.join(errs))
    added = 0
    for track in ('kanji', 'bottle', 'wset', 'stocks', 'crypto', 'filipino'):
        sec = b[track]
        ref = sec.get('ref') or sec.get('title') or track
        for i, q in enumerate(sec['quiz']):
            iid = hashlib.sha1(f'{track}|{ref}|{plain(q["q"])}'.encode()).hexdigest()[:12]
            item = dict(q, id=iid, track=track, date=d, ref=ref, title=sec.get('title', ''))
            if track == 'bottle' and sec.get('photo'):
                item.setdefault('img', sec['photo'])
            if iid not in st['pool']:
                added += 1
            st['pool'][iid] = item
        log = st['taught'].setdefault(track, [])
        if not any(x['date'] == d for x in log):
            log.append({'date': d, 'ref': ref, 'title': sec.get('title', '')})
    k = b['kanji']
    if isinstance(k.get('n'), int):
        st['counters']['kanji_next'] = max(st['counters'].get('kanji_next', 1), k['n'] + 1)
    for t in ('wset', 'stocks', 'crypto', 'filipino'):
        n = b[t].get('n')
        if isinstance(n, int):
            st['counters'][t] = max(st['counters'].get(t, 0), n)
    if d not in st['dates']:
        st['dates'].append(d)
        st['dates'].sort()
    b['published_at'] = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None).isoformat() + 'Z'
    os.makedirs(os.path.join(DATA, 'briefs'), exist_ok=True)
    enc(b, os.path.join(DATA, 'briefs', d + '.enc'))
    save_state(st)
    bump_version(d)
    print(f'Published {d}: {added} new quiz items, pool now {len(st["pool"])}')


def cmd_recs(path):
    r = json.load(open(path))
    for k in ('posted', 'title', 'try', 'push'):
        if k not in r:
            sys.exit(f'recs missing "{k}"')
    st = load_state()
    st['recs'] = r
    save_state(st)
    latest = json.load(open(os.path.join(DATA, 'latest.json')))
    bump_version(latest['date'])
    print('Recs published:', r['title'])


def cmd_state():
    st = load_state()
    out = {
        'counters': st['counters'],
        'dates': st['dates'][-10:],
        'pool_size': len(st['pool']),
        'taught': {t: [f"{x['date']} {x['ref']}" for x in v] for t, v in st['taught'].items()},
        'recs': (st['recs'] or {}).get('title'),
    }
    print(json.dumps(out, ensure_ascii=False, indent=1))


def cmd_progress(path):
    j = json.loads(open(path).read().strip())
    prog = json.loads(AESGCM(key()).decrypt(base64.b64decode(j['n']), base64.b64decode(j['c']), None))
    st = load_state()
    P = prog.get('P', {})
    rows = []
    for iid, p in P.items():
        it = st['pool'].get(iid)
        if it:
            rows.append((p.get('wrong', 0), p.get('box', 0), it['track'], it['ref'], it['q']))
    struggling = sorted([r for r in rows if r[0] > 0 and r[1] < 3], reverse=True)
    mastered = [r for r in rows if r[1] >= 3]
    print(json.dumps({
        'answered': len(rows), 'mastered': len(mastered),
        'struggling': [{'track': t, 'ref': ref, 'q': q, 'misses': w} for w, b, t, ref, q in struggling[:20]],
        'days_with_cards_done': sorted(prog.get('DONE', {}).keys())[-14:],
    }, ensure_ascii=False, indent=1))


def cmd_check():
    for f in ['state.enc'] + ['briefs/' + x for x in sorted(os.listdir(os.path.join(DATA, 'briefs')))]:
        dec(os.path.join(DATA, f))
    print('All files decrypt.')


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    {'state': lambda: cmd_state(), 'check': lambda: cmd_check(),
     'brief': lambda: cmd_brief(a[1]), 'recs': lambda: cmd_recs(a[1]),
     'progress': lambda: cmd_progress(a[1])}[a[0]]()
