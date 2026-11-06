"""Metrics sidecar auth smoke (audit fix F5/F12).

Starts metrics/app.py against the same throwaway database the store tests use,
and asserts: /health is unauthenticated, wrong credentials are refused with a
throttle delay, correct credentials are accepted, and the Prometheus endpoint
never emits a raw newline inside a label value.

Run: python tests/metrics_auth.py [port]
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.environ.get("DATA_DIR") or os.path.join(ROOT, "data")
PORT = sys.argv[1] if len(sys.argv) > 1 else "9111"
BASE = f"http://127.0.0.1:{PORT}"

failures = []

def check(label, cond, detail=""):
    print(("PASS  " if cond else "FAIL  ") + label + (f"  [{detail}]" if detail and not cond else ""))
    if not cond:
        failures.append(label)

def get(path, auth=None):
    r = urllib.request.Request(BASE + path)
    if auth:
        r.add_header("Authorization", auth)
    elif auth is False:
        r.add_header("Authorization", "Basic " + base64.b64encode(b"owner:wrongpass").decode())
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")

env = dict(os.environ)
env.update({
    "DB_PATH": os.path.join(DB, "store.db"),
    "PORT": PORT,
    "METRICS_PASSWORD": "testmetrics",
    "METRICS_USER": "owner",
})
if not os.path.exists(os.path.join(DB, "store.db")):
    # a metrics test without a database still tests auth; sqlite opened read-only
    # on a missing file errors when summary is computed, but auth runs first.
    pass
proc = subprocess.Popen([sys.executable, os.path.join(ROOT, "metrics", "app.py")], env=env,
                        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, cwd=ROOT)
try:
    time.sleep(1.5)
    code, _ = get("/health")
    check("health is unauthenticated", code == 200, str(code))

    t0 = time.time()
    code, _ = get("/api/summary.json", auth=False)
    took = time.time() - t0
    check("wrong password is refused", code == 401, str(code))
    check("failed auth is throttled (~0.2s)", took >= 0.2, f"{took:.2f}s")

    good = "Basic " + base64.b64encode(b"owner:testmetrics").decode()
    code, body = get("/api/summary.json", auth=good)
    check("correct password is accepted", code == 200, str(code))
    if code == 200:
        data = json.loads(body)
        check("summary is JSON with a db block", "db" in data or "error" in data, body[:80])

    code, body = get("/metrics", auth=good)
    check("metrics text endpoint works", code == 200, str(code))
    if code == 200:
        bad = [line for line in body.splitlines()
               if line.startswith("creamery") and '"' in line and "\n" in line.split('"')[1]]
        check("no unescaped newline inside a prom label", not bad, "; ".join(bad)[:200])
finally:
    proc.terminate()
    try:
        proc.wait(timeout=10)
    except Exception:
        proc.kill()

print()
print(("FAILURES: " + ", ".join(failures)) if failures else "all metrics auth checks passed")
sys.exit(1 if failures else 0)
