import { site, delivery, plans, money, artOptions, priceOf } from "./catalog.js";
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
${!admin && page !== "success" && site.umamiSrc && site.umamiWebsiteId
  ? `<script async src="${esc(site.umamiSrc)}" data-website-id="${esc(site.umamiWebsiteId)}" data-do-not-track="true"></script>`
  : ""}
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
          <a href="/admin/subscriptions"${section === "subscriptions" ? ' aria-current="page"' : ""}>Plans</a>
          <a href="/admin/discounts"${section === "discounts" ? ' aria-current="page"' : ""}>Discounts</a>
          <a href="/admin/settings"${section === "settings" ? ' aria-current="page"' : ""}>Settings</a>
          ${site.metricsUrl ? `<a href="/admin/metrics"${section === "metrics" ? ' aria-current="page"' : ""}>Metrics</a>` : ""}
          ${site.analyticsUrl ? `<a href="${esc(site.analyticsUrl)}" target="_blank" rel="noopener">Visitors ↗</a>` : ""}
          <a href="/" target="_blank" rel="noopener">View store ↗</a>
          <form method="post" action="/admin/logout" class="signout"><button type="submit">Sign out</button></form>
        </nav>`
      : guest
      ? `<nav class="nav" aria-label="Store"><a href="/">← Back to the shop</a></nav>`
      : `<nav class="nav" aria-label="Primary">
          <a href="/#shop">Shop</a>
          <a href="/#how">How it works</a>
          <a href="/#story">Our dairy</a>
          <a href="/faq">FAQ</a>
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
${drawer && !admin ? quickView() : ""}
${drawer && !admin ? cartDrawer() : ""}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>window.__CATALOG__=${json(catalog.map(p=>({id:p.id,name:p.name,weight:p.weight,priceCents:p.priceCents,saleCents:p.saleCents||null,max:p.maxPerOrder,subscribable:!!p.subscribable})))};window.__DELIVERY__=${json(delivery)};window.__PLAN__=${json({ weeks: [4, 8, 12], maxTubs: plans.maxTubsPerWeek })};</script>
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

/* One dialog for every product; the per-card <template> is cloned into it. */
function quickView() {
  return `
<div class="qv" id="qv" hidden>
  <div class="qv-backdrop" data-qv-close></div>
  <div class="qv-panel">
    <button class="qv-close" type="button" data-qv-close aria-label="Close product details">✕</button>
    <div class="qv-content" id="qv-content" role="dialog" aria-modal="true"></div>
  </div>
</div>`;
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

export function artFor(p) {
  return (art[p.art] || art.generic).replace(/\{\{FAT\}\}/g, fatOf(p));
}

const tickerPhrase = `<span>Cultured in small batches</span><span class="dot">·</span><span>6% yogurt</span><span class="dot">·</span><span>Cloth-drained cream cheese</span><span class="dot">·</span><span>Grill-ready halloumi</span><span class="dot">·</span>`;

/* ---------------------------------- faq ---------------------------------- */

/* One source for the FAQ: the page, the home teaser and the JSON-LD all read
   from here, so an answer can't drift out of sync with itself. Answers are
   trusted HTML; anything dynamic goes through esc() at the call site.        */
function faqGroups(products = []) {
  const shelf = products.length
    ? products
        .filter((p) => p.shelfLifeDays)
        .map((p) => `${esc(p.name)} keeps ${p.shelfLifeDays} days`)
        .join(", ")
    : "everything keeps at least two weeks";

  return [
    {
      id: "plans",
      title: "Weekly plans",
      blurb: "Prepaid pickup cards — how they work, and what happens when life gets in the way.",
      items: [
        { q: "How does the weekly plan work?",
          a: `You prepay for a block of weeks — 4, 8 or 12 — and collect that week's tubs at pickup. From one to ${plans.maxTubsPerWeek} tubs a week, your call; the 12-week card credits a 13th week free. There's no card on file and nothing to cancel: your name is on the card at the table.` },
        { q: "Why do I have to prepay?",
          a: "We make to order. A prepaid card tells us how many tubs to culture that week, so nothing is made to sit in a cooler." },
        { q: "Do I save money on a longer plan?",
          a: "The 12-week card is credited with <strong>13 tubs</strong> — you pay for 12. The 4 and 8 week cards are the same price per tub as buying one at a time." },
        { q: "What if I can't make it one week?",
          a: "Nothing happens. The week stays on your card. Uncollected weeks are good for four weeks past the end of your plan." },
        { q: "Can someone else pick it up for me?",
          a: "Yes. Give them your name — that's the whole card. No app, no code, no printing." },
        { q: "Can I get a plan delivered?",
          a: `The first tub, yes — add the card to your order and pick delivery at checkout. The rest are collected at ${esc(site.pickupLocation)}, because one tub a week doesn't carry a delivery on its own.` },
        { q: "Can I pause or cancel?",
          a: "Cancel before you've collected anything and we refund the order. Once tubs have been collected, the remaining weeks stay on your card but aren't refundable." },
        { q: "Can I switch products mid-plan?",
          a: "One product per card. Finish it, then start another — that keeps the batch numbers honest." },
        { q: "Will the price change during my plan?",
          a: "No. You pay at purchase, and the per-tub price on your card is locked." },
        { q: "Can I buy a plan as a gift?",
          a: "Yes. Put the recipient's name in the notes at checkout, or just tell them to give your name at pickup." }
      ]
    },
    {
      id: "orders",
      title: "Orders & pickup",
      blurb: "Cutoffs, delivery, payment and what happens if you miss a Saturday.",
      items: [
        { q: "When do I need to order by?",
          a: `${esc(site.cutoff)}.` },
        { q: "Where and when is pickup?",
          a: `${esc(site.pickupWindow)} at ${esc(site.pickupLocation)}.` },
        { q: "Do you deliver?",
          a: `Yes — ${esc(delivery.windows)} across ${esc(delivery.area)}, ${money(delivery.feeCents)}, free over ${money(delivery.freeOverCents)}. A weekly card's first tub rides with your delivery; the remaining weeks are pickup.` },
        { q: "How do I pay?",
          a: "Card at checkout (Stripe — we never see the number, and Apple Pay and Google Pay work), or Interac e-Transfer. Dairy sold as basic groceries is zero-rated, so no GST is added." },
        { q: "Can I change or cancel an order?",
          a: `Email <a href="mailto:${esc(site.email)}">${esc(site.email)}</a> with your order number before the cutoff and we'll sort it out. After that the batch is already running.` },
        { q: "What if I miss pickup?",
          a: "We keep orders cold until the end of the pickup window. After that it's perishable food and we can't re-sell it — email us and we'll do what we can, but we can't promise a second window." },
        { q: "Do you ship outside Calgary?",
          a: "No. Everything is perishable and we'd rather not hand it to a courier." },
        { q: "Do you sell wholesale?",
          a: `Yes, for cafés and restaurants in Calgary. Write to <a href="mailto:${esc(site.email)}">${esc(site.email)}</a> with what you'd use weekly.` }
      ]
    },
    {
      id: "food",
      title: "The food",
      blurb: "What's in it, how long it keeps, and why it behaves the way it does.",
      items: [
        { q: "What's in it?",
          a: "Milk, cream, cultures, rennet and salt — the full ingredient list and allergens are printed on every label." },
        { q: "Is it pasteurised?",
          a: "Yes. Selling unpasteurised milk is illegal in Alberta; everything is pasteurised before it's cultured." },
        { q: "How long does it keep?",
          a: `${shelf}. Keep it refrigerated; halloumi keeps best covered in its brine.` },
        { q: "Does it contain allergens?",
          a: "All of it contains milk. Every label lists the allergens, and nothing else is made in the kitchen that isn't dairy." },
        { q: "Is it organic?",
          a: "Not certified organic. The ingredient list on the label is the whole story." },
        { q: "How is it made?",
          a: "In small batches in Calgary. Yogurt is cultured then chilled; cream cheese is drained in cloth overnight; halloumi is pressed, poached and brined for a full day." },
        { q: "Why does halloumi squeak?",
          a: "Because the curd is never over-cooked and it's brined for 24 hours, so it stays elastic. If it doesn't squeak, it wasn't made that way." }
      ]
    }
  ];
}

function faqItem({ q, a }) {
  return `<details class="faq-item">
        <summary><span>${q}</span><span class="faq-mark" aria-hidden="true"></span></summary>
        <div class="faq-a"><p>${a}</p></div>
      </details>`;
}

function faqBlock(items) {
  return `<div class="faq">${items.map(faqItem).join("")}</div>`;
}

export function renderFaq({ products = [] } = {}) {
  const groups = faqGroups(products);
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: groups.flatMap((g) => g.items).map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a.replace(/<[^>]+>/g, "") }
    }))
  };
  return layout({
    title: `Questions — ${site.name}`,
    description: `How the weekly plan works, pickup and delivery, payment, shelf life and what's in the food at ${site.name}.`,
    page: "faq",
    catalog: products,
    body: `
<section class="wrap faq-page">
  <div class="section-head">
    <div>
      <p class="eyebrow"><span class="rule" aria-hidden="true"></span>Questions</p>
      <h1 class="h1-small">Everything else.</h1>
    </div>
    <p class="section-note">If the answer isn't here, email <a href="mailto:${esc(site.email)}">${esc(site.email)}</a> — a person replies.</p>
  </div>

  <nav class="faq-jump" aria-label="FAQ sections">
    ${groups.map((g) => `<a href="#${g.id}">${esc(g.title)}</a>`).join("")}
  </nav>

  ${groups.map((g) => `
  <section class="faq-group" id="${g.id}">
    <h2>${esc(g.title)}</h2>
    <p class="muted small">${esc(g.blurb)}</p>
    ${faqBlock(g.items)}
  </section>`).join("")}

  <div class="faq-foot">
    <p>Still stuck? <a class="link-arrow" href="mailto:${esc(site.email)}">Email ${esc(site.email)} →</a></p>
    <p class="fineprint">Plan cards are prepaid, pickup only, and valid for four weeks past the end of the plan.</p>
  </div>
</section>
<script type="application/ld+json">${json(ld)}</script>`
  });
}

