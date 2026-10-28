import { site, delivery, money, artOptions } from "./catalog.js";
import { assetVersion } from "./assets.js";

/* Accept "@handle", "handle" or a full URL, always emit a real https link. */
const igUrl = (v) => {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return "https://instagram.com/" + s.replace(/^@/, "").replace(/\/$/, "");
};

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// JSON embedded in a <script> tag: escape "<" so "</script>" in data can't break out.
const json = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

/* ---------------------------------- art ---------------------------------- */

const art = {
  yogurt: `
  <svg viewBox="0 0 120 140" role="img" aria-label="Yogurt tub illustration" class="art-svg">
    <ellipse cx="60" cy="128" rx="34" ry="4" fill="currentColor" opacity=".12"/>
    <path d="M28 42h64l-8 76a8 8 0 0 1-8 7H44a8 8 0 0 1-8-7z" fill="var(--paper)" stroke="currentColor" stroke-width="2.4"/>
    <path d="M24 34h72v10a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4z" fill="currentColor"/>
    <path d="M39 66h42" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".5"/>
    <text x="60" y="90" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-size="21" fill="currentColor">{{FAT}}</text>
  </svg>`,
  creamcheese: `
  <svg viewBox="0 0 120 140" role="img" aria-label="Cream cheese tub illustration" class="art-svg">
    <ellipse cx="60" cy="126" rx="36" ry="4" fill="currentColor" opacity=".12"/>
    <path d="M26 62h68l-5 52a9 9 0 0 1-9 8H40a9 9 0 0 1-9-8z" fill="var(--paper)" stroke="currentColor" stroke-width="2.4"/>
    <path d="M22 52h76v9a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4z" fill="currentColor"/>
    <path d="M42 84c6-6 12-6 18 0s12 6 18 0" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <circle cx="60" cy="104" r="2.4" fill="currentColor" opacity=".55"/>
  </svg>`,
  halloumi: `
  <svg viewBox="0 0 120 140" role="img" aria-label="Halloumi block illustration" class="art-svg">
    <ellipse cx="60" cy="124" rx="36" ry="4" fill="currentColor" opacity=".12"/>
    <path d="M30 94l30-14 30 14-30 14z" fill="var(--paper)" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M30 94v14l30 14 30-14V94" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M30 78l30-14 30 14-30 14z" fill="var(--paper)" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M30 78v14l30 14 30-14V78" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M41 92l22-11M46 99l22-11" stroke="currentColor" stroke-width="2" opacity=".45" stroke-linecap="round"/>
  </svg>`,
  bottle: `
  <svg viewBox="0 0 120 140" role="img" aria-label="Bottle illustration" class="art-svg">
    <ellipse cx="60" cy="128" rx="26" ry="4" fill="currentColor" opacity=".12"/>
    <path d="M52 16h16v14l6 10v72a8 8 0 0 1-8 8H54a8 8 0 0 1-8-8V40l6-10z" fill="var(--paper)" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>
    <rect x="50" y="10" width="20" height="8" rx="3" fill="currentColor"/>
    <path d="M46 62h28v34H46z" fill="currentColor" opacity=".12"/>
    <path d="M52 72h16M52 82h16" stroke="currentColor" stroke-width="2" opacity=".5" stroke-linecap="round"/>
  </svg>`,
  butter: `
  <svg viewBox="0 0 120 140" role="img" aria-label="Butter block illustration" class="art-svg">
    <ellipse cx="60" cy="122" rx="34" ry="4" fill="currentColor" opacity=".12"/>
    <path d="M28 78l30-16 34 16-30 16z" fill="var(--paper)" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M28 78v20l34 16 30-16V78" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M42 84l18-9" stroke="currentColor" stroke-width="2" opacity=".45" stroke-linecap="round"/>
  </svg>`,
  ricotta: `
  <svg viewBox="0 0 120 140" role="img" aria-label="Ricotta basket illustration" class="art-svg">
    <ellipse cx="60" cy="126" rx="33" ry="4" fill="currentColor" opacity=".12"/>
    <path d="M33 74h54l-5 40a8 8 0 0 1-8 7H46a8 8 0 0 1-8-7z" fill="var(--paper)" stroke="currentColor" stroke-width="2.4"/>
    <path d="M31 68h58v9H31z" fill="currentColor"/>
    <path d="M40 88l40 24M40 100l28 18M40 112l14 9M80 88l-40 30M80 100l-28 22" stroke="currentColor" stroke-width="1.5" opacity=".4" stroke-linecap="round"/>
    <path d="M41 64c3-9 10-14 19-14s16 5 19 14z" fill="var(--paper)" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>
  </svg>`,
  labneh: `
  <svg viewBox="0 0 120 140" role="img" aria-label="Labneh jar illustration" class="art-svg">
    <ellipse cx="60" cy="126" rx="32" ry="4" fill="currentColor" opacity=".12"/>
    <path d="M34 58h52v54a10 10 0 0 1-10 10H44a10 10 0 0 1-10-10z" fill="var(--paper)" stroke="currentColor" stroke-width="2.4"/>
    <path d="M30 50h60v10H30z" fill="currentColor"/>
    <path d="M42 50c0-9 8-15 18-15s18 6 18 15" fill="none" stroke="currentColor" stroke-width="2.4"/>
    <path d="M50 42c4 4 12 4 16 0" stroke="currentColor" stroke-width="2" opacity=".5" stroke-linecap="round"/>
    <path d="M45 74c6-4 12-4 18 0s12 4 18 0" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M52 90h16" stroke="currentColor" stroke-width="2" opacity=".45" stroke-linecap="round"/>
  </svg>`,
  cremefraiche: `
  <svg viewBox="0 0 120 140" role="img" aria-label="Creme fraiche jar illustration" class="art-svg">
    <ellipse cx="60" cy="126" rx="31" ry="4" fill="currentColor" opacity=".12"/>
    <path d="M36 66h48v48a10 10 0 0 1-10 10H46a10 10 0 0 1-10-10z" fill="var(--paper)" stroke="currentColor" stroke-width="2.4"/>
    <path d="M33 57h54v10H33z" fill="currentColor"/>
    <path d="M44 86c5-5 11-5 16 0s11 5 16 0" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M44 100c5-5 11-5 16 0s11 5 16 0" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".5"/>
  </svg>`,
  zatar: `
  <svg viewBox="0 0 120 140" role="img" aria-label="Labneh with za'atar jar illustration" class="art-svg">
    <ellipse cx="60" cy="126" rx="32" ry="4" fill="currentColor" opacity=".12"/>
    <path d="M36 62h48v52a10 10 0 0 1-10 10H46a10 10 0 0 1-10-10z" fill="var(--paper)" stroke="currentColor" stroke-width="2.4"/>
    <path d="M32 53h56v10H32z" fill="currentColor"/>
    <path d="M42 53c0-8 8-13 18-13s18 5 18 13" fill="none" stroke="currentColor" stroke-width="2.4"/>
    <path d="M45 76l4-4M57 71l4 4M68 77l4-4M49 89l4 4M63 87l4-4M72 92l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M44 102c6-5 12-5 18 0s12 5 18 0" stroke="currentColor" stroke-width="2" fill="none" opacity=".5" stroke-linecap="round"/>
  </svg>`,
  generic: `
  <svg viewBox="0 0 120 140" role="img" aria-label="Jar illustration" class="art-svg">
    <ellipse cx="60" cy="128" rx="30" ry="4" fill="currentColor" opacity=".12"/>
    <path d="M32 46h56v70a8 8 0 0 1-8 8H40a8 8 0 0 1-8-8z" fill="var(--paper)" stroke="currentColor" stroke-width="2.4"/>
    <path d="M28 34h64v12H28z" fill="currentColor"/>
    <path d="M44 76h32M44 90h32" stroke="currentColor" stroke-width="2.2" opacity=".45" stroke-linecap="round"/>
  </svg>`
};

