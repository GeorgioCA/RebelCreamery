import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { productsSeed, priceOf, plans } from "./catalog.js";
import { applyPendingRestore } from "./restore.js";

const DATA_DIR = process.env.DATA_DIR || "./data";
fs.mkdirSync(DATA_DIR, { recursive: true });
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// A staged restore is applied here, before the file is opened.
const restoredAtBoot = applyPendingRestore();
if (restoredAtBoot) console.log(`[restore] applied ${restoredAtBoot.orders} orders from ${restoredAtBoot.file}`);

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
    subscribable INTEGER NOT NULL DEFAULT 0,
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
  /* Prepaid pickup plans: one row per paid block of weeks, one row per tub.
     The order is the payment record; these tables are the punch card.        */
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL,
    order_item_id INTEGER UNIQUE,
    token TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    unit_cents INTEGER NOT NULL,
    weeks_paid INTEGER NOT NULL,
    weeks_credited INTEGER NOT NULL,
    tubs_per_week INTEGER NOT NULL DEFAULT 1,
    weeks_used INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS subscription_weeks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
    week_no INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    collected_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_products_sort ON products(sort_order, name);
  CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status, expires_at);
  CREATE INDEX IF NOT EXISTS idx_subs_order ON subscriptions(order_number);
  CREATE INDEX IF NOT EXISTS idx_subweeks_sub ON subscription_weeks(subscription_id, week_no);
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
  const cols = db.prepare("PRAGMA table_info(products)").all().map((c) => c.name);
  if (!cols.includes("sale_cents")) db.exec("ALTER TABLE products ADD COLUMN sale_cents INTEGER");
}
{
  const cols = db.prepare("PRAGMA table_info(products)").all().map((c) => c.name);
  if (!cols.includes("subscribable")) {
    db.exec("ALTER TABLE products ADD COLUMN subscribable INTEGER NOT NULL DEFAULT 0");
    // The 6% yogurt is the only SKU sold as a weekly pickup plan today; the
    // product form can turn it on for others.
    db.exec("UPDATE products SET subscribable = 1 WHERE id = 'yogurt-6'");
  }
}
{
  const cols = db.prepare("PRAGMA table_info(subscriptions)").all().map((c) => c.name);
  if (cols.length && !cols.includes("tubs_per_week")) {
    db.exec("ALTER TABLE subscriptions ADD COLUMN tubs_per_week INTEGER NOT NULL DEFAULT 1");
  }
}
{
  const cols = db.prepare("PRAGMA table_info(orders)").all().map((c) => c.name);
  if (!cols.includes("plan_weeks")) db.exec("ALTER TABLE orders ADD COLUMN plan_weeks INTEGER NOT NULL DEFAULT 0");
  if (!cols.includes("plan_product_id")) db.exec("ALTER TABLE orders ADD COLUMN plan_product_id TEXT");
}
{
  const cols = db.prepare("PRAGMA table_info(order_items)").all().map((c) => c.name);
  if (!cols.includes("plan_weeks")) db.exec("ALTER TABLE order_items ADD COLUMN plan_weeks INTEGER NOT NULL DEFAULT 0");
  // Tubs in each week's collection: 1, 2 or 3. Older cards were one a week.
  if (!cols.includes("plan_tubs")) db.exec("ALTER TABLE order_items ADD COLUMN plan_tubs INTEGER NOT NULL DEFAULT 0");
}
{
  // Earlier builds assumed one card per order. A card is now a line item, so an
  // order can hold several (and mix them with ordinary products). SQLite can't
  // drop a UNIQUE clause in place, so rebuild the table around the new key.
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='subscriptions'").get();
  if (row && /order_number\s+TEXT\s+UNIQUE/i.test(row.sql)) {
    db.exec(`
      ALTER TABLE subscriptions RENAME TO subscriptions_v1;
      CREATE TABLE subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT NOT NULL,
        order_item_id INTEGER UNIQUE,
        token TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        unit_cents INTEGER NOT NULL,
        weeks_paid INTEGER NOT NULL,
        weeks_credited INTEGER NOT NULL,
        tubs_per_week INTEGER NOT NULL DEFAULT 1,
        weeks_used INTEGER NOT NULL DEFAULT 0,
        total_cents INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT
      );
      INSERT INTO subscriptions
        (id, order_number, token, created_at, name, email, phone, product_id, product_name,
         unit_cents, weeks_paid, weeks_credited, tubs_per_week, weeks_used, total_cents, expires_at, status, notes)
        SELECT id, order_number, token, created_at, name, email, phone, product_id, product_name,
         unit_cents, weeks_paid, weeks_credited, 1, weeks_used, total_cents, expires_at, status, notes
        FROM subscriptions_v1;
      DROP TABLE subscriptions_v1;
    `);
  }
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
    `INSERT INTO products (id, sku, name, weight, price_cents, note, tags, art, stock, max_per_order,
       active, sort_order, ingredients, allergens, shelf_life_days, subscribable, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`
  );
  productsSeed.forEach((p, i) => {
    ins.run(p.id, p.sku || suggestSku(p), p.name, p.weight, p.priceCents, p.note, JSON.stringify(p.tags), p.art,
      oldStock[p.id] ?? p.stock, p.maxPerOrder, (i + 1) * 10,
      p.ingredients || "", p.allergens || "Milk", p.shelfLifeDays || 14, p.subscribable ? 1 : 0, new Date().toISOString());
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
  saleCents: r.sale_cents || null,
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
  subscribable: !!r.subscribable,
  soldOut: !!r.sold_out
});

