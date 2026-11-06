import { chromium } from "/workspace/rebel-creamery/node_modules/playwright-core/index.mjs";

const CHROME = "/root/.cache/ms-playwright/chromium-1248/chrome-linux-arm64/chrome";
const BASE = "https://dev.rebelcreamery.ca";
const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const out = [];
const ok = (label, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  // Cloudflare injects its own beacon at the edge; the shop's CSP blocks it.
  if (m.type() === "error" && !/static\.cloudflareinsights\.com|Content Security Policy/i.test(m.text())) {
    errors.push(m.text());
  }
});
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

const card = await page.evaluate(() => ({
  groups: document.querySelectorAll("[data-qv-group]").length,
  title: document.querySelector(".card-group h3")?.textContent.trim(),
  meta: document.querySelector(".card-group .card-weight")?.textContent.trim(),
  from: document.querySelector(".card-group .card-price")?.innerText.replace(/\s+/g, " ").trim(),
  yogurts: [...document.querySelectorAll("article.card:not(.card-group)")].filter((c) => /yogurt/i.test(c.dataset.product || "")).length,
}));
ok("dev: one Yogurt card", card.groups === 1 && card.title === "Yogurt" && card.yogurts === 0, JSON.stringify(card));
ok("dev: card shows six options and the entry price", /6 options/.test(card.meta || "") && /4\.49/.test(card.from || ""), JSON.stringify(card));

await page.locator(".card-group .btn-add").click();
await page.waitForSelector("#qv:not([hidden])");
await page.waitForTimeout(200);

const read = () => page.evaluate(() => {
  const q = (s) => document.querySelector(`#qv ${s}`);
  const checked = {};
  for (const g of document.querySelectorAll("#qv .qv-opt")) {
    checked[g.dataset.opt] = [...g.querySelectorAll("[data-opt-value]")]
      .find((b) => b.getAttribute("aria-checked") === "true")?.dataset.optValue;
  }
  return {
    title: q(".qv-copy h2")?.textContent.trim(),
    price: q("[data-qv-price]")?.innerText.replace(/\s+/g, " ").trim(),
    sku: q('[data-spec="sku"] dd')?.textContent.trim(),
    add: q(".qv-actions .btn-add")?.dataset.add,
    checked,
    disabled: [...document.querySelectorAll("#qv .qv-opt button:disabled")]
      .map((b) => `${b.closest(".qv-opt").dataset.opt}=${b.dataset.optValue}`),
    dims: [...document.querySelectorAll("#qv .qv-opt")].map((g) => g.dataset.opt),
  };
});

let s = await read();
ok("dev: popup has all three dimensions", s.title === "Yogurt" && s.dims.join(",") === "Milk type,Milk fat,Size", JSON.stringify(s.dims));
ok("dev: default is Classic / 6% / 750 g", s.checked["Milk type"] === "Classic" && s.checked["Milk fat"] === "6%" && s.checked["Size"] === "750 g", JSON.stringify(s.checked));
ok("dev: default price and SKU", s.price.startsWith("$4.49") && s.sku === "RC-YOG-6-750" && s.add === "yogurt-6", JSON.stringify(s));

await page.locator('#qv .qv-opt[data-opt="Milk type"] [data-opt-value="Organic"]').click();
s = await read();
ok("dev: organic repaints price, SKU, add target", s.price.startsWith("$4.99") && s.sku === "RC-YOG-O-6-750" && s.add === "organic-yogurt-6", JSON.stringify(s));

await page.locator('#qv .qv-opt[data-opt="Size"] [data-opt-value="3.5 kg"]').click();
s = await read();
ok("dev: 3.5 kg repaints to the bulk SKU", s.price.startsWith("$19.99") && s.sku === "RC-YOG-O-6-35" && s.add === "organic-yogurt-6-2", JSON.stringify(s));
ok("dev: impossible 10% + 3.5 kg is disabled", s.disabled.includes("Milk fat=10%"), JSON.stringify(s.disabled));

await page.locator("#qv .qv-actions .btn-add").click();
await page.waitForTimeout(400);
const cart = await page.evaluate(() => ({
  open: document.getElementById("cart").classList.contains("open"),
  qvHidden: document.getElementById("qv").hidden,
  item: document.querySelector("#cart-body .cart-item")?.innerText.replace(/\s+/g, " ").trim(),
  subtotal: document.getElementById("cart-subtotal")?.textContent,
}));
ok("dev: add puts the selected variant in the cart", cart.open && cart.qvHidden && /Organic Yogurt 6% 3\.5 kg/.test(cart.item || "") && cart.subtotal === "$19.99", JSON.stringify(cart));
await page.screenshot({ path: "/tmp/dev-variant-cart.png" });
await page.locator("#cart-close").click();
await page.waitForTimeout(300);

await page.goto(BASE + "/#product-yogurt-6", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
s = await read();
ok("dev: QR deep link opens the group at 6% / 750 g", s.title === "Yogurt" && s.checked["Milk fat"] === "6%" && s.add === "yogurt-6", JSON.stringify(s.checked));

await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.locator(".card-group .btn-add").click();
await page.waitForSelector("#qv:not([hidden])");
await page.waitForTimeout(200);
await page.screenshot({ path: "/tmp/dev-variants-desktop.png" });
await ctx.close();

{
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const p = await m.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.locator(".card-group .btn-add").tap();
  await p.waitForSelector("#qv:not([hidden])");
  await p.waitForTimeout(250);
  const r = await p.evaluate(() => {
    const vh = innerHeight;
    const add = document.querySelector("#qv .qv-actions .btn-add").getBoundingClientRect();
    const opts = [...document.querySelectorAll("#qv .qv-opt")].map((g) => {
      const b = g.querySelector("button").getBoundingClientRect();
      return { opt: g.dataset.opt, h: Math.round(b.height) };
    });
    return {
      addVisible: add.top >= 0 && add.bottom <= vh,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      opts,
    };
  });
  ok("dev mobile: add bar visible, chips 40px, no overflow", r.addVisible && r.overflowX === 0 && r.opts.every((o) => o.h >= 40), JSON.stringify(r));
  await p.screenshot({ path: "/tmp/dev-variants-mobile.png" });
  await m.close();
}

ok("dev: no page errors", errors.length === 0, errors.join(" | "));
console.log(out.join("\n"));
console.log(`\n${out.filter((l) => l.startsWith("PASS")).length} passed, ${out.filter((l) => l.startsWith("FAIL")).length} failed`);
await browser.close();
