#!/usr/bin/env python3
"""Web Push for the Morning Brief (RFC 8291 payload encryption + RFC 8292 VAPID).

The cloud writer can't reach Apple's push servers, so this script only *prepares*
each notification: it encrypts the text for each subscribed phone and signs the
VAPID token. The rows go into the "outbox" tab of the Morning Brief Sync sheet,
and the sheet's Apps Script delivers them.

  MB_VAPID=<private key> python3 tools/push.py build SUBS.json "Title" "Body" [url]
      SUBS.json = rows from the sheet's "push" tab: [[endpoint, p256dh, auth], ...]
      prints outbox rows: [[date, endpoint, body_b64, authorization, ""], ...]
  python3 tools/push.py pubkey      print the public key that goes in config.js
"""
import base64, datetime, hashlib, hmac, json, os, struct, sys, time
from urllib.parse import urlparse
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

CONTACT = 'mailto:deniselyuki@gmail.com'


def b64u(b): return base64.urlsafe_b64encode(b).rstrip(b'=').decode()
def ub64u(s): return base64.urlsafe_b64decode(s + '=' * (-len(s) % 4))
def hmac256(k, m): return hmac.new(k, m, hashlib.sha256).digest()
def raw_pub(pub): return pub.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)


def vapid_key():
    d = os.environ.get('MB_VAPID')
    if not d:
        sys.exit('MB_VAPID is not set')
    return ec.derive_private_key(int.from_bytes(ub64u(d), 'big'), ec.SECP256R1())


def encrypt(p256dh, auth, data, salt=None, as_key=None):
    """aes128gcm Web Push payload for one subscription."""
    ua_pub = ub64u(p256dh); auth_secret = ub64u(auth)
    as_key = as_key or ec.generate_private_key(ec.SECP256R1())
    as_pub = raw_pub(as_key.public_key())
    ecdh = as_key.exchange(ec.ECDH(), ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), ua_pub))
    prk_key = hmac256(auth_secret, ecdh)
    ikm = hmac256(prk_key, b'WebPush: info\x00' + ua_pub + as_pub + b'\x01')
    salt = salt or os.urandom(16)
    prk = hmac256(salt, ikm)
    cek = hmac256(prk, b'Content-Encoding: aes128gcm\x00\x01')[:16]
    nonce = hmac256(prk, b'Content-Encoding: nonce\x00\x01')[:12]
    ct = AESGCM(cek).encrypt(nonce, data + b'\x02', None)
    return salt + struct.pack('>I', 4096) + bytes([len(as_pub)]) + as_pub + ct


def vapid_header(endpoint, key):
    u = urlparse(endpoint)
    claims = {'aud': f'{u.scheme}://{u.netloc}', 'exp': int(time.time()) + 12 * 3600, 'sub': CONTACT}
    head = b64u(json.dumps({'typ': 'JWT', 'alg': 'ES256'}, separators=(',', ':')).encode())
    body = b64u(json.dumps(claims, separators=(',', ':')).encode())
    r, s = decode_dss_signature(key.sign(f'{head}.{body}'.encode(), ec.ECDSA(hashes.SHA256())))
    jwt = f'{head}.{body}.{b64u(r.to_bytes(32, "big") + s.to_bytes(32, "big"))}'
    return f'vapid t={jwt}, k={b64u(raw_pub(key.public_key()))}'


def build(subs_path, title, body, url='./'):
    key = vapid_key()
    subs = json.load(open(subs_path))
    payload = json.dumps({'title': title, 'body': body, 'url': url}, ensure_ascii=False).encode()
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-7))).strftime('%Y-%m-%d')
    rows, seen = [], set()
    for row in subs:
        if len(row) < 3 or not row[0] or row[0] in seen:
            continue
        seen.add(row[0])
        rows.append([today, row[0], base64.b64encode(encrypt(row[1], row[2], payload)).decode(), vapid_header(row[0], key), ''])
    print(json.dumps(rows))


if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == 'pubkey':
        print(b64u(raw_pub(vapid_key().public_key())))
    elif len(a) >= 4 and a[0] == 'build':
        build(a[1], a[2], a[3], a[4] if len(a) > 4 else './')
    else:
        sys.exit(__doc__)