/* -------------------------------- layout -------------------------------- */

function layout({ title, description, body, page = "", drawer = true, catalog = [], admin = false, guest = false, section = "" }) {
  return `<!doctype html>
<html lang="en-CA">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(description)}"/>
<meta property="og:type" content="website"/>
<meta name="theme-color" content="#1d2a21"/>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%231d2a21'/%3E%3Cpath d='M16 7c4 4.6 6.4 7.6 6.4 10.6A6.4 6.4 0 0 1 16 24a6.4 6.4 0 0 1-6.4-6.4C9.6 14.6 12 11.6 16 7z' fill='%23f4c95d'/%3E%3C/svg%3E"/>
<link rel="preload" href="/fonts/fraunces-latin.woff2" as="font" type="font/woff2" crossorigin/>
<link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin/>
<link rel="stylesheet" href="/styles.css?v=${assetVersion}"/>
</head>
<body class="page-${esc(page)}">
<a class="skip" href="#main">Skip to content</a>
${admin ? "" : `<div class="announce"><span class="announce-dot" aria-hidden="true"></span>${esc(site.cutoff)} <a href="#shop">Shop the batch</a></div>`}
<header class="site-head${admin ? " site-head-admin" : ""}">
  <div class="wrap head-inner">
    <a class="brand" href="${admin ? "/admin" : "/"}" aria-label="${esc(site.name)} home">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 3c3.2 3.8 5.2 6.2 5.2 8.7A5.2 5.2 0 0 1 12 17a5.2 5.2 0 0 1-5.2-5.3C6.8 9.2 8.8 6.8 12 3z"/></svg>
      </span>
      <span class="brand-name">${esc(site.name)}${admin ? `<span class="admin-tag">Back office</span>` : ""}</span>
    </a>
    ${admin && !guest
      ? `<nav class="nav" aria-label="Back office">
          <a href="/admin"${section === "orders" ? ' aria-current="page"' : ""}>Orders</a>
          <a href="/admin/products"${section === "products" ? ' aria-current="page"' : ""}>Products</a>
          <a href="/admin/discounts"${section === "discounts" ? ' aria-current="page"' : ""}>Discounts</a>
          <a href="/admin/settings"${section === "settings" ? ' aria-current="page"' : ""}>Settings</a>
          <a href="/" target="_blank" rel="noopener">View store ↗</a>
          <form method="post" action="/admin/logout" class="signout"><button type="submit">Sign out</button></form>
        </nav>`
      : guest
      ? `<nav class="nav" aria-label="Store"><a href="/">← Back to the shop</a></nav>`
      : `<nav class="nav" aria-label="Primary">
          <a href="/#shop">Shop</a>
          <a href="/#how">How it works</a>
          <a href="/#story">Our dairy</a>
          ${site.instagram ? `<a href="${esc(igUrl(site.instagram))}" rel="noopener" target="_blank">Instagram</a>` : ""}
        </nav>
        <button class="cart-btn" id="cart-open" aria-controls="cart" aria-expanded="false">
          <span>Cart</span><span class="cart-count" id="cart-count" aria-live="polite">0</span>
        </button>`}
  </div>
</header>
<main id="main">${body}</main>
<footer class="site-foot" id="visit">
  <div class="wrap foot-grid">
    <div>
      <p class="foot-brand">${esc(site.name)}</p>
      <p class="muted">${esc(site.tagline)}</p>
    </div>
    <div>
      <p class="foot-label">Pickup</p>
      <p>${esc(site.pickupLocation)}<br/>${esc(site.pickupWindow)}</p>
    </div>
    <div>
      <p class="foot-label">Delivery</p>
      <p>${esc(delivery.windows)}<br/>${esc(delivery.area)}</p>
    </div>
    <div>
      <p class="foot-label">Contact</p>
      <p><a href="mailto:${esc(site.email)}">${esc(site.email)}</a>${site.phone ? `<br/><a href="tel:${esc(site.phone.replace(/\s/g, ""))}">${esc(site.phone)}</a>` : ""}${site.instagram ? `<br/><a href="${esc(igUrl(site.instagram))}" rel="noopener" target="_blank">Instagram ${esc(String(site.instagram).replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/?$/, ""))}</a>` : ""}</p>
    </div>
  </div>
  <div class="wrap foot-legal">
    <p>${esc(site.licence)}</p>
    <p>© ${new Date().getFullYear()} ${esc(site.name)} · ${esc(site.city)} · <a href="/admin">Staff login</a></p>
  </div>
</footer>
${drawer && !admin ? cartDrawer() : ""}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>window.__CATALOG__=${json(catalog.map(p=>({id:p.id,name:p.name,weight:p.weight,priceCents:p.priceCents,max:p.maxPerOrder})))};window.__DELIVERY__=${json(delivery)};</script>
<script src="/app.js?v=${assetVersion}" defer></script>
</body>
</html>`;
}

function cartDrawer() {
  return `
<div class="cart-backdrop" id="cart-backdrop" hidden></div>
<aside class="cart" id="cart" aria-label="Cart" aria-hidden="true">
  <div class="cart-head">
    <h2>Your cart</h2>
    <button class="icon-btn" id="cart-close" aria-label="Close cart">✕</button>
  </div>
  <div class="cart-body" id="cart-body"></div>
  <div class="cart-foot" id="cart-foot" hidden>
    <div class="cart-line"><span>Subtotal</span><span id="cart-subtotal">$0.00</span></div>
    <p class="cart-note">Pickup is free. Delivery ${money(delivery.feeCents)} — free over ${money(delivery.freeOverCents)}.</p>
    <a class="btn btn-block" id="cart-checkout" href="/checkout">Checkout</a>
  </div>
</aside>`;
}

/* --------------------------------- home --------------------------------- */

// Compact row actions for the order book.
const iconCheck = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>`;
const iconPrint = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 8V3h10v5"/><rect x="3" y="8" width="18" height="8" rx="2"/><path d="M7 16h10v5H7z"/></svg>`;
const iconEye = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;

// The yogurt tub carries the fat percentage. Take it from the name or tags so
// the 3% tub doesn't advertise 6%; products without a percentage get a blank tub.
function fatOf(p) {
  // Handles a single number ("6%") and a range ("0-2%"), normalised to an en dash.
  const m = `${p.name || ""} ${(p.tags || []).join(" ")}`
    .match(/(\d+(?:\.\d+)?(?:\s*[–-]\s*\d+(?:\.\d+)?)?)\s*%/);
  return m ? `${m[1].replace(/\s*[–-]\s*/g, "–")}%` : "";
}

function artFor(p) {
  return (art[p.art] || art.generic).replace(/\{\{FAT\}\}/g, fatOf(p));
}

const tickerPhrase = `<span>Cultured in small batches</span><span class="dot">·</span><span>6% yogurt</span><span class="dot">·</span><span>Cloth-drained cream cheese</span><span class="dot">·</span><span>Grill-ready halloumi</span><span class="dot">·</span>`;

