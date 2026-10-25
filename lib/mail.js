import { site, delivery, money } from "./catalog.js";

/* Outgoing order email through Resend. No SDK — one POST, no dependency.
   Until rebelcreamery.ca is verified in Resend, EMAIL_FROM falls back to the
   shared test sender, which only delivers to the Resend account owner.        */

const KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.EMAIL_FROM || `Rebel Creamery <onboarding@resend.dev>`;
const REPLY_TO = process.env.EMAIL_REPLY_TO || site.email;

const STATUS_LABEL = {
  pending: "awaiting payment",
  awaiting_etransfer: "awaiting your e-Transfer",
  paid: "paid",
  packed: "packed and ready",
  completed: "completed",
  cancelled: "cancelled"
};

export const mailConfigured = () => Boolean(KEY);
export const mailFrom = () => FROM;

async function send({ to, subject, html, text, replyTo = REPLY_TO }) {
  if (!KEY) {
    console.warn("[mail] RESEND_API_KEY not set — skipping", subject);
    return false;
  }
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) {
    console.warn("[mail] bad recipient, skipping:", to);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text, reply_to: replyTo })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[mail] send failed", res.status, body.message || body);
      return false;
    }
    console.log("[mail] sent", body.id, "->", to);
    return true;
  } catch (err) {
    console.error("[mail] send error", err.message);
    return false;
  }
}

function shell(title, inner) {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f7f3ea;font-family:Georgia,'Times New Roman',serif;color:#22201c">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fffdf8;border:1px solid #e4ddcd;border-radius:14px">
    <tr><td style="padding:28px 28px 8px">
      <p style="margin:0 0 18px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#8a7f6d">Rebel Creamery · Calgary</p>
      <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;font-weight:normal">${title}</h1>
    </td></tr>
    <tr><td style="padding:0 28px 28px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#3a352d">
      ${inner}
    </td></tr>
  </table>
  <p style="max-width:560px;margin:14px auto 0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;color:#8a7f6d;text-align:center">
    ${site.name} · ${site.pickupLocation} · <a href="mailto:${site.email}" style="color:#8a7f6d">${site.email}</a>
  </p>
  </body></html>`;
}

function itemsTable(order) {
  const rows = order.items
    .map(
      (it) => `<tr>
        <td style="padding:6px 0;border-bottom:1px solid #efe9dc">${it.name} × ${it.qty}</td>
        <td style="padding:6px 0;border-bottom:1px solid #efe9dc;text-align:right">${money(it.price_cents * it.qty)}</td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 10px;font-size:14px">
    ${rows}
    <tr><td style="padding:8px 0 0">Subtotal</td><td style="padding:8px 0 0;text-align:right">${money(order.subtotal_cents)}</td></tr>
    ${order.delivery_cents ? `<tr><td style="padding:2px 0">Delivery</td><td style="padding:2px 0;text-align:right">${money(order.delivery_cents)}</td></tr>` : ""}
    <tr><td style="padding:8px 0 0;font-weight:600">Total</td><td style="padding:8px 0 0;text-align:right;font-weight:600">${money(order.total_cents)}</td></tr>
  </table>`;
}

function fulfilment(order) {
  if (order.method === "pickup") {
    return `<p style="margin:0 0 6px"><strong>Pickup</strong> — ${site.pickupWindow} at ${site.pickupLocation}</p>`;
  }
  return `<p style="margin:0 0 6px"><strong>Delivery</strong> — ${delivery.windows}${order.address ? ` to ${order.address}` : ""}</p>`;
}

function button(link, label) {
  return `<p style="margin:22px 0 6px"><a href="${link}" style="display:inline-block;background:#1f3b2c;color:#fbf8f1;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px">${label}</a></p>
  <p style="margin:0 0 18px;font-size:12px;color:#8a7f6d;word-break:break-all">${link}</p>`;
}

export async function sendOrderConfirmation(order, link) {
  const etransfer = order.payment === "etransfer" && order.status === "awaiting_etransfer";
  const title = etransfer ? "Almost there — send the e-Transfer" : "You're in the batch";
  const inner = `
    <p style="margin:0 0 14px">Thanks ${order.name.split(" ")[0] || ""} — order <strong>${order.number}</strong> is in the book.</p>
    ${etransfer
      ? `<div style="background:#fdf3e4;border:1px solid #e8cfae;border-radius:10px;padding:14px 16px;margin:0 0 16px">
           <p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8a5a1c">Interac e-Transfer</p>
           <p style="margin:0 0 4px;font-size:22px">${money(order.total_cents)}</p>
           <p style="margin:0">Send to <strong>${process.env.ETRANSFER_EMAIL || site.email}</strong><br/>Message: <strong>${order.number}</strong><br/>No security question — auto-deposit is on.</p>
         </div>`
      : ""}
    ${itemsTable(order)}
    ${fulfilment(order)}
    ${button(link, "View your order")}
    <p style="margin:0 0 6px;font-size:13px;color:#5d5648">Bookmark that link — it shows your order, total and status any time. No account needed.</p>
    <p style="margin:16px 0 0;font-size:13px;color:#5d5648">Need to change something? Reply to this email and quote ${order.number}.</p>`;
  return send({
    to: order.email,
    subject: `Order ${order.number} — ${site.name}`,
    html: shell(title, inner),
    text: [
      `Order ${order.number} — ${site.name}`,
      "",
      ...order.items.map((it) => `${it.name} x${it.qty} — ${money(it.price_cents * it.qty)}`),
      `Total ${money(order.total_cents)}`,
      "",
      etransfer ? `e-Transfer ${money(order.total_cents)} to ${process.env.ETRANSFER_EMAIL || site.email}, message ${order.number}.` : "",
      order.method === "pickup" ? `Pickup: ${site.pickupWindow} at ${site.pickupLocation}` : `Delivery: ${delivery.windows} — ${order.address || ""}`,
      "",
      `Your order: ${link}`
    ].filter(Boolean).join("\n")
  });
}

export async function sendOrderUpdate(order, link) {
  const label = STATUS_LABEL[order.status] || order.status;
  const extra = order.status === "cancelled"
    ? `<p style="margin:0 0 12px">If this wasn't you, reply to this email and we'll sort it out.</p>`
    : `<p style="margin:0 0 12px">${fulfilment(order).replace(/<\/?p[^>]*>/g, "")}</p>`;
  const inner = `
    <p style="margin:0 0 12px">Order <strong>${order.number}</strong> is now <strong>${label}</strong>.</p>
    ${extra}
    ${button(link, "View your order")}`;
  return send({
    to: order.email,
    subject: `Order ${order.number} is ${label} — ${site.name}`,
    html: shell(`Order ${label}`, inner),
    text: `Order ${order.number} is now ${label}.\n\nView it: ${link}`
  });
}
