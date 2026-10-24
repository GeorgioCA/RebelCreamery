import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { products } from "./catalog.js";

const DATA_DIR = process.env.DATA_DIR || "./data";
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, "store.db"));

db.exec(`
  PRAGMA journal_mode = WAL;
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
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    qty INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS stock (
    product_id TEXT PRIMARY KEY,
    qty INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
`);

const seedStock = db.prepare("INSERT OR IGNORE INTO stock (product_id, qty) VALUES (?, ?)");
for (const p of products) seedStock.run(p.id, p.stock);

export function getStock() {
  const rows = db.prepare("SELECT product_id, qty FROM stock").all();
  return Object.fromEntries(rows.map((r) => [r.product_id, r.qty]));
}

export function setStock(productId, qty) {
  db.prepare("UPDATE stock SET qty = ? WHERE product_id = ?").run(Math.max(0, qty), productId);
}

function nextNumber() {
  const row = db.prepare("SELECT COALESCE(MAX(id), 0) AS m FROM orders").get();
  return `RC-${1000 + row.m + 1}`;
}

export function reserveStock(items) {
  const upd = db.prepare("UPDATE stock SET qty = MAX(0, qty - ?) WHERE product_id = ?");
  for (const it of items) upd.run(it.qty, it.id);
}

export function releaseStock(items) {
  const upd = db.prepare("UPDATE stock SET qty = qty + ? WHERE product_id = ?");
  for (const it of items) upd.run(it.qty, it.id);
}

export function createOrder(o) {
  const number = nextNumber();
  const info = db
    .prepare(
      `INSERT INTO orders
        (number, created_at, name, email, phone, method, address, notes, payment, status,
         subtotal_cents, delivery_cents, total_cents, stripe_session)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      number,
      new Date().toISOString(),
      o.name,
      o.email,
      o.phone || null,
      o.method,
      o.address || null,
      o.notes || null,
      o.payment,
      o.status,
      o.subtotalCents,
      o.deliveryCents,
      o.totalCents,
      o.stripeSession || null
    );
  const orderId = Number(info.lastInsertRowid);
  const ins = db.prepare(
    "INSERT INTO order_items (order_id, product_id, name, price_cents, qty) VALUES (?, ?, ?, ?, ?)"
  );
  for (const it of o.items) ins.run(orderId, it.id, it.name, it.priceCents, it.qty);
  return { id: orderId, number };
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

export function listOrders(limit = 100) {
  const orders = db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT ?").all(limit);
  for (const o of orders) {
    o.items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(o.id);
  }
  return orders;
}

export function markPaid(sessionId, paymentRef) {
  const order = getOrderBySession(sessionId);
  if (!order) return null;
  if (order.status === "pending") {
    db.prepare("UPDATE orders SET status = 'paid', payment = 'card' WHERE id = ?").run(order.id);
  }
  return getOrder(order.number);
}

export function setStatus(number, status) {
  const order = getOrder(number);
  if (!order) return null;
  // Stock is reserved when the order is placed, so cancelling returns it to the cooler.
  if (status === "cancelled" && order.status !== "cancelled") releaseStock(order.items.map((i) => ({ id: i.product_id, qty: i.qty })));
  if (status !== "cancelled" && order.status === "cancelled") reserveStock(order.items.map((i) => ({ id: i.product_id, qty: i.qty })));
  db.prepare("UPDATE orders SET status = ? WHERE number = ?").run(status, number);
  return getOrder(number);
}

export function salesSummary() {
  return db
    .prepare(
      `SELECT COUNT(*) AS orders,
              COALESCE(SUM(total_cents), 0) AS revenue_cents,
              COALESCE(SUM(CASE WHEN status IN ('paid','packed','completed') THEN total_cents ELSE 0 END), 0) AS paid_cents
       FROM orders WHERE status != 'cancelled'`
    )
    .get();
}