/* Four questions on the home page; the rest live at /faq. */
function faqTeaser(products) {
  const all = faqGroups(products).flatMap((g) => g.items);
  const pick = ["How does the weekly plan work?", "How long does it keep?", "Where and when is pickup?", "Do you deliver?"];
  const asked = pick.map((q) => all.find((i) => i.q === q)).filter(Boolean);
  return asked.length ? faqBlock(asked) : "";
}

/* Quick view: the detail markup is server-rendered into an inert <template>
   inside its own card, so the client clones real HTML — art, fat-fill, prices
   and DB fields — instead of rebuilding any of it in JS. */
function quickViewTemplate(p, soldOut) {
  return `
      <template data-qv-tpl="${esc(p.id)}">
        <div class="qv-art art-${p.art} ${p.image ? "has-photo" : ""}">${p.image ? `<img src="/media/${encodeURIComponent(p.image)}" alt="${esc(p.name)}"/>` : artFor(p)}</div>
        <div class="qv-copy">
          <p class="qv-eyebrow">${esc(site.city)} · small-batch dairy</p>
          <h2>${esc(p.name)}</h2>
          <p class="qv-price">${p.saleCents && p.saleCents < p.priceCents
            ? `<span class="was">${money(p.priceCents)}</span><span class="now">${money(p.saleCents)}</span>`
            : money(p.priceCents)} <span class="qv-weight">/ ${esc(p.weight)}</span></p>
          <p class="qv-note">${esc(p.note)}</p>
          <ul class="tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
          <dl class="qv-specs">
            ${p.ingredients ? `<div><dt>Ingredients</dt><dd>${esc(p.ingredients)}</dd></div>` : ""}
            ${p.allergens ? `<div><dt>Allergens</dt><dd>${esc(p.allergens)}</dd></div>` : ""}
            ${p.shelfLifeDays ? `<div><dt>Keeps</dt><dd>${p.shelfLifeDays} days refrigerated</dd></div>` : ""}
            ${p.sku ? `<div><dt>SKU</dt><dd>${esc(p.sku)}</dd></div>` : ""}
          </dl>
          <div class="qv-actions">
            <div class="stepper" role="group" aria-label="Quantity for ${esc(p.name)}">
              <button type="button" data-step="-1" aria-label="Decrease quantity">−</button>
              <input type="number" min="0" max="${p.maxPerOrder}" value="1" inputmode="numeric" aria-label="Quantity" ${soldOut ? "disabled" : ""}/>
              <button type="button" data-step="1" aria-label="Increase quantity">+</button>
            </div>
            <button class="btn btn-add" data-add="${p.id}" ${soldOut ? "disabled" : ""}>${soldOut ? "Sold out" : "Add"}</button>
          </div>
        </div>
      </template>`;
}