// Backfill only products that have no SKU at all.
for (const row of db.prepare("SELECT * FROM products WHERE sku = '' ORDER BY created_at, id").all()) {
  db.prepare("UPDATE products SET sku = ? WHERE id = ?").run(suggestSku(rowToProduct(row)), row.id);
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku <> ''");

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
      `UPDATE products SET sku=?, name=?, weight=?, price_cents=?, sale_cents=?, note=?, tags=?, art=?, image=?,
       max_per_order=?, active=?, sold_out=?, sort_order=?, ingredients=?, allergens=?, shelf_life_days=?, subscribable=? WHERE id=?`
    ).run(p.sku || "", p.name, p.weight, p.priceCents, p.saleCents ?? null, p.note, JSON.stringify(p.tags || []), p.art,
      p.image ?? null, p.maxPerOrder, p.active ? 1 : 0, p.soldOut ? 1 : 0, p.sortOrder ?? 100,
      p.ingredients || "", p.allergens || "Milk", p.shelfLifeDays || 14, p.subscribable ? 1 : 0, p.id);
    if (Number.isInteger(p.stock)) setStock(p.id, p.stock);
    return getProduct(p.id);
  }
  const id = slugify(p.name);
  db.prepare(
    `INSERT INTO products (id, sku, name, weight, price_cents, sale_cents, note, tags, art, image, stock, max_per_order,
       active, sold_out, sort_order, ingredients, allergens, shelf_life_days, subscribable, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, p.sku || suggestSku(p), p.name, p.weight, p.priceCents, p.saleCents ?? null, p.note, JSON.stringify(p.tags || []), p.art,
    p.image ?? null, Math.max(0, p.stock || 0), p.maxPerOrder, p.active ? 1 : 0, p.soldOut ? 1 : 0,
    p.sortOrder ?? 100, p.ingredients || "", p.allergens || "Milk", p.shelfLifeDays || 14, p.subscribable ? 1 : 0, now);
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
         subtotal_cents, delivery_cents, total_cents, discount_cents, discount_code, stripe_session,
         plan_weeks, plan_product_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(number, token, new Date().toISOString(), o.name, o.email, o.phone || null, o.method,
      o.address || null, o.notes || null, o.payment, o.status,
      o.subtotalCents, o.deliveryCents, o.totalCents, o.discountCents || 0, o.discountCode || "", o.stripeSession || null,
      o.planWeeks || 0, o.planProductId || null);
  const orderId = Number(info.lastInsertRowid);
  const ins = db.prepare(
    "INSERT INTO order_items (order_id, product_id, sku, name, price_cents, qty, plan_weeks, plan_tubs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  for (const it of o.items) ins.run(orderId, it.id, it.sku || "", it.name, it.priceCents, it.qty, it.planWeeks || 0, it.planTubs || 0);
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

/* ------------------------------ subscriptions ----------------------------- */
/* A plan is a prepaid punch card: the customer pays for N weeks up front and
   collects one tub per visit. No recurring billing, no card on file — the
   order row is the payment record, these tables are the card.               */

export const PLAN_WEEKS = [4, 8, 12];
// Uncollected weeks stay on the card for a few weeks past the plan length.
export const PLAN_GRACE_WEEKS = 4;

// 12 weeks is paid as 12 and credited as 13 — a bonus tub, not a discount.
export const planCredited = (weeks) => (Number(weeks) >= 12 ? Number(weeks) + 1 : Number(weeks));

// 1..N, where N comes from /admin/settings (plan_max_tubs).
export const planMaxTubs = () => Number(plans.maxTubsPerWeek) || 3;
export const planTubsAllowed = (n) =>
  Number.isInteger(Number(n)) && Number(n) >= 1 && Number(n) <= planMaxTubs();

/* A card is weeks x tubs a week. The 12-week bonus is a free 13th week, so it
   scales with the household instead of being a single extra tub. */
export function planQuote(product, weeks, tubsPerWeek = 1) {
  const paid = Number(weeks);
  const perWeek = Number(tubsPerWeek);
  if (!product || !PLAN_WEEKS.includes(paid) || !planTubsAllowed(perWeek)) return null;
  const unit = priceOf(product);
  const credited = planCredited(paid);
  return {
    weeksPaid: paid,
    weeksCredited: credited,
    tubsPerWeek: perWeek,
    tubsPaid: paid * perWeek,
    tubsCredited: credited * perWeek,
    unitCents: unit,
    totalCents: unit * paid * perWeek
  };
}

export function listSubscriptionsForOrder(orderNumber) {
  return db.prepare("SELECT * FROM subscriptions WHERE order_number = ? ORDER BY id").all(orderNumber).map(withWeeks);
}

export function getSubscription(id) {
  const sub = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(Number(id));
  return sub ? withWeeks(sub) : null;
}

export function getSubscriptionByToken(token) {
  const sub = db.prepare("SELECT * FROM subscriptions WHERE token = ?").get(String(token || ""));
  return sub ? withWeeks(sub) : null;
}

function withWeeks(sub) {
  sub.weeks = db.prepare("SELECT * FROM subscription_weeks WHERE subscription_id = ? ORDER BY week_no").all(sub.id);
  sub.tubs_per_week = Number(sub.tubs_per_week) || 1;
  sub.weeks_remaining = Math.max(0, sub.weeks_credited - sub.weeks_used);
  sub.tubs_total = sub.weeks_credited * sub.tubs_per_week;
  sub.tubs_left = sub.weeks_remaining * sub.tubs_per_week;
  return sub;
}

/* Called when an order becomes paid. Every line with plan_weeks gets its own
   card; a mixed order can mint two. Idempotent on order_item_id, so a Stripe
   retry or an admin re-saving "paid" can't mint a second card.

   Week 1 travels with this order — collected in the bag at pickup, or in the
   delivery box — so the card starts at 1 rather than 0. */
export function activatePlans(order) {
  if (!order?.items?.length) return [];
  const cards = [];
  for (const item of order.items) {
    const weeks = Number(item.plan_weeks) || 0;
    if (weeks <= 0) continue;
    const existing = db.prepare("SELECT id FROM subscriptions WHERE order_item_id = ?").get(item.id);
    if (existing) { cards.push(getSubscription(existing.id)); continue; }

    const product = getProduct(item.product_id);
    const perWeek = Math.max(1, Math.min(3, Number(item.plan_tubs) || 1));
    // Derive the unit from what was actually charged: a discount code reduces
    // the line total, and the refund value has to follow the money.
    const unit = Math.round(item.price_cents / (weeks * perWeek));
    const credited = planCredited(weeks);
    const now = new Date();
    const expires = new Date(now.getTime() + (weeks + PLAN_GRACE_WEEKS) * 7 * 86400_000);

    const info = db.prepare(
      `INSERT INTO subscriptions
        (order_number, order_item_id, token, created_at, name, email, phone, product_id, product_name,
         unit_cents, weeks_paid, weeks_credited, tubs_per_week, weeks_used, total_cents, expires_at, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'active', ?)`
    ).run(order.number, item.id, randomBytes(12).toString("base64url"), now.toISOString(),
      order.name, order.email, order.phone || null, item.product_id,
      product?.name || String(item.name).split(" — ")[0] || "Yogurt",
      unit, weeks, credited, perWeek, item.price_cents, expires.toISOString(), order.notes || null);

    const id = Number(info.lastInsertRowid);
    const ins = db.prepare("INSERT INTO subscription_weeks (subscription_id, week_no, status, collected_at) VALUES (?, ?, ?, ?)");
    for (let w = 1; w <= credited; w++) ins.run(id, w, w === 1 ? "collected" : "pending", w === 1 ? now.toISOString() : null);
    cards.push(getSubscription(id));
  }
  return cards;
}

/* One tap at the counter: take the next uncollected week. */
export function collectWeek(id) {
  const sub = getSubscription(id);
  if (!sub || sub.status !== "active") return sub;
  const next = sub.weeks.find((w) => w.status === "pending");
  if (!next) return sub;
  db.prepare("UPDATE subscription_weeks SET status = 'collected', collected_at = ? WHERE id = ?")
    .run(new Date().toISOString(), next.id);
  const used = sub.weeks_used + 1;
  db.prepare("UPDATE subscriptions SET weeks_used = ?, status = ? WHERE id = ?")
    .run(used, used >= sub.weeks_credited ? "done" : "active", sub.id);
  return getSubscription(sub.id);
}

/* Mis-tap insurance. Only the most recent collection can be undone. */
export function undoWeek(id) {
  const sub = getSubscription(id);
  if (!sub) return null;
  const last = [...sub.weeks].reverse().find((w) => w.status === "collected");
  if (!last) return sub;
  db.prepare("UPDATE subscription_weeks SET status = 'pending', collected_at = NULL WHERE id = ?").run(last.id);
  const used = Math.max(0, sub.weeks_used - 1);
  db.prepare("UPDATE subscriptions SET weeks_used = ?, status = 'active' WHERE id = ?").run(used, sub.id);
  return getSubscription(sub.id);
}

/* Cancelling the order cancels the cards it paid for — but only while nothing
   beyond the tub in that order has been collected. After that it's a refund
   conversation, not a status change. */
export function cancelSubscriptionsForOrder(orderNumber) {
  const cards = listSubscriptionsForOrder(orderNumber).filter((s) => s.status === "active" && s.weeks_used <= 1);
  for (const s of cards) db.prepare("UPDATE subscriptions SET status = 'cancelled' WHERE id = ?").run(s.id);
  return cards.map((s) => s.id);
}

export function listSubscriptions({ status = "" } = {}) {
  const rows = status
    ? db.prepare("SELECT * FROM subscriptions WHERE status = ? ORDER BY id DESC").all(status)
    : db.prepare("SELECT * FROM subscriptions ORDER BY id DESC").all();
  return rows.map(withWeeks);
}

/* Prepaid money that has not been earned yet. Breakage (weeks that expired
   uncollected) is treated as earned — the cash is real and the tub was never
   handed over.                                                            */
export function subscriptionSummary() {
  const rows = db.prepare("SELECT * FROM subscriptions").all();
  let active = 0, unearnedCents = 0, earnedCents = 0, weeksOutstanding = 0, tubsOutstanding = 0;
  for (const s of rows) {
    if (s.status === "active") active += 1;
    const remaining = ["active"].includes(s.status) ? Math.max(0, s.weeks_credited - s.weeks_used) : 0;
    const perWeek = s.weeks_credited ? s.total_cents / s.weeks_credited : 0;
    const unearned = Math.round(perWeek * remaining);
    unearnedCents += unearned;
    earnedCents += s.total_cents - unearned;
    weeksOutstanding += remaining;
    tubsOutstanding += remaining * (Number(s.tubs_per_week) || 1);
  }
  return { active, unearnedCents, earnedCents, weeksOutstanding, tubsOutstanding, total: rows.length };
}

/* Cards whose collection window has closed. Run from the same sweep as the
   abandoned checkouts, so it needs no cron of its own. */
export function expireSubscriptions() {
  const now = new Date().toISOString();
  const stale = db.prepare("SELECT id FROM subscriptions WHERE status = 'active' AND expires_at < ?").all(now);
  for (const { id } of stale) db.prepare("UPDATE subscriptions SET status = 'expired' WHERE id = ?").run(id);
  return stale.map((s) => s.id);
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
