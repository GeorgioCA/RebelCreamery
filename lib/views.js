import { site, delivery, money, artOptions } from "./catalog.js";
import { assetVersion } from "./assets.js";

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------------------------------- art ---------------------------------- */

const art = {
  yogurt: `
  <svg viewBox="0 0 120 140" role="img" aria-label="Yogurt tub illustration" class="art-svg">
    <ellipse cx="60" cy="128" rx="34" ry="4" fill="currentColor" opacity=".12"/>
    <path d="M28 42h64l-8 76a8 8 0 0 1-8 7H44a8 8 0 0 1-8-7z" fill="var(--paper)" stroke="currentColor" stroke-width="2.4"/>
    <path d="M24 34h72v10a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4z" fill="currentColor"/>
    <path d="M39 66h42" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".5"/>
    <text x="60" y="90" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-size="21" fill="currentColor">6%</text>
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
  generic: `
  <svg viewBox="0 0 120 140" role="img" aria-label="Jar illustration" class="art-svg">
    <ellipse cx="60" cy="128" rx="30" ry="4" fill="currentColor" opacity=".12"/>
    <path d="M32 46h56v70a8 8 0 0 1-8 8H40a8 8 0 0 1-8-8z" fill="var(--paper)" stroke="currentColor" stroke-width="2.4"/>
    <path d="M28 34h64v12H28z" fill="currentColor"/>
    <path d="M44 76h32M44 90h32" stroke="currentColor" stroke-width="2.2" opacity=".45" stroke-linecap="round"/>
  </svg>`
};

/* -------------------------------- layout -------------------------------- */

function layout({ title, description, body, page = "", drawer = true, catalog = [], admin = false, guest = false }) {
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
          <a href="/admin">Orders</a>
          <a href="/admin/products">Products</a>
          <a href="/" target="_blank" rel="noopener">View store ↗</a>
          <form method="post" action="/admin/logout" class="signout"><button type="submit">Sign out</button></form>
        </nav>`
      : guest
      ? `<nav class="nav" aria-label="Store"><a href="/">← Back to the shop</a></nav>`
      : `<nav class="nav" aria-label="Primary">
          <a href="/#shop">Shop</a>
          <a href="/#how">How it works</a>
          <a href="/#story">Our dairy</a>
          ${site.instagram ? `<a href="${esc(site.instagram)}" rel="noopener" target="_blank">Instagram</a>` : ""}
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
      <p><a href="mailto:${esc(site.email)}">${esc(site.email)}</a>${site.phone ? `<br/><a href="tel:${esc(site.phone.replace(/\s/g, ""))}">${esc(site.phone)}</a>` : ""}</p>
    </div>
  </div>
  <div class="wrap foot-legal">
    <p>${esc(site.licence)}</p>
    <p>© ${new Date().getFullYear()} ${esc(site.name)} · ${esc(site.city)}</p>
  </div>
</footer>
${drawer && !admin ? cartDrawer() : ""}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>window.__CATALOG__=${JSON.stringify(catalog.map(p=>({id:p.id,name:p.name,weight:p.weight,priceCents:p.priceCents,max:p.maxPerOrder})))};window.__DELIVERY__=${JSON.stringify(delivery)};</script>
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

const tickerPhrase = `<span>Cultured in small batches</span><span class="dot">·</span><span>6% yogurt</span><span class="dot">·</span><span>Cloth-drained cream cheese</span><span class="dot">·</span><span>Grill-ready halloumi</span><span class="dot">·</span>`;

export function renderHome({ products, demo, madeToOrder = true }) {
  const cards = products
    .map((p) => {
      const left = p.stock ?? 0;
      const soldOut = p.soldOut || (!madeToOrder && left <= 0);
      return `
    <article class="card ${soldOut ? "is-soldout" : ""}" data-product="${p.id}">
      <div class="card-art art-${p.art} ${p.image ? "has-photo" : ""}">${p.image ? `<img src="/media/${encodeURIComponent(p.image)}" alt="${esc(p.name)}" loading="lazy"/>` : (art[p.art] || art.generic)}</div>
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
    <div class="art-pos art-pos-2">${art.yogurt}</div>
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
    <div class="story-art" aria-hidden="true"><div class="story-ring"></div>${art.yogurt}</div>
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
              <span class="choice-sub">Send to ${esc(process.env.ETRANSFER_EMAIL || site.email)}. We pack once it lands.</span>
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
      <div class="summary-line"><span>Subtotal</span><span id="sum-subtotal">$0.00</span></div>
      <div class="summary-line" id="sum-delivery-row" hidden><span>Delivery</span><span id="sum-delivery">$0.00</span></div>
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
    <p>Send to <strong>${esc(process.env.ETRANSFER_EMAIL || site.email)}</strong><br/>
       Message: <strong>${esc(order.number)}</strong><br/>
       No security question needed — auto-deposit is on.</p>
  </div>` : ""}

  <div class="receipt">
    <ul class="receipt-items">${items}</ul>
    <div class="summary-line"><span>Subtotal</span><span>${money(order.subtotal_cents)}</span></div>
    ${order.delivery_cents ? `<div class="summary-line"><span>Delivery</span><span>${money(order.delivery_cents)}</span></div>` : ""}
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

export function renderAdmin({ orders, summary, products, printQueue = [], queued = false, madeToOrder = true }) {
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
          <form method="post" action="/admin/orders/${esc(o.number)}/status" class="inline-form">
            <select name="status">
              ${["pending", "awaiting_etransfer", "paid", "packed", "completed", "cancelled"]
                .map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s.replace(/_/g, " ")}</option>`)
                .join("")}
            </select>
            <button class="btn btn-small" type="submit">Save</button>
          </form>
          <form method="post" action="/admin/print/order/${encodeURIComponent(o.number)}">
            <button class="btn btn-small btn-quiet" type="submit">Label</button>
          </form>
          <a class="btn btn-small btn-quiet" href="/admin/orders/${encodeURIComponent(o.number)}">View</a>
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
    body: `
<section class="wrap admin">
  <div class="section-head">
    <div><p class="eyebrow"><span class="rule" aria-hidden="true"></span>Back office</p><h1 class="h1-small">Order book</h1></div>
    <p class="section-note">All figures CAD. Stock is reserved when an order is placed and returned if it is cancelled.</p>
  </div>
  <p class="admin-nav"><a class="btn btn-small" href="/admin/products">Manage products</a>
    <span class="muted small">Labels ${printQueue.filter(q => q.status === "queued").map(q => q.n).reduce((a, b) => a + b, 0) || 0} queued</span></p>
  ${queued ? `<p class="notice">Label queued — the print agent picks it up within a few seconds.</p>` : ""}
  <div class="stat-row">
    <div class="stat"><span>${summary.orders}</span><p>orders</p></div>
    <div class="stat"><span>${money(summary.revenue_cents)}</span><p>booked</p></div>
    <div class="stat"><span>${money(summary.paid_cents)}</span><p>paid</p></div>
    ${products.map((p) => {
      const low = !madeToOrder && !p.soldOut && p.stock <= 4;
      return `<div class="stat stat-stock${low ? " is-low" : ""}${p.active ? "" : " is-hidden"}${p.soldOut ? " is-out" : ""}">
      <div class="stat-top"><span>${p.stock ?? 0}</span>
        <div class="stat-step">
          <form method="post" action="/admin/stock"><input type="hidden" name="product_id" value="${esc(p.id)}"/><input type="hidden" name="delta" value="-1"/><button type="submit" aria-label="Remove one ${esc(p.name)}" ${p.stock <= 0 ? "disabled" : ""}>−</button></form>
          <form method="post" action="/admin/stock"><input type="hidden" name="product_id" value="${esc(p.id)}"/><input type="hidden" name="delta" value="1"/><button type="submit" aria-label="Add one ${esc(p.name)}">+</button></form>
        </div>
      </div>
      <p>${esc(p.name)}<br/><span class="stat-sub">${!p.active ? "hidden" : p.soldOut ? "sold out" : madeToOrder ? "capacity" : "left"}</span></p>
      <form method="post" action="/admin/products/${encodeURIComponent(p.id)}/sold-out" class="stat-toggle">
        <input type="hidden" name="sold_out" value="${p.soldOut ? "0" : "1"}"/>
        <button type="submit">${p.soldOut ? "Back in stock" : "Mark sold out"}</button>
      </form>
    </div>`;
    }).join("")}
    <a class="stat stat-new" href="/admin/products/new"><span>+</span><p>New product</p></a>
  </div>
  <div class="table-wrap">
    <table class="orders">
      <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Fulfilment</th><th>Total</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7" class="muted">No orders yet.</td></tr>`}</tbody>
    </table>
  </div>
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
        <td>${esc(it.name)}</td>
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
          <div class="prod-thumb">${p.image ? `<img src="/media/${encodeURIComponent(p.image)}" alt=""/>` : `<span class="prod-art">${art[p.art] || art.generic}</span>`}</div>
          <div><strong>${esc(p.name)}</strong><br/><span class="muted small">${esc(p.weight)} · ${esc(p.id)}</span></div>
        </div>
      </td>
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
    body: `
<section class="wrap admin">
  <div class="section-head">
    <div><p class="eyebrow"><span class="rule" aria-hidden="true"></span>Back office</p><h1 class="h1-small">Products</h1></div>
    <p class="section-note">Live products appear on the storefront immediately. Hiding keeps the row and its history.</p>
  </div>
  <p class="admin-nav">
    <a class="btn btn-small" href="/admin/products/new">New product</a>
    <a class="link-arrow" href="/admin">← Orders</a>
  </p>
  <div class="table-wrap">
    <table class="orders">
      <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Max/order</th><th>Status</th><th>Sort</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7" class="muted">No products yet.</td></tr>`}</tbody>
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
        <label>Max per order<input name="max" type="number" min="1" max="50" value="${p.maxPerOrder ?? 12}"/></label>
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
    <p class="fineprint">The browser view prints through the Brother driver. The queued path prints directly over USB from the agent.</p>
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
