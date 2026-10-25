import express from "express";
import Stripe from "stripe";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { site, delivery, money, artOptions } from "./lib/catalog.js";
import {
  db, UPLOAD_DIR, claimPrintJobs, createOrder, deleteProduct, enqueuePrint, finishPrintJob,
  getOrder, getOrderByToken, getProduct, listOrders, listProducts, markPaid, printQueueSummary, releaseStock,
  reserveStock, salesSummary, saveProduct, setStatus, setStock
} from "./lib/db.js";
import {
  renderHome, renderCheckout, renderSuccess, renderAdmin, renderProductsAdmin,
  renderProductForm, renderLogin, render404
} from "./lib/views.js";
import { orderLabel, productLabel, renderOrderLabelHTML, renderProductLabelHTML } from "./lib/labels.js";
import { sendOrderConfirmation, sendOrderUpdate, mailConfigured, mailFrom } from "./lib/mail.js";

const PORT = Number(process.env.PORT || 3000);
const BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
// Behind a proxy, derive the public origin from the request when PUBLIC_BASE_URL is unset.
const baseFor = (req) => BASE_URL || `${req.protocol}://${req.get("host")}`;
const DEMO = process.env.DEMO_MODE === "1";
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;
const ETRANSFER_EMAIL = process.env.ETRANSFER_EMAIL || site.email;
const ART_IDS = artOptions.map((a) => a.id);
const PRINT_TOKEN = process.env.PRINT_TOKEN || "";

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
    const session = event.data.object;
    const paidEvent = event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded";
    if (paidEvent && session?.payment_status === "paid") {
      const order = markPaid(session.id);
      if (order) {
        console.log(`paid: ${order.number}`);
        sendOrderConfirmation(order, `${baseFor(req)}/order/${order.token}`);
      }
    }
    res.json({ received: true });
  }
);

app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public", { maxAge: "7d", setHeaders: (res, p) => {
  if (p.endsWith(".html")) res.setHeader("Cache-Control", "no-store");
}}));
app.use("/media", express.static(UPLOAD_DIR, { maxAge: "365d", immutable: true, index: false }));

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
  res.json({
    products: listProducts({ activeOnly: true }).map((p) => ({ id: p.id, stock: p.stock }))
  });
});

