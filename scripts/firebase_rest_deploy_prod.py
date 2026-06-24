import json, os, gzip, hashlib, subprocess, tempfile, sys

TOKEN = open('/tmp/access_token.txt').read().strip()
SITE = "dealecho-io-sales-intel-hub"
BASE = "https://firebasehosting.googleapis.com/v1beta1"
DIST = "dist"
GZDIR = tempfile.mkdtemp(prefix="gzp_")

def curl(method, url, json_body=None, binary_file=None):
    cmd = ["curl", "-s", "-X", method, url,
           "-H", f"Authorization: Bearer {TOKEN}", "--max-time", "120"]
    if json_body is not None:
        bf = tempfile.NamedTemporaryFile("w", delete=False, suffix=".json")
        bf.write(json.dumps(json_body)); bf.close()
        cmd += ["-H", "Content-Type: application/json", "--data-binary", "@" + bf.name]
    if binary_file is not None:
        cmd += ["-H", "Content-Type: application/octet-stream", "--data-binary", "@" + binary_file]
    out = subprocess.run(cmd, capture_output=True)
    try:
        return json.loads(out.stdout.decode())
    except Exception:
        return {"_raw": out.stdout.decode()}

files, hash_to_gz = {}, {}
for root, _, names in os.walk(DIST):
    for n in names:
        full = os.path.join(root, n)
        rel = "/" + os.path.relpath(full, DIST).replace(os.sep, "/")
        gz = gzip.compress(open(full, "rb").read(), 9)
        h = hashlib.sha256(gz).hexdigest()
        p = os.path.join(GZDIR, h); open(p, "wb").write(gz)
        files[rel] = h; hash_to_gz[h] = p
print(f"prepared {len(files)} files")

ver = curl("POST", f"{BASE}/sites/{SITE}/versions", json_body={})
vname = ver.get("name")
if not vname:
    print("ERROR version:", ver); sys.exit(1)
print("version:", vname)

pop = curl("POST", f"{BASE}/{vname}:populateFiles", json_body={"files": files})
required = pop.get("uploadRequiredHashes", []) or []
upload_url = pop.get("uploadUrl")
if upload_url is None:
    print("ERROR populateFiles:", pop); sys.exit(1)
print(f"uploading {len(required)} files")
for h in required:
    curl("POST", f"{upload_url}/{h}", binary_file=hash_to_gz[h])

fin = curl("PATCH", f"{BASE}/{vname}?update_mask=status", json_body={"status": "FINALIZED"})
if fin.get("status") != "FINALIZED":
    print("ERROR finalize:", fin); sys.exit(1)
print("finalized")

# Release to the LIVE site (default channel) — production
rel = curl("POST", f"{BASE}/sites/{SITE}/releases?versionName={vname}", json_body={})
print("RELEASE:", "ok" if rel.get("name") else rel)
print("LIVE URLS: https://dealecho-io-sales-intel-hub.web.app  and  https://www.dealecho.io")
