import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { productsSeed } from "./catalog.js";

const DATA_DIR = process.env.DATA_DIR || "./data";
fs.mkdirSync(DATA_DIR, { recursive: true });
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, "store.db"));

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    weight TEXT NOT NULL DEFAULT '',
    price_cents INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    art TEXT NOT NULL DEFAULT 'generic',
    image TEXT,
    stock INTEGER NOT NULL DEFAULT 0,
    max_per_order INTEGER NOT NULL DEFAULT 12,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 100,
    ingredients TEXT NOT NULL DEFAULT '',
    allergens TEXT NOT NULL DEFAULT 'Milk',
    shelf_life_days INTEGER NOT NULL DEFAULT 14,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    method TEXT NOT NULL,
    address TEXT,
    notes TEXT,
    payment TEXT NOT NULL,
    status TEXT NOT NULL,
    subtotal_cents INTEGER NOT NULL,
    delivery_cents INTEGER NOT NULL,
    total_cents INTEGER NOT NULL,
    stripe_session TEXT
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id TEXT NOT NULL,
    sku TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    qty INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS print_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    copies INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'queued',
    created_at TEXT NOT NULL,
    printed_at TEXT,
    error TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS discounts (
    code TEXT PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'percent',
    value INTEGER NOT NULL DEFAULT 0,
    min_subtotal_cents INTEGER NOT NULL DEFAULT 0,
    max_uses INTEGER,
    uses INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_products_sort ON products(sort_order, name);
`);

/* --------------------------- column migrations --------------------------- */
{
  const cols = db.prepare("PRAGMA table_info(products)").all().map((c) => c.name);
  const add = [
    ["ingredients", "ALTER TABLE products ADD COLUMN ingredients TEXT NOT NULL DEFAULT ''"],
    ["allergens", "ALTER TABLE products ADD COLUMN allergens TEXT NOT NULL DEFAULT 'Milk'"],
    ["shelf_life_days", "ALTER TABLE products ADD COLUMN shelf_life_days INTEGER NOT NULL DEFAULT 14"],
    ["sold_out", "ALTER TABLE products ADD COLUMN sold_out INTEGER NOT NULL DEFAULT 0"],
    ["sku", "ALTER TABLE products ADD COLUMN sku TEXT NOT NULL DEFAULT ''"]
  ];
  for (const [name, ddl] of add) if (!cols.includes(name)) db.exec(ddl);
}
{
  const cols = db.prepare("PRAGMA table_info(print_jobs)").all().map((c) => c.name);
  if (!cols.includes("claimed_at")) db.exec("ALTER TABLE print_jobs ADD COLUMN claimed_at TEXT");
}
{
  const cols = db.prepare("PRAGMA table_info(order_items)").all().map((c) => c.name);
  if (!cols.includes("sku")) db.exec("ALTER TABLE order_items ADD COLUMN sku TEXT NOT NULL DEFAULT ''");
}
{
  const cols = db.prepare("PRAGMA table_info(orders)").all().map((c) => c.name);
  if (!cols.includes("discount_cents")) db.exec("ALTER TABLE orders ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0");
  if (!cols.includes("discount_code")) db.exec("ALTER TABLE orders ADD COLUMN discount_code TEXT NOT NULL DEFAULT ''");
}

/* ---------------------------------- SKUs ---------------------------------- */
// Readable codes: RC-<family>-[<fat>|<variant>]-<size>, e.g. RC-YOG-6-750,
// RC-LAB-ZAT-500, RC-BTM-1L. Unique, and editable in the product form.
const SKU_FAMILIES = [
  [/yogurt/i, "YOG"],
  [/cream cheese/i, "CHZ"],
  [/halloumi/i, "HAL"],
  [/buttermilk/i, "BTM"],
  [/butter/i, "BTR"],
  [/ricotta/i, "RIC"],
  [/labneh/i, "LAB"],
  [/cr[eè]me/i, "CRF"],
  [/kefir/i, "KEF"],
  [/^milk/i, "MLK"]
];
const SKU_WORDS = new Set(["the", "with", "and", "of", "cultured", "fresh", "plain"]);
const SKU_FAMILY_WORDS = new Set(["yogurt", "cream", "cheese", "halloumi", "buttermilk", "butter",
  "ricotta", "labneh", "kefir", "milk", "creme", "fraiche"]);
const SIZE_UNITS = { l: "L", ml: "ML", kg: "KG", g: "", oz: "OZ", lb: "LB" };

export function suggestSku(p) {
  const name = String(p.name || "").trim();
  const plain = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const family = (SKU_FAMILIES.find(([re]) => re.test(name)) || [null, "GEN"])[1];
  const parts = [family];

  const fat = name.match(/(\d+(?:\.\d+)?(?:\s*[–-]\s*\d+(?:\.\d+)?)?)\s*%/);
  if (fat) {
    parts.push(fat[1].replace(/\s*[–-]\s*/g, "").replace(/\./g, ""));
  } else {
    // A distinguishing word: "Labneh Za'atar" -> ZAT; initials when there are several.
    const words = plain.replace(/['\u2019]/g, "").replace(/[^A-Za-z ]/g, " ").split(/\s+/)
      .filter((w) => w && !SKU_WORDS.has(w.toLowerCase()) && !SKU_FAMILY_WORDS.has(w.toLowerCase()));
    if (words.length === 1) parts.push(words[0].slice(0, 3).toUpperCase());
    else if (words.length > 1) parts.push(words.map((w) => w[0]).join("").slice(0, 3).toUpperCase());
  }

  const size = String(p.weight || "").match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|oz|lb)?/i);
  if (size) parts.push(`${size[1].replace(/\./g, "")}${SIZE_UNITS[(size[2] || "g").toLowerCase()] ?? ""}`);

  const base = `RC-${parts.filter(Boolean).join("-")}`;
  let sku = base, n = 2;
  while (db.prepare("SELECT 1 FROM products WHERE sku = ? AND id <> ?").get(sku, p.id || "")) sku = `${base}-${n++}`;
  return sku;
}

// Backfill only products that have no SKU at all.
for (const row of db.prepare("SELECT * FROM products WHERE sku = '' ORDER BY created_at, id").all()) {
  db.prepare("UPDATE products SET sku = ? WHERE id = ?").run(suggestSku(rowToProduct(row)), row.id);
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku <> ''");

/* ------------------------------- migration ------------------------------- */
// Older installs kept stock in its own table and products in code. Fold that in once.
const hasStockTable = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stock'")
  .get();
const productCount = db.prepare("SELECT COUNT(*) AS n FROM products").get().n;

if (productCount === 0) {
  const oldStock = hasStockTable
    ? Object.fromEntries(db.prepare("SELECT product_id, qty FROM stock").all().map((r) => [r.product_id, r.qty]))
    : {};
  const ins = db.prepare(
    `INSERT INTO products (id, name, weight, price_cents, note, tags, art, stock, max_per_order,
       active, sort_order, ingredients, allergens, shelf_life_days, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`
  );
  productsSeed.forEach((p, i) => {
    ins.run(p.id, p.name, p.weight, p.priceCents, p.note, JSON.stringify(p.tags), p.art,
      oldStock[p.id] ?? p.stock, p.maxPerOrder, (i + 1) * 10,
      p.ingredients || "", p.allergens || "Milk", p.shelfLifeDays || 14, new Date().toISOString());
  });
}
if (hasStockTable) db.exec("DROP TABLE stock");

/* -------------------------------- products ------------------------------- */

const rowToProduct = (r) => r && ({
  id: r.id,
  sku: r.sku || "",
  name: r.name,
  weight: r.weight,
  priceCents: r.price_cents,
  note: r.note,
  tags: safeTags(r.tags),
  art: r.art,
  image: r.image,
  stock: r.stock,
  maxPerOrder: r.max_per_order,
  active: !!r.active,
  sortOrder: r.sort_order,
  ingredients: r.ingredients,
  allergens: r.allergens,
  shelfLifeDays: r.shelf_life_days,
  soldOut: !!r.sold_out
});

function safeTags(raw) {
  try {
    const t = JSON.parse(raw);
    return Array.isArray(t) ? t.filter((x) => typeof x === "string").slice(0, 8) : [];
  } catch { return []; }
}

export function listProducts({ activeOnly = false } = {}) {
  const rows = activeOnly
    ? db.prepare("SELECT * FROM products WHERE active = 1 ORDER BY sort_order, name").all()
    : db.prepare("SELECT * FROM products ORDER BY active DESC, sort_order, name").all();
  return rows.map(rowToProduct);
}

export function getProduct(id) {
  return rowToProduct(db.prepare("SELECT * FROM products WHERE id = ?").get(id));
}

export function slugify(name) {
  const base = String(name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "product";
  let id = base, n = 2;
  while (db.prepare("SELECT 1 FROM products WHERE id = ?").get(id)) id = `${base}-${n++}`;
  return id;
}

export function saveProduct(p) {
  const now = new Date().toISOString();
  if (p.id) {
    db.prepare(
      `UPDATE products SET sku=?, name=?, weight=?, price_cents=?, note=?, tags=?, art=?, image=?,
       max_per_order=?, active=?, sold_out=?, sort_order=?, ingredients=?, allergens=?, shelf_life_days=? WHERE id=?`
    ).run(p.sku || "", p.name, p.weight, p.priceCents, p.note, JSON.stringify(p.tags || []), p.art,
      p.image ?? null, p.maxPerOrder, p.active ? 1 : 0, p.soldOut ? 1 : 0, p.sortOrder ?? 100,
      p.ingredients || "", p.allergens || "Milk", p.shelfLifeDays || 14, p.id);
    if (Number.isInteger(p.stock)) setStock(p.id, p.stock);
    return getProduct(p.id);
  }
  const id = slugify(p.name);
  db.prepare(
    `INSERT INTO products (id, sku, name, weight, price_cents, note, tags, art, image, stock, max_per_order,
       active, sold_out, sort_order, ingredients, allergens, shelf_life_days, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, p.sku || suggestSku(p), p.name, p.weight, p.priceCents, p.note, JSON.stringify(p.tags || []), p.art,
    p.image ?? null, Math.max(0, p.stock || 0), p.maxPerOrder, p.active ? 1 : 0, p.soldOut ? 1 : 0,
    p.sortOrder ?? 100, p.ingredients || "", p.allergens || "Milk", p.shelfLifeDays || 14, now);
  return getProduct(id);
}

export function setSoldOut(id, flag) {
  db.prepare("UPDATE products SET sold_out = ? WHERE id = ?").run(flag ? 1 : 0, id);
  return getProduct(id);
}

export function deleteProduct(id) {
  db.prepare("DELETE FROM products WHERE id = ?").run(id);
}

export function setStock(id, qty) {
  db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(Math.max(0, qty), id);
}

export function reserveStock(items) {
  const upd = db.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?");
  for (const it of items) upd.run(it.qty, it.id);
}

export function releaseStock(items) {
  const upd = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
  for (const it of items) upd.run(it.qty, it.id);
}

/* --------------------------------- orders -------------------------------- */

function nextNumber() {
  const row = db.prepare("SELECT COALESCE(MAX(id), 0) AS m FROM orders").get();
  return `RC-${1000 + row.m + 1}`;
}

export function createOrder(o) {
  const number = nextNumber();
  const token = randomBytes(16).toString("base64url");
  const info = db
    .prepare(
      `INSERT INTO orders
        (number, token, created_at, name, email, phone, method, address, notes, payment, status,
         subtotal_cents, delivery_cents, total_cents, discount_cents, discount_code, stripe_session)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(number, token, new Date().toISOString(), o.name, o.email, o.phone || null, o.method,
      o.address || null, o.notes || null, o.payment, o.status,
      o.subtotalCents, o.deliveryCents, o.totalCents, o.discountCents || 0, o.discountCode || "", o.stripeSession || null);
  const orderId = Number(info.lastInsertRowid);
  const ins = db.prepare(
    "INSERT INTO order_items (order_id, product_id, sku, name, price_cents, qty) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (const it of o.items) ins.run(orderId, it.id, it.sku || "", it.name, it.priceCents, it.qty);
  return { id: orderId, number, token };
}

export function getOrderByToken(token) {
  if (!token) return null;
  const order = db.prepare("SELECT * FROM orders WHERE token = ?").get(String(token));
  if (!order) return null;
  order.items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(order.id);
  return order;
}

export function getOrder(number) {
  const order = db.prepare("SELECT * FROM orders WHERE number = ?").get(number);
  if (!order) return null;
  order.items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(order.id);
  return order;
}

export function getOrderBySession(sessionId) {
  return db.prepare("SELECT * FROM orders WHERE stripe_session = ?").get(sessionId) || null;
}


/* -------------------------------- discounts ------------------------------- */
export function listDiscounts() {
  return db.prepare("SELECT * FROM discounts ORDER BY created_at DESC").all();
}

export function getDiscount(code) {
  return db.prepare("SELECT * FROM discounts WHERE code = ?").get(String(code || "").toUpperCase()) || null;
}

export function saveDiscount(d) {
  const code = String(d.code || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24);
  if (!code) throw new Error("A code is required.");
  db.prepare(
    `INSERT INTO discounts (code, kind, value, min_subtotal_cents, max_uses, expires_at, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET kind=excluded.kind, value=excluded.value,
       min_subtotal_cents=excluded.min_subtotal_cents, max_uses=excluded.max_uses,
       expires_at=excluded.expires_at, active=excluded.active`
  ).run(code, d.kind === "fixed" ? "fixed" : "percent", Number(d.value) || 0,
    Number(d.minSubtotalCents) || 0, d.maxUses ? Number(d.maxUses) : null,
    d.expiresAt || null, d.active === false ? 0 : 1, new Date().toISOString());
  return getDiscount(code);
}

export function setDiscountActive(code, active) {
  db.prepare("UPDATE discounts SET active = ? WHERE code = ?").run(active ? 1 : 0, String(code).toUpperCase());
}

export function deleteDiscount(code) {
  db.prepare("DELETE FROM discounts WHERE code = ?").run(String(code).toUpperCase());
}

export function useDiscount(code) {
  db.prepare("UPDATE discounts SET uses = uses + 1 WHERE code = ?").run(String(code).toUpperCase());
}

export function listOrders(limit = 100, offset = 0) {
  const orders = db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT ? OFFSET ?").all(limit, offset);
  for (const o of orders) {
    o.items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(o.id);
  }
  return orders;
}

/* Runtime settings live in the database so the shop can be re-configured
   without a redeploy. Environment variables remain the defaults.            */
export function getSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function saveSettings(patch) {
  const stmt = db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) " +
    "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  );
  const now = new Date().toISOString();
  // node:sqlite has no .transaction() helper — a handful of upserts needs none.
  for (const [k, v] of Object.entries(patch)) stmt.run(k, String(v), now);
  return getSettings();
}

export function listOrdersSince(iso) {
  const rows = db.prepare("SELECT * FROM orders WHERE created_at >= ? ORDER BY id ASC").all(iso);
  for (const o of rows) {
    o.items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(o.id);
  }
  return rows;
}

export function listUnpaidEtransfers() {
  // e-Transfer orders never expire — they sit here until somebody checks the bank.
  const rows = db.prepare("SELECT * FROM orders WHERE status = 'awaiting_etransfer' ORDER BY id ASC").all();
  for (const o of rows) {
    o.items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(o.id);
  }
  return rows;
}


/* Search and filters for the order book. `q` matches number, name, email or phone. */
function orderFilter({ q = "", status = "", method = "" } = {}) {
  const where = [], args = [];
  const needle = String(q || "").trim();
  if (needle) {
    where.push("(number LIKE ? OR name LIKE ? OR email LIKE ? OR COALESCE(phone,'') LIKE ?)");
    const like = `%${needle}%`;
    args.push(like, like, like, like);
  }
  if (status) { where.push("status = ?"); args.push(status); }
  if (method) { where.push("method = ?"); args.push(method); }
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", args };
}

/* Whitelist: the sort key is a URL parameter, so it can never reach SQL raw. */
const ORDER_SORTS = {
  number: "number",
  created: "created_at",
  customer: "name",
  fulfilment: "method",
  total: "total_cents",
  status: "status"
};

export function listOrdersFiltered({ q = "", status = "", method = "", sort = "created", dir = "desc", limit = 100, offset = 0 } = {}) {
  const f = orderFilter({ q, status, method });
  const col = ORDER_SORTS[sort] || ORDER_SORTS.created;
  const direction = dir === "asc" ? "ASC" : "DESC";
  const rows = db.prepare(`SELECT * FROM orders ${f.sql} ORDER BY ${col} ${direction}, id DESC LIMIT ? OFFSET ?`).all(...f.args, limit, offset);
  for (const o of rows) o.items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(o.id);
  return rows;
}

export function countOrdersFiltered({ q = "", status = "", method = "" } = {}) {
  const f = orderFilter({ q, status, method });
  return db.prepare(`SELECT COUNT(*) AS n FROM orders ${f.sql}`).get(...f.args).n;
}

export function countOrders() {
  return db.prepare("SELECT COUNT(*) AS n FROM orders").get().n;
}

export function markPaid(sessionId, clientReferenceId = null) {
  // Webhooks arrive at-least-once and can race the checkout flow: look the order
  // up by Stripe session first, then by client_reference_id (the order number)
  // for the rare case where the process died before stripe_session was written.
  const order = getOrderBySession(sessionId) ||
    (clientReferenceId ? getOrder(String(clientReferenceId)) : null);
  if (!order) return null;
  if (order.status === "pending") {
    if (!order.stripe_session) {
      db.prepare("UPDATE orders SET stripe_session = ? WHERE id = ?").run(sessionId, order.id);
    }
    db.prepare("UPDATE orders SET status = 'paid', payment = 'card' WHERE id = ?").run(order.id);
    return getOrder(order.number);
  }
  if (order.status === "cancelled") {
    // Money landed for an order the shop already cancelled. Refunds are manual,
    // so surface it loudly instead of silently reopening the order.
    console.error(`PAYMENT FOR CANCELLED ORDER: ${order.number} — a card payment arrived after cancellation. Refund it in Stripe or set the order back to paid.`);
  }
  return null;
}

export function setStatus(number, status, { moveStock = true } = {}) {
  const order = getOrder(number);
  if (!order) return null;
  // Stock is reserved when the order is placed, so cancelling returns it to the cooler.
  const items = order.items.map((i) => ({ id: i.product_id, qty: i.qty }));
  if (moveStock) {
    if (status === "cancelled" && order.status !== "cancelled") releaseStock(items);
    if (status !== "cancelled" && order.status === "cancelled") reserveStock(items);
  }
  db.prepare("UPDATE orders SET status = ? WHERE number = ?").run(status, number);
  return getOrder(number);
}

// Abandoned card checkouts: the Stripe session dies after 23 h, so anything still
// 'pending' well past that was never paid. Cancelling returns held stock. Only card
// orders expire — e-Transfer orders sit in 'awaiting_etransfer' until handled by hand.
export function expireStalePendingOrders(ttlMs = 48 * 3600 * 1000, { moveStock = true } = {}) {
  const cutoff = new Date(Date.now() - ttlMs).toISOString();
  const stale = db.prepare("SELECT number FROM orders WHERE status = 'pending' AND created_at < ?").all(cutoff);
  for (const { number } of stale) setStatus(number, "cancelled", { moveStock });
  return stale.map((o) => o.number);
}

/* ------------------------------- print jobs ------------------------------ */

// How long a claimed label stays out of the queue before another poll may take it.
const PRINT_LEASE_MS = 5 * 60_000;

export function enqueuePrint(kind, payload, copies = 1) {
  const info = db.prepare(
    "INSERT INTO print_jobs (kind, payload, copies, status, created_at) VALUES (?, ?, ?, 'queued', ?)"
  ).run(kind, JSON.stringify(payload), Math.min(20, Math.max(1, copies)), new Date().toISOString());
  return Number(info.lastInsertRowid);
}

export function claimPrintJobs(limit = 10) {
  // Lease the rows out so two agents (or a restart between print and ack) can't
  // double-print: a claimed row only returns to the queue once its lease lapses.
  const leaseCutoff = new Date(Date.now() - PRINT_LEASE_MS).toISOString();
  const rows = db.prepare(
    `SELECT * FROM print_jobs
     WHERE status = 'queued' OR (status = 'claimed' AND claimed_at < ?)
     ORDER BY id LIMIT ?`
  ).all(leaseCutoff, limit);
  const now = new Date().toISOString();
  const lease = db.prepare("UPDATE print_jobs SET status = 'claimed', claimed_at = ? WHERE id = ?");
  for (const j of rows) lease.run(now, j.id);
  // Report the post-lease status, not the pre-lease snapshot the SELECT saw.
  return rows.map((j) => ({ ...j, status: "claimed", payload: JSON.parse(j.payload) }));
}

export function finishPrintJob(id, status, error = null) {
  if (!["printed", "error", "skipped"].includes(status)) throw new Error("bad print status");
  db.prepare("UPDATE print_jobs SET status = ?, printed_at = ?, error = ? WHERE id = ?")
    .run(status, new Date().toISOString(), error, id);
}

export function printQueueSummary() {
  return db.prepare("SELECT status, COUNT(*) AS n FROM print_jobs GROUP BY status").all();
}

/* Operations summary, not a revenue report: completed and cancelled orders are
   history, so they never appear in these tiles.                              */
export function salesSummary() {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN status IN ('pending','awaiting_etransfer','paid','packed') THEN 1 ELSE 0 END), 0) AS open_orders,
              COALESCE(SUM(CASE WHEN status IN ('pending','awaiting_etransfer','paid','packed') THEN total_cents ELSE 0 END), 0) AS open_cents,
              COALESCE(SUM(CASE WHEN status IN ('pending','awaiting_etransfer') THEN total_cents ELSE 0 END), 0) AS due_cents,
              COALESCE(SUM(CASE WHEN status IN ('paid','packed') THEN total_cents ELSE 0 END), 0) AS paid_cents,
              COALESCE(SUM(CASE WHEN status != 'cancelled' THEN 1 ELSE 0 END), 0) AS lifetime_orders,
              COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_cents ELSE 0 END), 0) AS lifetime_cents
       FROM orders`
    )
    .get();
  return {
    orders: row.open_orders, revenue_cents: row.open_cents, due_cents: row.due_cents, paid_cents: row.paid_cents,
    lifetimeOrders: row.lifetime_orders, lifetimeCents: row.lifetime_cents
  };
}


/* --------------------------- order link migration ------------------------- */
/* Each order gets an unguessable token so customers can open their own order
   page without exposing the sequential order numbers.                        */

try { db.exec("ALTER TABLE orders ADD COLUMN token TEXT"); } catch {}
db.exec("UPDATE orders SET token = lower(hex(randomblob(16))) WHERE token IS NULL OR token = ''");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_token ON orders(token)");