app.post("/api/checkout", async (req, res) => {
  let pendingOrder = null;
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

    const catalog = Object.fromEntries(listProducts({ activeOnly: true }).map((p) => [p.id, p]));
    const lines = [];
    for (const raw of items) {
      const p = catalog[raw?.id];
      const qty = Number(raw?.qty);
      if (!p) return res.status(400).json({ error: "That product is no longer available." });
      if (!Number.isInteger(qty) || qty < 1 || qty > p.maxPerOrder) return res.status(400).json({ error: `Invalid quantity for ${p.name}.` });
      lines.push({ id: p.id, name: `${p.name} ${p.weight}`.trim(), priceCents: p.priceCents, qty });
    }

    const wanted = lines.reduce((acc, l) => acc + l.qty, 0);
    for (const l of lines) {
      const available = catalog[l.id].stock ?? 0;
      if (l.qty > available) return res.status(409).json({ error: `Only ${available} of ${l.name} left this week.` });
    }
    if (wanted > 24) return res.status(400).json({ error: "That's a lot of dairy — email us for a bulk order." });

    const subtotalCents = lines.reduce((s, l) => s + l.priceCents * l.qty, 0);
    const deliveryCents = method === "delivery" && subtotalCents < delivery.freeOverCents ? delivery.feeCents : 0;
    const totalCents = subtotalCents + deliveryCents;
    const orderBase = { name: name.trim(), email: email.trim(), phone: phone.trim(), method, address: address.trim(), notes: notes.trim(), items: lines, subtotalCents, deliveryCents, totalCents };

    // Interac e-Transfer: record the order, collect payment out of band.
    if (payment === "etransfer") {
      const { number, token } = createOrder({ ...orderBase, payment: "etransfer", status: "awaiting_etransfer" });
      reserveStock(lines);
      const link = `${baseFor(req)}/order/${token}`;
      sendOrderConfirmation(getOrder(number), link);
      return res.json({ url: `/order/${token}` });
    }

    // Demo mode: simulate a successful card payment so the whole flow is testable without keys.
    if (!stripe) {
      if (!DEMO) return res.status(503).json({ error: "Card payments are not configured yet. Choose e-Transfer, or add Stripe keys." });
      const { number, token } = createOrder({ ...orderBase, payment: "card", status: "paid", stripeSession: "demo" });
      reserveStock(lines);
      sendOrderConfirmation(getOrder(number), `${baseFor(req)}/order/${token}`);
      return res.json({ url: `/order/${token}` });
    }

    const { number, token } = createOrder({ ...orderBase, payment: "card", status: "pending" });
    pendingOrder = number;
    reserveStock(lines);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "auto", // Stripe has no en-CA; auto follows the browser and falls back to English
      customer_email: email.trim(),
      client_reference_id: number,
      metadata: { order_number: number },
      line_items: [
        ...lines.map((l) => ({
          quantity: l.qty,
          price_data: { currency: "cad", unit_amount: l.priceCents, product_data: { name: l.name } }
        })),
        ...(deliveryCents
          ? [{ quantity: 1, price_data: { currency: "cad", unit_amount: deliveryCents, product_data: { name: `Delivery — ${delivery.area}` } } }]
          : [])
      ],
      success_url: `${baseFor(req)}/order/${token}`,
      cancel_url: `${baseFor(req)}/checkout?canceled=1`,
      payment_intent_data: { metadata: { order_number: number } }
    });

    db.prepare("UPDATE orders SET stripe_session = ? WHERE number = ?").run(session.id, number);
    pendingOrder = null;
    res.json({ url: session.url });
  } catch (err) {
    console.error("checkout error:", err);
    // Card session failed after the order row was written: cancel it so the
    // customer isn't left with a phantom order holding stock.
    if (pendingOrder) {
      try { setStatus(pendingOrder, "cancelled"); } catch (e) { console.error("cleanup failed:", e.message); }
    }
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

/* --------------------------------- pages --------------------------------- */

app.get("/", (_req, res) => {
  res.send(renderHome({ products: listProducts({ activeOnly: true }), demo: DEMO && !stripe }));
});

app.get("/checkout", (_req, res) => {
  res.send(renderCheckout({ demo: DEMO && !stripe, canCard: Boolean(stripe), products: listProducts({ activeOnly: true }) }));
});

app.get("/order/:token", (req, res) => {
  res.send(renderSuccess({ order: getOrderByToken(req.params.token), origin: baseFor(req) }));
});

// Staff lookup by order number. Public success links use /order/:token instead.
app.get("/success", adminAuth, (req, res) => {
  res.send(renderSuccess({ order: getOrder(String(req.query.order || "")), origin: baseFor(req) }));
});

app.get("/health", (_req, res) => res.json({ ok: true }));

/* --------------------------------- admin --------------------------------- */

/* ------------------------------- back office auth -------------------------
   Cookie session, because some proxies/CDNs strip the Authorization header from
   browser requests. Basic auth is still accepted for curl and scripts.        */

const SESSION_COOKIE = "admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "dev-secret";

function signSession(user) {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${user}.${exp}`;
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifySession(token) {
  if (!token) return false;
  const [user, exp, sig] = String(token).split(".");
  if (!user || !exp || !sig) return false;
  const expect = crypto.createHmac("sha256", SESSION_SECRET).update(`${user}.${exp}`).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Number(exp) > Date.now() && user === process.env.ADMIN_USER;
}

function readCookie(req, name) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}

function credentialsOk(u, p) {
  const user = process.env.ADMIN_USER, pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass) return false;
  const ea = Buffer.from(String(u)), eb = Buffer.from(user);
  const pa = Buffer.from(String(p)), pb = Buffer.from(pass);
  return ea.length === eb.length && pa.length === pb.length &&
    crypto.timingSafeEqual(ea, eb) && crypto.timingSafeEqual(pa, pb);
}

function isHttps(req) {
  return req.secure || String(req.headers["x-forwarded-proto"] || "").split(",")[0] === "https";
}

function adminAuth(req, res, next) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass) return res.status(503).send("Set ADMIN_USER and ADMIN_PASSWORD to use the back office.");

  if (verifySession(readCookie(req, SESSION_COOKIE))) return next();

  const header = req.headers.authorization || "";
  if (header.startsWith("Basic ")) {
    const [u, p] = Buffer.from(header.slice(6), "base64").toString().split(":");
    if (credentialsOk(u, p)) return next();
  }

  // Browsers get the sign-in page; scripts still get a plain 401.
  const wantsHtml = (req.method === "GET" || req.method === "HEAD") &&
    String(req.headers.accept || "").includes("text/html");
  if (wantsHtml) {
    const next_ = encodeURIComponent(req.originalUrl || "/admin");
    return res.redirect(`/admin/login?next=${next_}`);
  }
  res.set("WWW-Authenticate", 'Basic realm="Order book", charset="UTF-8"');
  res.status(401).send("Authentication required.");
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }[file.mimetype] || ".bin";
      cb(null, `${crypto.randomBytes(8).toString("hex")}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
});

