#!/usr/bin/env python3
"""Rebel Creamery metrics.

A separate, read-only container that turns the store's SQLite order book into
(a) a small dashboard, (b) a JSON summary, and (c) Prometheus text metrics.

It never writes to the database: the file is opened with mode=ro and
PRAGMA query_only. The store keeps running if this container is stopped, and
this container keeps running if the store is down (it just shows older data).

Endpoints
    GET /                  HTML dashboard
    GET /api/summary.json  everything the dashboard shows, as JSON
    GET /metrics           Prometheus exposition format
    GET /health            liveness, no auth, no business data

Environment
    DATA_DIR          where store.db lives          (default /data)
    DB_PATH           override the database path    (default $DATA_DIR/store.db)
    PORT              listen port                   (default 9110)
    METRICS_USER      basic-auth user               (default owner)
    METRICS_PASSWORD  basic-auth password           (empty = 503, like /admin)
    SITE_NAME         wordmark                      (default Rebel Creamery)
    TZ_NAME           business timezone             (default America/Edmonton)
    CACHE_SECONDS     how long a computed summary is reused (default 15)
    LOW_STOCK         stock at or below this is "low"       (default 3)
"""

import base64
import html
import json
import os
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from zoneinfo import ZoneInfo

DATA_DIR = os.environ.get("DATA_DIR", "/data")
DB_PATH = os.environ.get("DB_PATH") or os.path.join(DATA_DIR, "store.db")
PORT = int(os.environ.get("PORT", "9110"))
USER = os.environ.get("METRICS_USER", "owner")
PASSWORD = os.environ.get("METRICS_PASSWORD", "")
SITE_NAME = os.environ.get("SITE_NAME", "Rebel Creamery")
TZ = ZoneInfo(os.environ.get("TZ_NAME", "America/Edmonton"))
CACHE_SECONDS = float(os.environ.get("CACHE_SECONDS", "15"))
LOW_STOCK = int(os.environ.get("LOW_STOCK", "3"))

# Money is only real once it has been paid. Cancelled orders never count, and
# pending card / e-Transfer orders are shown separately as money owed.
REVENUE_STATUSES = ("paid", "packed", "completed")
OPEN_STATUSES = ("pending", "awaiting_etransfer", "paid", "packed")
STATUS_ORDER = ["pending", "awaiting_etransfer", "paid", "packed", "completed", "cancelled"]

_lock = threading.Lock()
_cache = {"at": 0.0, "payload": None}
_read_errors = 0


# --------------------------------------------------------------------------- #
# database
# --------------------------------------------------------------------------- #

def connect():
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, timeout=4)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA query_only = 1")
    return conn


def rows(conn, sql, args=()):
    try:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]
    except sqlite3.Error:
        return []


def table_exists(conn, name):
    return bool(conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?", (name,)
    ).fetchone())


def parse_ts(value):
    if not value:
        return None
    try:
        text = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(text)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def local_date(value):
    dt = parse_ts(value)
    return dt.astimezone(TZ).date() if dt else None


# --------------------------------------------------------------------------- #
# summary
# --------------------------------------------------------------------------- #

def window_stats(orders, start=None, days=None):
    if start is not None:
        chosen = [o for o in orders if o["_date"] and o["_date"] >= start]
    else:
        chosen = list(orders)
    paid = [o for o in chosen if o["status"] in REVENUE_STATUSES]
    revenue = sum(int(o["total_cents"] or 0) for o in paid)
    return {
        "orders": len(chosen),
        "paid_orders": len(paid),
        "revenue_cents": revenue,
        "aov_cents": round(revenue / len(paid)) if paid else 0,
    }