export function renderHome({ products, demo, madeToOrder = true }) {
  const cards = products
    .map((p) => {
      const left = p.stock ?? 0;
      const soldOut = p.soldOut || (!madeToOrder && left <= 0);
      return `
    <article class="card ${soldOut ? "is-soldout" : ""}" data-product="${p.id}">
      <div class="card-art art-${p.art} ${p.image ? "has-photo" : ""}">${p.image ? `<img src="/media/${encodeURIComponent(p.image)}" alt="${esc(p.name)}" loading="lazy"/>` : artFor(p)}</div>
      <div class="card-body">
        <div class="card-top">
          <h3>${esc(p.name)}</h3>
          <span class="card-price">${money(p.priceCents)}</span>
        </div>
        <p class="card-weight">${esc(p.weight)}${soldOut ? " · sold out" : !madeToOrder && left <= 4 ? ` · ${left} left` : ""}</p>
        <p class="card-note">${esc(p.note)}</p>
        <ul class="tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        <div class="card-actions">
          <div class="stepper" role="group" aria-label="Quantity for ${esc(p.name)}">
            <button type="button" data-step="-1" aria-label="Decrease quantity">−</button>
            <input type="number" min="0" max="${p.maxPerOrder}" value="1" inputmode="numeric" aria-label="Quantity" ${soldOut ? "disabled" : ""}/>
            <button type="button" data-step="1" aria-label="Increase quantity">+</button>
          </div>
          <button class="btn btn-add" data-add="${p.id}" ${soldOut ? "disabled" : ""}>${soldOut ? "Sold out" : "Add"}</button>
        </div>
      </div>
    </article>`;
    })
    .join("");

  return layout({
    title: `${site.name} — ${site.tagline}`,
    description: `${site.name} makes small-batch yogurt, cream cheese and halloumi in ${site.city}. Pickup ${site.pickupWindow}, or Friday delivery.`,
    page: "home",
    catalog: products,
    body: `
<section class="hero wrap">
  <div class="hero-copy">
    <p class="eyebrow"><span class="rule" aria-hidden="true"></span>${esc(site.city)} · small-batch dairy</p>
    <h1>Dairy,<br/><em>done slowly.</em></h1>
    <p class="lede">Yogurt, cream cheese and halloumi made in small batches from Alberta milk. Nothing added to stretch it — just cultures, rennet, salt and time.</p>
    <div class="hero-cta">
      <a class="btn" href="#shop">Shop this week's batch</a>
      <a class="link-arrow" href="#how">How pickup works <span aria-hidden="true">→</span></a>
    </div>
    <dl class="hero-facts">
      <div><dt>Cultured weekly</dt><dd>Made in batches of 40 L or less</dd></div>
      <div><dt>Two ways to get it</dt><dd>Saturday pickup · Friday delivery</dd></div>
      <div><dt>Short ingredient list</dt><dd>Milk, cream, cultures, rennet, salt</dd></div>
    </dl>
  </div>
  <div class="hero-art" aria-hidden="true">
    <div class="blob"></div>
    <div class="art-pos art-pos-1">${art.halloumi}</div>
    <div class="art-pos art-pos-2">${art.yogurt.replace("{{FAT}}", "6%")}</div>
    <div class="art-pos art-pos-3">${art.creamcheese}</div>
    <div class="stamp"><span>Made in<br/>Calgary</span></div>
  </div>
</section>

<div class="ticker" aria-hidden="true">
  <div class="ticker-track">
    <div class="ticker-group">${tickerPhrase.repeat(2)}</div>
    <div class="ticker-group">${tickerPhrase.repeat(2)}</div>
  </div>
</div>

<section class="shop wrap" id="shop">
  <div class="section-head">
    <div>
      <p class="eyebrow"><span class="rule" aria-hidden="true"></span>This week</p>
      <h2>The batch</h2>
    </div>
    <p class="section-note">${esc(site.cutoff)}. Stock counts are what's left in the cooler.</p>
  </div>
  ${demo ? `<p class="demo-banner">Demo mode — card payments are simulated until Stripe keys are added. e-Transfer orders are recorded normally.</p>` : ""}
  <div class="grid-products">${cards}</div>
</section>

<section class="how wrap" id="how">
  <div class="section-head">
    <div>
      <p class="eyebrow"><span class="rule" aria-hidden="true"></span>Simple by design</p>
      <h2>How it works</h2>
    </div>
  </div>
  <ol class="steps">
    <li>
      <span class="step-n">01</span>
      <h3>Order by Thursday</h3>
      <p>We make to order. Thursday 6 pm is the cutoff so the batch is cultured, drained and packed in time.</p>
    </li>
    <li>
      <span class="step-n">02</span>
      <h3>Pay your way</h3>
      <p>Card at checkout, or Interac e-Transfer. Cards are handled by Stripe — we never see the number.</p>
    </li>
    <li>
      <span class="step-n">03</span>
      <h3>Pick up or get it delivered</h3>
      <p>${esc(site.pickupWindow)} at ${esc(site.pickupLocation)}. Or Friday delivery across ${esc(delivery.area)}.</p>
    </li>
  </ol>
</section>

<section class="story" id="story">
  <div class="wrap story-grid">
    <div class="story-art" aria-hidden="true"><div class="story-ring"></div>${art.yogurt.replace("{{FAT}}", "6%")}</div>
    <div class="story-copy">
      <p class="eyebrow"><span class="rule" aria-hidden="true"></span>Our dairy</p>
      <h2>Fewer ingredients.<br/>More patience.</h2>
      <p>Most commercial yogurt is thickened with modified milk ingredients and stabilisers so it can survive a truck. Ours is cultured until the culture says it's done, then chilled.</p>
      <p>The cream cheese is drained in cloth overnight instead of being firmed up with gums. The halloumi is brined for a full day, which is why it squeaks when you bite it and why it holds its shape on the grill.</p>
      <ul class="facts">
        <li><span>40 L</span> largest batch we run</li>
        <li><span>0</span> gums, fillers or modified milk</li>
        <li><span>24 h</span> brine on every halloumi</li>
      </ul>
    </div>
  </div>
</section>`
  });
}

/* ------------------------------- checkout ------------------------------- */

