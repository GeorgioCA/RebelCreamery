import express from "express";
import Stripe from "stripe";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const DATA_DIR = process.env.DATA_DIR || "./data";
import { site, delivery, money, artOptions, applySettings, priceOf } from "./lib/catalog.js";
import {
  db, UPLOAD_DIR, claimPrintJobs, countOrders, createOrder, deleteProduct, enqueuePrint, expireStalePendingOrders, listUnpaidEtransfers, listOrdersSince,
  finishPrintJob, getOrder, getOrderByToken, getProduct, listOrders, listOrdersFiltered, listProducts, markPaid, printQueueSummary,
  countOrdersFiltered,
  releaseStock, reserveStock, salesSummary, saveProduct, setSoldOut, setStatus, setStock, suggestSku,
  getSettings, saveSettings, listDiscounts, saveDiscount, setDiscountActive, deleteDiscount, useDiscount
} from "./lib/db.js";
import {
  renderHome, renderCheckout, renderSuccess, renderAdmin, renderProductsAdmin,
  renderProductForm, renderLogin, renderOrderAdmin, renderSettings, renderDiscounts, renderRestore, render404
} from "./lib/views.js";
import { orderLabel, productLabel, renderOrderLabelHTML, renderProductLabelHTML } from "./lib/labels.js";
import { evaluateDiscount } from "./lib/discounts.js";
import { runBackup, backupEnabled, lastBackup, listBackups, fetchBackup, snapshotBuffer } from "./lib/backup.js";
import { stageRestore, restoreLog } from "./lib/restore.js";
import { sendOrderConfirmation, sendOrderUpdate, sendOwnerOrderAlert, sendEtransferDigest, sendWeeklySummary, mailConfigured, mailFrom } from "./lib/mail.js";

const PORT = Number(process.env.PORT || 3000);
// Made to order: stock is capacity, not a gate. Set MADE_TO_ORDER=0 to sell against
// counted stock again (and get "N left" / automatic sold-out back).
const MADE_TO_ORDER = process.env.MADE_TO_ORDER !== "0";
const BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
// Behind a proxy, derive the public origin from the request when PUBLIC_BASE_URL is unset.
const baseFor = (req) => BASE_URL || `${req.protocol}://${req.get("host")}`;
const DEMO = process.env.DEMO_MODE === "1";
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;
// Stored settings override the environment defaults for the life of the process.
applySettings(getSettings());
const ART_IDS = artOptions.map((a) => a.id);
const PRINT_TOKEN = process.env.PRINT_TOKEN || "";
// One cap for both the per-product form and the cart total, so an admin can never
// set a per-product max that the checkout then rejects with a confusing error.
const MAX_ITEMS_PER_ORDER = 24;

// A stray rejected promise shouldn't kill the storefront mid-checkout.
process.on("unhandledRejection", (err) => console.error("unhandled rejection:", err));

const app = express();
app.set("trust proxy", true);
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  // 'unsafe-inline' stays until the inline __CATALOG__ script and confirm() handlers move out.
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; " +
      "script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  );
  next();
});

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
      // markPaid only returns the order when pending → paid actually happened,
      // so Stripe's at-least-once retries don't re-send the confirmation email.
      const order = markPaid(session.id, session.client_reference_id);
      if (order) {
        console.log(`paid: ${order.number}`);
        if (order.discount_code) useDiscount(order.discount_code);
        sendOrderConfirmation(order, `${baseFor(req)}/order/${order.token}`);
        sendOwnerOrderAlert(order, `${baseFor(req)}/admin/orders/${order.number}`);
      }
    }
    res.json({ received: true });
  }
);

const PUBLIC_DIR = fileURLToPath(new URL("./public/", import.meta.url));
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(PUBLIC_DIR, { maxAge: "7d", setHeaders: (res, p) => {
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

// Sweep expired buckets so unique visitor IPs can't grow the map forever.
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of buckets) if (now > b.reset) buckets.delete(ip);
}, 10 * 60_000).unref();


/* ------------------------------ addresses -------------------------------- */
// Photon (OpenStreetMap) for street suggestions, Zippopotam for postal lookups.
// Both are free and keyless; results cached in memory so a busy checkout doesn't
// hammer them. Canada Post AddressComplete is the paid upgrade (account + key).