def summarise():
    global _read_errors

    today = datetime.now(TZ).date()
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "site": SITE_NAME,
        "timezone": str(TZ),
        "db": {"path": DB_PATH, "present": os.path.exists(DB_PATH), "mode": "read-only"},
        "windows": {},
        "trend": [],
        "status": [],
        "payment": [],
        "method": [],
        "top_products": [],
        "subscriptions": {},
        "ops": {},
        "customers": {},
    }

    if not payload["db"]["present"]:
        payload["error"] = f"no database at {DB_PATH}"
        return payload

    stat = os.stat(DB_PATH)
    payload["db"]["size_bytes"] = stat.st_size
    payload["db"]["age_seconds"] = int(time.time() - stat.st_mtime)

    try:
        conn = connect()
    except sqlite3.Error as exc:
        _read_errors += 1
        payload["error"] = f"cannot open database: {exc}"
        return payload

    try:
        order_rows = rows(conn, "SELECT * FROM orders ORDER BY id DESC")
        item_rows = rows(conn, "SELECT * FROM order_items") if table_exists(conn, "order_items") else []
        product_rows = rows(conn, "SELECT * FROM products") if table_exists(conn, "products") else []
        sub_rows = rows(conn, "SELECT * FROM subscriptions") if table_exists(conn, "subscriptions") else []
        print_rows = rows(conn, "SELECT status, COUNT(*) AS n FROM print_jobs GROUP BY status") if table_exists(conn, "print_jobs") else []
        discount_rows = rows(conn, "SELECT * FROM discounts") if table_exists(conn, "discounts") else []
    except sqlite3.Error as exc:
        _read_errors += 1
        payload["error"] = f"database read failed: {exc}"
        conn.close()
        return payload
    finally:
        try:
            conn.close()
        except sqlite3.Error:
            pass

    for o in order_rows:
        o["_date"] = local_date(o.get("created_at"))
        o["status"] = (o.get("status") or "unknown").strip()

    # ---- headline windows -------------------------------------------------
    payload["windows"] = {
        "today": window_stats(order_rows, start=today),
        "7d": window_stats(order_rows, start=today - timedelta(days=6)),
        "30d": window_stats(order_rows, start=today - timedelta(days=29)),
        "all": window_stats(order_rows),
    }

    # ---- 30-day trend -----------------------------------------------------
    by_day = {}
    for o in order_rows:
        if not o["_date"] or o["_date"] < today - timedelta(days=29):
            continue
        bucket = by_day.setdefault(o["_date"], {"orders": 0, "revenue_cents": 0})
        bucket["orders"] += 1
        if o["status"] in REVENUE_STATUSES:
            bucket["revenue_cents"] += int(o["total_cents"] or 0)
    trend = []
    for i in range(29, -1, -1):
        day = today - timedelta(days=i)
        bucket = by_day.get(day, {"orders": 0, "revenue_cents": 0})
        trend.append({"date": day.isoformat(), "orders": bucket["orders"],
                      "revenue_cents": bucket["revenue_cents"]})
    payload["trend"] = trend
    payload["trend_peak_cents"] = max([t["revenue_cents"] for t in trend] + [0])

    # ---- status / payment / fulfilment ------------------------------------
    for status in STATUS_ORDER + sorted({o["status"] for o in order_rows} - set(STATUS_ORDER)):
        bucket = [o for o in order_rows if o["status"] == status]
        if not bucket and status not in STATUS_ORDER:
            continue
        payload["status"].append({
            "status": status,
            "count": len(bucket),
            "cents": sum(int(o["total_cents"] or 0) for o in bucket),
        })

    for field, key in (("payment", "payment"), ("method", "method")):
        seen = {}
        for o in order_rows:
            label = (o.get(field) or "unknown").strip() or "unknown"
            entry = seen.setdefault(label, {"name": label, "count": 0, "cents": 0})
            entry["count"] += 1
            entry["cents"] += int(o["total_cents"] or 0)
        payload[key] = sorted(seen.values(), key=lambda e: -e["count"])

    # ---- products ---------------------------------------------------------
    product_by_id = {p.get("id"): p for p in product_rows}
    revenue_order_ids = {o["id"] for o in order_rows if o["status"] in REVENUE_STATUSES}
    since_30 = today - timedelta(days=29)
    date_by_order = {o["id"]: o["_date"] for o in order_rows}
    sold = {}
    for item in item_rows:
        if item.get("order_id") not in revenue_order_ids:
            continue
        day = date_by_order.get(item["order_id"])
        if not day or day < since_30:
            continue
        key = item.get("product_id") or item.get("name") or "unknown"
        entry = sold.setdefault(key, {
            "product_id": key,
            "name": item.get("name") or key,
            "sku": item.get("sku") or "",
            "units": 0,
            "revenue_cents": 0,
        })
        entry["units"] += int(item.get("qty") or 0)
        entry["revenue_cents"] += int(item.get("price_cents") or 0) * int(item.get("qty") or 0)
    top = sorted(sold.values(), key=lambda e: (-e["revenue_cents"], -e["units"]))
    top_total = sum(e["revenue_cents"] for e in top) or 1
    for entry in top:
        entry["share"] = round(100 * entry["revenue_cents"] / top_total, 1)
    payload["top_products"] = top[:10]

    # ---- subscriptions (mirrors subscriptionSummary() in lib/db.js) -------
    active = unearned = earned = weeks_out = tubs_out = 0
    for s in sub_rows:
        status = s.get("status")
        weeks_credited = int(s.get("weeks_credited") or 0)
        weeks_used = int(s.get("weeks_used") or 0)
        per_week = int(s.get("tubs_per_week") or 1)
        total = int(s.get("total_cents") or 0)
        if status == "active":
            active += 1
        remaining = max(0, weeks_credited - weeks_used) if status == "active" else 0
        slice_cents = round(total / weeks_credited * remaining) if weeks_credited else 0
        unearned += slice_cents
        earned += total - slice_cents
        weeks_out += remaining
        tubs_out += remaining * per_week
    payload["subscriptions"] = {
        "total": len(sub_rows),
        "active": active,
        "weeks_outstanding": weeks_out,
        "tubs_outstanding": tubs_out,
        "unearned_cents": unearned,
        "earned_cents": earned,
        "cards": [
            {
                "product": s.get("product_name"),
                "weeks_paid": s.get("weeks_paid"),
                "weeks_credited": s.get("weeks_credited"),
                "weeks_used": s.get("weeks_used"),
                "tubs_per_week": s.get("tubs_per_week") or 1,
                "status": s.get("status"),
                "expires_at": s.get("expires_at"),
            }
            for s in sub_rows if s.get("status") == "active"
        ][:20],
    }

    # ---- operations -------------------------------------------------------
    awaiting = [o for o in order_rows if o["status"] == "awaiting_etransfer"]
    stale_cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    stale = [
        o for o in order_rows
        if o["status"] == "pending" and o.get("payment") == "card"
        and parse_ts(o.get("created_at")) and parse_ts(o["created_at"]) < stale_cutoff
    ]
    sold_out = [p.get("name") for p in product_rows if p.get("active", 1) and p.get("sold_out")]
    low = [
        {"name": p.get("name"), "stock": int(p.get("stock") or 0)}
        for p in product_rows
        if p.get("active", 1) and not p.get("sold_out") and int(p.get("stock") or 0) <= LOW_STOCK
    ]
    payload["ops"] = {
        "awaiting_etransfer": {
            "count": len(awaiting),
            "cents": sum(int(o["total_cents"] or 0) for o in awaiting),
        },
        "stale_card_orders": {
            "count": len(stale),
            "cents": sum(int(o["total_cents"] or 0) for o in stale),
        },
        "open_orders": {
            "count": len([o for o in order_rows if o["status"] in OPEN_STATUSES]),
            "cents": sum(int(o["total_cents"] or 0) for o in order_rows if o["status"] in OPEN_STATUSES),
        },
        "print": {r["status"]: int(r["n"]) for r in print_rows},
        "sold_out": sold_out,
        "low_stock": sorted(low, key=lambda p: p["stock"]),
        "low_stock_threshold": LOW_STOCK,
        "discounts": [
            {
                "code": d.get("code"),
                "kind": d.get("kind"),
                "value": d.get("value"),
                "uses": int(d.get("uses") or 0),
                "max_uses": d.get("max_uses"),
                "active": bool(d.get("active")),
            }
            for d in discount_rows if int(d.get("uses") or 0) > 0
        ][:10],
    }

    # ---- customers --------------------------------------------------------
    paid_emails = [str(o.get("email") or "").strip().lower() for o in order_rows
                   if o["status"] in REVENUE_STATUSES and o.get("email")]
    counts = {}
    for email in paid_emails:
        counts[email] = counts.get(email, 0) + 1
    payload["customers"] = {
        "unique": len(counts),
        "repeat": len([c for c in counts.values() if c > 1]),
    }

    last_order = max((parse_ts(o.get("created_at")) for o in order_rows), default=None)
    payload["last_order_age_seconds"] = (
        int((datetime.now(timezone.utc) - last_order).total_seconds()) if last_order else None
    )
    payload["db_mode"] = "read-only"
    return payload


