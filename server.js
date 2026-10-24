import express from "express";
import Stripe from "stripe";
import { site, delivery, products, productsById, money } from "./lib/catalog.js";
import {
  db, createOrder, getOrder, getStock, listOrders, markPaid, releaseStock, reserveStock, salesSummary, setStatus, setStock
} from "./lib/db.js";
import { renderHome, renderCheckout, renderSuccess, renderAdmin, render404 } from "./lib/views.js";

const PORT = Number(process.env.PORT || 3000);
const BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
// Behind Coolify's proxy, derive the public origin from the request when PUBLIC_BASE_URL is unset.
const baseFor = (req) => BASE_URL || `${req.protocol}://${req.get("host")}`;
const DEMO = process.env.DEMO_MODE === "1";
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;
const ETRANSFER_EMAIL = process.env.ETRANSFER_EMAIL || site.email;

const app = express();
app.set("trust proxy", true);
app.disable("x-powered-by");

/* ------------------------------ checkout API ----------------------------- */

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(400).send("webhook not configured");
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("webhook signature failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    if (event.type === "checkout.session.completed") {
      const order = markPaid(event.data.object.id);
      if (order) console.log(`paid: ${order.number}`);
    }
    res.json({ received: true });
  }
);

app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public", { maxAge: "7d", setHeaders: (res, p) => {
  if (p.endsWith(".html")) res.setHeader("Cache-Control", "no-store");
}}));

const buckets = new Map();
function limited(ip, max = 12, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(ip) || { count: 0, reset: now + windowMs };
  if (now > b.reset) { b.count = 0; b.reset = now + windowMs; }
  b.count += 1;
  buckets.set(ip, b);
  return b.count > max;
}

app.get("/api/stock", (_req, res) => {
  const stock = getStock();
  res.json({ products: products.map((p) => ({ id: p.id, stock: stock[p.id] ?? 0 })) });
});

