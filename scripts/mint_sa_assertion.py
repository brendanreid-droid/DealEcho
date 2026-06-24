import json, time, base64, subprocess, sys

sa = json.load(open('service-account.json'))

def b64(d):
    return base64.urlsafe_b64encode(d).rstrip(b'=')

header = b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
now = int(time.time())
claim = b64(json.dumps({
    "iss": sa['client_email'],
    "scope": "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase",
    "aud": "https://oauth2.googleapis.com/token",
    "iat": now,
    "exp": now + 3600,
}).encode())

signing_input = header + b'.' + claim
open('/tmp/sa_key.pem', 'w').write(sa['private_key'])
p = subprocess.run(['openssl', 'dgst', '-sha256', '-sign', '/tmp/sa_key.pem'],
                   input=signing_input, capture_output=True)
if p.returncode != 0:
    sys.stderr.write(p.stderr.decode())
    sys.exit(1)
sig = b64(p.stdout)
assertion = (signing_input + b'.' + sig).decode()
open('/tmp/assertion.txt', 'w').write(assertion)
print("assertion written, len", len(assertion))
print("client_email:", sa['client_email'])
print("project:", sa['project_id'])