def get_summary(force=False):
    now = time.time()
    with _lock:
        if not force and _cache["payload"] and now - _cache["at"] < CACHE_SECONDS:
            return _cache["payload"]
        payload = summarise()
        _cache.update(at=now, payload=payload)
        return payload


# --------------------------------------------------------------------------- #
# rendering
# --------------------------------------------------------------------------- #

def money(cents):
    cents = int(cents or 0)
    sign = "-" if cents < 0 else ""
    return f"{sign}${abs(cents) / 100:,.2f}"


def esc(value):
    return html.escape(str(value if value is not None else ""))


def ago(seconds):
    if seconds is None:
        return "never"
    seconds = int(seconds)
    if seconds < 90:
        return f"{seconds}s ago"
    if seconds < 5400:
        return f"{round(seconds / 60)} min ago"
    if seconds < 172800:
        return f"{round(seconds / 3600)} h ago"
    return f"{round(seconds / 86400)} d ago"


def prom_labels(pairs):
    body = ",".join(f'{k}="{str(v).replace(chr(92), chr(92) * 2).replace(chr(34), chr(92) + chr(34))}"'
                    for k, v in pairs if v is not None)
    return "{" + body + "}" if body else ""


def prometheus(payload):
    lines = []
    errors = payload.get("error")

    def metric(name, kind, help_text, samples):
        lines.append(f"# HELP {name} {help_text}")
        lines.append(f"# TYPE {name} {kind}")
        for labels, value in samples:
            lines.append(f"{name}{prom_labels(labels)} {value}")

    metric("creamery_up", "gauge", "1 when the order book was read successfully.",
           [([], 0 if errors else 1)])
    metric("creamery_db_read_errors_total", "counter", "Read failures since start.",
           [([], _read_errors)])
    if errors:
        return "\n".join(lines) + "\n"

    db = payload["db"]
    metric("creamery_db_size_bytes", "gauge", "Size of the SQLite file.",
           [([], db.get("size_bytes", 0))])
    metric("creamery_db_modified_age_seconds", "gauge", "Seconds since the database file changed.",
           [([], db.get("age_seconds", 0))])
    if payload.get("last_order_age_seconds") is not None:
        metric("creamery_last_order_age_seconds", "gauge", "Seconds since the newest order.",
               [([], payload["last_order_age_seconds"])])

    metric("creamery_revenue_cents", "gauge", "Paid revenue in the window (cents).",
           [([("window", w)], v["revenue_cents"]) for w, v in payload["windows"].items()])
    metric("creamery_orders", "gauge", "Orders created in the window.",
           [([("window", w)], v["orders"]) for w, v in payload["windows"].items()])
    metric("creamery_paid_orders", "gauge", "Paid orders in the window.",
           [([("window", w)], v["paid_orders"]) for w, v in payload["windows"].items()])
    metric("creamery_aov_cents", "gauge", "Average order value on paid orders (cents).",
           [([("window", w)], v["aov_cents"]) for w, v in payload["windows"].items()])

    metric("creamery_orders_by_status", "gauge", "Orders by status (all time).",
           [([("status", s["status"])], s["count"]) for s in payload["status"]])
    metric("creamery_orders_value_by_status_cents", "gauge", "Order value by status (cents).",
           [([("status", s["status"])], s["cents"]) for s in payload["status"]])
    metric("creamery_payment_split", "gauge", "Orders by payment method.",
           [([("payment", p["name"])], p["count"]) for p in payload["payment"]])
    metric("creamery_fulfilment_split", "gauge", "Orders by fulfilment method.",
           [([("method", m["name"])], m["count"]) for m in payload["method"]])

    subs = payload["subscriptions"]
    metric("creamery_subscriptions_active", "gauge", "Prepaid plans still being collected.",
           [([], subs.get("active", 0))])
    metric("creamery_subscription_weeks_outstanding", "gauge", "Prepaid weeks not yet collected.",
           [([], subs.get("weeks_outstanding", 0))])
    metric("creamery_subscription_tubs_outstanding", "gauge", "Tubs owed on open plans.",
           [([], subs.get("tubs_outstanding", 0))])
    metric("creamery_subscription_unearned_cents", "gauge", "Money taken for tubs not yet handed over.",
           [([], subs.get("unearned_cents", 0))])

    ops = payload["ops"]
    metric("creamery_awaiting_etransfer", "gauge", "Orders waiting on an e-Transfer.",
           [([], ops["awaiting_etransfer"]["count"])])
    metric("creamery_awaiting_etransfer_cents", "gauge", "Value of orders waiting on an e-Transfer.",
           [([], ops["awaiting_etransfer"]["cents"])])
    metric("creamery_stale_card_orders", "gauge", "Card orders unpaid after 24 h.",
           [([], ops["stale_card_orders"]["count"])])
    metric("creamery_print_jobs", "gauge", "Label jobs by status.",
           [([("status", k)], v) for k, v in ops["print"].items()])
    metric("creamery_products_sold_out", "gauge", "Active products marked sold out.",
           [([], len(ops["sold_out"]))])
    metric("creamery_products_low_stock", "gauge", f"Active products at or below {ops['low_stock_threshold']} units.",
           [([], len(ops["low_stock"]))])
    metric("creamery_customers_unique", "gauge", "Customers with at least one paid order.",
           [([], payload["customers"].get("unique", 0))])
    metric("creamery_customers_repeat", "gauge", "Customers with more than one paid order.",
           [([], payload["customers"].get("repeat", 0))])
    metric("creamery_generated_at_seconds", "gauge", "Unix time this snapshot was computed.",
           [([], int(parse_ts(payload["generated_at"]).timestamp()))])
    return "\n".join(lines) + "\n"