const PROVINCE_BY_NAME = {
  "Alberta": "AB", "British Columbia": "BC", "Saskatchewan": "SK", "Manitoba": "MB",
  "Ontario": "ON", "Quebec": "QC", "New Brunswick": "NB", "Nova Scotia": "NS",
  "Prince Edward Island": "PE", "Newfoundland and Labrador": "NL", "Yukon": "YT",
  "Northwest Territories": "NT", "Nunavut": "NU"
};
const PROVINCE_CODES = new Set(Object.values(PROVINCE_BY_NAME));

function normPostal(value) {
  const s = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 6 ? `${s.slice(0, 3)} ${s.slice(3)}` : String(value || "").toUpperCase().trim();
}
const postalOk = (p) => /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] \d[ABCEGHJ-NPRSTV-Z]\d$/.test(p);

const lookupCache = new Map();
function cached(key, ttlMs, load) {
  const hit = lookupCache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const value = load();
  lookupCache.set(key, { at: Date.now(), value });
  if (lookupCache.size > 500) lookupCache.delete(lookupCache.keys().next().value);
  return value;
}

app.get("/api/stock", (_req, res) => {
  res.json({
    products: listProducts({ activeOnly: true }).map((p) => ({ id: p.id, stock: p.stock }))
  });
});

app.get("/api/postal/:code", async (req, res) => {
  const postal = normPostal(req.params.code);
  const fsa = postal.slice(0, 3);
  if (!/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]$/.test(fsa)) return res.json({ ok: false });
  if (limited(`postal:${req.ip}`, 200, 60 * 60_000)) return res.status(429).json({ ok: false });
  const out = await cached(`pc:${fsa}`, 24 * 60 * 60_000, async () => {
    try {
      const r = await fetch(`https://api.zippopotam.us/CA/${fsa}`, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) return { ok: false };
      const d = await r.json();
      const place = d.places?.[0];
      if (!place) return { ok: false };
      return {
        ok: true,
        city: String(place["place name"] || "").replace(/\s*\(.*\)$/, "").trim(),
        province: PROVINCE_BY_NAME[place.state] || "",
        postal
      };
    } catch { return { ok: false }; }
  });
  res.json(out);
});

app.get("/api/address", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 4) return res.json({ results: [] });
  if (limited(`addr:${req.ip}`, 300, 60 * 60_000)) return res.json({ results: [] });
  const results = await cached(`q:${q.toLowerCase()}`, 6 * 60 * 60_000, async () => {
    try {
      const url = new URL("https://photon.komoot.io/api/");
      url.searchParams.set("q", q);
      url.searchParams.set("limit", "6");
      url.searchParams.set("lang", "en");
      url.searchParams.set("lat", "51.0447");   // bias to Calgary
      url.searchParams.set("lon", "-114.0719");
      const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) return [];
      const d = await r.json();
      return (d.features || [])
        .filter((f) => f.properties?.countrycode === "CA")
        .map((f) => {
          const x = f.properties;
          const [lon, lat] = f.geometry?.coordinates || [];
          const street = [x.housenumber, x.street].filter(Boolean).join(" ");
          const city = x.city || x.town || x.village || x.locality || "";
          // distance from downtown Calgary, so the nearest match wins the list
          const dist = (lat && lon)
            ? Math.hypot((lat - 51.0447) * 111, (lon + 114.0719) * 111 * Math.cos((51.0447 * Math.PI) / 180))
            : 99;
          return {
            label: `${street || x.name}, ${city}${x.postcode ? " " + x.postcode : ""}`.replace(/,\s*$/, ""),
            street,
            city,
            province: PROVINCE_BY_NAME[x.state] || "",
            postal: x.postcode || "",
            dist
          };
        })
        .filter((r) => r.street && r.postal)
        // One row per street+city, with the most common postal code: OSM often
        // repeats the same address with a bad postcode on one POI.
        .reduce((acc, r) => {
          const key = `${r.street}|${r.city}`;
          const hit = acc.find((o) => o.key === key);
          if (!hit) acc.push({ key, ...r, votes: new Map([[r.postal, 1]]) });
          else {
            hit.votes.set(r.postal, (hit.votes.get(r.postal) || 0) + 1);
            hit.dist = Math.min(hit.dist, r.dist);
          }
          return acc;
        }, [])
        .map(({ key, votes, dist, ...r }) => ({
          ...r,
          postal: [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0],
          dist
        }))
        .map((r) => ({ ...r, label: `${r.street}, ${r.city} ${r.postal}`.trim() }))
        .sort((a, b) => a.dist - b.dist)
        .map(({ dist, ...r }) => r);
    } catch { return []; }
  });
  res.json({ results });
});