app.get("/admin/login", (req, res) => {
  const next = String(req.query.next || "/admin");
  if (verifySession(readCookie(req, SESSION_COOKIE))) return res.redirect(next.startsWith("/admin") ? next : "/admin");
  res.send(renderLogin({ next: next.startsWith("/admin") ? next : "/admin" }));
});

app.post("/admin/login", (req, res) => {
  const next = String(req.body.next || "/admin");
  const target = next.startsWith("/admin") ? next : "/admin";
  if (limited(`login:${req.ip}`, 10, 10 * 60_000)) {
    return res.status(429).send(renderLogin({ error: "Too many attempts. Wait a few minutes.", next: target }));
  }
  if (!credentialsOk(req.body.username, req.body.password)) {
    return res.status(401).send(renderLogin({ error: "Wrong username or password.", next: target }));
  }
  res.cookie(SESSION_COOKIE, signSession(process.env.ADMIN_USER), {
    httpOnly: true, sameSite: "lax", secure: isHttps(req), maxAge: SESSION_TTL_MS, path: "/"
  });
  res.redirect(target);
});

app.post("/admin/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.redirect("/admin/login");
});

app.get("/admin", adminAuth, (req, res) => {
  res.send(renderAdmin({
    orders: listOrders(100), summary: salesSummary(), products: listProducts(),
    printQueue: printQueueSummary(), queued: req.query.queued === "1"
  }));
});

app.get("/admin/products", adminAuth, (_req, res) => {
  res.send(renderProductsAdmin({ products: listProducts() }));
});

app.get("/admin/products/new", adminAuth, (_req, res) => {
  res.send(renderProductForm({ product: null }));
});

app.get("/admin/products/:id", adminAuth, (req, res) => {
  const product = getProduct(req.params.id);
  if (!product) return res.status(404).send(renderProductForm({ product: null, error: "That product no longer exists." }));
  res.send(renderProductForm({ product, queued: Number(req.query.queued) || 0 }));
});

