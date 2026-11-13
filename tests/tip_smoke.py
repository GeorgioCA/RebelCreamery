"""Delivery tips: presets, flat amounts, pickup exclusion and the cap.

Runs against a demo-mode server (DEMO_MODE=1) with DATA_DIR pointing at a
throwaway directory and CHECKOUT_RATE_MAX raised (this suite places more than
the public 12 checkouts a minute). Every expected amount is computed from the
price and settings actually in the database, never from the seed array, because
the operator edits both in the back office.
"""
import json
import math
import os
import sqlite3
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("BASE", "http://127.0.0.1:3188")
DATA_DIR = os.environ.get("DATA_DIR", "/tmp/rc-tip-test")
DB_PATH = os.path.join(DATA_DIR, "store.db")

failures = []


def check(label, cond, detail=""):
    print(("PASS  " if cond else "FAIL  ") + label + (f"  [{detail}]" if detail and not cond else ""))
    if not cond:
        failures.append(label)


def post(path, payload):
    req = urllib.request.Request(BASE + path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def get(path):
    with urllib.request.urlopen(BASE + path) as r:
        return r.status, r.read().decode()


def money_line(html, label):
    """Read the amount beside a summary label from the customer order page."""
    marker = f"{label}</span><span>"
    if marker not in html:
        return None
    return html.split(marker, 1)[1].split("<", 1)[0].strip()


def cents(text):
    return None if text is None else round(float(text.replace("$", "").replace(",", "")) * 100)


# --- what the live catalogue actually sells ----------------------------------
con = sqlite3.connect(DB_PATH)
con.row_factory = sqlite3.Row
product = con.execute(
    "SELECT id, name, price_cents, sale_cents, max_per_order FROM products "
    "WHERE active = 1 ORDER BY price_cents DESC, sort_order ASC LIMIT 1"
).fetchone()
price = product["sale_cents"] if product["sale_cents"] and product["sale_cents"] < product["price_cents"] else product["price_cents"]
product_id = product["id"]

settings = {r["key"]: r["value"] for r in con.execute("SELECT key, value FROM settings")}
fee = int(settings.get("delivery_fee_cents", 800))
free_over = int(settings.get("free_delivery_over_cents", 4000))
presets = [int(p) for p in (settings.get("delivery_tip_presets", "5,10,15").replace("%", "")).split(",")]
con.close()

base = {
    "name": "Tip Smoke", "email": "tip@example.com", "phone": "4035550100",
    "method": "delivery", "unit": "1", "street": "1008 9 St SW", "city": "Calgary",
    "province": "AB", "postal": "T2R 1B1", "payment": "etransfer",
}

# --- a percentage tip --------------------------------------------------------
pct = presets[1] if len(presets) > 1 else presets[0]
sub = price * 2
expected_tip = round(sub * pct / 100)
expected_fee = fee if sub < free_over else 0
s, r = post("/api/checkout", {**base, "items": [{"id": product_id, "qty": 2}], "tip": str(pct)})
check(f"{pct}% delivery order accepted", s == 200, f"{s} {r}")
if s == 200:
    _, html = get(r["url"])
    check("order page names the tip", "Tip for your driver" in html)
    check(f"tip is {expected_tip} cents", cents(money_line(html, "Tip for your driver")) == expected_tip,
          money_line(html, "Tip for your driver"))
    check(f"total is {sub - 0 + expected_fee + expected_tip} cents",
          cents(money_line(html, "Total")) == sub + expected_fee + expected_tip,
          money_line(html, "Total"))
    check("delivery line matches the fee", (cents(money_line(html, "Delivery")) == expected_fee) if expected_fee else True)

# --- a flat amount -----------------------------------------------------------
s, r = post("/api/checkout", {**base, "items": [{"id": product_id, "qty": 1}], "tip": "custom", "tipCents": 250})
check("custom tip accepted", s == 200, f"{s} {r}")
if s == 200:
    _, html = get(r["url"])
    check("custom tip renders $2.50", cents(money_line(html, "Tip for your driver")) == 250,
          money_line(html, "Tip for your driver"))

# --- explicitly no tip -------------------------------------------------------
s, r = post("/api/checkout", {**base, "items": [{"id": product_id, "qty": 1}], "tip": "0"})
check("no-tip order accepted", s == 200, f"{s} {r}")
if s == 200:
    _, html = get(r["url"])
    check("no tip line when none was given", "Tip for your driver" not in html)

# --- pickup ignores a tip ----------------------------------------------------
s, r = post("/api/checkout", {**{**base, "method": "pickup"}, "items": [{"id": product_id, "qty": 1}], "tip": str(pct)})
check("pickup order accepted", s == 200, f"{s} {r}")
if s == 200:
    _, html = get(r["url"])
    check("pickup carries no tip", "Tip for your driver" not in html)
    check("pickup total is subtotal only", cents(money_line(html, "Total")) == price, money_line(html, "Total"))

# --- rejected input ----------------------------------------------------------
not_a_preset = next((n for n in (1, 2, 3, 4, 6, 7, 99) if n not in presets), 7)
s, r = post("/api/checkout", {**base, "items": [{"id": product_id, "qty": 1}], "tip": str(not_a_preset)})
check(f"{not_a_preset}% (not a preset) rejected", s == 400, f"{s} {r}")
s, r = post("/api/checkout", {**base, "items": [{"id": product_id, "qty": 1}], "tipCents": 1000000})
check("tip above the cap rejected", s == 400, f"{s} {r}")
s, r = post("/api/checkout", {**base, "items": [{"id": product_id, "qty": 1}], "tipCents": 12.5})
check("fractional cents rejected", s == 400, f"{s} {r}")

# --- free delivery still carries a tip ---------------------------------------
qty = min(int(product["max_per_order"] or 12), max(1, math.ceil(free_over / price)))
sub = price * qty
s, r = post("/api/checkout", {**base, "items": [{"id": product_id, "qty": qty}], "tip": str(presets[-1])})
check("free-delivery order accepted", s == 200, f"{s} {r}")
if s == 200 and sub >= free_over:
    _, html = get(r["url"])
    check("free delivery has no Delivery line", ">Delivery</span>" not in html)
    tip_expected = round(sub * presets[-1] / 100)
    check("tip still applies above the free-delivery line",
          cents(money_line(html, "Tip for your driver")) == tip_expected,
          money_line(html, "Tip for your driver"))

print()
if failures:
    print(f"{len(failures)} failed: {', '.join(failures)}")
    sys.exit(1)
print("all tip checks passed")
