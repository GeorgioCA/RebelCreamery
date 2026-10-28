import { getDiscount } from "./db.js";
import { money } from "./catalog.js";

/* One place that decides whether a code may be used, so the checkout API, the
   preview endpoint and the order creation path can never disagree.            */
export function evaluateDiscount(rawCode, subtotalCents, now = new Date()) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a code." };
  const d = getDiscount(code);
  if (!d) return { ok: false, error: "That code isn't valid." };
  if (!d.active) return { ok: false, error: "That code is no longer active." };
  if (d.expires_at && new Date(d.expires_at) < now) return { ok: false, error: "That code has expired." };
  if (d.max_uses != null && d.uses >= d.max_uses) return { ok: false, error: "That code has been used up." };
  if (subtotalCents < d.min_subtotal_cents) {
    return { ok: false, error: `Spend ${money(d.min_subtotal_cents)} to use this code.` };
  }

  const amountCents = d.kind === "fixed"
    ? Math.min(d.value, subtotalCents)
    : Math.round((subtotalCents * Math.min(100, Math.max(0, d.value))) / 100);

  if (amountCents <= 0) return { ok: false, error: "That code doesn't apply to this order." };
  return {
    ok: true,
    code: d.code,
    amountCents,
    label: d.kind === "fixed" ? `${money(amountCents)} off` : `${d.value}% off`
  };
}
