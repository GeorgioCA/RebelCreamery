import qrcode from "qrcode-generator";
import { site, delivery } from "./catalog.js";

const BUSINESS_LINE = process.env.BUSINESS_ADDRESS || "Rebel Creamery · Calgary, AB";
const STORAGE = "Keep refrigerated";
const PUBLIC_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");

const fmtDate = (d) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", month: "short", day: "numeric", year: "numeric" }).format(d);

/** Label payload consumed by the print agent (and rendered as HTML for browser printing). */
export function orderLabel(order) {
  return {
    kind: "order",
    brand: site.name,
    title: `#${order.number}`,
    subtitle: order.method === "pickup" ? "PICKUP" : "DELIVERY",
    person: order.name,
    meta: [
      order.method === "pickup" ? site.pickupWindow : delivery.windows,
      order.method === "pickup" ? site.pickupLocation : order.address || ""
    ].filter(Boolean),
    items: order.items.map((i) => ({ qty: i.qty, name: i.name })),
    footer: [fmtDate(new Date(order.created_at)), STORAGE, BUSINESS_LINE]
  };
}

/* A thank-you sticker for the bag, on the same 62 mm roll as the other labels.
   Deliberately built from the generic fields (heading/subheading/body/footer)
   so older print agents render it without an update. */
export function thankYouLabel(order) {
  const raw = String(order.name || "").trim().split(/\s+/)[0] || "";
  // Names typed in caps ("GEORGIO") read as shouting on a sticker; title-case
  // only that case, so "McDonald" or "husam" are left as the customer wrote them.
  const firstName = raw && raw === raw.toUpperCase()
    ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
    : raw;
  return {
    kind: "thankyou",
    brand: site.name,
    heading: "Thank you",
    subheading: firstName,
    body: `Made in small batches in Calgary. Tell us how it turned out — ${site.email || "hello@rebelcreamery.ca"}`,
    footer: [
      `Order ${order.number}`,
      site.instagram ? `Instagram ${site.instagram}` : null,
      BUSINESS_LINE
    ].filter(Boolean)
  };
}

/** A product's QR, as a module matrix the print agent can draw without any
    QR library of its own. The URL lands on the product card on the shop page. */
function productQr(product, sizeMm = 16) {
  if (!PUBLIC_URL) return null;
  const url = `${PUBLIC_URL}/#product-${product.id}`;
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  const rows = [];
  for (let r = 0; r < n; r++) {
    let line = "";
    for (let c = 0; c < n; c++) line += qr.isDark(r, c) ? "1" : "0";
    rows.push(line);
  }
  return { url, size_mm: sizeMm, modules: n, rows };
}

export function productLabel(product, copies = 1) {
  const packed = new Date();
  const best = new Date(packed.getTime() + (product.shelfLifeDays || 14) * 86400000);
  return {
    kind: "product",
    brand: site.name,
    copies,
    title: product.name,
    subtitle: product.weight,
    ingredients: product.ingredients || "",
    allergens: product.allergens || "Milk",
    meta: [`Packed ${fmtDate(packed)}`, `Best before ${fmtDate(best)}`, product.sku ? `SKU ${product.sku}` : null].filter(Boolean),
    qr: productQr(product),
    footer: [STORAGE, BUSINESS_LINE]
  };
}

/* ------------------------------ HTML labels ------------------------------ */
// 62 mm wide, printed from the browser via /admin/labels/... (Brother driver installed).

