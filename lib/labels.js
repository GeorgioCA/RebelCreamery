import { site, delivery } from "./catalog.js";

const BUSINESS_LINE = process.env.BUSINESS_ADDRESS || "Rebel Creamery · Calgary, AB";
const STORAGE = "Keep refrigerated";

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
    meta: [`Packed ${fmtDate(packed)}`, `Best before ${fmtDate(best)}`],
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
  .sheet { width: 62mm; min-height: 40mm; background: #fff; margin: 8mm auto; padding: 3mm; }
  .brand { font-size: 6pt; letter-spacing: .18em; text-transform: uppercase; font-weight: 700; }
  .rule { border-top: .4mm solid #000; margin: 1.2mm 0; }
  h1 { font-size: 15pt; line-height: 1.05; margin: 1.5mm 0 0; letter-spacing: -.2pt; }
  .sub { font-size: 9pt; font-weight: 700; letter-spacing: .04em; margin-top: .6mm; }
  .person { font-size: 13pt; font-weight: 700; margin: 2mm 0 1mm; }
  .meta { font-size: 7.5pt; line-height: 1.3; }
  .items { margin: 2mm 0 0; padding: 0; list-style: none; }
  .items li { font-size: 10pt; line-height: 1.35; display: flex; gap: 2mm; }
  .items .q { font-weight: 700; min-width: 6mm; }
  .ing { font-size: 6.8pt; line-height: 1.28; margin-top: 1.5mm; }
  .allergen { font-size: 7.6pt; font-weight: 700; margin-top: 1.5mm; }
  .foot { font-size: 6.4pt; line-height: 1.3; margin-top: 2mm; border-top: .3mm solid #000; padding-top: 1.2mm; }
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

export function renderProductLabelHTML(product) {
  const d = productLabel(product);
  return shell(`
    <div class="brand">${esc(site.name)}</div>
    <div class="rule"></div>
    <h1>${esc(d.title)}</h1>
    <div class="sub">${esc(d.subtitle)}</div>
    <div class="ing">${esc(d.ingredients)}</div>
    <div class="allergen">Contains: ${esc(d.allergens)}</div>
    <div class="meta" style="margin-top:1.5mm">${d.meta.map(esc).join("<br/>")}</div>
    <div class="foot">${d.footer.map(esc).join("<br/>")}</div>`, `Label ${product.name}`);
}