export function renderCheckout({ demo, canCard = true, products = [] }) {
  const cardOff = !canCard && !demo;
  return layout({
    title: `Checkout — ${site.name}`,
    description: `Checkout for ${site.name}.`,
    page: "checkout",
    catalog: products,
    body: `
<section class="wrap checkout-page">
  <div class="checkout-main">
    <p class="eyebrow"><span class="rule" aria-hidden="true"></span>Checkout</p>
    <h1 class="h1-small">Where's this going?</h1>

    <form id="checkout-form" novalidate>
      <fieldset class="field-group">
        <legend>Your details</legend>
        <label>Name<input name="name" autocomplete="name" required/></label>
        <div class="two">
          <label>Email<input name="email" type="email" autocomplete="email" required/></label>
          <label>Phone<input name="phone" type="tel" autocomplete="tel" placeholder="For delivery or order updates"/></label>
        </div>
      </fieldset>

      <fieldset class="field-group">
        <legend>Pickup or delivery</legend>
        <div class="choice-grid">
          <label class="choice">
            <input type="radio" name="method" value="pickup" checked/>
            <span class="choice-body">
              <span class="choice-title">Pickup — free</span>
              <span class="choice-sub">${esc(site.pickupWindow)}<br/>${esc(site.pickupLocation)}</span>
            </span>
          </label>
          <label class="choice">
            <input type="radio" name="method" value="delivery"/>
            <span class="choice-body">
              <span class="choice-title">Delivery — <span id="delivery-fee-label">${money(delivery.feeCents)}</span></span>
              <span class="choice-sub">${esc(delivery.windows)}<br/>${esc(delivery.area)} · free over ${money(delivery.freeOverCents)}</span>
            </span>
          </label>
        </div>
        <div class="address" id="address-field" hidden>
          <p class="field-label">Delivery address</p>
          <div class="two">
            <label>Unit <span class="muted small">optional</span><input name="unit" placeholder="204"/></label>
            <label>Street <span class="req">required</span>
              <span class="addr-wrap">
                <input name="street" autocomplete="address-line1" placeholder="Start typing the street…" aria-autocomplete="list" aria-controls="addr-suggest"/>
                <ul class="addr-suggest" id="addr-suggest" role="listbox" hidden></ul>
              </span>
            </label>
          </div>
          <div class="two">
            <label>City<input name="city" value="Calgary" autocomplete="address-level2"/></label>
            <label>Province
              <select name="province" autocomplete="address-level1">
                ${["AB","BC","SK","MB","ON","QC","NB","NS","PE","NL","YT","NT","NU"].map((p) => `<option value="${p}"${p === "AB" ? " selected" : ""}>${p}</option>`).join("")}
              </select>
            </label>
          </div>
          <label>Postal code<input name="postal" autocomplete="postal-code" maxlength="7" placeholder="T2R 1B1"/></label>
          <p class="fineprint">Type the street and pick a suggestion — city, province and postal code fill in. Or enter it all by hand.</p>
        </div>
      </fieldset>

      <fieldset class="field-group">
        <legend>Payment</legend>
        <div class="choice-grid">
          <label class="choice">
            <input type="radio" name="payment" value="card" ${cardOff ? "disabled" : "checked"}/>
            <span class="choice-body">
              <span class="choice-title">Card${cardOff ? " — not enabled yet" : ""}</span>
              <span class="choice-sub">${cardOff ? "Stripe keys are not configured. Use e-Transfer for now." : "Visa, Mastercard, Amex, Apple Pay. You finish on Stripe&rsquo;s secure page."}</span>
            </span>
          </label>
          <label class="choice">
            <input type="radio" name="payment" value="etransfer" ${cardOff ? "checked" : ""}/>
            <span class="choice-body">
              <span class="choice-title">Interac e-Transfer</span>
              <span class="choice-sub">Send to ${esc(site.etransferEmail)}. We pack once it lands.</span>
            </span>
          </label>
        </div>
      </fieldset>

      <label class="notes">Notes for the batch<textarea name="notes" rows="2" placeholder="Allergies, gate code, or a note on the order"></textarea></label>

      <p class="form-error" id="form-error" role="alert" hidden></p>
      <button class="btn btn-block" type="submit" id="place-order">Place order</button>
      <p class="fineprint">By ordering you agree to pick up or receive delivery in the window above. Perishable food — no refunds once collected.</p>
    </form>
  </div>

  <aside class="checkout-aside">
    <div class="summary">
      <h2>Your order</h2>
      <div id="checkout-items"></div>
      <div class="discount-box">
        <label for="discount-code">Discount code</label>
        <div class="discount-row">
          <input id="discount-code" name="code" placeholder="Optional" autocomplete="off" spellcheck="false"/>
          <button class="btn btn-small" type="button" id="discount-apply">Apply</button>
        </div>
        <p class="discount-msg" id="discount-msg" role="status"></p>
      </div>
      <div class="summary-line"><span>Subtotal</span><span id="sum-subtotal">$0.00</span></div>
      <div class="summary-line" id="sum-delivery-row" hidden><span>Delivery</span><span id="sum-delivery">$0.00</span></div>
      <div class="summary-line" id="sum-discount-row" hidden><span id="sum-discount-label">Discount</span><span id="sum-discount">−$0.00</span></div>
      <div class="summary-line total"><span>Total</span><span id="sum-total">$0.00</span></div>
      <p class="fineprint">Food sold as basic groceries is zero-rated — no GST is charged.</p>
      <a class="link-arrow" href="/#shop">← Keep shopping</a>
    </div>
  </aside>
</section>`
  });
}

/* -------------------------------- success ------------------------------- */

const ORDER_STATUS = {
  pending: "Awaiting payment",
  awaiting_etransfer: "Awaiting e-Transfer",
  paid: "Paid",
  packed: "Packed",
  completed: "Completed",
  cancelled: "Cancelled"
};

export function renderSuccess({ order, origin = "" }) {
  if (!order) {
    return layout({
      title: `Order not found — ${site.name}`,
      description: "We couldn't find that order.",
      page: "success",
      body: `<section class="wrap narrow center-block"><h1 class="h1-small">Order not found</h1><p>That order number doesn't match anything in the book. <a href="/">Back to the shop</a>.</p></section>`
    });
  }
  const etransfer = order.payment === "etransfer" && order.status === "awaiting_etransfer";
  const items = order.items
    .map(
      (it) => `<li><span>${esc(it.name)} × ${it.qty}</span><span>${money(it.price_cents * it.qty)}</span></li>`
    )
    .join("");
  return layout({
    title: `Order ${order.number} — ${site.name}`,
    description: `Thank you — order ${order.number}.`,
    page: "success",
    body: `
<section class="wrap narrow success">
  <p class="eyebrow"><span class="rule" aria-hidden="true"></span>Order ${esc(order.number)}</p>
  <h1 class="h1-small">${etransfer ? "Almost there." : "You're in the batch."}</h1>
  <p class="order-status status-${esc(order.status)}">${esc(ORDER_STATUS[order.status] || order.status)}</p>
  <p class="lede small">${etransfer ? "Send the e-Transfer and we'll pack your order." : "Your order is in the book — we'll have it packed for the next batch."}</p>

  <div class="order-link">
    <p class="foot-label">Your order link</p>
    <div class="link-row">
      <code>${esc(origin)}/order/${esc(order.token || "")}</code>
      <button type="button" class="copy-btn" data-copy="${esc(origin)}/order/${esc(order.token || "")}">Copy link</button>
    </div>
    <p class="fineprint">Bookmark this link — it shows your order, total and status any time. No account needed.</p>
  </div>

  ${etransfer ? `
  <div class="etransfer-box">
    <p class="foot-label">Interac e-Transfer</p>
    <p class="big">${money(order.total_cents)}</p>
    <p>Send to <strong>${esc(site.etransferEmail)}</strong><br/>
       Message: <strong>${esc(order.number)}</strong><br/>
       No security question needed — auto-deposit is on.</p>
  </div>` : ""}

  <div class="receipt">
    <ul class="receipt-items">${items}</ul>
    <div class="summary-line"><span>Subtotal</span><span>${money(order.subtotal_cents)}</span></div>
    ${order.delivery_cents ? `<div class="summary-line"><span>Delivery</span><span>${money(order.delivery_cents)}</span></div>` : ""}
    ${order.discount_cents ? `<div class="summary-line"><span>Discount${order.discount_code ? ` · ${esc(order.discount_code)}` : ""}</span><span>−${money(order.discount_cents)}</span></div>` : ""}
    <div class="summary-line total"><span>Total</span><span>${money(order.total_cents)}</span></div>
  </div>

  <div class="next-steps">
    <h2>What happens next</h2>
    <p><strong>${order.method === "pickup" ? "Pickup" : "Delivery"}:</strong>
      ${order.method === "pickup" ? esc(site.pickupWindow) + " at " + esc(site.pickupLocation) : esc(delivery.windows) + " — " + esc(order.address || "")}</p>
    <p>Bring this order number or your name. Everything is packed cold and labelled.</p>
    <p>Need to change something? Write to <a href="mailto:${esc(site.email)}">${esc(site.email)}</a> and quote order ${esc(order.number)}.</p>
  </div>
</section>`
  });
}

