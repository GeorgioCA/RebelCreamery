import { chromium } from "/workspace/rebel-creamery/node_modules/playwright-core/index.mjs";

const CHROME = "/root/.cache/ms-playwright/chromium-1248/chrome-linux-arm64/chrome";
const BASE = "http://127.0.0.1:3111";
const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const out = [];
const ok = (label, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

const cards = await page.evaluate(() => ({
  groups: document.querySelectorAll("[data-qv-group]").length,
  groupName: document.querySelector(".card-group h3")?.textContent.trim(),
  groupMeta: document.querySelector(".card-group .card-weight")?.textContent.trim(),
  from: document.querySelector(".card-group .card-price")?.innerText.replace(/\s+/g, " ").trim(),
  singles: [...document.querySelectorAll("article.card:not(.card-group)")].map((c) => c.dataset.product),
}));
ok("one card per variant group", cards.groups === 1, JSON.stringify(cards));
ok("card is titled by the group, not a SKU", cards.groupName === "Yogurt", cards.groupName);
ok("members are not rendered as their own cards", !cards.singles.includes("yogurt-6") && !cards.singles.includes("yogurt-3"));
ok("card shows the lowest price as 'from'", /from\s*\$3\.99/i.test(cards.from), cards.from);
ok("card counts the options", /6 options/.test(cards.groupMeta || ""), cards.groupMeta);

// open the group
await page.locator(".card-group .btn-add").click();
await page.waitForSelector("#qv:not([hidden])");
await page.waitForTimeout(150);

const read = () => page.evaluate(() => {
  const q = (s) => document.querySelector(`#qv ${s}`);
  const checked = {};
  for (const g of document.querySelectorAll("#qv .qv-opt")) {
    checked[g.dataset.opt] = [...g.querySelectorAll("[data-opt-value]")].find((b) => b.getAttribute("aria-checked") === "true")?.dataset.optValue;
  }
  return {
    title: q(".qv-copy h2")?.textContent.trim(),
    price: q("[data-qv-price]")?.innerText.replace(/\s+/g, " ").trim(),
    sku: q('[data-spec="sku"] dd')?.textContent.trim(),
    add: q(".qv-actions .btn-add")?.dataset.add,
    addText: q(".qv-actions .btn-add")?.textContent.trim(),
    checked,
    disabled: [...document.querySelectorAll("#qv .qv-opt button:disabled")].map((b) => `${b.closest(".qv-opt").dataset.opt}=${b.dataset.optValue}`),
    options: [...document.querySelectorAll("#qv .qv-opt")].map((g) => [g.dataset.opt, [...g.querySelectorAll("[data-opt-value]")].map((b) => b.dataset.optValue)]),
  };
});

let s = await read();
ok("dialog opens on the group and its options render", s.title === "Yogurt" && s.options.length === 3, JSON.stringify(s.options));
ok("default is the first available member", s.checked["Milk type"] === "Classic" && s.checked["Milk fat"] === "6%" && s.checked["Size"] === "750 g", JSON.stringify(s.checked));
ok("default price / SKU / add target", s.price.startsWith("$3.99") && s.sku === "RC-YOG-6-750" && s.add === "yogurt-6", JSON.stringify(s));

// switch milk type -> organic
await page.locator('#qv .qv-opt[data-opt="Milk type"] [data-opt-value="Organic"]').click();
s = await read();
ok("milk type changes price, SKU and add target", s.price.startsWith("$4.49") && s.sku === "RC-YOG-O-6-750" && s.add === "yogurt-organic-6", JSON.stringify({ p: s.price, sku: s.sku, add: s.add }));

// switch size -> 3.5 kg
await page.locator('#qv .qv-opt[data-opt="Size"] [data-opt-value="3.5 kg"]').click();
s = await read();
ok("size changes price, SKU and add target", s.price.startsWith("$19.99") && s.sku === "RC-YOG-O-6-35" && s.add === "yogurt-organic-6-35kg", JSON.stringify({ p: s.price, sku: s.sku, add: s.add }));
ok("3.5 kg has no 10% variant, so the option is disabled", s.disabled.includes("Milk fat=10%"), JSON.stringify(s.disabled));
ok("weight line follows the selection", /3\.5 kg/.test(s.price), s.price);

// add the selected variant
await page.locator("#qv .qv-actions .btn-add").click();
await page.waitForTimeout(350);
const cart = await page.evaluate(() => ({
  open: document.getElementById("cart").classList.contains("open"),
  qvHidden: document.getElementById("qv").hidden,
  item: document.querySelector("#cart-body .cart-item")?.innerText.replace(/\s+/g, " ").trim(),
  subtotal: document.getElementById("cart-subtotal")?.textContent,
}));
ok("add uses the selected variant", cart.qvHidden && cart.open && /Organic Yogurt 6% 3\.5 kg/.test(cart.item || "") && cart.subtotal === "$19.99", JSON.stringify(cart));
await page.locator("#cart-close").click();
await page.waitForTimeout(250);

// deep link to a member opens the group with that variant selected
await page.goto(BASE + "/#product-yogurt-organic-6-35kg", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
s = await read();
ok("QR deep link preselects its variant inside the group", s.title === "Yogurt" && s.checked["Milk type"] === "Organic" && s.checked["Size"] === "3.5 kg" && s.add === "yogurt-organic-6-35kg", JSON.stringify(s.checked));

// checkout page carries the variant line at the right price
await page.evaluate(() => localStorage.setItem("rc_cart_v1", JSON.stringify({ "yogurt-organic-6-35kg": 1 })));
await page.goto(BASE + "/checkout", { waitUntil: "networkidle" });
const checkout = await page.evaluate(() => ({
  item: document.querySelector(".sum-items li")?.innerText.replace(/\s+/g, " ").trim(),
  total: document.getElementById("sum-total")?.textContent,
}));
ok("checkout keeps the variant name and price", /Organic Yogurt 6% 3\.5 kg/.test(checkout.item || "") && checkout.total === "$19.99", JSON.stringify(checkout));

await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.locator(".card-group .btn-add").click();
await page.waitForSelector("#qv:not([hidden])");
await page.waitForTimeout(200);
await page.screenshot({ path: "/tmp/variants-desktop.png" });
await ctx.close();

// mobile
{
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const p = await m.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.locator(".card-group .btn-add").tap();
  await p.waitForSelector("#qv:not([hidden])");
  await p.waitForTimeout(200);
  const r = await p.evaluate(() => {
    const vh = innerHeight;
    const add = document.querySelector("#qv .qv-actions .btn-add").getBoundingClientRect();
    const copy = document.querySelector("#qv .qv-copy");
    const opts = [...document.querySelectorAll("#qv .qv-opt")].map((g) => {
      const b = g.querySelector("button").getBoundingClientRect();
      return { opt: g.dataset.opt, h: Math.round(b.height), visible: b.top >= 0 && b.bottom <= vh };
    });
    return {
      addVisible: add.top >= 0 && add.bottom <= vh,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      internalScroll: copy.scrollHeight > copy.clientHeight,
      opts,
    };
  });
  ok("mobile: action bar stays visible with three option rows", r.addVisible, JSON.stringify(r));
  ok("mobile: option chips are 40px tap targets", r.opts.every((o) => o.h >= 40), JSON.stringify(r.opts));
  ok("mobile: no horizontal overflow", r.overflowX === 0);
  await p.screenshot({ path: "/tmp/variants-mobile.png" });
  await m.close();
}

ok("no page errors", errors.length === 0, errors.join(" | "));
console.log(out.join("\n"));
console.log(`\n${out.filter((l) => l.startsWith("PASS")).length} passed, ${out.filter((l) => l.startsWith("FAIL")).length} failed`);
await browser.close();
