"""Security regression suite: runs a disposable demo-mode server and asserts the
behaviours fixed during the 2026-11 audit.

1.  Plan orders must not break email templating (mail.js esc() bug returned 500s
    / unhandled rejections while dropping every weekly-card confirmation).
2.  Hostile customer data renders escaped everywhere it appears.
3.  Admin delete confirms moved from inline onsubmit="confirm('…')" to a
    data-confirm attribute (inline JS-string form was injectable).
4.  Login attempts are capped even when X-Forwarded-For rotates per request.
5.  Baseline rate limits still exist (no XFF games).

Run:  python tests/security_regressions.py
Uses only stdlib on purpose.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("SEC_TEST_PORT", "3123"))
BASE = f"http://127.0.0.1:{PORT}"
USER = "owner"
PASS = "testpass"

failures = []


def check(label, cond, detail=""):
    print(("PASS  " if cond else "FAIL  ") + label + (f"  [{detail}]" if detail and not cond else ""))
    if not cond:
        failures.append(label)


def req(path, data=None, headers=None, form=False, auth=False):
    url = BASE + path
    body = None
    headers = dict(headers or {})
    if data is not None:
        if form:
            body = urllib.parse.urlencode(data).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            body = json.dumps(data).encode()
            headers["Content-Type"] = "application/json"
    if auth:
        import base64
        headers["Authorization"] = "Basic " + base64.b64encode(f"{USER}:{PASS}".encode()).decode()
    r = urllib.request.Request(url, data=body, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


import urllib.parse  # noqa: E402  (after req() definition to keep the header block readable)


HOSTILE = "Eve `x`'><script>alert(1)</script>Name"
PRODUCT_NAME = "Bo Peep');alert(1);//<script>alert(2)</script>"


def start_server(tmp):
    env = dict(os.environ)
    env.update({
        "PORT": str(PORT),
        "DEMO_MODE": "1",
        "ADMIN_USER": USER,
        "ADMIN_PASSWORD": PASS,
        "DATA_DIR": tmp,
        "CHECKOUT_RATE_MAX": "1000",  # the suite places orders; don't trip the public cap
    })
    so = open(os.path.join(tmp, "out.log"), "w", encoding="utf-8", errors="replace")
    se = open(os.path.join(tmp, "err.log"), "w", encoding="utf-8", errors="replace")
    proc = subprocess.Popen([sys.executable, "-c", "import subprocess,sys; sys.exit(subprocess.call(['node','server.js']))"],
                            cwd=ROOT, env=env, stdout=so, stderr=se)
    return proc, os.path.join(tmp, "err.log")


def wait_ready(timeout=20):
    for _ in range(timeout * 4):
        try:
            code, _body = req("/health")
            if code == 200:
                return True
        except Exception:
            pass
        time.sleep(0.25)
    return False


def main():
    tmp = tempfile.mkdtemp(prefix="rc-sec-")
    proc, errlog = start_server(tmp)
    try:
        check("server came up", wait_ready())

        # 1+2: a weekly-checkout plan with a hostile delivery name must return 200,
        # build its emails without ReferenceError, and render escaped.
        code, body = req("/api/checkout", data={
            "items": [{"id": "yogurt-6", "qty": 1, "planWeeks": 8, "tubsPerWeek": 1}],
            "name": HOSTILE, "email": "packer@example.com",
            "method": "pickup", "payment": "etransfer", "notes": "leave on step <b>bold</b>",
        })
        check("plan checkout with hostile name returns 200", code == 200, str(code))
        time.sleep(2.0)  # let the un-awaited mail builders crash if they would
        with open(errlog, encoding="utf-8", errors="replace") as fh:
            errs = fh.read()
        check("no ReferenceError from mail.js (esc bug absent)", "esc is not defined" not in errs, errs[-300:] if "esc is not defined" in errs else "")

        token = ""
        try:
            token = json.loads(body).get("url", "").split("/order/")[-1]
        except Exception:
            pass
        if token:
            code, page = req(f"/order/{token}")
            check("order page renders", code == 200)
            check("order page: no raw <script> injected", "<script>alert(1)" not in page)
            check("order page: no raw injected quote break", '"><script' not in page)
        else:
            check("plan checkout returned an order link", False)

        # 3: admin pages must not build confirm dialogs in inline JS strings.
        code, _ = req("/admin/products", data={
            "name": PRODUCT_NAME, "price": "7.50", "weight": "3%", "stock": "5",
            "active": "1", "sold_out": "", "art": "yogurt", "note": "x", "cost": "3.20",
            "tags": "", "ingredients": "milk", "allergens": "Milk", "shelf_life_days": "14",
            "max": "12", "sort": "5", "sku": "", "id": "", "image": "",
        }, form=True, auth=True)
        check("hostile product saved", code in (301, 302, 200), str(code))
        code, table = req("/admin/products", auth=True)
        check("admin product table renders", code == 200)
        check("no inline confirm() handlers left", "onsubmit=\"return confirm(" not in table)
        check("data-confirm in place", 'data-confirm="Delete' in table)
        check("admin table: product name entity-escaped", "&lt;script&gt;" in table and "<script>alert(1)</script>" not in table)
        code, home = req("/")
        check("home: no raw <script> injected from product name", "<script>alert(1)</script>" not in home)

        # 3b: the same for the product edit form (danger zone) — covered above via table;
        # the ids: product id derived from the hostile name gets sanitized by slugify.

        # 4: rotating X-Forwarded-For must not launder password guessing.
        blocked = None
        for i in range(1, 13):
            code, _ = req("/admin/login", data={"username": USER, "password": "nope", "next": "/admin"},
                          form=True, headers={"X-Forwarded-For": f"198.51.100.{i}"})
            if code == 429:
                blocked = i
                break
        check("login throttle caps attempts despite rotating XFF", blocked is not None and blocked <= 12, f"blocked at {blocked}")

        # 5: the no-XFF baseline still rate-limits (existing behaviour).
        blocked = None
        for i in range(1, 36):
            code, _ = req("/api/discount?code=nope&subtotal=0")
            if code == 429:
                blocked = i
                break
        check("discount endpoint rate limit intact", blocked is not None and blocked <= 35, f"blocked at {blocked}")

    finally:
        try:
            proc.terminate()
            proc.wait(timeout=10)
        except Exception:
            proc.kill()
        shutil.rmtree(tmp, ignore_errors=True)

    print()
    if failures:
        print(f"{len(failures)} failure(s):")
        for f in failures:
            print(" -", f)
        sys.exit(1)
    print("all security regressions passed")


if __name__ == "__main__":
    main()