/* --------------------------------- admin -------------------------------- */

export function renderAdmin({ orders, summary, products, printQueue = [], queued = false, madeToOrder = true, pager = null, filters = {} }) {
  const sortHeader = (key, label) => {
    const current = filters.sort || "created";
    const dir = filters.dir === "asc" ? "asc" : "desc";
    const active = current === key;
    const next = active && dir === "desc" ? "asc" : "desc";
    const u = new URLSearchParams();
    if (filters.q) u.set("q", filters.q);
    if (filters.status) u.set("status", filters.status);
    if (filters.method) u.set("method", filters.method);
    u.set("sort", key);
    u.set("dir", active ? next : "asc");
    const arrow = active ? (dir === "asc" ? " ▲" : " ▼") : "";
    return `<th${active ? ` aria-sort="${dir === "asc" ? "ascending" : "descending"}"` : ""}><a class="th-sort" href="/admin?${u.toString()}">${label}${arrow}</a></th>`;
  };

  const qs = (page) => {
    const u = new URLSearchParams();
    if (filters.q) u.set("q", filters.q);
    if (filters.status) u.set("status", filters.status);
    if (filters.method) u.set("method", filters.method);
    if (filters.sort && filters.sort !== "created") u.set("sort", filters.sort);
    if (filters.sort && filters.sort !== "created" && filters.dir === "asc") u.set("dir", "asc");
    if (page && page > 1) u.set("page", String(page));
    const s = u.toString();
    return s ? `?${s}` : "";
  };
  const rows = orders
    .map((o) => {
      const items = o.items.map((i) => `${i.qty}× ${i.name}`).join(", ");
      return `<tr>
        <td><a href="/admin/orders/${encodeURIComponent(o.number)}"><strong>${esc(o.number)}</strong></a><br/><span class="muted small">${esc(new Date(o.created_at).toLocaleString("en-CA", { timeZone: "America/Edmonton" }))}</span></td>
        <td>${esc(o.name)}<br/><span class="muted small">${esc(o.email)}${o.phone ? " · " + esc(o.phone) : ""}</span></td>
        <td>${esc(items)}</td>
        <td>${o.method === "pickup" ? "Pickup" : "Delivery"}<br/><span class="muted small">${esc(o.address || "")}</span></td>
        <td>${money(o.total_cents)}<br/><span class="muted small">${esc(o.payment)}</span></td>
        <td><span class="badge badge-${esc(o.status)}">${esc(o.status.replace(/_/g, " "))}</span></td>
        <td>
          <div class="row-tools">
            <form method="post" action="/admin/orders/${esc(o.number)}/status" class="status-pick">
              <select name="status" aria-label="Status for ${esc(o.number)}">
                ${["pending", "awaiting_etransfer", "paid", "packed", "completed", "cancelled"]
                  .map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s.replace(/_/g, " ")}</option>`)
                  .join("")}
              </select>
              <button class="icon-btn" type="submit" title="Save status" aria-label="Save status for ${esc(o.number)}">${iconCheck}</button>
            </form>
            <form method="post" action="/admin/print/order/${encodeURIComponent(o.number)}">
              <button class="icon-btn" type="submit" title="Queue a label" aria-label="Queue a label for ${esc(o.number)}">${iconPrint}</button>
            </form>
            <a class="icon-btn" href="/admin/orders/${encodeURIComponent(o.number)}" title="View order" aria-label="View order ${esc(o.number)}">${iconEye}</a>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  return layout({
    title: `Orders — ${site.name}`,
    description: "Order book.",
    page: "admin",
    drawer: false,
    admin: true,
    section: "orders",
    body: `
<section class="wrap admin">
  <div class="section-head">
    <div><p class="eyebrow"><span class="rule" aria-hidden="true"></span>Back office</p><h1 class="h1-small">Order book</h1></div>
    <p class="section-note">All figures CAD. ${madeToOrder ? "Made to order — capacity is a note, not a limit." : "Stock is reserved when an order is placed and returned if it is cancelled."}</p>
  </div>
  <p class="admin-nav"><a class="btn btn-small" href="/admin/products">Manage products</a>
    <a class="btn btn-small" href="/admin/settings">Settings</a>
    <span class="muted small">Labels ${printQueue.filter(q => q.status === "queued" || q.status === "claimed").map(q => q.n).reduce((a, b) => a + b, 0) || 0} queued</span></p>
  ${queued ? `<p class="notice">Label queued — the print agent picks it up within a few seconds.</p>` : ""}
  <div class="stat-row">
    <div class="stat"><span>${summary.orders}</span><p>open orders</p></div>
    <div class="stat"><span>${money(summary.due_cents)}</span><p>awaiting payment</p></div>
    <div class="stat"><span>${money(summary.paid_cents)}</span><p>paid, to fulfil</p></div>
    <div class="stat"><span>${money(summary.lifetimeCents)}</span><p>lifetime · ${summary.lifetimeOrders} ${summary.lifetimeOrders === 1 ? "order" : "orders"}</p></div>
  </div>
  <form class="order-filter" method="get" action="/admin" role="search">
    <input type="search" name="q" value="${esc(filters.q || "")}" placeholder="Order number, name, email or phone" aria-label="Search orders"/>
    <select name="status" aria-label="Filter by status">
      <option value="">Any status</option>
      ${["pending", "awaiting_etransfer", "paid", "packed", "completed", "cancelled"]
        .map((s) => `<option value="${s}" ${filters.status === s ? "selected" : ""}>${s.replace(/_/g, " ")}</option>`)
        .join("")}
    </select>
    <select name="method" aria-label="Filter by fulfilment">
      <option value="">Any method</option>
      <option value="pickup" ${filters.method === "pickup" ? "selected" : ""}>Pickup</option>
      <option value="delivery" ${filters.method === "delivery" ? "selected" : ""}>Delivery</option>
    </select>
    <button class="btn btn-small" type="submit">Filter</button>
    ${filters.q || filters.status || filters.method ? `<a class="link-arrow" href="/admin">Clear</a>` : ""}
  </form>
  <div class="table-wrap">
    <table class="orders">
      <thead><tr>${sortHeader("number", "Order")}${sortHeader("customer", "Customer")}<th>Items</th>${sortHeader("fulfilment", "Fulfilment")}${sortHeader("total", "Total")}${sortHeader("status", "Status")}<th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7" class="muted">${filters.q || filters.status || filters.method ? "No orders match that filter." : "No orders yet."}</td></tr>`}</tbody>
    </table>
  </div>
  ${pager ? `
  <p class="admin-nav">
    ${pager.pageCount > 1 && pager.page > 1 ? `<a class="btn btn-small" href="${qs(pager.page - 1)}">← Newer</a>` : ""}
    <span class="muted small">${pager.total} order${pager.total === 1 ? "" : "s"}${pager.pageCount > 1 ? ` · page ${pager.page} of ${pager.pageCount}` : ""}</span>
    ${pager.pageCount > 1 && pager.page < pager.pageCount ? `<a class="btn btn-small" href="${qs(pager.page + 1)}">Older →</a>` : ""}
  </p>` : ""}
</section>`
  });
}




/* ------------------------------- order detail ---------------------------- */

const STATUS_WORDS = {
  pending: "pending", awaiting_etransfer: "awaiting e-Transfer", paid: "paid",
  packed: "packed", completed: "completed", cancelled: "cancelled"
};

export function renderOrderAdmin({ order, queued = false, sent = false, mailFailed = false }) {
  const when = new Date(order.created_at).toLocaleString("en-CA", {
    timeZone: "America/Edmonton", dateStyle: "medium", timeStyle: "short"
  });
  const items = order.items
    .map((it) => `<tr>
        <td>${esc(it.name)}${it.sku ? `<br/><span class="sku">${esc(it.sku)}</span>` : ""}</td>
        <td class="num">${it.qty}</td>
        <td class="num">${money(it.price_cents)}</td>
        <td class="num">${money(it.price_cents * it.qty)}</td>
      </tr>`)
    .join("");

  return layout({
    title: `Order ${order.number} — ${site.name}`,
    description: `Order ${order.number}.`,
    page: "admin",
    drawer: false,
    admin: true,
    body: `
<section class="wrap admin">
  <div class="section-head">
    <div>
      <p class="eyebrow"><span class="rule" aria-hidden="true"></span>Back office</p>
      <h1 class="h1-small">Order ${esc(order.number)}</h1>
      <p class="muted small">${esc(when)} · <span class="badge badge-${esc(order.status)}">${esc(STATUS_WORDS[order.status] || order.status)}</span> · ${esc(order.payment === "etransfer" ? "Interac e-Transfer" : "Card")}</p>
    </div>
    <p class="admin-nav"><a class="link-arrow" href="/admin">← Order book</a></p>
  </div>

  ${queued ? `<p class="notice">Label queued — the print agent picks it up within a few seconds.</p>` : ""}
  ${sent ? `<p class="notice">Confirmation email sent to ${esc(order.email)}.</p>` : ""}
  ${mailFailed ? `<p class="form-error">Could not send the email — check the Resend key and the sender domain.</p>` : ""}

  <div class="order-grid">
    <div class="detail-card">
      <h2>Customer</h2>
      <dl class="kv">
        <dt>Name</dt><dd>${esc(order.name)}</dd>
        <dt>Email</dt><dd><a href="mailto:${esc(order.email)}">${esc(order.email)}</a></dd>
        <dt>Phone</dt><dd>${order.phone ? `<a href="tel:${esc(order.phone)}">${esc(order.phone)}</a>` : "<span class=\"muted\">—</span>"}</dd>
      </dl>
    </div>

    <div class="detail-card">
      <h2>Fulfilment</h2>
      <dl class="kv">
        <dt>Method</dt><dd>${order.method === "pickup" ? "Pickup" : "Delivery"}</dd>
        <dt>Where</dt><dd>${order.method === "pickup" ? `${esc(site.pickupWindow)}<br/>${esc(site.pickupLocation)}` : esc(order.address || "—")}</dd>
        <dt>Payment</dt><dd>${esc(order.payment === "etransfer" ? "e-Transfer" : "Card")}${order.status === "cancelled" ? " — order cancelled" : order.payment === "etransfer" ? (["paid", "packed", "completed"].includes(order.status) ? " — received" : " — not yet received") : ""}</dd>
        <dt>Notes</dt><dd>${order.notes ? esc(order.notes) : "<span class=\"muted\">—</span>"}</dd>
      </dl>
    </div>
  </div>

  <div class="detail-card">
    <h2>Items</h2>
    <div class="table-wrap">
      <table class="orders order-lines">
        <thead><tr><th>Product</th><th class="num">Qty</th><th class="num">Each</th><th class="num">Line</th></tr></thead>
        <tbody>${items}</tbody>
      </table>
    </div>
    <div class="order-totals">
      <p class="totals-label">Totals</p>
      <div class="summary-line"><span>Subtotal</span><span>${money(order.subtotal_cents)}</span></div>
      ${order.delivery_cents ? `<div class="summary-line"><span>Delivery</span><span>${money(order.delivery_cents)}</span></div>` : ""}
      ${order.discount_cents ? `<div class="summary-line"><span>Discount${order.discount_code ? ` · ${esc(order.discount_code)}` : ""}</span><span>−${money(order.discount_cents)}</span></div>` : ""}
      <div class="summary-line total"><span>Total</span><span>${money(order.total_cents)}</span></div>
    </div>
  </div>

  <div class="detail-card">
    <h2>Actions</h2>
    <div class="action-row">
      <form method="post" action="/admin/orders/${encodeURIComponent(order.number)}/status" class="inline-form"
            onsubmit="return this.status.value !== 'cancelled' || confirm('Cancel this order? The customer gets an email and stock is returned.')">
        <input type="hidden" name="back" value="order"/>
        <select name="status">
          ${["pending", "awaiting_etransfer", "paid", "packed", "completed", "cancelled"]
            .map((s) => `<option value="${s}" ${s === order.status ? "selected" : ""}>${STATUS_WORDS[s] || s}</option>`)
            .join("")}
        </select>
        <button class="btn btn-small" type="submit">Update status</button>
      </form>

      <form method="post" action="/admin/print/order/${encodeURIComponent(order.number)}">
        <input type="hidden" name="back" value="order"/>
        <button class="btn btn-small btn-quiet" type="submit">Print order label</button>
      </form>

      <form method="post" action="/admin/orders/${encodeURIComponent(order.number)}/email">
        <button class="btn btn-small btn-quiet" type="submit">Resend confirmation</button>
      </form>

      <a class="btn btn-small btn-quiet" href="/order/${esc(order.token || "")}" target="_blank" rel="noopener">Customer page ↗</a>
    </div>
    <p class="fineprint">Changing the status emails the customer for paid, packed, completed and cancelled.</p>
  </div>
</section>`
  });
}

/* --------------------------------- login --------------------------------- */

export function renderLogin({ error = "", next = "/admin" } = {}) {
  return layout({
    title: `Sign in — ${site.name}`,
    description: "Back office sign in.",
    page: "admin",
    drawer: false,
    admin: true,
    guest: true,
    body: `
<section class="wrap login-wrap">
  <div class="login-card">
    <p class="eyebrow"><span class="rule" aria-hidden="true"></span>Back office</p>
    <h1 class="h1-small">Sign in</h1>
    <p class="muted small">Orders, stock and labels for ${esc(site.name)}.</p>
    ${error ? `<p class="form-error">${esc(error)}</p>` : ""}
    <form method="post" action="/admin/login" class="login-form">
      <input type="hidden" name="next" value="${esc(next)}"/>
      <label>Username<input name="username" autocomplete="username" required autofocus/></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" required/></label>
      <button class="btn" type="submit">Sign in</button>
    </form>
  </div>
</section>`
  });
}

/* ---------------------------- product manager ---------------------------- */

const priceInput = (cents) => (cents / 100).toFixed(2);

export function renderProductsAdmin({ products }) {
  const rows = products.map((p) => `
    <tr>
      <td>
        <div class="prod-cell">
          <div class="prod-thumb">${p.image ? `<img src="/media/${encodeURIComponent(p.image)}" alt=""/>` : `<span class="prod-art">${artFor(p)}</span>`}</div>
          <div><strong>${esc(p.name)}</strong><br/><span class="muted small">${esc(p.weight)} · ${esc(p.id)}</span></div>
        </div>
      </td>
      <td><span class="sku">${esc(p.sku || "—")}</span></td>
      <td>${money(p.priceCents)}</td>
      <td>${p.stock}</td>
      <td>${p.maxPerOrder}</td>
      <td><span class="badge ${p.active ? "badge-paid" : "badge-cancelled"}">${p.active ? "Live" : "Hidden"}</span></td>
      <td>${p.sortOrder}</td>
      <td class="row-actions">
        <a class="btn btn-small" href="/admin/products/${encodeURIComponent(p.id)}">Edit</a>
        <form method="post" action="/admin/products/${encodeURIComponent(p.id)}/delete" onsubmit="return confirm('Delete ${esc(p.name)}? Past orders keep their own copy.')">
          <button class="btn btn-small btn-quiet" type="submit">Delete</button>
        </form>
      </td>
    </tr>`).join("");

  return layout({
    title: `Products — ${site.name}`,
    description: "Product manager.",
    page: "admin",
    drawer: false,
    admin: true,
    section: "products",
    body: `
<section class="wrap admin">
  <div class="section-head">
    <div><p class="eyebrow"><span class="rule" aria-hidden="true"></span>Back office</p><h1 class="h1-small">Products</h1></div>
    <p class="section-note">Live products appear on the storefront immediately. Hiding keeps the row and its history.</p>
  </div>
  <p class="admin-nav">
    <a class="btn btn-small" href="/admin/products/new">New product</a>
    <a class="btn btn-small btn-quiet" href="/admin/products.csv">Download CSV</a>
    <a class="link-arrow" href="/admin">← Orders</a>
  </p>
  <div class="table-wrap">
    <table class="orders">
      <thead><tr><th>Product</th><th>SKU</th><th>Price</th><th>Stock</th><th>Max/order</th><th>Status</th><th>Sort</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="8" class="muted">No products yet.</td></tr>`}</tbody>
    </table>
  </div>
</section>`
  });
}

