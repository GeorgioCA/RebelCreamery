import { chromium } from "/workspace/rebel-creamery/node_modules/playwright-core/index.mjs";

const CHROME = "/root/.cache/ms-playwright/chromium-1248/chrome-linux-arm64/chrome";
const BASE = "http://127.0.0.1:3111";
const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const out = [];
const ok = (label, cond, extra = "") => out.push(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);

/* ------------------------------- desktop UI ------------------------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });

  // open from the "Ingredients & details" button on a standalone card
  const card = page.locator(".card").filter({ has: page.locator(".card-more") }).first();
  const trigger = card.locator(".card-more");
  const name = (await card.locator(".card-top h3").innerText()).split("\n")[0].trim();
  await trigger.click();
  await page.waitForSelector("#qv:not([hidden])");

  const info = await page.evaluate(() => {
    const qv = document.getElementById("qv");
    const dlg = document.getElementById("qv-content");
    const h2 = dlg.querySelector(".qv-copy h2");
    const r = dlg.getBoundingClientRect();
    const specs = [...dlg.querySelectorAll(".qv-specs div")].map((d) => d.querySelector("dt").textContent.trim());
    return {
      open: !qv.hidden,
      title: h2.textContent.trim(),
      labelled: dlg.getAttribute("aria-labelledby") && document.getElementById(dlg.getAttribute("aria-labelledby")) === h2,
      specs,
      box: { top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width) },
      inside: r.top >= 0 && r.bottom <= innerHeight,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      locked: getComputedStyle(document.body).overflow,
      focus: document.activeElement?.className,
      cardsWithTpl: document.querySelectorAll("template[data-qv-tpl]").length,
    };
  });
  ok("dialog opens from card button", info.open);
  ok("title matches product", info.title === name, `${info.title} / ${name}`);
  ok("aria-labelledby resolves to the heading", !!info.labelled);
  ok("detail rows rendered", info.specs.includes("Ingredients") && info.specs.includes("Allergens") && info.specs.includes("SKU"), info.specs.join(","));
  ok("inside 1440x900, no page overflow", info.inside && info.overflowX === 0);
  ok("body scroll locked", info.locked === "hidden");
  ok("focus moved to close button", info.focus.includes("qv-close"), info.focus);

  // stepper: 1 -> 3, then Add
  const plus = page.locator("#qv .qv-actions .stepper button").nth(1);
  await plus.click(); await plus.click();
  const qty = await page.locator("#qv .qv-actions .stepper input").inputValue();
  ok("quick-view stepper reaches 3", qty === "3", qty);
  await page.locator("#qv .qv-actions .btn-add").click();
  await page.waitForTimeout(350);
  const afterAdd = await page.evaluate(() => ({
    qvHidden: document.getElementById("qv").hidden,
    cartOpen: document.getElementById("cart").classList.contains("open"),
    line: document.querySelector("#cart-body .cart-item .q")?.textContent
      || [...document.querySelectorAll("#cart-body .cart-item")].map((e) => e.innerText).join(" | "),
    qty: document.querySelector("#cart-body .cart-item input")?.value,
    subtotal: document.getElementById("cart-subtotal")?.textContent,
  }));
  ok("dialog closes on add", afterAdd.qvHidden);
  ok("cart opens after add", afterAdd.cartOpen);
  ok("cart line carries qty 3", afterAdd.qty === "3", JSON.stringify(afterAdd));

  // close cart, reopen, Escape closes and returns focus
  await page.locator("#cart-close").click();
  await page.waitForTimeout(250);
  await page.locator(".card .card-more").first().focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector("#qv:not([hidden])");
  // tab should stay inside
  for (let i = 0; i < 24; i++) await page.keyboard.press("Tab");
  const stillInside = await page.evaluate(() => document.getElementById("qv").contains(document.activeElement));
  ok("focus trap keeps Tab inside the dialog", stillInside);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(120);
  const escState = await page.evaluate(() => ({
    hidden: document.getElementById("qv").hidden,
    focusBack: document.activeElement?.classList.contains("card-more"),
    unlocked: getComputedStyle(document.body).overflow !== "hidden",
  }));
  ok("Escape closes and restores focus", escState.hidden && escState.focusBack && escState.unlocked, JSON.stringify(escState));

  // backdrop click
  await page.locator(".card .card-open").first().click();
  await page.waitForSelector("#qv:not([hidden])");
  await page.mouse.click(20, 450);
  await page.waitForTimeout(120);
  ok("backdrop click closes", await page.evaluate(() => document.getElementById("qv").hidden));

  await page.screenshot({ path: "/tmp/qv-real-desktop.png" });
  await ctx.close();
}

/* ---------------------------- deep link from QR --------------------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/#product-yogurt-6", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => ({
    open: !document.getElementById("qv").hidden,
    title: document.querySelector("#qv-content .qv-copy h2")?.textContent.trim(),
    add: document.querySelector("#qv .btn-add")?.dataset.add,
    hash: location.hash,
  }));
  ok("QR deep link /#product-yogurt-6 opens its group with that variant", r.open && r.title === "Yogurt" && r.add === "yogurt-6", JSON.stringify(r));
  await ctx.close();
}

/* --------------------------------- mobile -------------------------------- */
for (const [label, w, h] of [["390x844", 390, 844], ["375x667", 375, 667], ["320x568", 320, 568]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.locator(".card .card-open").first().tap();
  await page.waitForSelector("#qv:not([hidden])");
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight;
    const panel = document.querySelector(".qv-panel").getBoundingClientRect();
    const add = document.querySelector("#qv .qv-actions .btn-add").getBoundingClientRect();
    const close = document.querySelector("#qv .qv-close").getBoundingClientRect();
    const copy = document.querySelector("#qv .qv-copy");
    return {
      vw, vh,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      panelBottom: Math.round(panel.bottom),
      panelTop: Math.round(panel.top),
      addVisible: add.top >= 0 && add.bottom <= vh,
      addBottom: Math.round(add.bottom),
      closeVisible: close.top >= 0 && close.bottom <= vh && close.right <= vw,
      internalScroll: copy.scrollHeight > copy.clientHeight,
      saveArea: getComputedStyle(document.querySelector("#qv .qv-actions")).paddingBottom,
    };
  });
  ok(`${label}: sheet sits on the bottom edge`, Math.abs(r.panelBottom - r.vh) <= 1, JSON.stringify(r));
  ok(`${label}: Add visible without scrolling`, r.addVisible);
  ok(`${label}: close button on screen`, r.closeVisible);
  ok(`${label}: no horizontal overflow`, r.overflowX === 0, `overflow ${r.overflowX}px`);
  if (label === "390x844") await page.screenshot({ path: "/tmp/qv-real-mobile.png" });
  if (label === "320x568") await page.screenshot({ path: "/tmp/qv-real-320.png" });
  await ctx.close();
}

/* ------------------------------ sold out state ---------------------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const sold = page.locator(".card.is-soldout").first();
  if (await sold.count()) {
    await sold.locator(".card-more").click();
    await page.waitForSelector("#qv:not([hidden])");
    const dis = await page.locator("#qv .btn-add").isDisabled();
    ok("sold-out product opens details with Add disabled", dis);
  } else {
    out.push("SKIP  sold-out product (none in this catalog)");
  }
  await ctx.close();
}

console.log(out.join("\n"));
console.log(`\n${out.filter((l) => l.startsWith("PASS")).length} passed, ${out.filter((l) => l.startsWith("FAIL")).length} failed, ${out.filter((l) => l.startsWith("SKIP")).length} skipped`);
await browser.close();