app.post("/api/checkout", async (req, res) => {
  let pendingOrder = null;
  try {
    if (limited(req.ip)) return res.status(429).json({ error: "Too many attempts. Try again in a minute." });

    const { items = [], name = "", email = "", phone = "", method = "pickup", address = "", unit = "", street = "", city = "", province = "", postal = "", notes = "", payment = "card", code = "" } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Your cart is empty." });
    if (!name.trim() || name.trim().length < 2) return res.status(400).json({ error: "Please enter your name." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: "Please enter a valid email." });
    if (!["pickup", "delivery"].includes(method)) return res.status(400).json({ error: "Choose pickup or delivery." });
    if (!["card", "etransfer"].includes(payment)) return res.status(400).json({ error: "Choose a payment method." });
    // Delivery address: structured parts when the form sends them, plain string otherwise.
    let deliveryAddress = String(address || "").trim();
    if (method === "delivery") {
      const st = String(street || "").trim();
      if (st || city || postal) {
        const ct = String(city || "").trim() || "Calgary";
        const pv = String(province || "AB").toUpperCase();
        const pc = normPostal(postal);
        if (st.length < 3) return res.status(400).json({ error: "Enter the street address." });
        if (!PROVINCE_CODES.has(pv)) return res.status(400).json({ error: "Choose a province." });
        if (!postalOk(pc)) return res.status(400).json({ error: "Enter a postal code like T2R 1B1." });
        const unitTxt = String(unit || "").trim();
        deliveryAddress = `${st}${unitTxt ? `, Unit ${unitTxt}` : ""}, ${ct}, ${pv} ${pc}`;
      } else if (deliveryAddress.length < 8) {
        return res.status(400).json({ error: "A delivery address is required." });
      }
    }
    if (method === "delivery" && !phone.trim()) return res.status(400).json({ error: "A phone number is required for delivery." });

    const catalog = Object.fromEntries(listProducts({ activeOnly: true }).map((p) => [p.id, p]));
    const lines = [];
    for (const raw of items) {
      const p = catalog[raw?.id];
      const qty = Number(raw?.qty);
      if (!p) return res.status(400).json({ error: "That product is no longer available." });
      if (!Number.isInteger(qty) || qty < 1 || qty > p.maxPerOrder) return res.status(400).json({ error: `Invalid quantity for ${p.name}.` });
      lines.push({ id: p.id, sku: p.sku, name: `${p.name} ${p.weight}`.trim(), priceCents: priceOf(p), qty });
    }

    const wanted = lines.reduce((acc, l) => acc + l.qty, 0);
    for (const l of lines) {
      const prod = catalog[l.id];
      if (prod.soldOut) return res.status(409).json({ error: `${l.name} is sold out this week.` });
      if (!MADE_TO_ORDER) {
        const available = prod.stock ?? 0;
        if (l.qty > available) return res.status(409).json({ error: `Only ${available} of ${l.name} left this week.` });
      }
    }
    if (wanted > MAX_ITEMS_PER_ORDER) return res.status(400).json({ error: "That's a lot of dairy — email us for a bulk order." });

    const subtotalCents = lines.reduce((s, l) => s + l.priceCents * l.qty, 0);
    // A code is all-or-nothing: if it doesn't apply, say so rather than quietly charging full price.
    let discount = { ok: false };
    if (String(code || "").trim()) {
      discount = evaluateDiscount(code, subtotalCents);
      if (!discount.ok) return res.status(400).json({ error: discount.error });
    }
    const discountCents = discount.ok ? discount.amountCents : 0;
    const deliveryCents = method === "delivery" && subtotalCents < delivery.freeOverCents ? delivery.feeCents : 0;
    const totalCents = Math.max(0, subtotalCents - discountCents + deliveryCents);
    const orderBase = { name: name.trim(), email: email.trim(), phone: phone.trim(), method, address: deliveryAddress, notes: notes.trim(), items: lines, subtotalCents, deliveryCents, totalCents, discountCents, discountCode: discount.ok ? discount.code : "" };

    // Interac e-Transfer: record the order, collect payment out of band.
    if (payment === "etransfer") {
      const { number, token } = createOrder({ ...orderBase, payment: "etransfer", status: "awaiting_etransfer" });
      if (!MADE_TO_ORDER) reserveStock(lines);
      const link = `${baseFor(req)}/order/${token}`;
      if (discount.ok) useDiscount(discount.code);
      const etransferOrder = getOrder(number);
      sendOrderConfirmation(etransferOrder, link);
      sendOwnerOrderAlert(etransferOrder, `${baseFor(req)}/admin/orders/${number}`);
      return res.json({ url: `/order/${token}` });
    }

    // Demo mode: simulate a successful card payment so the whole flow is testable without keys.
    if (!stripe) {
      if (!DEMO) return res.status(503).json({ error: "Card payments are not configured yet. Choose e-Transfer, or add Stripe keys." });
      const { number, token } = createOrder({ ...orderBase, payment: "card", status: "paid", stripeSession: "demo" });
      if (!MADE_TO_ORDER) reserveStock(lines);
      if (discount.ok) useDiscount(discount.code);
      const demoOrder = getOrder(number);
      sendOrderConfirmation(demoOrder, `${baseFor(req)}/order/${token}`);
      sendOwnerOrderAlert(demoOrder, `${baseFor(req)}/admin/orders/${number}`);
      return res.json({ url: `/order/${token}` });
    }

    const { number, token } = createOrder({ ...orderBase, payment: "card", status: "pending" });
    pendingOrder = number;
    if (!MADE_TO_ORDER) reserveStock(lines);

    // Stripe needs a coupon object; create a one-shot one for this order.
    let couponId = null;
    if (discountCents > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: discountCents,
        currency: "cad",
        duration: "once",
        name: discount.code
      });
      couponId = coupon.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      discounts: couponId ? [{ coupon: couponId }] : undefined,
      locale: "auto", // Stripe has no en-CA; auto follows the browser and falls back to English
      customer_email: email.trim(),
      client_reference_id: number,
      metadata: { order_number: number },
      // Sessions die after 23 h (Stripe's max is 24 h); the 48 h sweep is the backstop.
      expires_at: Math.floor(Date.now() / 1000) + 23 * 60 * 60,
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
    }, { idempotency_key: `checkout-${number}` });

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
  res.send(renderHome({ products: listProducts({ activeOnly: true }), demo: DEMO && !stripe, madeToOrder: MADE_TO_ORDER }));
});