export function renderProductForm({ product, error, queued = 0 }) {
  const isNew = !product;
  const p = product || { id: "", name: "", weight: "", priceCents: 0, note: "", tags: [], art: "generic", image: null, stock: 0, maxPerOrder: 12, active: true, soldOut: false, sortOrder: 100 };
  return layout({
    title: `${isNew ? "New product" : "Edit " + p.name} — ${site.name}`,
    description: "Product editor.",
    page: "admin",
    drawer: false,
    admin: true,
    section: "products",
    body: `
<section class="wrap admin narrow-admin">
  <div class="section-head">
    <div><p class="eyebrow"><span class="rule" aria-hidden="true"></span>Back office</p><h1 class="h1-small">${isNew ? "New product" : esc(p.name)}</h1></div>
  </div>
  <p class="admin-nav"><a class="link-arrow" href="/admin/products">← All products</a></p>
  ${error ? `<p class="form-error">${esc(error)}</p>` : ""}
  ${queued ? `<p class="notice">${queued} label${queued > 1 ? "s" : ""} queued.</p>` : ""}

  <form class="product-form" method="post" action="/admin/products" enctype="multipart/form-data">
    ${p.id ? `<input type="hidden" name="id" value="${esc(p.id)}"/>` : ""}

    <fieldset class="field-group">
      <legend>Product</legend>
      <label>Name <span class="req">required</span><input name="name" value="${esc(p.name)}" required/></label>
      <div class="two">
        <label>Size / weight<input name="weight" value="${esc(p.weight)}" placeholder="750 g"/></label>
        <label>Price (CAD) <span class="req">required</span><input name="price" type="number" step="0.01" min="0" value="${priceInput(p.priceCents)}" required/></label>
      </div>
      <label>SKU <span class="muted small">(blank on a new product = next RC-number; letters, digits, dash)</span>
        <input name="sku" value="${esc(p.sku || "")}" placeholder="RC-1012" maxlength="24"/></label>
      <label>Short description<textarea name="note" rows="2">${esc(p.note)}</textarea></label>
      <label>Tags (comma separated)<input name="tags" value="${esc(p.tags.join(", "))}" placeholder="Cultured, Spreadable"/></label>
    </fieldset>

    <fieldset class="field-group">
      <legend>Label</legend>
      <label>Ingredients <span class="muted small">(as printed on the label)</span>
        <textarea name="ingredients" rows="2" placeholder="Whole milk, salt, microbial rennet.">${esc(p.ingredients || "")}</textarea></label>
      <div class="two">
        <label>Allergens<input name="allergens" value="${esc(p.allergens || "Milk")}"/></label>
        <label>Shelf life (days)<input name="shelf_life_days" type="number" min="1" max="365" value="${p.shelfLifeDays || 14}"/></label>
      </div>
      <p class="fineprint">Best-before is calculated from the print date. Net weight, business address and storage line come from the product and environment settings.</p>
    </fieldset>

    <fieldset class="field-group">
      <legend>Stock</legend>
      <div class="two">
        <label>Units available<input name="stock" type="number" min="0" value="${p.stock ?? 0}"/></label>
        <label>Max per order<input name="max" type="number" min="1" max="24" value="${p.maxPerOrder ?? 12}"/></label>
      </div>
      <label>Sort order <span class="muted small">(lower shows first)</span><input name="sort" type="number" min="0" value="${p.sortOrder ?? 100}"/></label>
      <label class="checkline"><input type="checkbox" name="active" value="1" ${p.active ? "checked" : ""}/> Show on the storefront</label>
      <label class="checkline"><input type="checkbox" name="sold_out" value="1" ${p.soldOut ? "checked" : ""}/> Sold out — keep it visible but stop taking orders</label>
    </fieldset>

    <fieldset class="field-group">
      <legend>Image</legend>
      ${p.image ? `<div class="current-image"><img src="/media/${encodeURIComponent(p.image)}" alt=""/><label class="checkline"><input type="checkbox" name="remove_image" value="1"/> Remove this photo</label></div>` : ""}
      <label>Upload a photo <span class="muted small">(JPG, PNG or WebP, max 5 MB)</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp"/></label>
      <label>Or use a built-in illustration
        <select name="art">
          ${artOptions.map((a) => `<option value="${a.id}" ${a.id === p.art ? "selected" : ""}>${esc(a.label)}</option>`).join("")}
        </select>
      </label>
      <p class="fineprint">A photo overrides the illustration.</p>
    </fieldset>

    <div class="form-actions"><button class="btn" type="submit">${isNew ? "Create product" : "Save changes"}</button><a class="link-arrow" href="/admin/products">Cancel</a></div>
  </form>

  ${!isNew ? `<section class="print-block">
    <h2>Labels</h2>
    <p>62 mm continuous stock (Brother QL-800). Queued jobs are picked up by the print agent on the
      machine the printer is plugged into.</p>
    <div class="print-actions">
      <form method="post" action="/admin/print/product/${encodeURIComponent(p.id)}" class="print-form">
        <label>Copies<input name="copies" type="number" min="1" max="20" value="${p.stock > 0 ? Math.min(p.stock, 20) : 1}"/></label>
        <button class="btn" type="submit">Queue labels</button>
      </form>
      <a class="link-arrow" href="/admin/labels/product/${encodeURIComponent(p.id)}" target="_blank" rel="noopener">Open printable label ↗</a>
    </div>
    <p class="fineprint">The browser view opens a 62 mm page you can print from any print dialog, or save as PDF. The queued path needs the print agent running on the machine with the printer.</p>
  </section>
  <form method="post" action="/admin/products/${encodeURIComponent(p.id)}/delete" class="danger-zone" onsubmit="return confirm('Delete ${esc(p.name)}?')">
    <button class="btn btn-quiet" type="submit">Delete product</button>
    <span class="muted small">Past orders keep their own copy of the name and price.</span>
  </form>` : ""}
</section>`
  });
}

