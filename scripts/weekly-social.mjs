#!/usr/bin/env node
/* Weekly social generator.
   Pulls the live catalog and store settings, then renders three ready-to-post
   images (1080x1350) plus captions. No account access, no posting — the point
   is that nobody stares at a blank page on Sunday morning.

   Usage:
     node scripts/weekly-social.mjs            # uses https://rebelcreamery.ca
     STORE_URL=http://127.0.0.1:3100 node scripts/weekly-social.mjs
     node scripts/weekly-social.mjs --week 45  # force a rotation slot (testing)
*/
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORE_URL = (process.env.STORE_URL || "https://rebelcreamery.ca").replace(/\/$/, "");
const argWeek = process.argv.indexOf("--week");
const FORCED_WEEK = argWeek > -1 ? Number(process.argv[argWeek + 1]) : null;

const MOSS = "#2f4436", CREAM = "#fbf7ef", INK = "#1d2a21", GOLD = "#f4c95d", CLAY = "#a94a20";

function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
}

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const nb = (s = "") => String(s).replace(/(\d)\s*(am|pm)\b/gi, "$1\u00a0$2");
const cutoffLine = (s = "") => {
  const first = String(s || "").split(/ for /i)[0].trim().replace(/\.$/, "");
  return first ? `${first}.` : "Order by Thursday 6 pm.";
};
const cutoffHead = (s = "") => {
  const line = cutoffLine(s);                      // "Order by Wednesday 9 pm."
  const m = line.match(/^(Order by)\s+(.*)$/i);
  return m ? `${m[1]}<br/>${m[2]}` : line;
};

const PROCESS = [
  { head: "Cultured overnight.<br/><em>Not thickened.</em>", body: "Milk and live cultures, left alone. That is the whole recipe." },
  { head: "Cut by hand,<br/><em>drained in cloth.</em>", body: "No starch, no gums, no shortcut that would make it faster." },
  { head: "Brined,<br/><em>never pressed.</em>", body: "Halloumi keeps its squeak because nothing squeezes it flat." },
  { head: "Churned from<br/><em>cultured cream.</em>", body: "Butter that tastes of something, because the cream was cultured first." },
  { head: "Strained for<br/><em>eighteen hours.</em>", body: "Labneh is yogurt that gave up its whey — thick enough to spread." }
];

async function loadStore() {
  const res = await fetch(`${STORE_URL}/api/store.json`);
  if (!res.ok) throw new Error(`store.json ${res.status}`);
  return res.json();
}

function processFor(product, week) {
  const n = `${product.name} ${(product.tags || []).join(" ")}`.toLowerCase();
  if (n.includes("halloumi")) return PROCESS[2];
  if (n.includes("butter")) return PROCESS[3];
  if (n.includes("labneh")) return PROCESS[4];
  if (n.includes("yogurt") || n.includes("yoghurt")) return PROCESS[0];
  if (n.includes("cream cheese") || n.includes("ricotta")) return PROCESS[1];
  return PROCESS[week % PROCESS.length];
}

function pick(products, week) {
  // Products rotate one per week; order is stable so weeks don't repeat until the list does.
  if (!products.length) throw new Error("no active products");
  return products[week % products.length];
}

const cssBase = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1350px;overflow:hidden}
.poster{position:relative;width:1080px;height:1350px;padding:92px;display:flex;flex-direction:column;justify-content:space-between}
.eyebrow{font-family:'Inter';font-size:25px;letter-spacing:.3em;text-transform:uppercase;font-weight:600}
.h1{font-family:'Fraunces';font-size:132px;line-height:.96;letter-spacing:-.02em;font-weight:400}
.rule{width:96px;height:4px;border-radius:2px}
.sub{font-family:'Inter';font-size:30px;line-height:1.45;text-wrap:balance;max-width:840px}
.foot{display:flex;justify-content:space-between;align-items:flex-end;font-family:'Inter';font-size:24px;letter-spacing:.12em;text-transform:uppercase}
`;

function page(fonts, extra, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Fraunces';font-style:normal;font-weight:300 700;src:url(data:font/woff2;base64,${fonts.fraunces}) format('woff2')}
@font-face{font-family:'Inter';font-style:normal;font-weight:400 600;src:url(data:font/woff2;base64,${fonts.inter}) format('woff2')}
${cssBase}${extra}</style></head><body>${body}</body></html>`;
}

function postProduct(store, product, banner, fonts) {
  const price = `$${(product.priceCents / 100).toFixed(2)}`;
  const tags = (product.tags || []).slice(0, 3).join(" · ");
  return page(fonts, `.poster{background:${CREAM};color:${INK}} .price{font-family:'Fraunces';font-size:92px;color:${CLAY}}`,
    `<div class="poster">
      <div class="eyebrow" style="color:#4c5a4f">This week · ${esc(banner)}</div>
      <div>
        <div class="h1" style="font-size:${product.name.length > 14 ? 104 : 126}px">${esc(product.name)}</div>
        <div class="rule" style="background:${GOLD};margin:44px 0 32px"></div>
        <div style="display:flex;align-items:baseline;gap:26px">
          <div class="price">${price}</div>
          <div class="sub" style="color:#4c5a4f">${esc(product.weight || "")}</div>
        </div>
        <div class="sub" style="margin-top:26px;max-width:820px;color:#4c5a4f">${esc(product.note || tags)}</div>
      </div>
      <div class="foot" style="color:#4c5a4f"><span>Made to order</span><span>rebelcreamery.ca</span></div>
    </div>`);
}