app.get("/checkout", (_req, res) => {
  res.send(renderCheckout({ demo: DEMO && !stripe, canCard: Boolean(stripe), products: listProducts({ activeOnly: true }) }));
});

app.get("/order/:token", (req, res) => {
  res.set("Cache-Control", "no-store"); // order status changes; don't let it get cached
  res.send(renderSuccess({ order: getOrderByToken(req.params.token), origin: baseFor(req) }));
});

// Staff lookup by order number. Public success links use /order/:token instead.
app.get("/success", adminAuth, (req, res) => {
  res.set("Cache-Control", "no-store");
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
  // base64url keeps dots out of the payload, so the token always splits into exactly
  // three parts even when ADMIN_USER itself contains a dot.
  const payload = `${Buffer.from(user).toString("base64url")}.${exp}`;
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifySession(token) {
  if (!token) return false;
  const [userB64, exp, sig] = String(token).split(".");
  if (!userB64 || !exp || !sig) return false;
  let user;
  try { user = Buffer.from(userB64, "base64url").toString(); } catch { return false; }
  const expect = crypto.createHmac("sha256", SESSION_SECRET).update(`${userB64}.${exp}`).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Number(exp) > Date.now() && user === process.env.ADMIN_USER;
}

function readCookie(req, name) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k !== name) continue;
    // A malformed %-sequence in the cookie header would otherwise throw a 500.
    try { return decodeURIComponent(v.join("=")); } catch { return v.join("="); }
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



// Public store description for tools (weekly social generator, site checks).
app.get("/api/store.json", (_req, res) => {
  res.json({
    site: {
      name: site.name, tagline: site.tagline, email: site.email,
      pickupLocation: site.pickupLocation, pickupWindow: site.pickupWindow,
      cutoff: site.cutoff, instagram: site.instagram, etransferEmail: site.etransferEmail
    },
    delivery,
    products: listProducts({ activeOnly: true }).map((p) => ({
      id: p.id, sku: p.sku, name: p.name, weight: p.weight, priceCents: priceOf(p), saleCents: p.saleCents || null, regularCents: p.priceCents,
      note: p.note, tags: p.tags, art: p.art
    }))
  });
});


app.get("/api/discount", (req, res) => {
  if (limited(`disc:${req.ip}`, 30, 60_000)) return res.status(429).json({ ok: false, error: "Too many attempts. Wait a minute." });
  const subtotal = Math.max(0, Math.round(Number(req.query.subtotal) || 0));
  const r = evaluateDiscount(req.query.code, subtotal);
  res.json(r.ok
    ? { ok: true, code: r.code, amountCents: r.amountCents, label: r.label }
    : { ok: false, error: r.error });
});

app.get("/admin/discounts", adminAuth, (req, res) => {
  res.send(renderDiscounts({
    discounts: listDiscounts(),
    saved: req.query.saved === "1",
    error: String(req.query.error || "")
  }));
});

app.post("/admin/discounts", adminAuth, (req, res) => {
  const b = req.body || {};
  const kind = b.kind === "fixed" ? "fixed" : "percent";
  const raw = Number(String(b.value || "").replace(/[^0-9.]/g, ""));
  const value = kind === "fixed" ? Math.round(raw * 100) : Math.round(raw);
  if (!String(b.code || "").trim()) return res.redirect("/admin/discounts?error=" + encodeURIComponent("A code is required."));
  if (!Number.isFinite(value) || value <= 0) return res.redirect("/admin/discounts?error=" + encodeURIComponent("Enter a value above zero."));
  if (kind === "percent" && value > 100) return res.redirect("/admin/discounts?error=" + encodeURIComponent("A percentage can't exceed 100."));
  const expires = String(b.expires || "").trim();
  try {
    saveDiscount({
      code: b.code,
      kind,
      value,
      minSubtotalCents: Math.round((Number(b.min) || 0) * 100),
      maxUses: b.max_uses ? Number(b.max_uses) : null,
      expiresAt: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
      active: true
    });
  } catch (err) {
    return res.redirect("/admin/discounts?error=" + encodeURIComponent(err.message));
  }
  res.redirect("/admin/discounts?saved=1");
});

app.post("/admin/discounts/:code/toggle", adminAuth, (req, res) => {
  const d = listDiscounts().find((x) => x.code === String(req.params.code).toUpperCase());
  if (d) setDiscountActive(d.code, !d.active);
  res.redirect("/admin/discounts?saved=1");
});

app.post("/admin/discounts/:code/delete", adminAuth, (req, res) => {
  deleteDiscount(req.params.code);
  res.redirect("/admin/discounts?saved=1");
});

app.get("/admin/backup/download", adminAuth, (req, res) => {
  try {
    const { day, buffer } = snapshotBuffer();
    res.setHeader("Content-Type", "application/vnd.sqlite3");
    res.setHeader("Content-Disposition", `attachment; filename="rebel-creamery-${day}.sqlite"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
    console.log(`[backup] download ${day}: ${buffer.length} bytes`);
  } catch (err) {
    console.error(`[backup] download failed: ${err.message}`);
    res.redirect(`/admin/settings?backup_error=${encodeURIComponent("Download failed: " + err.message)}`);
  }
});

app.post("/admin/backup", adminAuth, async (req, res) => {
  const out = await runBackup({ manual: true });
  console.log(`[backup] manual: ${out.ok ? "ok" : "FAILED"} ${out.files?.length || 0} file(s)${out.error ? " — " + out.error : ""}`);
  res.redirect(`/admin/settings?${out.ok ? "backed=1" : "backup_error=" + encodeURIComponent(out.error || "failed")}`);
});

app.get("/admin/restore", adminAuth, async (req, res) => {
  let backups = [];
  let error = "";
  if (backupEnabled()) {
    try { backups = await listBackups(); } catch (err) { error = `Could not list snapshots: ${err.message}`; }
  }
  res.send(renderRestore({ backups, error, log: restoreLog(), restoreOn: backupEnabled() }));
});

app.post("/admin/restore", adminAuth, async (req, res) => {
  const file = String(req.body?.file || "");
  const confirm = String(req.body?.confirm || "").trim();
  const day = (file.match(/\d{4}-\d{2}-\d{2}/) || [])[0];

  const fail = async (msg) => {
    let backups = [];
    try { backups = await listBackups(); } catch { /* already failing; show what we can */ }
    res.status(400).send(renderRestore({ backups, error: msg, log: restoreLog(), restoreOn: backupEnabled() }));
  };

  if (!backupEnabled()) return fail("Backblaze isn't configured.");
  if (!day || !new RegExp(`^${(process.env.B2_PREFIX || "rebel-creamery").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/db/${day}\\.sqlite$`).test(file)) {
    return fail("That snapshot name isn't valid.");
  }
  if (confirm !== day) return fail(`Type ${day} exactly to confirm.`);

  try {
    const { snapshot, uploads } = await fetchBackup(file);
    const tmpSnapshot = path.join(DATA_DIR, "restore-download.sqlite");
    fs.writeFileSync(tmpSnapshot, snapshot);
    let tmpUploads = null;
    if (uploads) {
      tmpUploads = path.join(DATA_DIR, "restore-download.tgz");
      fs.writeFileSync(tmpUploads, uploads);
    }
    const counts = stageRestore({ snapshotPath: tmpSnapshot, uploadsPath: tmpUploads, file });
    fs.rmSync(tmpSnapshot, { force: true });
    if (tmpUploads) fs.rmSync(tmpUploads, { force: true });

    console.log(`[restore] staged ${file} (${counts.orders} orders, ${counts.products} products) — restarting`);
    res.send(`<!doctype html><html><head><meta charset="utf-8"/><meta http-equiv="refresh" content="25;url=/admin"/>
      <title>Restoring — ${site.name}</title>
      <style>body{font:16px/1.6 system-ui;background:#fbf7ef;color:#1d2a21;display:grid;place-items:center;height:100vh;margin:0}
      main{max-width:34rem;padding:2rem}code{background:#efe9dc;padding:2px 6px;border-radius:4px}</style></head>
      <body><main><h1>Restoring from ${day}</h1>
      <p>The snapshot passed its integrity check: <strong>${counts.orders} orders, ${counts.products} products</strong>.</p>
      <p>The app is restarting to swap the database. This page returns to the order book in about 25 seconds.</p>
      <p class="muted">Your previous data is kept on the volume as <code>store.db.pre-restore-…</code>.</p>
      </main></body></html>`);
    setTimeout(() => { console.log("[restore] exiting to apply snapshot"); process.exit(0); }, 2000);
  } catch (err) {
    console.error(`[restore] failed: ${err.message}`);
    return fail(`Restore failed: ${err.message}`);
  }
});

app.get("/admin/settings", adminAuth, (req, res) => {
  res.send(renderSettings({
    saved: req.query.saved === "1",
    error: req.query.error || "",
    backed: req.query.backed === "1",
    backupError: req.query.backup_error || "",
    backup: lastBackup(),
    backupOn: backupEnabled()
  }));
});

app.post("/admin/settings", adminAuth, (req, res) => {
  const b = req.body || {};
  const val = (k) => String(b[k] ?? "").trim();
  const cents = (k) => Math.round(Number(val(k) || 0) * 100);
  const bad = (msg) => res.redirect(`/admin/settings?error=${encodeURIComponent(msg)}`);

  if (!val("site_name")) return bad("The shop needs a name.");
  if (!val("pickup_location")) return bad("Pickup address is required.");
  if (!val("pickup_window")) return bad("Pickup window is required.");
  for (const k of ["contact_email", "etransfer_email"]) {
    const v = val(k);
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return bad("That email address does not look right.");
  }
  for (const k of ["delivery_fee", "free_delivery_over"]) {
    const n = Number(val(k) || 0);
    if (!Number.isFinite(n) || n < 0) return bad("Delivery amounts must be zero or more.");
  }

  saveSettings({
    site_name: val("site_name"),
    site_tagline: val("site_tagline"),
    contact_email: val("contact_email"),
    contact_phone: val("contact_phone"),
    instagram: val("instagram"),
    pickup_location: val("pickup_location"),
    pickup_window: val("pickup_window"),
    cutoff_text: val("cutoff_text"),
    delivery_area: val("delivery_area"),
    delivery_windows: val("delivery_windows"),
    delivery_fee_cents: cents("delivery_fee"),
    free_delivery_over_cents: cents("free_delivery_over"),
    etransfer_email: val("etransfer_email"),
    licence_text: val("licence_text")
  });
  applySettings(getSettings());
  res.redirect("/admin/settings?saved=1");
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

const PAGE_SIZE = 100;

app.get("/admin", adminAuth, (req, res) => {
  const filters = {
    q: String(req.query.q || "").slice(0, 60),
    status: String(req.query.status || ""),
    method: String(req.query.method || ""),
    sort: String(req.query.sort || "created"),
    dir: req.query.dir === "asc" ? "asc" : "desc"
  };
  const total = countOrdersFiltered(filters);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, parseInt(req.query.page, 10) || 1), pageCount);
  res.send(renderAdmin({
    orders: listOrdersFiltered({ ...filters, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    summary: salesSummary(), products: listProducts(),
    printQueue: printQueueSummary(), queued: req.query.queued === "1", madeToOrder: MADE_TO_ORDER,
    pager: { page, pageCount, total }, filters
  }));
});

app.get("/admin/products.csv", adminAuth, (req, res) => {
  const rows = [["sku", "name", "weight", "price_cad", "sale_cad", "stock", "status", "sort"]];
  for (const p of listProducts()) {
    rows.push([
      p.sku || "",
      p.name,
      p.weight,
      (p.priceCents / 100).toFixed(2),
      p.saleCents ? (p.saleCents / 100).toFixed(2) : "",
      String(p.stock ?? 0),
      p.soldOut ? "sold out" : p.active ? "live" : "hidden",
      String(p.sortOrder ?? "")
    ]);
  }
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="rebel-creamery-products.csv"');
  res.send("\uFEFF" + csv);
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
  const saleRaw = String(body.sale || "").trim();
  const saleCents = saleRaw ? Math.round(Number(saleRaw.replace(/[^0-9.]/g, "")) * 100) : null;
  return {
    id: body.id || "",
    sku: String(body.sku || "").toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 24),
    name: String(body.name || "").trim(),
    weight: String(body.weight || "").trim(),
    priceCents: Number.isFinite(cents) ? Math.max(0, cents) : NaN,
    saleCents: saleCents === null ? null : Number.isFinite(saleCents) ? Math.max(0, saleCents) : NaN,
    note: String(body.note || "").trim(),
    tags: String(body.tags || "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8),
    art: ART_IDS.includes(body.art) ? body.art : "generic",
    stock: Math.max(0, parseInt(body.stock, 10) || 0),
    maxPerOrder: Math.min(MAX_ITEMS_PER_ORDER, Math.max(1, parseInt(body.max, 10) || 12)),
    sortOrder: Math.max(0, parseInt(body.sort, 10) || 100),
    active: body.active === "1",
    soldOut: body.sold_out === "1",
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
    // An unknown id means "create this product under that id"; saveProduct only
    // updates when an id is present, so clear it and let the slug be generated.
    if (body.id && !existing) body.id = "";
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
    if (draft.saleCents !== null && !Number.isFinite(draft.saleCents)) return res.status(400).send(renderProductForm({ product: draft, error: "Enter the sale price in dollars, or leave it blank." }));
    if (draft.saleCents !== null && draft.saleCents >= draft.priceCents) return res.status(400).send(renderProductForm({ product: draft, error: "The sale price must be below the regular price." }));

    if (req.file) {
      draft.image = req.file.filename;
      if (existing?.image) removeUpload(existing.image);
    } else if (body.remove_image === "1") {
      draft.image = null;
      if (existing?.image) removeUpload(existing.image);
    }

    // SKUs are unique across products; empty means "use the next RC-number".
    if (draft.sku) {
      const clash = listProducts().find((p) => p.sku === draft.sku && p.id !== draft.id);
      if (clash) {
        return res.status(400).send(renderProductForm({
          product: draft,
          error: `SKU ${draft.sku} is already used by ${clash.name}.`
        }));
      }
    } else if (!existing) {
      draft.sku = suggestSku(draft);
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
  const order = setStatus(req.params.number, status, { moveStock: !MADE_TO_ORDER });
  if (order && ["paid", "packed", "completed", "cancelled"].includes(status)) {
    sendOrderUpdate(order, `${baseFor(req)}/order/${order.token}`);
  }
  res.redirect(req.body.back === "order" ? `/admin/orders/${encodeURIComponent(req.params.number)}` : "/admin");
});

app.post("/admin/products/:id/sold-out", adminAuth, (req, res) => {
  const product = getProduct(req.params.id);
  if (!product) return res.status(404).send("No such product.");
  setSoldOut(req.params.id, req.body.sold_out === "1");
  res.redirect(req.body.back === "products" ? "/admin/products" : "/admin");
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

app.get("/admin/orders/:number", adminAuth, (req, res) => {
  const order = getOrder(req.params.number);
  if (!order) return res.status(404).send(render404());
  res.send(renderOrderAdmin({
    order,
    queued: req.query.queued === "1",
    sent: req.query.sent === "1",
    mailFailed: req.query.mail === "0"
  }));
});

app.post("/admin/orders/:number/email", adminAuth, async (req, res) => {
  const order = getOrder(req.params.number);
  if (!order) return res.status(404).send(render404());
  const ok = await sendOrderConfirmation(order, `${baseFor(req)}/order/${order.token}`);
  res.redirect(`/admin/orders/${encodeURIComponent(order.number)}?${ok ? "sent=1" : "mail=0"}`);
});

app.post("/admin/print/order/:number", adminAuth, (req, res) => {
  const order = getOrder(req.params.number);
  if (!order) return res.status(404).send("No such order.");
  enqueuePrint("order", orderLabel(order), 1);
  res.redirect(req.body.back === "order"
    ? `/admin/orders/${encodeURIComponent(order.number)}?queued=1`
    : "/admin?queued=1");
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

/* --------------------------- pending-order expiry ------------------------ */
// Abandoned card checkouts hold stock in counted mode, so cancel anything still
// 'pending' long after its Stripe session could have been paid. Runs once at boot
// (catches orders left hanging while the container was down) and then every 30 min.
// No email: the customer never finished paying. e-Transfer orders never expire.
function sweepPendingOrders() {
  const expired = expireStalePendingOrders(48 * 3600 * 1000, { moveStock: !MADE_TO_ORDER });
  if (expired.length) console.log(`expired unpaid orders: ${expired.join(", ")}`);
}
sweepPendingOrders();
setInterval(sweepPendingOrders, 30 * 60_000).unref();

/* Nightly database + photos backup to B2, 3 am mountain. Guarded by the local
   date so a redeploy at 3 am cannot double-run it.                            */
let backupDay = "";
setInterval(async () => {
  if (!backupEnabled()) return;
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Edmonton", hour: "2-digit", hour12: false, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(now).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
    const day = `${parts.year}-${parts.month}-${parts.day}`;
    if (Number(parts.hour) !== 3 || backupDay === day) return;
    backupDay = day;
    const out = await runBackup();
    console.log(`[backup] ${out.ok ? "ok" : "FAILED"}: ${out.files.join(", ") || out.error}`);
  } catch (err) {
    console.log(`[backup] error: ${err.message}`);
  }
}, 15 * 60_000).unref();



/* e-Transfers arrive with no signal — Koho (like every consumer account) has no
   webhook. So once a morning, mountain time, list the ones still unconfirmed.
   Guarded by the local date so a restart mid-morning can't double-send.        */
const ETRANSFER_DIGEST = process.env.ETRANSFER_DIGEST === "1"; // off unless asked for
let digestDay = "";
setInterval(async () => {
  if (!ETRANSFER_DIGEST) return;
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Edmonton", hour: "2-digit", hour12: false, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(now).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
    const day = `${parts.year}-${parts.month}-${parts.day}`;
    if (Number(parts.hour) !== 8 || digestDay === day) return;
    const unpaid = listUnpaidEtransfers();
    if (!unpaid.length) { digestDay = day; return; }
    digestDay = day;
    const ok = await sendEtransferDigest(unpaid, `${BASE_URL.replace(/\/$/, "")}/admin`);
    console.log(`[digest] ${unpaid.length} unpaid e-transfer(s) -> ${ok ? "sent" : "skipped"}`);
  } catch (err) {
    console.error("[digest] failed:", err.message);
  }
}, 30 * 60 * 1000).unref();

/* Thursday 7 pm, after the cutoff: what to make, who is coming, what is unpaid. */
let summaryWeek = "";
setInterval(async () => {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Edmonton", weekday: "short", hour: "2-digit", hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date()).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
    const day = `${parts.year}-${parts.month}-${parts.day}`;
    if (parts.weekday !== "Thu" || Number(parts.hour) !== 19 || summaryWeek === day) return;
    summaryWeek = day;
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const orders = listOrdersSince(since);
    const ok = await sendWeeklySummary(orders, `${BASE_URL}/admin`);
    console.log(`[summary] ${orders.length} order(s) -> ${ok ? "sent" : "skipped"}`);
  } catch (err) {
    console.error("[summary] failed:", err.message);
  }
}, 30 * 60 * 1000).unref();

app.listen(PORT, () => {
  console.log(`${site.name} on ${BASE_URL || "(request origin)"} (port ${PORT})`);
  console.log(`  stripe: ${stripe ? "live keys" : DEMO ? "DEMO mode (simulated)" : "not configured"}`);
  console.log(`  e-transfer: ${site.etransferEmail}`);
  console.log(`  email: ${mailConfigured() ? `Resend via ${mailFrom()}` : "off (no RESEND_API_KEY)"}`);
  console.log(`  products: ${listProducts().length}`);
});
