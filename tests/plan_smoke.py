"""Weekly cards as cart lines: mixed baskets, delivery, activation, collect.

Runs against a demo-mode server (DEMO_MODE=1) on PORT, with DATA_DIR pointing at
a throwaway directory. Exits non-zero on the first failed assertion.
"""
import base64
import json
import os
import sqlite3
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("BASE", "http://127.0.0.1:3111")
DATA_DIR = os.environ.get("DATA_DIR", "/tmp/rc-plan-test")
USER = os.environ.get("ADMIN_USER", "owner")
PASS = os.environ.get("ADMIN_PASSWORD", "testpass")
DB_PATH = os.path.join(DATA_DIR, "store.db")
FREE_OVER = 4000  # catalog default; asserted against the order, not assumed

failures = []


def check(label, cond, detail=""):
    print(("PASS  " if cond else "FAIL  ") + label + (f"  [{detail}]" if detail and not cond else ""))
    if not cond:
        failures.append(label)


def get(path, auth=False):
    req = urllib.request.Request(BASE + path)
    if auth:
        tok = base64.b64encode(f"{USER}:{PASS}".encode()).decode()
        req.add_header("Authorization", f"Basic {tok}")
    with urllib.request.urlopen(req) as r:
        return r.status, r.read().decode()


def post(path, payload, auth=False):
    req = urllib.request.Request(BASE + path, data=json.dumps(payload).encode(), method="POST")
    req.add_header("Content-Type", "application/json")
    if auth:
        tok = base64.b64encode(f"{USER}:{PASS}".encode()).decode()
        req.add_header("Authorization", f"Basic {tok}")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def post_form(path, fields, auth=False):
    body = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(BASE + path, data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    if auth:
        tok = base64.b64encode(f"{USER}:{PASS}".encode()).decode()
        req.add_header("Authorization", f"Basic {tok}")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def connect():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db


def unit_cents(product_id="yogurt-6"):
    row = connect().execute("SELECT price_cents, sale_cents FROM products WHERE id = ?", (product_id,)).fetchone()
    sale = row["sale_cents"] or 0
    return sale if 0 < sale < row["price_cents"] else row["price_cents"]


UNIT = unit_cents()
HALL = unit_cents("halloumi")

# --- storefront -----------------------------------------------------------
_, home = get("/")
check("home offers the weekly card", 'data-add-plan="yogurt-6"' in home, home[:200])
check("home explains the card length options", "12 weeks + 1 free" in home)

_, seeded = get("/checkout?plan=yogurt-6&weeks=12")
check("old subscribe link seeds the cart", "window.__SEED_PLAN__" in seeded)
check("seed carries the chosen length", '"weeks":12' in seeded.replace(" ", ""), seeded[:600])
check("seeded checkout is still a normal cart", 'id="checkout-items"' in seeded)

# --- guards ---------------------------------------------------------------
status, out = post("/api/checkout", {"items": [{"id": "yogurt-6", "qty": 1, "planWeeks": 5}],
                                     "name": "A B", "email": "a@b.co"})
check("rejects a week count that isn't 4/8/12", status == 400, f"{status} {out}")

status, out = post("/api/checkout", {"items": [{"id": "halloumi", "qty": 1, "planWeeks": 8}],
                                     "name": "A B", "email": "a@b.co"})
check("rejects a product that isn't subscribable", status == 400, f"{status} {out}")

# --- mixed basket, delivered (week 1 rides along) -------------------------
status, out = post("/api/checkout", {
    "items": [{"id": "yogurt-6", "qty": 1, "planWeeks": 8}, {"id": "halloumi", "qty": 1}],
    "name": "Mixed Tester", "email": "mixed@example.com", "phone": "4035550100",
    "method": "delivery", "street": "1200 12 Ave SW", "city": "Calgary", "province": "AB",
    "postal": "T3C 0P8", "payment": "card"
})
check("mixed cart is accepted", status == 200 and out.get("url", "").startswith("/order/"), f"{status} {out}")

db = connect()
order = db.execute("SELECT * FROM orders ORDER BY id DESC LIMIT 1").fetchone()
items = db.execute("SELECT * FROM order_items WHERE order_id = ? ORDER BY id", (order["id"],)).fetchall()
plan_line = [i for i in items if i["plan_weeks"]]
check("mixed order has two lines", len(items) == 2, [dict(i) for i in items])
check("card line keeps plan_weeks", len(plan_line) == 1 and plan_line[0]["plan_weeks"] == 8, [dict(i) for i in plan_line])
check("card line qty is 1", plan_line and plan_line[0]["qty"] == 1)
check("card line is the block price", plan_line and plan_line[0]["price_cents"] == UNIT * 8,
      plan_line and plan_line[0]["price_cents"])
check("card line names the block", plan_line and "8-week plan" in plan_line[0]["name"], plan_line and plan_line[0]["name"])
subtotal = UNIT * 8 + HALL
expected_fee = 0 if subtotal >= FREE_OVER else 800
check("delivery charged once for the basket", order["delivery_cents"] == expected_fee,
      f'{order["delivery_cents"]} vs {expected_fee}')
check("order total carries the card", order["total_cents"] == subtotal + expected_fee, order["total_cents"])

card = db.execute("SELECT * FROM subscriptions WHERE order_item_id = ?", (plan_line[0]["id"],)).fetchone()
check("card created on payment", card is not None)
if card:
    check("8 weeks paid, 8 credited", (card["weeks_paid"], card["weeks_credited"]) == (8, 8),
          (card["weeks_paid"], card["weeks_credited"]))
    check("week 1 counts as collected with the order", card["weeks_used"] == 1, card["weeks_used"])
    check("seven tubs left to collect", card["weeks_credited"] - card["weeks_used"] == 7)
    rows = db.execute("SELECT * FROM subscription_weeks WHERE subscription_id = ? ORDER BY week_no", (card["id"],)).fetchall()
    check("one row per tub", len(rows) == 8, len(rows))
    check("week 1 is marked collected", rows[0]["status"] == "collected", rows[0]["status"])
    check("weeks 2..8 are pending", all(r["status"] == "pending" for r in rows[1:]))

_, order_page = get(out["url"])
check("customer page says week 1 is in the delivery", "is in this delivery" in order_page, order_page[:400])
check("customer page shows 1 of 8", "1 of 8 collected" in order_page)

# --- plan-only, pickup: no fee -------------------------------------------
status, out = post("/api/checkout", {
    "items": [{"id": "yogurt-6", "qty": 1, "planWeeks": 12}],
    "name": "Card Only", "email": "card@example.com", "method": "pickup", "payment": "card"
})
check("plan-only checkout works", status == 200, f"{status} {out}")
o2 = connect().execute("SELECT * FROM orders ORDER BY id DESC LIMIT 1").fetchone()
check("12 weeks pay for 12", o2["total_cents"] == UNIT * 12, o2["total_cents"])
check("pickup costs nothing", o2["delivery_cents"] == 0)
c2 = connect().execute("SELECT * FROM subscriptions WHERE order_number = ?", (o2["number"],)).fetchone()
check("12 paid crediting 13 tubs", (c2["weeks_paid"], c2["weeks_credited"]) == (12, 13),
      (c2["weeks_paid"], c2["weeks_credited"]))
check("12-week card starts at 1 of 13", c2["weeks_used"] == 1, c2["weeks_used"])

# --- two different cards on one order ------------------------------------
status, out = post("/api/checkout", {
    "items": [{"id": "yogurt-6", "qty": 1, "planWeeks": 4}, {"id": "yogurt-6", "qty": 1, "planWeeks": 8}],
    "name": "Two Cards", "email": "two@example.com", "method": "pickup", "payment": "card"
})
check("two cards in one cart", status == 200, f"{status} {out}")
o3 = connect().execute("SELECT * FROM orders ORDER BY id DESC LIMIT 1").fetchone()
cards = connect().execute("SELECT * FROM subscriptions WHERE order_number = ? ORDER BY id", (o3["number"],)).fetchall()
check("one card per line, same order", len(cards) == 2, len(cards))
check("order number can repeat across cards", len({c["order_number"] for c in cards}) == 1)
check("4 and 8 weeks kept apart", [c["weeks_paid"] for c in cards] == [4, 8], [c["weeks_paid"] for c in cards])
check("two lines, both cards", len(connect().execute("SELECT * FROM order_items WHERE order_id = ? AND plan_weeks > 0", (o3["id"],)).fetchall()) == 2)

# --- delivery fee on a small card ----------------------------------------
status, out = post("/api/checkout", {
    "items": [{"id": "yogurt-6", "qty": 1, "planWeeks": 4}],
    "name": "Small Card", "email": "small@example.com", "phone": "4035550111", "method": "delivery",
    "street": "1200 12 Ave SW", "city": "Calgary", "province": "AB", "postal": "T3C 0P8",
    "payment": "card"
})
check("small card delivers", status == 200, f"{status} {out}")
o4 = connect().execute("SELECT * FROM orders ORDER BY id DESC LIMIT 1").fetchone()
expected4 = 0 if UNIT * 4 >= FREE_OVER else 800
check("a small card pays delivery like anything else", o4["delivery_cents"] == expected4,
      f'{o4["delivery_cents"]} vs {expected4}')

# --- admin collect --------------------------------------------------------
status, _ = get("/admin/subscriptions", auth=True)
check("admin plans page loads", status == 200)

sid = card["id"]
status, _ = post_form(f"/admin/subscriptions/{sid}/collect", {}, auth=True)
check("collect endpoint responds", status == 200)
used = connect().execute("SELECT weeks_used FROM subscriptions WHERE id = ?", (sid,)).fetchone()[0]
check("collect marks one week used", used == 2, used)
_, admin_page = get("/admin/subscriptions", auth=True)
check("admin page shows the new progress", "2 / 8" in admin_page, admin_page[:200])
check("admin page shows unearned revenue", "prepaid, unearned" in admin_page)

status, _ = post_form(f"/admin/subscriptions/{sid}/undo", {}, auth=True)
check("undo takes the week back", connect().execute("SELECT weeks_used FROM subscriptions WHERE id = ?", (sid,)).fetchone()[0] == 1)

# --- cancelling the order cancels its cards ------------------------------
status, _ = post_form(f"/admin/orders/{o3['number']}/status", {"status": "cancelled"}, auth=True)
check("admin can cancel the order", status == 200)
after = connect().execute("SELECT status FROM subscriptions WHERE order_number = ?", (o3["number"],)).fetchall()
check("cancelling kills unused cards", all(r["status"] == "cancelled" for r in after), [r["status"] for r in after])

# --- idempotency ----------------------------------------------------------
post_form(f"/admin/orders/{o3['number']}/status", {"status": "paid"}, auth=True)
again = connect().execute("SELECT COUNT(*) n FROM subscriptions WHERE order_number = ? AND status = 'active'", (o3["number"],)).fetchone()["n"]
check("re-activating does not duplicate cards", again == 0 or again == 2, again)

print()
if failures:
    print(f"{len(failures)} FAILED: " + "; ".join(failures))
    sys.exit(1)
print("all plan checks passed")