const groupKeyFor = (name) =>
  "g:" + String(name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

const isSoldOut = (p, madeToOrder) => p.soldOut || (!madeToOrder && (p.stock ?? 0) <= 0);

/* Ordered option dimensions across a group: [["Milk type", ["Classic","Organic"]], …] */
function optionDims(members) {
  const order = [];
  const values = new Map();
  for (const p of members) {
    for (const [k, v] of Object.entries(p.variantOptions || {})) {
      if (!values.has(k)) { values.set(k, []); order.push(k); }
      if (!values.get(k).includes(v)) values.get(k).push(v);
    }
  }
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  // Sizes sort by actual measure (750 g before 3.5 kg), everything else naturally.
  const measure = (v) => {
    const m = /^([\d.]+)\s*(kg|g|l|ml)$/i.exec(String(v).trim());
    if (!m) return null;
    return Number(m[1]) * (/^(kg|l)$/i.test(m[2]) ? 1000 : 1);
  };
  return order.map((k) => {
    const vals = values.get(k);
    const measured = vals.map(measure);
    return [k, measured.every((n) => n !== null) ? [...vals].sort((a, b) => measure(a) - measure(b)) : vals.sort(collator.compare)];
  });
}

function productCard(p, madeToOrder) {
  const left = p.stock ?? 0;
  const soldOut = isSoldOut(p, madeToOrder);
  return `
    <article class="card ${soldOut ? "is-soldout" : ""}" id="product-${esc(p.id)}" data-product="${p.id}">
      <div class="card-art art-${p.art} ${p.image ? "has-photo" : ""}">
        <button type="button" class="card-open" data-qv="${esc(p.id)}" aria-label="View details for ${esc(p.name)}">${p.image ? `<img src="/media/${encodeURIComponent(p.image)}" alt="${esc(p.name)}" loading="lazy"/>` : artFor(p)}</button>
      </div>
      <div class="card-body">
        <div class="card-top">
          <h3>${esc(p.name)}${p.subscribable && !soldOut ? `<span class="card-sub" title="Available as a weekly card — choose it at checkout">
            <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 11a8 8 0 0 0-13.7-5.3L4 8"/><path d="M4 4v4h4"/>
              <path d="M4 13a8 8 0 0 0 13.7 5.3L20 16"/><path d="M20 20v-4h-4"/>
            </svg>
            <span class="sr-only">Available as a weekly card at checkout</span>
          </span>` : ""}</h3>
          <span class="card-price">${p.saleCents && p.saleCents < p.priceCents
            ? `<span class="was">${money(p.priceCents)}</span><span class="now">${money(p.saleCents)}</span>`
            : money(p.priceCents)}</span>
        </div>
        <p class="card-weight">${esc(p.weight)}${soldOut ? " · sold out" : !madeToOrder && left <= 4 ? ` · ${left} left` : ""}</p>
        <p class="card-note">${esc(p.note)}</p>
        <ul class="tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        <button type="button" class="card-more" data-qv="${esc(p.id)}">Ingredients &amp; details <span aria-hidden="true">→</span></button>
        <div class="card-actions">
          <div class="stepper" role="group" aria-label="Quantity for ${esc(p.name)}">
            <button type="button" data-step="-1" aria-label="Decrease quantity">−</button>
            <input type="number" min="0" max="${p.maxPerOrder}" value="1" inputmode="numeric" aria-label="Quantity" ${soldOut ? "disabled" : ""}/>
            <button type="button" data-step="1" aria-label="Increase quantity">+</button>
          </div>
          <button class="btn btn-add" data-add="${p.id}" ${soldOut ? "disabled" : ""}>${soldOut ? "Sold out" : "Add"}</button>
        </div>
      </div>
      ${quickViewTemplate(p, soldOut)}
    </article>`;
}

/* One card for a group of SKUs that differ only by options. The members stay
   real products — cart keys, checkout, orders, stock and labels are untouched. */
function variantCard(name, members, madeToOrder) {
  const key = groupKeyFor(name);
  const def = members.find((p) => !isSoldOut(p, madeToOrder)) || members[0];
  const allSold = members.every((p) => isSoldOut(p, madeToOrder));
  const from = Math.min(...members.map(priceOf));
  const weights = [...new Set(members.map((p) => p.weight).filter(Boolean))];
  const tagSets = members.map((p) => p.tags || []);
  const tags = (tagSets[0] || []).filter((t) => tagSets.every((s) => s.includes(t)));
  return `
    <article class="card card-group ${allSold ? "is-soldout" : ""}" data-qv-group="${esc(key)}">
      ${members.map((p) => `<span id="product-${esc(p.id)}" hidden></span>`).join("")}
      <div class="card-art art-${def.art} ${def.image ? "has-photo" : ""}">
        <button type="button" class="card-open" data-qv="${esc(key)}" aria-label="Choose ${esc(name)} options">${def.image ? `<img src="/media/${encodeURIComponent(def.image)}" alt="${esc(name)}" loading="lazy"/>` : artFor(def)}</button>
      </div>
      <div class="card-body">
        <div class="card-top">
          <h3>${esc(name)}</h3>
          <span class="card-price"><span class="from">from </span>${money(from)}</span>
        </div>
        <p class="card-weight">${esc(weights.slice(0, 3).join(" / "))}${weights.length > 3 ? " …" : ""} · ${members.length} options${allSold ? " · sold out" : ""}</p>
        <p class="card-note">${esc(def.note)}</p>
        ${tags.length ? `<ul class="tags">${tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
        <div class="card-actions">
          <button class="btn btn-add btn-block" data-qv="${esc(key)}">Choose options <span aria-hidden="true">→</span></button>
        </div>
      </div>
      ${variantTemplate(key, name, members, def, madeToOrder)}
    </article>`;
}

function variantTemplate(key, name, members, def, madeToOrder) {
  const dims = optionDims(members);
  const defSold = isSoldOut(def, madeToOrder);
  const defPrice = def.saleCents && def.saleCents < def.priceCents
    ? `<span class="was">${money(def.priceCents)}</span><span class="now">${money(def.saleCents)}</span>`
    : money(def.priceCents);
  const payload = {
    defaultId: def.id,
    variants: members.map((p) => ({
      id: p.id,
      name: p.name,
      options: p.variantOptions || {},
      weight: p.weight,
      priceCents: p.priceCents,
      saleCents: p.saleCents && p.saleCents < p.priceCents ? p.saleCents : null,
      sku: p.sku || "",
      ingredients: p.ingredients || "",
      allergens: p.allergens || "",
      shelfLifeDays: p.shelfLifeDays || 0,
      soldOut: isSoldOut(p, madeToOrder),
      maxPerOrder: p.maxPerOrder,
      artId: p.art,
      art: p.image ? "" : artFor(p),
      image: p.image || null
    }))
  };
  return `
      <template data-qv-tpl="${esc(key)}">
        <div class="qv-art art-${def.art} ${def.image ? "has-photo" : ""}" data-qv-art>${def.image ? `<img src="/media/${encodeURIComponent(def.image)}" alt="${esc(name)}"/>` : artFor(def)}</div>
        <div class="qv-copy">
          <p class="qv-eyebrow">${esc(site.city)} · small-batch dairy</p>
          <h2>${esc(name)}</h2>
          <p class="qv-price" data-qv-price>${defPrice} <span class="qv-weight" data-qv-weight>/ ${esc(def.weight)}</span></p>
          <p class="qv-note">${esc(def.note)}</p>
          <div class="qv-options">
            ${dims.map(([label, values]) => `
              <div class="qv-opt" data-opt="${esc(label)}">
                <span class="qv-opt-label">${esc(label)}</span>
                <div class="qv-opt-values" role="radiogroup" aria-label="${esc(label)}">
                  ${values.map((v) => `<button type="button" role="radio" aria-checked="${v === (def.variantOptions || {})[label]}" data-opt-value="${esc(v)}">${esc(v)}</button>`).join("")}
                </div>
              </div>`).join("")}
          </div>
          <dl class="qv-specs">
            <div data-spec="ingredients"${def.ingredients ? "" : " hidden"}><dt>Ingredients</dt><dd>${esc(def.ingredients)}</dd></div>
            <div data-spec="allergens"${def.allergens ? "" : " hidden"}><dt>Allergens</dt><dd>${esc(def.allergens)}</dd></div>
            <div data-spec="keeps"${def.shelfLifeDays ? "" : " hidden"}><dt>Keeps</dt><dd>${def.shelfLifeDays} days refrigerated</dd></div>
            <div data-spec="sku"${def.sku ? "" : " hidden"}><dt>SKU</dt><dd>${esc(def.sku)}</dd></div>
          </dl>
          <div class="qv-actions">
            <div class="stepper" role="group" aria-label="Quantity for ${esc(name)}">
              <button type="button" data-step="-1" aria-label="Decrease quantity">−</button>
              <input type="number" min="0" max="${def.maxPerOrder}" value="1" inputmode="numeric" aria-label="Quantity" ${defSold ? "disabled" : ""}/>
              <button type="button" data-step="1" aria-label="Increase quantity">+</button>
            </div>
            <button class="btn btn-add" data-add="${def.id}" ${defSold ? "disabled" : ""}>${defSold ? "Sold out" : "Add"}</button>
          </div>
          <script type="application/json" class="qv-data">${json(payload)}</script>
        </div>
      </template>`;
}

export function renderHome({ products, demo, madeToOrder = true }) {
  // Products sharing a variant group collapse into one card, in the position of
  // the first member. A group with one member, or with no options, stays single.
  const entries = [];
  const groups = new Map();
  for (const p of products) {
    const g = (p.variantGroup || "").trim();
    if (!g) { entries.push({ single: p }); continue; }
    if (!groups.has(g)) { const e = { group: g, members: [] }; groups.set(g, e); entries.push(e); }
    groups.get(g).members.push(p);
  }
  const cards = entries.map((e) => {
    if (e.single) return productCard(e.single, madeToOrder);
    if (e.members.length < 2 || !optionDims(e.members).length) {
      return e.members.map((p) => productCard(p, madeToOrder)).join("");
    }
    return variantCard(e.group, e.members, madeToOrder);
  }).join("");

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
</section>

<section class="wrap faq-home" id="questions">
  <div class="section-head">
    <div>
      <p class="eyebrow"><span class="rule" aria-hidden="true"></span>Questions</p>
      <h2>The short answers</h2>
    </div>
    <p class="section-note"><a class="link-arrow" href="/faq">All questions <span aria-hidden="true">→</span></a></p>
  </div>
  ${faqTeaser(products)}
</section>`
  });
}