const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function shell(inner, title) {
  return `<!doctype html>
<html lang="en-CA"><head><meta charset="utf-8"/>
<title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @page { size: 62mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #eee; font-family: "Helvetica Neue", Arial, sans-serif; color: #000; }
  .sheet { width: 62mm; min-height: 40mm; background: #fff; margin: 8mm auto; padding: 3mm; --ts: 1.2; }
  .brand { font-size: calc(6pt * var(--ts)); letter-spacing: .18em; text-transform: uppercase; font-weight: 700; }
  .rule { border-top: .4mm solid #000; margin: 1.2mm 0; }
  h1 { font-size: calc(15pt * var(--ts)); line-height: 1.05; margin: 1.5mm 0 0; letter-spacing: -.2pt; }
  .sub { font-size: calc(9pt * var(--ts)); font-weight: 700; letter-spacing: .04em; margin-top: .6mm; }
  .person { font-size: calc(13pt * var(--ts)); font-weight: 700; margin: 2mm 0 1mm; }
  .meta { font-size: calc(7.5pt * var(--ts)); line-height: 1.3; }
  .items { margin: 2mm 0 0; padding: 0; list-style: none; }
  .items li { font-size: calc(10pt * var(--ts)); line-height: 1.35; display: flex; gap: 2mm; }
  .items .q { font-weight: 700; min-width: 6mm; }
  .ing { font-size: calc(6.8pt * var(--ts)); line-height: 1.28; margin-top: 1.5mm; }
  .allergen { font-size: calc(7.6pt * var(--ts)); font-weight: 700; margin-top: 1.5mm; }
  .qr { display: flex; align-items: center; gap: 3mm; margin-top: 2.5mm; }
  .qr svg { width: 16mm; height: 16mm; flex: 0 0 auto; }
  .qr .qr-text { font-size: calc(7.6pt * var(--ts)); font-weight: 700; line-height: 1.25; }
  .foot { font-size: calc(6.4pt * var(--ts)); line-height: 1.3; margin-top: 2mm; border-top: .3mm solid #000; padding-top: 1.2mm; }
</style></head>
<body><div class="sheet">${inner}</div>
<script>window.addEventListener("load", () => setTimeout(() => window.print(), 250));</script>
</body></html>`;
}

export function renderOrderLabelHTML(order) {
  const d = orderLabel(order);
  return shell(`
    <div class="brand">${esc(site.name)}</div>
    <div class="rule"></div>
    <h1>${esc(d.title)}</h1>
    <div class="sub">${esc(d.subtitle)}</div>
    <div class="person">${esc(d.person)}</div>
    <div class="meta">${d.meta.map(esc).join("<br/>")}</div>
    <ul class="items">${d.items.map((i) => `<li><span class="q">${i.qty}×</span><span>${esc(i.name)}</span></li>`).join("")}</ul>
    <div class="foot">${d.footer.map(esc).join("<br/>")}</div>`, `Label ${order.number}`);
}

export function renderThankYouLabelHTML(order) {
  const d = thankYouLabel(order);
  return shell(`
    <div class="brand">${esc(site.name)}</div>
    <div class="rule"></div>
    <h1>${esc(d.heading)}</h1>
    ${d.subheading ? `<div class="person">${esc(d.subheading)}</div>` : ""}
    <div class="meta" style="margin-top:2mm">${esc(d.body)}</div>
    <div class="foot">${d.footer.map(esc).join("<br/>")}</div>`, `Thank you ${order.number}`);
}

function qrSvg(qr) {
  if (!qr) return "";
  const n = qr.modules;
  const quiet = 4;
  const dim = n + quiet * 2;
  const cells = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.rows[r][c] === "1") cells.push(`<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="Scan to reorder">
    <rect width="${dim}" height="${dim}" fill="#fff"/><g fill="#000">${cells.join("")}</g></svg>`;
}

export function renderProductLabelHTML(product) {
  const d = productLabel(product);
  return shell(`
    <div class="brand">${esc(site.name)}</div>
    <div class="rule"></div>
    <h1>${esc(d.title)}</h1>
    <div class="sub">${esc(d.subtitle)}</div>
    <div class="ing">${esc(d.ingredients)}</div>
    <div class="allergen">Contains: ${esc(d.allergens)}</div>
    ${d.qr ? `<div class="qr">${qrSvg(d.qr)}<span class="qr-text">Scan to<br/>reorder</span></div>` : ""}
    <div class="meta" style="margin-top:1.5mm">${d.meta.map(esc).join("<br/>")}</div>
    <div class="foot">${d.footer.map(esc).join("<br/>")}</div>`, `Label ${product.name}`);
}
