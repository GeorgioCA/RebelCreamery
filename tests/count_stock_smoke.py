"""Counted stock per product, while the rest of the shop stays made to order.

A product with count_stock = 1 sells against a hard number: the card shows what
is left, the order takes the units off the count, a third order is refused at
zero, and cancelling puts them back. A product without the flag ignores its
stock entirely, which is the shop default (MADE_TO_ORDER is on).

Runs against a demo-mode server with a throwaway DATA_DIR. Setup is written
straight into that database, then everything else goes through HTTP so the
checkout and admin paths are the ones being tested.
"""
import base64
import json
import os
import re
import sqlite3
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("BASE", "http://127.0.0.1:3191")
DATA_DIR = os.environ.get("DATA_DIR", "/tmp/rc-count-test")
DB_PATH = os.path.join(DATA_DIR, "store.db")
ADMIN_USER = os.environ.get("ADMIN_USER", "owner")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "testpass")
UA = {"User-Agent": "Mozilla/5.0 count-stock-smoke"}

failures = []


def check(label, cond, detail=""):
    print(("PASS  " if cond else "FAIL  ") + label + (f"  [{detail}]" if detail and not cond else ""))
    if not cond:
        failures.append(label)


def post(path, payload, headers=None):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", **UA, **(headers or {})},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"{}"), r.headers
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read() or b"{}")
        except json.JSONDecodeError:
            body = {}
        return e.code, body, e.headers


def form(path, fields, auth=None):
    data = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(BASE + path, data=data, method="POST",
                                 headers={"Content-Type": "application/x-www-form-urlencoded", **UA,
                                          **({"Authorization": auth} if auth else {})})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.headers
    except urllib.error.HTTPError as e:
        return e.code, e.headers


def get(path, auth=None):
    req = urllib.request.Request(BASE + path, headers={**UA, **({"Authorization": auth} if auth else {})})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def admin_auth():
    token = base64.b64encode(f"{ADMIN_USER}:{ADMIN_PASSWORD}".encode()).decode()
    return f"Basic {token}"


def stock(pid):
    con = sqlite3.connect(DB_PATH)
    row = con.execute("SELECT stock FROM products WHERE id = ?", (pid,)).fetchone()
    con.close()
    return row[0] if row else None


def card(html, pid):
    """The <article> for one product, so checks cannot pass on a neighbour's text."""
    marker = f'id="product-{pid}"'
    if marker not in html:
        return ""
    return html.split(marker, 1)[1].split("</article>", 1)[0]


# --- two products: one counted, one made to order ----------------------------
con = sqlite3.connect(DB_PATH)
now = "2026-01-01T00:00:00.000Z"
for pid, name, counted in (("counted-item", "Counted Item", 1), ("open-item", "Open Item", 0)):
    con.execute("DELETE FROM products WHERE id = ?", (pid,))
    con.execute(
        "INSERT INTO products (id, sku, name, weight, price_cents, note, tags, art, stock, count_stock,"
        " max_per_order, active, sold_out, sort_order, ingredients, allergens, shelf_life_days,"
        " subscribable, variant_group, variant_options, created_at)"
        " VALUES (?, ?, ?, '1 kg', 1000, '', '[]', 'generic', 2, ?, 6, 1, 0, 5, '', 'Milk', 14, 0, '', '{}', ?)",
        (pid, pid.upper(), name, counted, now),
    )
con.commit()
con.close()

cookie = admin_auth()
check("admin auth works", get("/admin/products", cookie)[0] == 200, "basic auth refused")

s, html = get("/")
counted_card = card(html, "counted-item")
open_card = card(html, "open-item")
check("counted product shows its count", "2 left" in counted_card, counted_card[:160])
check("made-to-order product shows no count", "left" not in open_card.lower().split("card-note")[0], open_card[:160])

# --- an order takes units only off the counted product -----------------------
base = {"name": "Count Smoke", "email": "count@example.com", "phone": "4035550100",
        "method": "pickup", "payment": "etransfer"}
s, r, _ = post("/api/checkout", {**base, "items": [
    {"id": "counted-item", "qty": 2}, {"id": "open-item", "qty": 1}]})
check("mixed order accepted", s == 200, f"{s} {r}")
check("counted stock drops to zero", stock("counted-item") == 0, stock("counted-item"))
check("made-to-order stock is untouched", stock("open-item") == 2, stock("open-item"))

order_url = r.get("url", "")
if order_url:
    _, order_html = get(order_url)
    number = re.search(r"RC-\d+", order_html)
    number = number.group(0) if number else ""

    # --- at zero the card says sold out and the checkout refuses ------------
    _, html = get("/")
    counted_card = card(html, "counted-item")
    check("card reads sold out at zero", "sold out" in counted_card.lower(), counted_card[:160])
    check("add button is disabled at zero", 'class="btn btn-add" data-add="counted-item" disabled' in counted_card
          or "btn-add\" data-add=\"counted-item\" disabled" in counted_card, counted_card[:400])

    s, r, _ = post("/api/checkout", {**base, "items": [{"id": "counted-item", "qty": 1}]})
    check("checkout refuses a sold-out counted product", s == 409, f"{s} {r}")

    # --- the other product can still be ordered -----------------------------
    s, r, _ = post("/api/checkout", {**base, "items": [{"id": "open-item", "qty": 1}]})
    check("made-to-order product still sells at zero stock", s == 200, f"{s} {r}")

    # --- cancelling puts the counted units back -----------------------------
    if number and cookie:
        s, _ = form(f"/admin/orders/{number}/status", {"status": "cancelled"}, cookie)
        check("admin can cancel the order", s in (200, 302), s)
        check("cancel restores the counted stock", stock("counted-item") == 2, stock("counted-item"))
        _, html = get("/")
        check("card is back on sale after the cancel", "2 left" in card(html, "counted-item"))

    # --- the admin form round-trips the flag --------------------------------
    s, page = get("/admin/products/counted-item", cookie)
    check("product form renders", s == 200, s)
    check("counted product's checkbox is checked",
          bool(re.search(r'name="count_stock"[^>]*checked', page)) and 'name="count_stock"' in page)
    s, page = get("/admin/products/open-item", cookie)
    check("made-to-order product's checkbox is clear",
          not re.search(r'name="count_stock"[^>]*checked', page))

    # Saving the form with the box ticked keeps it on; unticking turns it off.
    fields = {"id": "counted-item", "name": "Counted Item", "weight": "1 kg", "price": "10.00", "cost": "4.00",
              "stock": "3", "max": "6", "sort": "5", "active": "1", "art": "generic",
              "count_stock": "1", "shelf_life_days": "14", "allergens": "Milk"}
    s, _ = form("/admin/products", fields, cookie)
    check("admin save keeps the flag on", s in (200, 302) and stock("counted-item") == 3,
          f"{s} stock={stock('counted-item')}")
    fields.pop("count_stock")
    s, _ = form("/admin/products", fields, cookie)
    con = sqlite3.connect(DB_PATH)
    flag = con.execute("SELECT count_stock FROM products WHERE id = 'counted-item'").fetchone()[0]
    con.close()
    check("admin save can turn the flag off", flag == 0, flag)

print()
if failures:
    print(f"{len(failures)} failed: {', '.join(failures)}")
    sys.exit(1)
print("all counted-stock checks passed")