/* ------------------------------- checkout ------------------------------- */

export function renderCheckout({ demo, canCard = true, products = [], seedPlan = null }) {
  const cardOff = !canCard && !demo;
  const body = `
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
        <p class="plan-note" id="plan-note" hidden></p>
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
                ${["AB","BC","SK","MB","ON","QC","NB","NS","PE","NL","YT","NT","NU"].map((code) => `<option value="${code}"${code === "AB" ? " selected" : ""}>${code}</option>`).join("")}
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
      <p class="plan-note" id="plan-note-aside" hidden></p>
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
</section>${seedPlan ? `<script>window.__SEED_PLAN__=${json(seedPlan)};</script>` : ""}`;

  return layout({
    title: `Checkout — ${site.name}`,
    description: `Checkout for ${site.name}.`,
    page: "checkout",
    catalog: products,
    body
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

export function renderSuccess({ order, origin = "", subscriptions = [] }) {
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

  ${!subscriptions.length && (order.items || []).some((i) => Number(i.plan_weeks) > 0) ? `
  <div class="plan-status">
    <p class="foot-label">Weekly card</p>
    ${(order.items || []).filter((i) => Number(i.plan_weeks) > 0).map((i) => {
      const w = Number(i.plan_weeks);
      return `<p class="big">${esc(i.name.replace(/\s+—\s+\d+-week plan.*$/, ""))} — ${w >= 12 ? w + 1 : w} tubs</p>`;
    }).join("")}
    <p>Your card starts the moment payment lands${order.status === "awaiting_etransfer" ? " — send the e-Transfer and this week's tub is packed with the rest of the order" : ""}. Week 1 travels with this order; the rest are collected at ${esc(site.pickupLocation)}, one visit a week.</p>
  </div>` : ""}
  ${subscriptions.length ? `
  <div class="plan-status">
    <p class="foot-label">${subscriptions.length === 1 ? "Weekly card" : "Weekly cards"}</p>
    ${subscriptions.map((s) => `
      <p class="big">${esc(s.product_name)} — ${s.weeks_used} of ${s.weeks_credited} weeks collected</p>
      <p>${s.tubs_per_week > 1 ? `${s.tubs_per_week} tubs a week` : "One tub a week"} · ${s.tubs_left} ${s.tubs_left === 1 ? "tub" : "tubs"} still on the card.</p>
      <p>Week 1 ${order.method === "delivery" ? "is in this delivery" : "is in this order"}. The rest are collected at ${esc(site.pickupLocation)}, one visit a week. Give your name — no code, no card to print.</p>
      <p class="fineprint">End date ${esc(new Date(s.expires_at).toLocaleDateString("en-CA", { timeZone: "America/Edmonton", dateStyle: "long" }))}. Uncollected weeks expire after that.</p>
    `).join("")}
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

/* Metrics live in their own container; this page renders what it returns.
   Nothing here recomputes money — one implementation, two surfaces.        */
const ago = (seconds) => {
  if (seconds === null || seconds === undefined) return "never";
  const s = Math.max(0, Number(seconds));
  if (s < 90) return `${Math.round(s)}s ago`;
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 172800) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

function metricChart(trend = [], peak = 0) {
  if (!trend.length) return `<p class="muted small">No orders yet.</p>`;
  const width = 720, height = 150, slot = width / trend.length, barW = Math.max(4, slot - 5);
  const top = Math.max(1, Number(peak) || 0);
  const bars = trend.map((day, i) => {
    const h = Math.max(1.5, (day.revenue_cents / top) * (height - 34));
    const x = i * slot;
    const y = height - 20 - h;
    const fill = day.revenue_cents ? "var(--moss)" : "rgba(29,42,33,.12)";
    const tip = `${day.date} · ${money(day.revenue_cents)} · ${day.orders} order${day.orders === 1 ? "" : "s"}`;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2.5" fill="${fill}"><title>${esc(tip)}</title></rect>`;
  }).join("");
  const ticks = trend.map((day, i) =>
    i % 7 === 0 || i === trend.length - 1
      ? `<text x="${(i * slot + barW / 2).toFixed(1)}" y="${height - 4}" font-size="10" fill="#4c5a4f" text-anchor="middle">${esc(day.date.slice(5))}</text>`
      : "").join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Paid revenue per day, last 30 days">${bars}${ticks}</svg>`;
}

export function renderMetrics({ summary = null, error = "", externalUrl = "" } = {}) {
  const w = summary?.windows || {};
  const trend = summary?.trend || [];
  const subs = summary?.subscriptions || {};
  const ops = summary?.ops || {};
  const customers = summary?.customers || {};
  const status = summary?.status || [];
  const top = summary?.top_products || [];
  const stamp = summary?.generated_at
    ? new Date(summary.generated_at).toLocaleString("en-CA", { timeZone: "America/Edmonton", dateStyle: "medium", timeStyle: "short" })
    : "";

  const tile = (label, value, note) =>
    `<div class="stat"><span>${value}</span><p>${label}${note ? `<br/>${note}` : ""}</p></div>`;
  const sharePct = (part, whole) => (whole ? `${Math.round((100 * Number(part || 0)) / whole)}%` : "—");

  const windows = [["Today", w.today], ["Last 7 days", w["7d"]], ["Last 30 days", w["30d"]], ["All time", w.all]]
    .filter(([, v]) => v)
    .map(([label, v]) => `<tr><td>${label}</td><td>${money(v.revenue_cents)}</td><td>${money(v.cogs_cents)}</td>
      <td>${money(v.gross_profit_cents)}</td><td>${money(v.fees_cents)}</td><td>${money(v.overhead_cents)}</td>
      <td><strong>${money(v.net_profit_cents)}</strong></td><td>${v.net_margin ?? 0}%</td><td>${v.paid_orders}</td></tr>`)
    .join("");

  const statusRows = status.map((s) =>
    `<tr><td><span class="badge badge-${esc(s.status)}">${esc(s.status.replace(/_/g, " "))}</span></td><td>${s.count}</td><td>${money(s.cents)}</td></tr>`).join("");

  const productRows = top.map((p) =>
    `<tr><td>${esc(p.name)}</td><td>${p.units}</td><td>${money(p.revenue_cents)}</td>
     <td>${p.unit_cost_cents ? money(p.unit_cost_cents) : "not set"}</td>
     <td>${money(p.cogs_cents)}</td><td>${money(p.gross_profit_cents)}</td><td>${p.margin ?? 0}%</td></tr>`).join("");

  const payment = (summary?.payment || []).map((p) => `${esc(p.name)} ${p.count}`).join(" · ") || "—";
  const method = (summary?.method || []).map((m) => `${esc(m.name)} ${m.count}`).join(" · ") || "—";
  const printQueue = Object.entries(ops.print || {}).map(([k, n]) => `${esc(k)} ${n}`).join(" · ") || "none";
  const lowStock = (ops.low_stock || []).map((p) => `${esc(p.name)} (${p.stock})`).join(", ") || "none";
  const soldOut = (ops.sold_out || []).map(esc).join(", ") || "none";
  const discounts = (ops.discounts || []).map((d) => `${esc(d.code)} ${d.uses}/${d.max_uses || "∞"}`).join(", ") || "none used yet";

  const body = summary
    ? `
  <div class="stat-row">
    ${tile("revenue · 30 days", money(w["30d"]?.revenue_cents), `${w["30d"]?.paid_orders || 0} paid orders`)}
    ${tile("cost of goods · 30 days", money(w["30d"]?.cogs_cents), `${sharePct(w["30d"]?.cogs_cents, w["30d"]?.revenue_cents)} of revenue`)}
    ${tile("net profit · 30 days", money(w["30d"]?.net_profit_cents), `${w["30d"]?.net_margin ?? 0}% margin`)}
    ${tile("net margin", `${w["30d"]?.net_margin ?? 0}%`, "after COGS, fees, overhead")}
  </div>

  <figure class="metrics-chart">
    ${metricChart(trend, summary.trend_peak_cents)}
    <figcaption><span>Paid revenue per day · last 30 days</span><span>Peak ${money(summary.trend_peak_cents)}</span></figcaption>
  </figure>

  <div class="metric-grid">
    <div class="table-wrap metric-table">
      <table class="metrics"><thead><tr><th>Period</th><th>Revenue</th><th>COGS</th><th>Gross</th>
        <th>Fees</th><th>Overhead</th><th>Net profit</th><th>Net margin</th><th>Paid</th></tr></thead>
        <tbody>${windows}</tbody></table>
    </div>
    <div class="table-wrap metric-table">
      <table class="metrics"><thead><tr><th>Status</th><th>Orders</th><th>Value</th></tr></thead>
        <tbody>${statusRows}</tbody></table>
    </div>
  </div>

  <div class="table-wrap metric-table">
    <table class="metrics"><thead><tr><th>Profit by product · 30 days</th><th>Units</th><th>Revenue</th>
      <th>Cost/unit</th><th>COGS</th><th>Gross profit</th><th>Margin</th></tr></thead>
      <tbody>${productRows || `<tr><td colspan="7" class="muted">No paid orders in the last 30 days.</td></tr>`}</tbody></table>
  </div>

  <div class="metric-grid">
    <div class="metric-card">
      <p class="foot-label">Prepaid plans</p>
      <div class="metric-kv"><span>Open plans</span><b>${subs.active ?? 0}</b></div>
      <div class="metric-kv"><span>Tubs still owed</span><b>${subs.tubs_outstanding ?? 0}</b></div>
      <div class="metric-kv"><span>Weeks outstanding</span><b>${subs.weeks_outstanding ?? 0}</b></div>
      <div class="metric-kv"><span>Paid, not poured</span><b>${money(subs.unearned_cents)}</b></div>
      <div class="metric-kv"><span>Earned</span><b>${money(subs.earned_cents)}</b></div>
    </div>
    <div class="metric-card">
      <p class="foot-label">Operations</p>
      <div class="metric-kv"><span>Awaiting e-Transfer</span><b>${ops.awaiting_etransfer?.count ?? 0} · ${money(ops.awaiting_etransfer?.cents)}</b></div>
      <div class="metric-kv"><span>Card orders unpaid &gt; 24 h</span><b>${ops.stale_card_orders?.count ?? 0}</b></div>
      <div class="metric-kv"><span>Label queue</span><b>${printQueue}</b></div>
      <div class="metric-kv"><span>Sold out</span><b>${soldOut}</b></div>
      <div class="metric-kv"><span>Low stock</span><b>${lowStock}</b></div>
      <div class="metric-kv"><span>Discount codes</span><b>${discounts}</b></div>
    </div>
  </div>

  <p class="section-note">Payment: ${payment} · Fulfilment: ${method} · Last order ${ago(summary.last_order_age_seconds)} ·
    Database ${Math.round((summary.db?.size_bytes || 0) / 1024)} KB, read-only.
    ${externalUrl ? `<a class="link-arrow" href="${esc(externalUrl)}" target="_blank" rel="noopener">Standalone dashboard ↗</a>` : ""}</p>`
    : "";

  return layout({
    title: `Metrics — ${site.name}`,
    description: "Order book metrics.",
    page: "admin",
    drawer: false,
    admin: true,
    section: "metrics",
    body: `
<section class="wrap admin">
  <div class="section-head">
    <div><p class="eyebrow"><span class="rule" aria-hidden="true"></span>Back office</p><h1 class="h1-small">Metrics</h1></div>
    <p class="section-note">${stamp ? `Read from the order book by a separate container · updated ${esc(stamp)}` : "Read from the order book by a separate container."}</p>
  </div>
  ${error ? `<p class="notice">${esc(error)}${summary ? " Showing the last good snapshot." : ""}</p>` : ""}
  ${body || `<p class="muted">No numbers yet — the metrics container has not answered.</p>`}
</section>`
  });
}

export function renderOrderAdmin({ order, subscriptions = [], queued = false, sent = false, mailFailed = false }) {
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

  ${subscriptions.length ? `
  <div class="detail-card">
    <h2>Weekly ${subscriptions.length === 1 ? "card" : "cards"}</h2>
    ${subscriptions.map((s) => `
      <dl class="kv">
        <dt>${esc(s.product_name)}</dt><dd>${s.weeks_used} of ${s.weeks_credited} weeks · ${s.tubs_per_week} a week · ${s.tubs_left} tubs left</dd>
        <dt>Status</dt><dd><span class="badge badge-${esc(s.status)}">${esc(s.status)}</span></dd>
        <dt>End date</dt><dd>${esc(new Date(s.expires_at).toLocaleDateString("en-CA", { timeZone: "America/Edmonton", dateStyle: "medium" }))}</dd>
      </dl>
    `).join("")}
    <p class="fineprint">Week 1 travels with this order. <a class="link-arrow" href="/admin/subscriptions">Collect later weeks →</a></p>
  </div>` : ""}

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

      <form method="post" action="/admin/print/thankyou/${encodeURIComponent(order.number)}">
        <input type="hidden" name="back" value="order"/>
        <button class="btn btn-small btn-quiet" type="submit">Print thank-you label</button>
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
  const rows = products.map((p) => {
    const opts = Object.entries(p.variantOptions || {}).map(([k, v]) => `${k}: ${v}`).join(" · ");
    return `
    <tr>
      <td>
        <div class="prod-cell">
          <div class="prod-thumb">${p.image ? `<img src="/media/${encodeURIComponent(p.image)}" alt=""/>` : `<span class="prod-art">${artFor(p)}</span>`}</div>
          <div><strong>${esc(p.name)}</strong><br/><span class="muted small">${esc(p.weight)} · ${esc(p.id)}${p.variantGroup ? ` · ${esc(p.variantGroup)}` : ""}</span>${opts ? `<br/><span class="muted small">${esc(opts)}</span>` : ""}</div>
        </div>
      </td>
      <td><span class="sku">${esc(p.sku || "—")}</span></td>
      <td>${p.saleCents && p.saleCents < p.priceCents ? `<s class="muted">${money(p.priceCents)}</s> <strong>${money(p.saleCents)}</strong>` : money(p.priceCents)}</td>
      <td>${p.costCents ? money(p.costCents) : `<span class="muted">not set</span>`}</td>
      <td>${(() => {
        const unit = p.saleCents && p.saleCents < p.priceCents ? p.saleCents : p.priceCents;
        if (!p.costCents || !unit) return `<span class="muted">—</span>`;
        return `${Math.round(((unit - p.costCents) / unit) * 100)}%`;
      })()}</td>
      <td>${p.stock}</td>
      <td>${p.maxPerOrder}</td>
      <td>${!p.active
        ? `<span class="badge badge-cancelled">Hidden</span>`
        : p.soldOut
          ? `<span class="badge badge-soldout">Sold out</span>`
          : `<span class="badge badge-paid">Live</span>`}</td>
      <td>${p.sortOrder}</td>
      <td class="row-actions">
        <a class="btn btn-small" href="/admin/products/${encodeURIComponent(p.id)}">Edit</a>
        <form method="post" action="/admin/products/${encodeURIComponent(p.id)}/delete" onsubmit="return confirm('Delete ${esc(p.name)}? Past orders keep their own copy.')">
          <button class="btn btn-small btn-quiet" type="submit">Delete</button>
        </form>
      </td>
    </tr>`;
  }).join("");

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
      <thead><tr><th>Product</th><th>SKU</th><th>Price</th><th>Unit cost</th><th>Margin</th><th>Stock</th><th>Max/order</th><th>Status</th><th>Sort</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="10" class="muted">No products yet.</td></tr>`}</tbody>
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
      <div class="two">
        <label>Sale price (CAD) <span class="muted small">(blank = not on sale)</span>
          <input name="sale" type="number" step="0.01" min="0" value="${p.saleCents ? priceInput(p.saleCents) : ""}" placeholder="e.g. 3.49"/></label>
        <label>Unit cost (CAD) <span class="muted small">(ingredients + packaging)</span>
          <input name="cost" type="number" step="0.01" min="0" value="${priceInput(p.costCents || 0)}"/></label>
      </div>
      <label>SKU <span class="muted small">(blank on a new product = next RC-number; letters, digits, dash)</span>
        <input name="sku" value="${esc(p.sku || "")}" placeholder="RC-1012" maxlength="24"/></label>
      <label>Short description<textarea name="note" rows="2">${esc(p.note)}</textarea></label>
      <label>Tags (comma separated)<input name="tags" value="${esc(p.tags.join(", "))}" placeholder="Cultured, Spreadable"/></label>
    </fieldset>

    <fieldset class="field-group">
      <legend>Variants</legend>
      <label>Variant group <span class="muted small">(products sharing a group collapse into one storefront card — leave blank for a standalone product)</span>
        <input name="variant_group" value="${esc(p.variantGroup || "")}" placeholder="Yogurt" maxlength="40"/></label>
      <label>Variant options <span class="muted small">(one per line, <code>Label: Value</code>)</span>
        <textarea name="variant_options" rows="3" placeholder="Milk type: Organic&#10;Milk fat: 6%&#10;Size: 750 g">${esc(Object.entries(p.variantOptions || {}).map(([k, v]) => `${k}: ${v}`).join("\n"))}</textarea></label>
      <p class="fineprint">Every product in a group needs the same option labels, spelled the same way, or the picker treats them as different choices. Each product keeps its own price, SKU, stock and label.</p>
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
      <label class="checkline"><input type="checkbox" name="subscribable" value="1" ${p.subscribable ? "checked" : ""}/> Sell as a weekly plan (prepaid 4, 8 or 12 weeks, pickup only)</label>
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

/* ------------------------------ subscriptions ---------------------------- */

export function renderSubscriptions({ subs = [], summary = {}, collected = false, undone = false } = {}) {
  const rows = subs.map((s) => {
    const pct = s.weeks_credited ? Math.round((s.weeks_used / s.weeks_credited) * 100) : 0;
    const expires = new Date(s.expires_at).toLocaleDateString("en-CA", { timeZone: "America/Edmonton", dateStyle: "medium" });
    return `<tr>
      <td>${esc(s.name)}<br/><span class="muted small">${esc(s.email)}${s.order_number ? ` · ${esc(s.order_number)}` : ""}</span></td>
      <td>${esc(s.product_name)}<br/><span class="muted small">${s.tubs_per_week} a week · ${money(s.unit_cents)} a tub · paid ${money(s.total_cents)}</span></td>
      <td>
        <strong>${s.weeks_used} / ${s.weeks_credited}</strong>
        <div class="plan-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <span class="muted small">${s.weeks_remaining} ${s.weeks_remaining === 1 ? "week" : "weeks"} · ${s.tubs_left} tubs left</span>
      </td>
      <td>${esc(expires)}</td>
      <td><span class="badge badge-${esc(s.status)}">${esc(s.status)}</span></td>
      <td>
        <div class="row-tools">
          <form method="post" action="/admin/subscriptions/${s.id}/collect">
            <button class="btn btn-small" type="submit" ${s.status === "active" ? "" : "disabled"}>Collect</button>
          </form>
          <form method="post" action="/admin/subscriptions/${s.id}/undo">
            <button class="btn btn-small btn-quiet" type="submit" ${s.weeks_used > 0 ? "" : "disabled"}>Undo</button>
          </form>
        </div>
      </td>
    </tr>`;
  }).join("");

  return layout({
    title: `Plans — ${site.name}`,
    description: "Prepaid weekly plans.",
    page: "admin",
    drawer: false,
    admin: true,
    section: "subscriptions",
    body: `
<section class="wrap admin">
  <div class="section-head">
    <div><p class="eyebrow"><span class="rule" aria-hidden="true"></span>Back office</p><h1 class="h1-small">Weekly plans</h1></div>
    <p class="section-note">Prepaid pickup cards. One tap at the counter takes a week off the card; undo fixes a mis-tap.</p>
  </div>
  <p class="admin-nav"><a class="btn btn-small" href="/admin">Order book</a>
    <a class="btn btn-small btn-quiet" href="/admin/products">Products</a></p>
  ${collected ? `<p class="notice">Week collected — the card is one week lighter.</p>` : ""}
  ${undone ? `<p class="notice">Last collection undone.</p>` : ""}
  <div class="stat-row">
    <div class="stat"><span>${summary.active ?? 0}</span><p>active plans</p></div>
    <div class="stat"><span>${summary.tubsOutstanding ?? 0}</span><p>tubs still owed</p></div>
    <div class="stat"><span>${money(summary.unearnedCents ?? 0)}</span><p>prepaid, unearned</p></div>
    <div class="stat"><span>${money(summary.earnedCents ?? 0)}</span><p>earned to date</p></div>
  </div>
  ${subs.length ? `<div class="table-wrap">
    <table class="orders">
      <thead><tr><th>Customer</th><th>Plan</th><th>Collected</th><th>End date</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>` : `<p class="muted">No plans yet. Turn on "Sell as a weekly plan" on a product, then the card offers it at checkout.</p>`}
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

export function renderSettings({ saved = false, error = "", backed = false, backupError = "", backup = null, backupOn = false } = {}) {
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
    <div class="section-aside">
      <p class="section-note">Saved to the database — the shop changes on the next page load, no redeploy.</p>
      <a class="btn btn-small" href="/admin/backup/download" title="Download a current copy of the database">Download backup</a>
    </div>
  </div>
  <p class="admin-nav"><a class="link-arrow" href="/admin">← Order book</a> <a class="link-arrow" href="/admin/products">Products →</a></p>
  ${saved ? `<p class="notice">Settings saved.</p>` : ""}
  ${error ? `<p class="form-error">${esc(error)}</p>` : ""}

  <div class="backup-panel">
    <div>
      <h2 class="h1-small" style="margin:0 0 4px">Backups</h2>
      ${backupOn
        ? (backup
            ? `<p class="muted small">Last run ${esc(new Date(backup.finishedAt || backup.startedAt).toLocaleString("en-CA", { timeZone: "America/Edmonton" }))}
                 — ${backup.ok ? `${Math.round((backup.dbBytes || 0) / 1024)} KB database${backup.uploadBytes ? `, ${Math.round(backup.uploadBytes / 1024)} KB photos` : ""} to Backblaze` : `failed: ${esc(backup.error || "unknown")}`}</p>`
            : `<p class="muted small">Nightly at 3 am to Backblaze. No run recorded yet.</p>`)
        : `<p class="muted small">Not configured — add the Backblaze key and bucket in the environment.</p>`}
      ${backupOn ? `<p class="small" style="margin:8px 0 0"><a class="link-arrow" href="/admin/restore">Restore from a backup →</a></p>` : ""}
      ${backed ? `<p class="notice" style="margin:10px 0 0">Backup uploaded.</p>` : ""}
      ${backupError ? `<p class="form-error" style="margin:10px 0 0">Backup failed: ${esc(backupError)}</p>` : ""}
    </div>
    ${backupOn ? `<form method="post" action="/admin/backup"><button class="btn btn-small" type="submit">Back up now</button></form>` : ""}
  </div>
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
      <legend>Weekly cards</legend>
      <div class="two">
        <label>Tubs a week, maximum <span class="muted small">(1–12)</span>
          <input name="plan_max_tubs" type="number" step="1" min="1" max="12" value="${Number(plans.maxTubsPerWeek) || 3}" required/></label>
        <p class="muted small" style="align-self:end;margin:0 0 10px">The most a household can take on one card. Lower it if a week's batch can't stretch; existing cards keep what they bought.</p>
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

export function renderRestore({ backups = [], error = "", log = [], restoreOn = true } = {}) {
  const rows = backups.map((b) => {
    const day = (b.fileName.match(/\d{4}-\d{2}-\d{2}/) || [""])[0];
    const when = new Date(b.uploadedAt).toLocaleString("en-CA", { timeZone: "America/Edmonton" });
    return `<tr>
      <td><strong>${esc(day)}</strong><br/><span class="muted small">${Math.round(b.bytes / 1024)} KB · uploaded ${esc(when)}</span></td>
      <td>
        <form class="restore-form" method="post" action="/admin/restore">
          <input type="hidden" name="file" value="${esc(b.fileName)}"/>
          <input name="confirm" placeholder="type ${esc(day)}" aria-label="Type ${esc(day)} to confirm" autocomplete="off"/>
          <button class="btn btn-small" type="submit">Restore</button>
        </form>
      </td>
    </tr>`;
  }).join("");

  return layout({
    title: `Restore — ${site.name}`,
    description: "Restore from backup.",
    page: "admin",
    drawer: false,
    admin: true,
    section: "settings",
    body: `
<section class="wrap admin narrow-admin">
  <div class="section-head">
    <div><p class="eyebrow"><span class="rule" aria-hidden="true"></span>Back office</p><h1 class="h1-small">Restore a backup</h1></div>
    <p class="section-note">Replaces the live database and photos with the snapshot, then restarts. The current data is kept as a pre-restore copy.</p>
  </div>
  <p class="admin-nav"><a class="link-arrow" href="/admin/settings">← Settings</a></p>
  ${error ? `<p class="form-error">${esc(error)}</p>` : ""}
  ${!restoreOn ? `<p class="notice">Backblaze isn't configured, so there are no snapshots to restore.</p>` : ""}
  ${restoreOn ? `
  <div class="table-wrap">
    <table class="orders">
      <thead><tr><th>Snapshot</th><th>Confirm</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="2" class="muted">No snapshots in the bucket yet.</td></tr>`}</tbody>
    </table>
  </div>
  <p class="muted small">Type the snapshot date to arm the button. Restoring signs everyone out and briefly takes the shop offline while the container restarts.</p>` : ""}
  ${log.length ? `<h2 class="h1-small" style="margin-top:28px">Recent restores</h2>
    <ul class="restore-log">${log.map((l) => `<li class="muted small">${esc(l)}</li>`).join("")}</ul>` : ""}
</section>`
  });
}