app.post("/api/checkout", async (req, res) => {
  try {
    if (limited(req.ip)) return res.status(429).json({ error: "Too many attempts. Try again in a minute." });

    const { items = [], name = "", email = "", phone = "", method = "pickup", address = "", notes = "", payment = "card" } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Your cart is empty." });
    if (!name.trim() || name.trim().length < 2) return res.status(400).json({ error: "Please enter your name." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: "Please enter a valid email." });
    if (!["pickup", "delivery"].includes(method)) return res.status(400).json({ error: "Choose pickup or delivery." });
    if (!["card", "etransfer"].includes(payment)) return res.status(400).json({ error: "Choose a payment method." });
    if (method === "delivery" && address.trim().length < 8) return res.status(400).json({ error: "A delivery address is required." });
    if (method === "delivery" && !phone.trim()) return res.status(400).json({ error: "A phone number is required for delivery." });

    const stock = getStock();
    const lines = [];
    for (const raw of items) {
      const p = productsById[raw?.id];
      const qty = Number(raw?.qty);
      if (!p) return res.status(400).json({ error: "Unknown product in cart." });
      if (!Number.isInteger(qty) || qty < 1 || qty > p.maxPerOrder) return res.status(400).json({ error: `Invalid quantity for ${p.name}.` });
      lines.push({ id: p.id, name: `${p.name} ${p.weight}`, priceCents: p.priceCents, qty, max: p.maxPerOrder });
    }

    const wanted = lines.reduce((acc, l) => acc + l.qty, 0);
    for (const l of lines) {
      const available = stock[l.id] ?? 0;
      if (l.qty > available) return res.status(409).json({ error: `Only ${available} of ${l.name} left this week.` });
    }
    if (wanted > 24) return res.status(400).json({ error: "That's a lot of dairy — email us for a bulk order." });

    const subtotalCents = lines.reduce((s, l) => s + l.priceCents * l.qty, 0);
    const deliveryCents = method === "delivery" && subtotalCents < delivery.freeOverCents ? delivery.feeCents : 0;
    const totalCents = subtotalCents + deliveryCents;

    // Interac e-Transfer: record the order, collect payment out of band.
    if (payment === "etransfer") {
      const { number } = createOrder({
        name: name.trim(), email: email.trim(), phone: phone.trim(), method, address: address.trim(), notes: notes.trim(),
        payment: "etransfer", status: "awaiting_etransfer", items: lines, subtotalCents, deliveryCents, totalCents
      });
      reserveStock(lines);
      return res.json({ url: `/success?order=${encodeURIComponent(number)}` });
    }

    // Demo mode: simulate a successful card payment so the whole flow is testable without keys.
    if (!stripe) {
      if (!DEMO) return res.status(503).json({ error: "Card payments are not configured yet. Choose e-Transfer, or add Stripe keys." });
      const { number } = createOrder({
        name: name.trim(), email: email.trim(), phone: phone.trim(), method, address: address.trim(), notes: notes.trim(),
        payment: "card", status: "paid", items: lines, subtotalCents, deliveryCents, totalCents, stripeSession: "demo"
      });
      reserveStock(lines);
      return res.json({ url: `/success?order=${encodeURIComponent(number)}` });
    }

    const { number } = createOrder({
      name: name.trim(), email: email.trim(), phone: phone.trim(), method, address: address.trim(), notes: notes.trim(),
      payment: "card", status: "pending", items: lines, subtotalCents, deliveryCents, totalCents
    });
    reserveStock(lines);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "en-CA",
      customer_email: email.trim(),
      client_reference_id: number,
      metadata: { order_number: number },
      line_items: [
        ...lines.map((l) => ({
          quantity: l.qty,
          price_data: {
            currency: "cad",
            unit_amount: l.priceCents,
            product_data: { name: l.name }
          }
        })),
        ...(deliveryCents
          ? [{
              quantity: 1,
              price_data: {
                currency: "cad",
                unit_amount: deliveryCents,
                product_data: { name: `Delivery — ${delivery.area}` }
              }
            }]
          : [])
      ],
      success_url: `${baseFor(req)}/success?order=${encodeURIComponent(number)}`,
      cancel_url: `${baseFor(req)}/checkout?canceled=1`,
      payment_intent_data: { metadata: { order_number: number } }
    });

    db.prepare("UPDATE orders SET stripe_session = ? WHERE number = ?").run(session.id, number);

    res.json({ url: session.url });
  } catch (err) {
    console.error("checkout error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

/* --------------------------------- pages --------------------------------- */

app.get("/", (_req, res) => {
  res.send(renderHome({ stock: getStock(), demo: DEMO && !stripe }));
});

app.get("/checkout", (_req, res) => {
  res.send(renderCheckout({ demo: DEMO && !stripe, canCard: Boolean(stripe) }));
});

app.get("/success", (req, res) => {
  const order = getOrder(String(req.query.order || ""));
  res.send(renderSuccess({ order }));
});

app.get("/health", (_req, res) => res.json({ ok: true }));

/* --------------------------------- admin --------------------------------- */

function adminAuth(req, res, next) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass) return res.status(503).send("Set ADMIN_USER and ADMIN_PASSWORD to use the back office.");
  const header = req.headers.authorization || "";
  if (header.startsWith("Basic ")) {
    const [u, p] = Buffer.from(header.slice(6), "base64").toString().split(":");
    if (u === user && p === pass) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="Order book", charset="UTF-8"');
  res.status(401).send("Authentication required.");
}

app.get("/admin", adminAuth, (_req, res) => {
  res.send(renderAdmin({ orders: listOrders(100), summary: salesSummary(), stock: getStock() }));
});

app.post("/admin/orders/:number/status", adminAuth, (req, res) => {
  const allowed = ["pending", "awaiting_etransfer", "paid", "packed", "completed", "cancelled"];
  const status = String(req.body.status || "");
  if (!allowed.includes(status)) return res.status(400).send("Bad status.");
  setStatus(req.params.number, status);
  res.redirect("/admin");
});

app.post("/admin/stock", adminAuth, (req, res) => {
  const id = String(req.body.product_id || "");
  const qty = Number(req.body.qty);
  if (productsById[id] && Number.isInteger(qty) && qty >= 0) setStock(id, qty);
  res.redirect("/admin");
});

app.use((_req, res) => res.status(404).send(render404()));

app.listen(PORT, () => {
  console.log(`${site.name} on ${BASE_URL || "(request origin)"} (port ${PORT})`);
  console.log(`  stripe: ${stripe ? "live keys" : DEMO ? "DEMO mode (simulated)" : "not configured"}`);
  console.log(`  e-transfer: ${ETRANSFER_EMAIL}`);
});