export function render404() {
  return layout({
    title: `Not found — ${site.name}`,
    description: "Page not found.",
    page: "404",
    body: `<section class="wrap narrow center-block"><p class="eyebrow">404</p><h1 class="h1-small">Nothing in this cooler.</h1><p><a class="link-arrow" href="/">Back to the shop →</a></p></section>`
  });
}

export function renderSettings({ saved = false, error = "" } = {}) {
  const money0 = (c) => (Number(c) / 100).toFixed(2);
  return layout({
    title: `Settings — ${site.name}`,
    description: "Store settings.",
    page: "admin",
    drawer: false,
    admin: true,
    section: "settings",
    body: `
<section class="wrap admin narrow-admin">
  <div class="section-head">
    <div><p class="eyebrow"><span class="rule" aria-hidden="true"></span>Back office</p><h1 class="h1-small">Settings</h1></div>
    <p class="section-note">Saved to the database — the shop changes on the next page load, no redeploy.</p>
  </div>
  <p class="admin-nav"><a class="link-arrow" href="/admin">← Order book</a> <a class="link-arrow" href="/admin/products">Products →</a></p>
  ${saved ? `<p class="notice">Settings saved.</p>` : ""}
  ${error ? `<p class="form-error">${esc(error)}</p>` : ""}

  <form class="product-form" method="post" action="/admin/settings">
    <fieldset class="field-group">
      <legend>The shop</legend>
      <label>Name <span class="req">required</span><input name="site_name" value="${esc(site.name)}" required/></label>
      <label>Tagline<input name="site_tagline" value="${esc(site.tagline)}"/></label>
      <div class="two">
        <label>Contact email <span class="req">required</span><input name="contact_email" type="email" value="${esc(site.email)}" required/></label>
        <label>Phone<input name="contact_phone" value="${esc(site.phone || "")}" placeholder="403-555-0100"/></label>
      </div>
      <label>Instagram handle<input name="instagram" value="${esc(site.instagram || "")}" placeholder="@rebel_creamery"/></label>
    </fieldset>

    <fieldset class="field-group">
      <legend>Pickup</legend>
      <label>Address <span class="req">required</span><input name="pickup_location" value="${esc(site.pickupLocation)}" required/></label>
      <div class="two">
        <label>Window <span class="req">required</span><input name="pickup_window" value="${esc(site.pickupWindow)}" required/></label>
        <label>Cut-off banner<input name="cutoff_text" value="${esc(site.cutoff)}"/></label>
      </div>
    </fieldset>

    <fieldset class="field-group">
      <legend>Delivery</legend>
      <div class="two">
        <label>Area<input name="delivery_area" value="${esc(delivery.area)}"/></label>
        <label>Window<input name="delivery_windows" value="${esc(delivery.windows)}"/></label>
      </div>
      <div class="two">
        <label>Fee (CAD)<input name="delivery_fee" type="number" step="0.01" min="0" value="${money0(delivery.feeCents)}"/></label>
        <label>Free over (CAD)<input name="free_delivery_over" type="number" step="0.01" min="0" value="${money0(delivery.freeOverCents)}"/></label>
      </div>
    </fieldset>

    <fieldset class="field-group">
      <legend>Payments</legend>
      <label>Interac e-Transfer address <span class="muted small">(must match the Autodeposit address on the account)</span>
        <input name="etransfer_email" type="email" value="${esc(site.etransferEmail)}"/></label>
    </fieldset>

    <fieldset class="field-group">
      <legend>Legal footer</legend>
      <label>Licence text<textarea name="licence_text" rows="2">${esc(site.licence)}</textarea></label>
    </fieldset>

    <div class="form-actions">
      <button class="btn" type="submit">Save settings</button>
      <span class="muted small">Blank email fields fall back to the previous value.</span>
    </div>
  </form>
</section>`
  });
}

