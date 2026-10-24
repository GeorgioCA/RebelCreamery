/* Rebel Creamery — cart + checkout. No framework, no build step. */
(() => {
  const CATALOG = window.__CATALOG__ || [];
  const DELIVERY = window.__DELIVERY__ || { feeCents: 800, freeOverCents: 4000 };
  const KEY = "rc_cart_v1";
  const byId = Object.fromEntries(CATALOG.map((p) => [p.id, p]));
  const money = (c) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(c / 100);

  /* ------------------------------- storage ------------------------------- */
  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch { return {}; }
  }
  function write(cart) {
    localStorage.setItem(KEY, JSON.stringify(cart));
    document.dispatchEvent(new CustomEvent("cart:change"));
  }
  const count = (cart) => Object.values(cart).reduce((a, b) => a + b, 0);
  const subtotal = (cart) =>
    Object.entries(cart).reduce((s, [id, q]) => s + (byId[id]?.priceCents || 0) * q, 0);
  const clean = (cart) =>
    Object.fromEntries(Object.entries(cart).filter(([id, q]) => byId[id] && q > 0).map(([id, q]) => [id, Math.min(q, byId[id].max)]));

  function add(id, qty) {
    const cart = clean(read());
    cart[id] = Math.min((cart[id] || 0) + qty, byId[id].max);
    write(cart);
  }
  function setQty(id, qty) {
    const cart = clean(read());
    if (qty <= 0) delete cart[id]; else cart[id] = Math.min(qty, byId[id].max);
    write(cart);
  }

  /* --------------------------------- ui ---------------------------------- */
  const drawer = document.getElementById("cart");
  const backdrop = document.getElementById("cart-backdrop");
  const body = document.getElementById("cart-body");
  const foot = document.getElementById("cart-foot");
  const counter = document.getElementById("cart-count");
  const toastEl = document.getElementById("toast");
  let toastTimer;

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  function openCart() {
    if (!drawer) return;
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    backdrop.hidden = false;
    document.body.style.overflow = "hidden";
    document.getElementById("cart-open")?.setAttribute("aria-expanded", "true");
    drawer.querySelector("#cart-close")?.focus();
  }
  function closeCart() {
    if (!drawer) return;
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    backdrop.hidden = true;
    document.body.style.overflow = "";
    document.getElementById("cart-open")?.setAttribute("aria-expanded", "false");
  }

  function renderCart() {
    const cart = clean(read());
    const n = count(cart);
    if (counter) counter.textContent = String(n);
    if (!body) return;

    if (!n) {
      body.innerHTML = `<p class="cart-empty">Nothing in the cart yet.<br/><a class="link-arrow" href="/#shop">Shop the batch →</a></p>`;
      if (foot) foot.hidden = true;
      return;
    }

    body.innerHTML = Object.entries(cart).map(([id, q]) => {
      const p = byId[id];
      return `<div class="cart-item" data-id="${id}">
        <div>
          <h3>${p.name}</h3>
          <span class="meta">${p.weight} · ${money(p.priceCents)}</span>
        </div>
        <span class="line-total">${money(p.priceCents * q)}</span>
        <div class="stepper">
          <button type="button" data-cart-step="-1" data-id="${id}" aria-label="Decrease ${p.name}">−</button>
          <input type="number" value="${q}" min="0" max="${p.max}" data-cart-qty data-id="${id}" aria-label="${p.name} quantity"/>
          <button type="button" data-cart-step="1" data-id="${id}" aria-label="Increase ${p.name}">+</button>
        </div>
        <button class="remove" type="button" data-remove="${id}">Remove</button>
      </div>`;
    }).join("");

    if (foot) {
      foot.hidden = false;
      const s = subtotal(cart);
      document.getElementById("cart-subtotal").textContent = money(s);
    }
  }

  document.addEventListener("click", (e) => {
    const addBtn = e.target.closest("[data-add]");
    if (addBtn) {
      const id = addBtn.dataset.add;
      const card = addBtn.closest(".card");
      const qty = Math.max(1, Number(card?.querySelector(".stepper input")?.value || 1));
      add(id, qty);
      toast(`${byId[id].name} added`);
      openCart();
      return;
    }
    const step = e.target.closest("[data-cart-step]");
    if (step) {
      const id = step.dataset.id;
      setQty(id, (clean(read())[id] || 0) + Number(step.dataset.cartStep));
      return;
    }
    const rm = e.target.closest("[data-remove]");
    if (rm) { setQty(rm.dataset.remove, 0); return; }

    if (e.target.closest("#cart-open")) { openCart(); return; }
    if (e.target.closest("#cart-close") || e.target === backdrop) { closeCart(); return; }

    // product-card steppers
    const s = e.target.closest("[data-step]");
    if (s && s.closest(".card")) {
      const input = s.closest(".stepper").querySelector("input");
      const max = Number(input.max || 12);
      input.value = String(Math.min(max, Math.max(1, Number(input.value || 1) + Number(s.dataset.step))));
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.matches("[data-cart-qty]")) {
      setQty(e.target.dataset.id, Number(e.target.value) || 0);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer?.classList.contains("open")) closeCart();
  });

  document.addEventListener("cart:change", renderCart);

  /* ------------------------------- checkout ------------------------------ */
  const form = document.getElementById("checkout-form");
  if (form) {
    const itemsEl = document.getElementById("checkout-items");
    const subEl = document.getElementById("sum-subtotal");
    const delRow = document.getElementById("sum-delivery-row");
    const delEl = document.getElementById("sum-delivery");
    const totEl = document.getElementById("sum-total");
    const feeLabel = document.getElementById("delivery-fee-label");
    const addressField = document.getElementById("address-field");
    const errorEl = document.getElementById("form-error");
    const submit = document.getElementById("place-order");

    const feeFor = (sub, method) =>
      method === "delivery" && sub < DELIVERY.freeOverCents ? DELIVERY.feeCents : 0;

    function paint() {
      const cart = clean(read());
      const s = subtotal(cart);
      const method = form.querySelector('input[name="method"]:checked')?.value || "pickup";
      const fee = feeFor(s, method);

      if (!Object.keys(cart).length) {
        itemsEl.innerHTML = `<p class="muted">Your cart is empty. <a href="/#shop">Shop the batch →</a></p>`;
        submit.disabled = true;
      } else {
        itemsEl.innerHTML = `<ul class="sum-items">${Object.entries(cart).map(([id, q]) => {
          const p = byId[id];
          return `<li><span>${p.name} ${p.weight} <span class="q">× ${q}</span></span><span>${money(p.priceCents * q)}</span></li>`;
        }).join("")}</ul>`;
        submit.disabled = false;
      }

      subEl.textContent = money(s);
      delRow.hidden = !fee;
      delEl.textContent = money(fee);
      totEl.textContent = money(s + fee);
      if (feeLabel) feeLabel.textContent = money(DELIVERY.feeCents);
      addressField.hidden = method !== "delivery";
    }

    form.addEventListener("change", paint);
    document.addEventListener("cart:change", paint);
    paint();

    const params = new URLSearchParams(location.search);
    if (params.get("canceled")) {
      errorEl.hidden = false;
      errorEl.textContent = "Payment was cancelled — your cart is still here. Try again when you're ready.";
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      const data = new FormData(form);
      const cart = clean(read());
      const items = Object.entries(cart).map(([id, qty]) => ({ id, qty }));
      if (!items.length) return;

      submit.disabled = true;
      submit.textContent = "Placing order…";

      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items,
            name: data.get("name"),
            email: data.get("email"),
            phone: data.get("phone"),
            method: data.get("method"),
            address: data.get("address"),
            notes: data.get("notes"),
            payment: data.get("payment")
          })
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || "Could not place the order.");
        if (out.url?.startsWith("/")) write({});
        location.href = out.url;
      } catch (err) {
        errorEl.hidden = false;
        errorEl.textContent = err.message;
        submit.disabled = false;
        submit.textContent = "Place order";
      }
    });
  }

  // The order is committed once the success page renders — drop the local cart.
  if (document.body.classList.contains("page-success")) {
    localStorage.removeItem(KEY);
    document.dispatchEvent(new CustomEvent("cart:change"));
  }

  renderCart();
})();

// Copy the order link to the clipboard.
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-copy]");
  if (!btn) return;
  const text = btn.getAttribute("data-copy");
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove();
  }
  const old = btn.textContent;
  btn.textContent = "Copied";
  btn.classList.add("copied");
  setTimeout(() => { btn.textContent = old; btn.classList.remove("copied"); }, 1600);
});