CSS = """
:root{--paper:#fbf7ef;--card:#fffdf8;--ink:#1d2a21;--soft:#4c5a4f;--moss:#2f4436;
--butter:#f4c95d;--clay:#a94a20;--line:rgba(29,42,33,.14)}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 Inter,-apple-system,
BlinkMacSystemFont,'Segoe UI',sans-serif;padding:34px 22px 60px}
.wrap{max-width:1080px;margin:0 auto}
header{display:flex;flex-wrap:wrap;align-items:baseline;gap:14px;justify-content:space-between;
border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:26px}
h1{font:500 30px/1.1 Georgia,'Times New Roman',serif;letter-spacing:-.02em;margin:0}
h1 span{color:var(--clay)}
.sub{color:var(--soft);font-size:13.5px}
h2{font:500 19px/1.2 Georgia,serif;margin:34px 0 12px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 18px}
.tile .label{font-size:12.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--soft)}
.tile .value{font:500 32px/1.15 Georgia,serif;margin-top:6px}
.tile .note{font-size:13px;color:var(--soft);margin-top:4px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);
border-radius:16px;overflow:hidden}
th,td{text-align:left;padding:11px 14px;border-bottom:1px solid var(--line);font-size:14px}
th{font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:var(--soft);font-weight:600}
tr:last-child td{border-bottom:none}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.bar{height:7px;background:rgba(29,42,33,.08);border-radius:99px;overflow:hidden;min-width:70px}
.bar i{display:block;height:100%;background:var(--moss)}
.chart{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px}
.chart svg{width:100%;height:190px;overflow:visible}
.legend{display:flex;gap:18px;flex-wrap:wrap;font-size:13px;color:var(--soft);margin-top:8px}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 18px}
.kv{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px dashed var(--line);font-size:14px}
.kv:last-child{border-bottom:none}
.kv b{font-weight:600}
.pill{display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;border:1px solid var(--line)}
.warn{color:var(--clay)}
footer{margin-top:38px;color:var(--soft);font-size:13px;border-top:1px solid var(--line);padding-top:16px}
footer a{color:var(--clay)}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}
"""