export function renderDiscounts({ discounts = [], saved = false, error = "" } = {}) {
  const rows = discounts.map((d) => {
    const value = d.kind === "fixed" ? money(d.value) : `${d.value}%`;
    const uses = d.max_uses ? `${d.uses} / ${d.max_uses}` : `${d.uses} / ∞`;
    const expiry = d.expires_at ? new Date(d.expires_at).toLocaleDateString("en-CA") : "—";
    return `<tr>
      <td><strong>${esc(d.code)}</strong><br/><span class="muted small">${esc(value)} off${d.min_subtotal_cents ? ` · min ${money(d.min_subtotal_cents)}` : ""}</span></td>
      <td>${esc(uses)}</td>
      <td>${esc(expiry)}</td>
      <td><span class="badge ${d.active ? "badge-paid" : "badge-cancelled"}">${d.active ? "active" : "off"}</span></td>
      <td>
        <div class="row-tools">
          <form method="post" action="/admin/discounts/${encodeURIComponent(d.code)}/toggle">
            <button class="icon-btn" type="submit" title="${d.active ? "Deactivate" : "Activate"}" aria-label="${d.active ? "Deactivate" : "Activate"} ${esc(d.code)}">${d.active ? "⏸" : "▶"}</button>
          </form>
          <form method="post" action="/admin/discounts/${encodeURIComponent(d.code)}/delete" onsubmit="return confirm('Delete ${esc(d.code)}?')">
            <button class="icon-btn" type="submit" title="Delete" aria-label="Delete ${esc(d.code)}">✕</button>
          </form>
        </div>
      </td>
    </tr>`;
  }).join("");

  return layout({
    title: `Discounts — ${site.name}`,
    description: "Discount codes.",
    page: "admin",
    drawer: false,
    admin: true,
    section: "discounts",
    body: `
<section class="wrap admin">
  <div class="section-head">
    <div><p class="eyebrow"><span class="rule" aria-hidden="true"></span>Back office</p><h1 class="h1-small">Discount codes</h1></div>
    <p class="section-note">Applied to the subtotal at checkout. Uses count when an order is created (e-Transfer) or paid (card).</p>
  </div>
  ${saved ? `<p class="notice">Saved.</p>` : ""}
  ${error ? `<p class="form-error">${esc(error)}</p>` : ""}

  <div class="table-wrap">
    <table class="orders">
      <thead><tr><th>Code</th><th>Uses</th><th>Expires</th><th>Status</th><th class="muted small">Actions</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" class="muted">No codes yet.</td></tr>`}</tbody>
    </table>
  </div>

  <form class="product-form" method="post" action="/admin/discounts">
    <fieldset class="field-group">
      <legend>New code</legend>
      <div class="two">
        <label>Code <span class="req">required</span><input name="code" placeholder="LAUNCH10" maxlength="24" required/></label>
        <label>Type
          <select name="kind">
            <option value="percent">Percent off</option>
            <option value="fixed">Dollars off</option>
          </select>
        </label>
      </div>
      <div class="two">
        <label>Value <span class="muted small">(10 = 10%, or 5 = $5.00)</span><input name="value" type="number" step="0.01" min="0" required/></label>
        <label>Minimum subtotal (CAD)<input name="min" type="number" step="0.01" min="0" value="0"/></label>
      </div>
      <div class="two">
        <label>Maximum uses <span class="muted small">(blank = unlimited)</span><input name="max_uses" type="number" min="1"/></label>
        <label>Expires <span class="muted small">(blank = no expiry)</span><input name="expires" type="date"/></label>
      </div>
      <div class="form-actions"><button class="btn" type="submit">Create code</button></div>
    </fieldset>
  </form>
</section>`
  });
}
