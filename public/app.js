/* Rebel Creamery — cart + checkout. No framework, no build step. */
(() => {
  const CATALOG = window.__CATALOG__ || [];
  const DELIVERY = window.__DELIVERY__ || { feeCents: 800, freeOverCents: 4000 };
  const KEY = "rc_cart_v1";
  // Sale price wins when it is set and lower than the regular price.
  const priceOf = (p) => (p && p.saleCents && p.saleCents < p.priceCents ? p.saleCents : (p ? p.priceCents : 0));
  const byId = Object.fromEntries(CATALOG.map((p) => [p.id, p]));
  const money = (c) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(c / 100);
  const esc = (s = "") =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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
  /* Cart keys: "yogurt-6" for a one-off, "plan:yogurt-6:8:2" for a card that is
     8 weeks of 2 tubs. A card is one line at the block price; its tubs live on
     the server, so its quantity is always 1 and it never counts against stock. */
  const PLAN_WEEKS = [4, 8, 12];
  const PLAN_TUBS = [1, 2, 3];
  const planKey = (id, weeks, tubs = 1) => `plan:${id}:${weeks}:${tubs}`;
  const parseKey = (key) => {
    const m = /^plan:([^:]+):(\d+)(?::(\d+))?$/.exec(key);
    return m
      ? { plan: true, id: m[1], weeks: Number(m[2]), tubs: Number(m[3] || 1) }
      : { plan: false, id: key, weeks: 0, tubs: 0 };
  };
  const credited = (weeks) => (weeks >= 12 ? weeks + 1 : weeks);

  function lineFor(key) {
    const { plan, id, weeks, tubs } = parseKey(key);
    const p = byId[id];
    if (!p) return null;
    const unit = priceOf(p);
    if (!plan) {
      return { key, plan: false, p, weeks: 0, tubs: 0, qtyMax: p.max, price: unit, unit,
        label: `${p.name} ${p.weight}`.trim() };
    }
    if (!PLAN_WEEKS.includes(weeks) || !PLAN_TUBS.includes(tubs) || !p.subscribable) return null;
    return { key, plan: true, p, weeks, tubs, qtyMax: 1, price: unit * weeks * tubs, unit,
      label: `${p.name} ${p.weight} — ${weeks}-week subscription × ${tubs}` };
  }

  const count = (cart) => Object.values(cart).reduce((a, b) => a + b, 0);
  const subtotal = (cart) =>
    Object.entries(cart).reduce((s, [k, q]) => { const l = lineFor(k); return s + (l ? l.price * q : 0); }, 0);
  const clean = (cart) => Object.fromEntries(Object.entries(cart).flatMap(([k, q]) => {
    const l = lineFor(k);
    if (!l || !(q > 0)) return [];
    return [[k, l.plan ? 1 : Math.min(q, l.qtyMax)]];
  }));
  const hasPlan = (cart) => Object.keys(cart).some((k) => parseKey(k).plan);

  function add(id, qty) {
    const cart = clean(read());
    if (!byId[id]) return;
    cart[id] = Math.min((cart[id] || 0) + qty, byId[id].max);
    write(cart);
  }
  function addPlan(id, weeks) {
    const p = byId[id];
    if (!p || !p.subscribable || !PLAN_WEEKS.includes(Number(weeks))) return null;
    const cart = clean(read());
    const key = planKey(id, Number(weeks));
    cart[key] = 1;
    write(cart);
    return key;
  }
  function setQty(key, qty) {
    const cart = clean(read());
    const l = lineFor(key);
    if (!l) return;
    if (qty <= 0) delete cart[key];
    else cart[key] = l.plan ? 1 : Math.min(qty, l.qtyMax);
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

    body.innerHTML = Object.entries(cart).map(([key, q]) => {
      const l = lineFor(key);
      if (!l) return "";
      const sale = !l.plan && l.p.saleCents && l.p.saleCents < l.p.priceCents;
      const meta = l.plan
        ? `${l.weeks} weeks · ${credited(l.weeks)} tubs · ${money(l.unit)} a tub`
        : `${esc(l.p.weight)} · ${money(l.unit)}${sale ? " sale" : ""}`;
      const control = l.plan
        ? `<span class="qty-fixed">1 card</span>`
        : `<div class="stepper">
          <button type="button" data-cart-step="-1" data-id="${esc(key)}" aria-label="Decrease ${esc(l.p.name)}">−</button>
          <input type="number" value="${q}" min="0" max="${l.qtyMax}" data-cart-qty data-id="${esc(key)}" aria-label="${esc(l.p.name)} quantity"/>
          <button type="button" data-cart-step="1" data-id="${esc(key)}" aria-label="Increase ${esc(l.p.name)}">+</button>
        </div>`;
      return `<div class="cart-item${l.plan ? " is-plan" : ""}" data-id="${esc(key)}">
        <div>
          <h3>${esc(l.p.name)}${l.plan ? ` <span class="tag-card">Weekly card</span>` : ""}</h3>
          <span class="meta">${meta}</span>
        </div>
        <span class="line-total">${money(l.price * q)}</span>
        ${control}
        <button class="remove" type="button" data-remove="${esc(key)}">Remove</button>
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
    const discInput = document.getElementById("discount-code");
    const discBtn = document.getElementById("discount-apply");
    const discMsg = document.getElementById("discount-msg");
    const discRow = document.getElementById("sum-discount-row");
    const discEl = document.getElementById("sum-discount");
    let disc = { code: "", amountCents: 0 };
    const feeLabel = document.getElementById("delivery-fee-label");
    const addressField = document.getElementById("address-field");
    const errorEl = document.getElementById("form-error");
    const submit = document.getElementById("place-order");

    // Old subscribe links land here with ?plan=<id>&weeks=<n>: drop the card
    // into the cart once, then behave like any other basket.
    const SEED = window.__SEED_PLAN__ || null;
    if (SEED) {
      const key = planKey(SEED.id, Number(SEED.weeks));
      const cart = clean(read());
      if (!cart[key]) { cart[key] = 1; write(cart); }
      if (history.replaceState) history.replaceState({}, "", "/checkout");
    }

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
        itemsEl.innerHTML = `<ul class="sum-items">${Object.entries(cart).map(([key, q]) => {
          const l = lineFor(key);
          if (!l) return "";
          const title = `${l.p.name} ${l.p.weight}`.trim();
          // Name left, price right. The picker below carries the same two lines
          // the plan reads as, so the control explains itself.
          const choices = [{ weeks: 0, tubs: 0, main: "One-off", sub: `1 tub · ${money(l.unit)} a tub` }];
          for (const w of PLAN_WEEKS) {
            for (const n of PLAN_TUBS) {
              choices.push({
                weeks: w,
                tubs: n,
                main: `${w}-week subscription × ${n}`,
                sub: `${credited(w) * n} tubs · ${money(l.unit)} a tub`
              });
            }
          }
          const chosen = choices.find((c) => c.weeks === (l.plan ? l.weeks : 0) && c.tubs === (l.plan ? l.tubs : 0)) || choices[0];
          const ctl = l.p.subscribable ? `<details class="plan-pick">
            <summary>
              <span class="sr-only">Change how ${esc(l.p.name)} is bought</span>
              <span class="pp-main">${esc(chosen.main)}</span>
              <span class="pp-sub">${esc(chosen.sub)}</span>
            </summary>
            <div class="pp-menu" role="listbox" aria-label="How ${esc(l.p.name)} is bought">
              ${choices.map((c) => `<button type="button" role="option" aria-selected="${c.weeks === chosen.weeks && c.tubs === chosen.tubs}"
                data-pick-for="${esc(l.p.id)}" data-pick-weeks="${c.weeks}" data-pick-tubs="${c.tubs}">
                <span class="pp-main">${esc(c.main)}</span>
                <span class="pp-sub">${esc(c.sub)}</span>
              </button>`).join("")}
            </div>
          </details>` : "";
          return `<li${l.plan ? ' class="is-plan"' : ""}>
            <div class="line-main">
              <span>${esc(title)}${l.plan ? "" : ` <span class="q">× ${q}</span>`}</span>
              <span>${money(l.price * q)}</span>
            </div>
            ${ctl}
          </li>`;
        }).join("")}</ul>`;
        submit.disabled = false;
      }

      // A card means week 1 ships with this order and the rest are collected.
      const card = hasPlan(cart);
      for (const el of [document.getElementById("plan-note"), document.getElementById("plan-note-aside")]) {
        if (!el) continue;
        el.hidden = !card;
        el.textContent = card
          ? (method === "delivery"
              ? "Week 1 of your subscription is in this delivery. The rest are collected at pickup, one a week."
              : "Week 1 of your subscription is in this order. The rest are collected at pickup, one a week.")
          : "";
      }

      const d = Math.min(disc.amountCents, s);
      subEl.textContent = money(s);
      delRow.hidden = !fee;
      delEl.textContent = money(fee);
      discRow.hidden = !d;
      if (discEl) discEl.textContent = "−" + money(d);
      const discLabel = document.getElementById("sum-discount-label");
      if (discLabel) discLabel.textContent = disc.code ? `Discount · ${disc.code}` : "Discount";
      totEl.textContent = money(Math.max(0, s - d + fee));
      if (feeLabel) feeLabel.textContent = money(DELIVERY.feeCents);
      addressField.hidden = method !== "delivery";
    }

    async function applyCode() {
      if (disc.code) {           // second press removes the code
        disc = { code: "", amountCents: 0 };
        if (discInput) { discInput.value = ""; discInput.readOnly = false; }
        if (discBtn) { discBtn.textContent = "Apply"; discBtn.classList.remove("ghost"); }
        if (discMsg) { discMsg.textContent = ""; discMsg.className = "discount-msg"; }
        paint();
        return;
      }
      const code = (discInput?.value || "").trim();
      if (!code) {
        disc = { code: "", amountCents: 0 };
        if (discMsg) discMsg.textContent = "";
        paint();
        return;
      }
      const s = subtotal(clean(read()));
      try {
        const r = await fetch(`/api/discount?code=${encodeURIComponent(code)}&subtotal=${s}`).then((x) => x.json());
        if (r.ok) {
          disc = { code: r.code, amountCents: r.amountCents };
          if (discMsg) { discMsg.textContent = `${r.label} applied`; discMsg.className = "discount-msg ok"; }
          // Applied state: the input locks and the button becomes the way out.
          if (discInput) discInput.readOnly = true;
          if (discBtn) { discBtn.textContent = "Remove"; discBtn.classList.add("ghost"); }
        } else {
          disc = { code: "", amountCents: 0 };
          if (discInput) discInput.readOnly = false;
          if (discBtn) discBtn.textContent = "Apply";
          if (discMsg) { discMsg.textContent = r.error || "That code didn't work."; discMsg.className = "discount-msg bad"; }
        }
      } catch {
        if (discMsg) { discMsg.textContent = "Could not check that code."; discMsg.className = "discount-msg bad"; }
      }
      paint();
    }
    discBtn?.addEventListener("click", applyCode);
    discInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); applyCode(); } });

    // Cart or fulfilment changes can invalidate a code (e.g. minimum spend).
    async function revalidate() {
      if (!disc.code) return;
      const code = disc.code;
      disc = { code: "", amountCents: 0 };
      if (discInput) { discInput.readOnly = false; discInput.value = code; }
      if (discBtn) discBtn.textContent = "Apply";
      await applyCode();
    }
    form.addEventListener("change", () => { paint(); revalidate(); });
    document.addEventListener("cart:change", paint);
    // Turning a line into a subscription (and back) happens at checkout, on the
    // line itself. Rebuild in place so converting doesn't shuffle the basket.
    function setLineMode(id, weeks, tubs) {
      const cart = clean(read());
      const next = {};
      for (const [k, v] of Object.entries(cart)) {
        const parsed = parseKey(k);
        if (parsed.id !== id) { next[k] = v; continue; }
        next[weeks ? planKey(id, weeks, tubs) : id] = 1;
      }
      write(next);
      revalidate();
    }
    if (itemsEl) {
      itemsEl.addEventListener("click", (e) => {
        const pick = e.target.closest("[data-pick-for]");
        if (!pick) return;
        e.preventDefault();
        const box = pick.closest("details");
        if (box) box.open = false;
        setLineMode(pick.dataset.pickFor, Number(pick.dataset.pickWeeks), Number(pick.dataset.pickTubs));
      });
      // A click anywhere else puts an open picker away.
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".plan-pick")) {
          for (const d of itemsEl.querySelectorAll(".plan-pick[open]")) d.open = false;
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") for (const d of itemsEl.querySelectorAll(".plan-pick[open]")) d.open = false;
      });
    }
    paint();

    /* ------------------------ delivery address parts ----------------------- */
    const streetEl = form.querySelector('[name="street"]');
    const cityEl = form.querySelector('[name="city"]');
    const provEl = form.querySelector('[name="province"]');
    const postalEl = form.querySelector('[name="postal"]');
    const unitEl = form.querySelector('[name="unit"]');
    const sugEl = document.getElementById("addr-suggest");

    let sugTimer, sugItems = [], sugIndex = -1, lastQuery = "";

    const hideSuggest = () => { sugEl.hidden = true; sugEl.innerHTML = ""; sugItems = []; sugIndex = -1; };
    const paintActive = () => [...sugEl.children].forEach((li, i) => li.classList.toggle("active", i === sugIndex));

    function showSuggest(list) {
      sugItems = list; sugIndex = -1;
      if (!list.length) return hideSuggest();
      sugEl.innerHTML = list.map((r, i) => `<li role="option" data-i="${i}">${esc(r.label)}</li>`).join("");
      sugEl.hidden = false;
    }

    function choose(i) {
      const r = sugItems[i];
      if (!r) return;
      streetEl.value = r.street || "";
      if (r.city) cityEl.value = r.city;
      if (r.province) provEl.value = r.province;
      if (r.postal) postalEl.value = r.postal;
      hideSuggest();
      (unitEl.value ? postalEl : unitEl).focus();
    }

    if (streetEl && sugEl) {
      streetEl.addEventListener("input", () => {
        const q = streetEl.value.trim();
        clearTimeout(sugTimer);
        if (q.length < 4) return hideSuggest();
        if (q === lastQuery) return;
        sugTimer = setTimeout(async () => {
          lastQuery = q;
          try {
            const r = await fetch(`/api/address?q=${encodeURIComponent(q)}`);
            const d = await r.json();
            if (streetEl.value.trim() !== q) return;
            showSuggest(d.results || []);
          } catch { hideSuggest(); }
        }, 250);
      });

      streetEl.addEventListener("keydown", (e) => {
        if (sugEl.hidden) return;
        if (e.key === "ArrowDown") { e.preventDefault(); sugIndex = Math.min(sugIndex + 1, sugItems.length - 1); paintActive(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); sugIndex = Math.max(sugIndex - 1, 0); paintActive(); }
        else if (e.key === "Enter" && sugIndex >= 0) { e.preventDefault(); choose(sugIndex); }
        else if (e.key === "Escape") hideSuggest();
      });

      sugEl.addEventListener("click", (e) => {
        const li = e.target.closest("li[data-i]");
        if (li) choose(Number(li.dataset.i));
      });

      document.addEventListener("click", (e) => {
        if (!e.target.closest(".addr-wrap")) hideSuggest();
      });
    }

    if (postalEl) {
      postalEl.addEventListener("blur", async () => {
        const raw = postalEl.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        if (raw.length !== 6) return;
        postalEl.value = `${raw.slice(0, 3)} ${raw.slice(3)}`;
        try {
          const r = await fetch(`/api/postal/${raw.slice(0, 3)}`);
          const d = await r.json();
          if (d.ok) {
            if (d.city) cityEl.value = d.city;
            if (d.province) provEl.value = d.province;
          }
        } catch {}
      });
    }

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
      const items = Object.entries(cart).map(([key, qty]) => {
        const { plan, id, weeks, tubs } = parseKey(key);
        return plan ? { id, qty: 1, planWeeks: weeks, tubsPerWeek: tubs } : { id, qty };
      });
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
            unit: data.get("unit"),
            street: data.get("street"),
            city: data.get("city"),
            province: data.get("province"),
            postal: data.get("postal"),
            notes: data.get("notes"),
            payment: data.get("payment"),
            code: disc.code
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