def bar_chart(trend, peak):
    if not trend:
        return '<p class="sub">No orders yet.</p>'
    width, height = 960, 170
    gap = 3
    slot = width / len(trend)
    bar_w = max(3, slot - gap)
    peak = peak or 1
    bars = []
    for i, day in enumerate(trend):
        h = (day["revenue_cents"] / peak) * (height - 28) if peak else 0
        h = max(1.2, h)
        x = i * slot
        y = height - 22 - h
        colour = "#2f4436" if day["revenue_cents"] else "rgba(29,42,33,.12)"
        label = f"{day['date']} · {money(day['revenue_cents'])} · {day['orders']} order{'s' if day['orders'] != 1 else ''}"
        bars.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w:.1f}" height="{h:.1f}" '
                    f'rx="2.5" fill="{colour}"><title>{esc(label)}</title></rect>')
    ticks = "".join(
        f'<text x="{i * slot + bar_w / 2:.1f}" y="{height - 5}" font-size="10" fill="#4c5a4f" '
        f'text-anchor="middle">{esc(day["date"][5:])}</text>'
        for i, day in enumerate(trend) if i % 5 == 0 or i == len(trend) - 1
    )
    return (f'<svg viewBox="0 0 {width} {height}" role="img" aria-label="Revenue, last 30 days">'
            f'{"".join(bars)}{ticks}</svg>')


