import { site, delivery, products, money } from "./catalog.js";

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
  </svg>`
};

/* -------------------------------- layout -------------------------------- */

function layout({ title, description, body, page = "", drawer = true }) {
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
<link rel="stylesheet" href="/styles.css"/>
</head>
<body class="page-${esc(page)}">
<a class="skip" href="#main">Skip to content</a>
<div class="announce"><span class="announce-dot" aria-hidden="true"></span>${esc(site.cutoff)} <a href="#shop">Shop the batch</a></div>
<header class="site-head">
  <div class="wrap head-inner">
    <a class="brand" href="/" aria-label="${esc(site.name)} home">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 3c3.2 3.8 5.2 6.2 5.2 8.7A5.2 5.2 0 0 1 12 17a5.2 5.2 0 0 1-5.2-5.3C6.8 9.2 8.8 6.8 12 3z"/></svg>
      </span>
      <span class="brand-name">${esc(site.name)}</span>
    </a>
    <nav class="nav" aria-label="Primary">
      <a href="/#shop">Shop</a>
      <a href="/#how">How it works</a>
      <a href="/#story">Our dairy</a>
      ${site.instagram ? `<a href="${esc(site.instagram)}" rel="noopener" target="_blank">Instagram</a>` : ""}
    </nav>
    <button class="cart-btn" id="cart-open" aria-controls="cart" aria-expanded="false">
      <span>Cart</span><span class="cart-count" id="cart-count" aria-live="polite">0</span>
    </button>
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
${drawer ? cartDrawer() : ""}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>window.__CATALOG__=${JSON.stringify(products.map(p=>({id:p.id,name:p.name,weight:p.weight,priceCents:p.priceCents,max:p.maxPerOrder})))};window.__DELIVERY__=${JSON.stringify(delivery)};</script>
<script src="/app.js" defer></script>
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

export function renderHome({ stock, demo }) {
  const cards = products
    .map((p) => {
      const left = stock[p.id] ?? 0;
      const soldOut = left <= 0;
      return `
    <article class="card ${soldOut ? "is-soldout" : ""}" data-product="${p.id}">
      <div class="card-art art-${p.art}">${art[p.art]}</div>
      <div class="card-body">
        <div class="card-top">
          <h3>${esc(p.name)}</h3>
          <span class="card-price">${money(p.priceCents)}</span>
        </div>
        <p class="card-weight">${esc(p.weight)}${soldOut ? " · sold out" : left <= 4 ? ` · ${left} left` : ""}</p>
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
    ${Array(4).fill(`<span>Cultured in small batches</span><span class="dot">·</span><span>6% yogurt</span><span class="dot">·</span><span>Cloth-drained cream cheese</span><span class="dot">·</span><span>Grill-ready halloumi</span><span class="dot">·</span>`).join("")}
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

export function renderCheckout({ demo, canCard = true }) {
  const cardOff = !canCard && !demo;
  return layout({
    title: `Checkout — ${site.name}`,
    description: `Checkout for ${site.name}.`,
    page: "checkout",
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
        <label class="address" id="address-field" hidden>Delivery address
          <input name="address" autocomplete="street-address" placeholder="Street, unit, postal code"/>
        </label>
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

export function renderSuccess({ order }) {
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
  <p class="lede small">${etransfer ? "Send the e-Transfer and we'll pack your order." : "A confirmation is on its way to " + esc(order.email) + "."}</p>

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
    <p>Need to change something? Reply to the confirmation email or write to <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>.</p>
  </div>
</section>`
  });
}

/* --------------------------------- admin -------------------------------- */

export function renderAdmin({ orders, summary, stock }) {
  const rows = orders
    .map((o) => {
      const items = o.items.map((i) => `${i.qty}× ${i.name}`).join(", ");
      return `<tr>
        <td><strong>${esc(o.number)}</strong><br/><span class="muted small">${esc(new Date(o.created_at).toLocaleString("en-CA", { timeZone: "America/Edmonton" }))}</span></td>
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
        </td>
      </tr>`;
    })
    .join("");

  return layout({
    title: `Orders — ${site.name}`,
    description: "Order book.",
    page: "admin",
    drawer: false,
    body: `
<section class="wrap admin">
  <div class="section-head">
    <div><p class="eyebrow"><span class="rule" aria-hidden="true"></span>Back office</p><h1 class="h1-small">Order book</h1></div>
    <p class="section-note">All figures CAD. Stock decrements when a card order is paid or an e-Transfer order is marked paid.</p>
  </div>
  <div class="stat-row">
    <div class="stat"><span>${summary.orders}</span><p>orders</p></div>
    <div class="stat"><span>${money(summary.revenue_cents)}</span><p>booked</p></div>
    <div class="stat"><span>${money(summary.paid_cents)}</span><p>paid</p></div>
    ${products.map((p) => `<div class="stat"><span>${stock[p.id] ?? 0}</span><p>${esc(p.name)} left</p></div>`).join("")}
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

export function render404() {
  return layout({
    title: `Not found — ${site.name}`,
    description: "Page not found.",
    page: "404",
    body: `<section class="wrap narrow center-block"><p class="eyebrow">404</p><h1 class="h1-small">Nothing in this cooler.</h1><p><a class="link-arrow" href="/">Back to the shop →</a></p></section>`
  });
}