function postProcess(step, fonts) {
  return page(fonts, `.poster{background:${MOSS};color:${CREAM}} .h1 em{font-style:italic;color:${GOLD}}`,
    `<div class="poster">
      <div class="eyebrow">How it is made</div>
      <div>
        <div class="h1">${step.head}</div>
        <div class="rule" style="background:${GOLD};margin:46px 0 34px"></div>
        <div class="sub" style="max-width:800px;opacity:.85">${step.body}</div>
      </div>
      <div class="foot" style="opacity:.8"><span>Calgary, Alberta</span><span>rebelcreamery.ca</span></div>
    </div>`);
}

function postCutoff(store, fonts) {
  const pickup = store.site.pickupWindow || "Saturdays";
  const when = nb(store.delivery?.windows ? `Pickup ${pickup}. Delivery ${store.delivery.windows}.` : `Pickup ${pickup}.`);
  return page(fonts, `.poster{background:${GOLD};color:${INK}}`,
    `<div class="poster">
      <div class="eyebrow">Ordering</div>
      <div>
        <div class="h1">${cutoffHead(store.site.cutoff)}</div>
        <div class="rule" style="background:${MOSS};margin:46px 0 34px"></div>
        <div class="sub" style="max-width:860px">${esc(when)} Everything is made after you order, so nothing sits in a cooler waiting.</div>
      </div>
      <div class="foot"><span>Order online</span><span>rebelcreamery.ca</span></div>
    </div>`);
}

function captions(store, product, step) {
  const price = `$${(product.priceCents / 100).toFixed(2)}`;
  return [
    `${product.name}${product.weight ? `, ${product.weight}` : ""} — ${price}.\n\n` +
      `${product.note || "Made in small batches in Calgary."}\n\n` +
      `${cutoffLine(store.site.cutoff)} Pickup Saturday. Link in bio.\n\n` +
      `#yyc #calgary #calgaryfood #smallbatch #artisandairy #yycfood`,
    step.body.replace(/<[^>]+>/g, "") + "\n\n" +
      `Small batches, Alberta milk, no shortcuts. ${cutoffLine(store.site.cutoff)}\n\n` +
      `#yyc #calgary #calgaryeats #smallbatch #madefromscratch #dairy`,
    `${cutoffLine(store.site.cutoff)}\n\n` +
      `Pickup ${nb(store.site.pickupWindow || "Saturdays")} in Calgary, delivery ${nb(store.delivery?.windows || "Friday")}. Everything is made after you order, so nothing sits in a cooler waiting for a buyer.\n\n` +
      `rebelcreamery.ca — link in bio.\n\n` +
      `#yyc #calgary #calgarysmallbusiness #shoplocalyyc #supportlocal`
  ];
}

async function main() {
  const week = FORCED_WEEK ?? isoWeek();
  const store = await loadStore();
  const product = pick(store.products, week);
  const step = processFor(product, week);

  const fonts = {
    fraunces: (await fs.readFile(path.join(ROOT, "public/fonts/fraunces-latin.woff2"))).toString("base64"),
    inter: (await fs.readFile(path.join(ROOT, "public/fonts/inter-latin.woff2"))).toString("base64")
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const outDir = path.join(ROOT, "brand/weekly", `${stamp}-w${week}`);
  await fs.mkdir(outDir, { recursive: true });

  const banner = `Week ${week}`;
  const jobs = [
    { n: "1-product", html: postProduct(store, product, banner, fonts) },
    { n: "2-process", html: postProcess(step, fonts) },
    { n: "3-cutoff", html: postCutoff(store, fonts) }
  ];

  // playwright-core ships no browser; use the Chromium already on the box when
  // the bundled one is absent (the sandbox keeps playwright's python build).
  let executablePath = process.env.CHROME_PATH;
  if (!executablePath) {
    try {
      executablePath = chromium.executablePath();
    } catch { executablePath = undefined; }
  }
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(executablePath ? { executablePath } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1350 }, device_scale_factor: 1 });
  const p = await ctx.newPage();
  const files = [];
  for (const job of jobs) {
    const htmlPath = path.join(outDir, `${job.n}.html`);
    await fs.writeFile(htmlPath, job.html);
    await p.goto("file://" + htmlPath);
    await p.waitForTimeout(300);
    const png = path.join(outDir, `${job.n}.png`);
    await p.screenshot({ path: png, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
    files.push(png);
  }
  await browser.close();

  const caps = captions(store, product, step);
  await fs.writeFile(path.join(outDir, "captions.txt"),
    caps.map((c, i) => `--- POST ${i + 1} ---\n${c}\n`).join("\n"));

  console.log(JSON.stringify({ week, product: product.name, outDir, files, captions: caps, step: step.head.replace(/<[^>]+>/g, " ") }, null, 2));
}

main().catch((err) => { console.error(err.message); process.exit(1); });