def render_html(payload):
    if payload.get("error"):
        body = (f'<div class="card"><b class="warn">Cannot read the order book.</b>'
                f'<p class="sub mono">{esc(payload["error"])}</p>'
                f'<p class="sub">The store keeps running; this container only reads.</p></div>')
        return page(body, payload)

    w = payload["windows"]
    subs = payload["subscriptions"]
    ops = payload["ops"]

    tiles = f"""
    <div class="tiles">
      <div class="tile"><div class="label">Revenue · 30 days</div>
        <div class="value">{money(w['30d']['revenue_cents'])}</div>
        <div class="note">{w['30d']['paid_orders']} paid orders</div></div>
      <div class="tile"><div class="label">Average order</div>
        <div class="value">{money(w['30d']['aov_cents'])}</div>
        <div class="note">30 days · paid only</div></div>
      <div class="tile"><div class="label">Open orders</div>
        <div class="value">{ops['open_orders']['count']}</div>
        <div class="note">{money(ops['open_orders']['cents'])} not finished</div></div>
      <div class="tile"><div class="label">Repeat customers</div>
        <div class="value">{payload['customers']['repeat']}</div>
        <div class="note">of {payload['customers']['unique']} buyers</div></div>
    </div>"""

    ranges = "".join(
        f"<tr><td>{label}</td><td class='num'>{money(v['revenue_cents'])}</td>"
        f"<td class='num'>{v['orders']}</td><td class='num'>{v['paid_orders']}</td>"
        f"<td class='num'>{money(v['aov_cents'])}</td></tr>"
        for label, v in (("Today", w["today"]), ("Last 7 days", w["7d"]),
                         ("Last 30 days", w["30d"]), ("All time", w["all"]))
    )

    status_rows = "".join(
        f"<tr><td><span class='pill'>{esc(s['status'].replace('_', ' '))}</span></td>"
        f"<td class='num'>{s['count']}</td><td class='num'>{money(s['cents'])}</td></tr>"
        for s in payload["status"]
    )

    if payload["top_products"]:
        top_rows = "".join(
            f"<tr><td>{esc(p['name'])}</td><td class='num'>{p['units']}</td>"
            f"<td class='num'>{money(p['revenue_cents'])}</td>"
            f"<td><div class='bar'><i style='width:{max(2, p['share']):.0f}%'></i></div></td></tr>"
            for p in payload["top_products"]
        )
        top_table = (f"<table><thead><tr><th>Product</th><th class='num'>Units</th>"
                     f"<th class='num'>Revenue</th><th>Share</th></tr></thead><tbody>{top_rows}</tbody></table>")
    else:
        top_table = "<p class='sub'>No paid orders in the last 30 days.</p>"

    payment = " · ".join(f"{esc(p['name'])} {p['count']}" for p in payload["payment"]) or "—"
    method = " · ".join(f"{esc(m['name'])} {m['count']}" for m in payload["method"]) or "—"

    sub_card = f"""
      <div class="card">
        <div class="kv"><span>Open plans</span><b>{subs['active']}</b></div>
        <div class="kv"><span>Tubs still owed</span><b>{subs['tubs_outstanding']}</b></div>
        <div class="kv"><span>Weeks outstanding</span><b>{subs['weeks_outstanding']}</b></div>
        <div class="kv"><span>Unearned (paid, not poured)</span><b>{money(subs['unearned_cents'])}</b></div>
        <div class="kv"><span>Earned</span><b>{money(subs['earned_cents'])}</b></div>
        <div class="kv"><span>Plans ever sold</span><b>{subs['total']}</b></div>
      </div>"""

    print_kv = " · ".join(f"{esc(k)} {v}" for k, v in ops["print"].items()) or "none"
    low = ", ".join(f"{esc(p['name'])} ({p['stock']})" for p in ops["low_stock"]) or "none"
    sold_out = ", ".join(esc(n) for n in ops["sold_out"]) or "none"
    discounts = ", ".join(f"{esc(d['code'])} {d['uses']}/{d['max_uses'] or '∞'}"
                          for d in ops["discounts"]) or "none used yet"

    ops_card = f"""
      <div class="card">
        <div class="kv"><span>Awaiting e-Transfer</span><b>{ops['awaiting_etransfer']['count']} · {money(ops['awaiting_etransfer']['cents'])}</b></div>
        <div class="kv"><span>Card orders unpaid &gt; 24 h</span><b class="{'warn' if ops['stale_card_orders']['count'] else ''}">{ops['stale_card_orders']['count']}</b></div>
        <div class="kv"><span>Label queue</span><b>{print_kv}</b></div>
        <div class="kv"><span>Sold out</span><b class="{'warn' if ops['sold_out'] else ''}">{sold_out}</b></div>
        <div class="kv"><span>Low stock (≤ {ops['low_stock_threshold']})</span><b>{low}</b></div>
        <div class="kv"><span>Discount codes</span><b>{discounts}</b></div>
      </div>"""

    body = f"""
    {tiles}
    <h2>Revenue, last 30 days</h2>
    <div class="chart">{bar_chart(payload['trend'], payload['trend_peak_cents'])}
      <div class="legend"><span><span class="dot" style="background:#2f4436"></span>Paid revenue per day</span>
      <span>Peak {money(payload['trend_peak_cents'])}</span></div></div>

    <h2>Windows</h2>
    <table><thead><tr><th>Period</th><th class="num">Revenue</th><th class="num">Orders</th>
      <th class="num">Paid</th><th class="num">AOV</th></tr></thead><tbody>{ranges}</tbody></table>

    <h2>What is in the book</h2>
    <div class="grid2">
      <table><thead><tr><th>Status</th><th class="num">Orders</th><th class="num">Value</th></tr></thead>
        <tbody>{status_rows}</tbody></table>
      <div class="card">
        <div class="kv"><span>Payment</span><b>{payment}</b></div>
        <div class="kv"><span>Fulfilment</span><b>{method}</b></div>
        <div class="kv"><span>Last order</span><b>{ago(payload.get('last_order_age_seconds'))}</b></div>
        <div class="kv"><span>Database</span><b>{payload['db'].get('size_bytes', 0) / 1024:.0f} KB · read-only</b></div>
      </div>
    </div>

    <h2>Best sellers · 30 days</h2>
    {top_table}

    <h2>Prepaid plans &amp; operations</h2>
    <div class="grid2">{sub_card}{ops_card}</div>
    """
    return page(body, payload)