function parseProductBody(body) {
  const cents = Math.round(Number(String(body.price || "").replace(/[^0-9.]/g, "")) * 100);
  return {
    id: body.id || "",
    name: String(body.name || "").trim(),
    weight: String(body.weight || "").trim(),
    priceCents: Number.isFinite(cents) ? Math.max(0, cents) : NaN,
    note: String(body.note || "").trim(),
    tags: String(body.tags || "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8),
    art: ART_IDS.includes(body.art) ? body.art : "generic",
    stock: Math.max(0, parseInt(body.stock, 10) || 0),
    maxPerOrder: Math.min(50, Math.max(1, parseInt(body.max, 10) || 12)),
    sortOrder: Math.max(0, parseInt(body.sort, 10) || 100),
    active: body.active === "1",
    ingredients: String(body.ingredients || "").trim(),
    allergens: String(body.allergens || "Milk").trim() || "Milk",
    shelfLifeDays: Math.min(365, Math.max(1, parseInt(body.shelf_life_days, 10) || 14)),
    image: null
  };
}

app.post("/admin/products", adminAuth, (req, res) => {
  upload.single("image")(req, res, (uploadErr) => {
    const body = req.body || {};
    const existing = body.id ? getProduct(body.id) : null;
    const draft = { ...(existing || {}), ...parseProductBody(body), image: existing?.image ?? null };

    if (uploadErr) {
      return res.status(400).send(renderProductForm({
        product: draft,
        error: uploadErr.code === "LIMIT_FILE_SIZE"
          ? "That image is larger than 5 MB."
          : "That file isn't a JPG, PNG or WebP image."
      }));
    }
    if (!draft.name) return res.status(400).send(renderProductForm({ product: draft, error: "Give the product a name." }));
    if (!Number.isFinite(draft.priceCents)) return res.status(400).send(renderProductForm({ product: draft, error: "Enter a price in dollars, e.g. 4.49." }));

    if (req.file) {
      draft.image = req.file.filename;
      if (existing?.image) removeUpload(existing.image);
    } else if (body.remove_image === "1") {
      draft.image = null;
      if (existing?.image) removeUpload(existing.image);
    }

    saveProduct(draft);
    res.redirect("/admin/products");
  });
});

app.post("/admin/products/:id/delete", adminAuth, (req, res) => {
  const product = getProduct(req.params.id);
  if (product) {
    deleteProduct(product.id);
    if (product.image) removeUpload(product.image);
  }
  res.redirect("/admin/products");
});

function removeUpload(filename) {
  // Only unlink if no other product still points at the same file.
  const inUse = db.prepare("SELECT 1 FROM products WHERE image = ?").get(filename);
  if (inUse) return;
  fs.promises.unlink(path.join(UPLOAD_DIR, filename)).catch(() => {});
}

app.post("/admin/orders/:number/status", adminAuth, (req, res) => {
  const allowed = ["pending", "awaiting_etransfer", "paid", "packed", "completed", "cancelled"];
  const status = String(req.body.status || "");
  if (!allowed.includes(status)) return res.status(400).send("Bad status.");
  const order = setStatus(req.params.number, status);
  if (order && ["paid", "packed", "completed", "cancelled"].includes(status)) {
    sendOrderUpdate(order, `${baseFor(req)}/order/${order.token}`);
  }
  res.redirect("/admin");
});

app.post("/admin/stock", adminAuth, (req, res) => {
  const id = String(req.body.product_id || "");
  const product = getProduct(id);
  if (product) {
    const delta = Number(req.body.delta);
    if (Number.isInteger(delta) && delta !== 0) {
      setStock(id, Math.max(0, product.stock + delta));       // relative: +1 / −1 buttons
    } else {
      const qty = Number(req.body.qty);
      if (Number.isInteger(qty) && qty >= 0) setStock(id, qty); // absolute: product form
    }
  }
  const back = String(req.body.back || "");
  res.redirect(back.startsWith("/admin") ? back : "/admin");
});

/* --------------------------------- labels -------------------------------- */

app.post("/admin/print/order/:number", adminAuth, (req, res) => {
  const order = getOrder(req.params.number);
  if (!order) return res.status(404).send("No such order.");
  enqueuePrint("order", orderLabel(order), 1);
  res.redirect("/admin?queued=1");
});

app.post("/admin/print/product/:id", adminAuth, (req, res) => {
  const product = getProduct(req.params.id);
  if (!product) return res.status(404).send("No such product.");
  const copies = Math.min(20, Math.max(1, parseInt(req.body.copies, 10) || 1));
  enqueuePrint("product", productLabel(product, copies), copies);
  res.redirect(`/admin/products/${encodeURIComponent(product.id)}?queued=${copies}`);
});

app.get("/admin/labels/order/:number", adminAuth, (req, res) => {
  const order = getOrder(req.params.number);
  if (!order) return res.status(404).send("No such order.");
  res.send(renderOrderLabelHTML(order));
});

app.get("/admin/labels/product/:id", adminAuth, (req, res) => {
  const product = getProduct(req.params.id);
  if (!product) return res.status(404).send("No such product.");
  res.send(renderProductLabelHTML(product));
});

/* ------------------------------ print agent API --------------------------- */

function printAuth(req, res, next) {
  if (!PRINT_TOKEN) return res.status(503).send("Printing is not configured. Set PRINT_TOKEN.");
  const given = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given), b = Buffer.from(PRINT_TOKEN);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
  res.status(401).send("Bad print token.");
}

app.get("/api/print/jobs", printAuth, (req, res) => {
  res.json({ jobs: claimPrintJobs(Math.min(20, Number(req.query.limit) || 10)) });
});

app.post("/api/print/jobs/:id/done", printAuth, (req, res) => {
  try {
    finishPrintJob(Number(req.params.id), String(req.body.status || "printed"), req.body.error || null);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/print/status", printAuth, (_req, res) => {
  res.json({ queue: printQueueSummary(), configured: true });
});

app.use((_req, res) => res.status(404).send(render404()));

app.listen(PORT, () => {
  console.log(`${site.name} on ${BASE_URL || "(request origin)"} (port ${PORT})`);
  console.log(`  stripe: ${stripe ? "live keys" : DEMO ? "DEMO mode (simulated)" : "not configured"}`);
  console.log(`  e-transfer: ${ETRANSFER_EMAIL}`);
  console.log(`  email: ${mailConfigured() ? `Resend via ${mailFrom()}` : "off (no RESEND_API_KEY)"}`);
  console.log(`  products: ${listProducts().length}`);
});
