import json, os, gzip, hashlib, subprocess, sys, tempfile

TOKEN = open('/tmp/access_token.txt').read().strip()
SITE = "dealecho-io-sales-intel-hub"
CHANNEL = "briefing-preview"
BASE = "https://firebasehosting.googleapis.com/v1beta1"
DIST = "dist"
GZDIR = tempfile.mkdtemp(prefix="gz_")

def curl(method, url, json_body=None, binary_file=None, ctype=None):
    cmd = ["curl", "-s", "-X", method, url,
           "-H", f"Authorization: Bearer {TOKEN}", "--max-time", "120"]
    if json_body is not None:
        bf = tempfile.NamedTemporaryFile("w", delete=False, suffix=".json")
        bf.write(json.dumps(json_body)); bf.close()
        cmd += ["-H", "Content-Type: application/json", "--data-binary", "@" + bf.name]
    if binary_file is not None:
        cmd += ["-H", f"Content-Type: {ctype or 'application/octet-stream'}",
                "--data-binary", "@" + binary_file]
    out = subprocess.run(cmd, capture_output=True)
    txt = out.stdout.decode()
    try:
        return json.loads(txt)
    except Exception:
        return {"_raw": txt}

# 1. Hash + gzip every file in dist
files = {}            # "/path" -> hash
hash_to_gz = {}       # hash -> gzipped file path
for root, _, names in os.walk(DIST):
    for n in names:
        full = os.path.join(root, n)
        rel = "/" + os.path.relpath(full, DIST).replace(os.sep, "/")
        raw = open(full, "rb").read()
        gz = gzip.compress(raw, 9)
        h = hashlib.sha256(gz).hexdigest()
        gzp = os.path.join(GZDIR, h)
        open(gzp, "wb").write(gz)
        files[rel] = h
        hash_to_gz[h] = gzp
print(f"prepared {len(files)} files")

# 2. Create a version
ver = curl("POST", f"{BASE}/sites/{SITE}/versions", json_body={})
vname = ver.get("name")
if not vname:
    print("ERROR creating version:", ver); sys.exit(1)
print("version:", vname)

# 3. populateFiles
pop = curl("POST", f"{BASE}/{vname}:populateFiles", json_body={"files": files})
required = pop.get("uploadRequiredHashes", []) or []
upload_url = pop.get("uploadUrl")
if upload_url is None:
    print("ERROR populateFiles:", pop); sys.exit(1)
print(f"need to upload {len(required)} files")

# 4. Upload required files
for i, h in enumerate(required):
    res = curl("POST", f"{upload_url}/{h}", binary_file=hash_to_gz[h])
    if res.get("_raw", "") != "" and res.get("_raw") is not None and res != {"_raw": ""}:
        if res.get("_raw"):
            print(f"  upload {h[:12]} resp:", res["_raw"][:120])
print("uploads done")

# 5. Finalize version
fin = curl("PATCH", f"{BASE}/{vname}?update_mask=status", json_body={"status": "FINALIZED"})
if fin.get("status") != "FINALIZED":
    print("ERROR finalize:", fin); sys.exit(1)
print("finalized")

# 6. Ensure channel exists (ignore if already there)
ch = curl("POST", f"{BASE}/sites/{SITE}/channels?channelId={CHANNEL}", json_body={})
# 7. Release the version to the channel
rel = curl("POST", f"{BASE}/sites/{SITE}/channels/{CHANNEL}/releases?versionName={vname}", json_body={})
# 8. Fetch channel for its URL
chan = curl("GET", f"{BASE}/sites/{SITE}/channels/{CHANNEL}")
url = chan.get("url") or ch.get("url")
print("RELEASE:", "ok" if rel.get("name") else rel)
print("CHANNEL_URL:", url)