def page(body, payload):
    refreshed = payload.get("generated_at", "")
    db_note = ""
    if payload.get("db", {}).get("age_seconds") is not None:
        db_note = f" · database touched {ago(payload['db']['age_seconds'])}"
    if payload.get("error"):
        db_note = ""
    banner = ""
    if not PASSWORD:
        banner = ('<div class="card" style="border-color:#a94a20"><b class="warn">Set METRICS_PASSWORD.</b>'
                  ' This page is only served once a password is configured — the numbers are private.</div>')
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>{esc(SITE_NAME)} · metrics</title><style>{CSS}</style></head>
<body><div class="wrap">
<header>
  <div><h1>{esc(SITE_NAME)} <span>·</span> metrics</h1>
  <div class="sub">Read-only view of the order book{esc(db_note)}</div></div>
  <div class="sub">Updated {esc(refreshed.replace('T', ' ').replace('+00:00', ' UTC'))}<br>
  <a href="/metrics">/metrics</a> · <a href="/api/summary.json">/api/summary.json</a></div>
</header>
{banner}
{body}
<footer>Separate container, read-only SQLite access. Nothing here writes to the store.
Values exclude cancelled orders; revenue counts paid, packed and completed only.</footer>
</div></body></html>"""


# --------------------------------------------------------------------------- #
# http
# --------------------------------------------------------------------------- #

class Handler(BaseHTTPRequestHandler):
    server_version = "creamery-metrics"
    sys_version = ""

    def log_message(self, fmt, *args):  # keep the container log quiet
        pass

    def authorised(self):
        if not PASSWORD:
            return False
        header = self.headers.get("Authorization", "")
        if not header.startswith("Basic "):
            return False
        try:
            decoded = base64.b64decode(header[6:]).decode("utf-8")
        except Exception:
            return False
        user, _, password = decoded.partition(":")
        return user == USER and password == PASSWORD

    def send_payload(self, body, content_type, status=200):
        data = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Robots-Tag", "noindex, nofollow")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split("?", 1)[0].rstrip("/") or "/"

        if path == "/health":
            return self.send_payload("ok\n", "text/plain; charset=utf-8")
        if path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return
        if not PASSWORD:
            return self.send_payload(
                "METRICS_PASSWORD is not set; refusing to serve business numbers.\n",
                "text/plain; charset=utf-8", 503)
        if not self.authorised():
            self.send_response(401)
            self.send_header("WWW-Authenticate", 'Basic realm="Rebel Creamery metrics", charset="UTF-8"')
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"authentication required\n")
            return

        force = path in ("/api/summary.json", "/metrics")
        payload = get_summary(force=force)

        if path == "/":
            return self.send_payload(render_html(payload), "text/html; charset=utf-8")
        if path == "/api/summary.json":
            return self.send_payload(json.dumps(payload, indent=2), "application/json")
        if path == "/metrics":
            return self.send_payload(prometheus(payload), "text/plain; version=0.0.4; charset=utf-8")
        return self.send_payload("not found\n", "text/plain; charset=utf-8", 404)


def main():
    if not PASSWORD:
        print("METRICS_PASSWORD is empty: the dashboard will answer 503 until it is set.",
              flush=True)
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"creamery metrics on :{PORT} reading {DB_PATH} ({TZ})", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
