/* Mail templates build their HTML before Resend is even called — so the builders
   must survive hostile customer input: no ReferenceError (the esc bug that
   dropped every weekly-plan confirmation email) and no raw markup in the
   outgoing HTML (owner alert HTML injection).

   Configuration is read once at import, so the environment is set first. The
   fetch stub captures what mail.js would have POSTed to Resend, and every send
   returns a fictional transport error — nothing leaves the machine.            */

process.env.OWNER_EMAIL = "owner@example.com";
process.env.RESEND_API_KEY = "re_capture_key";
process.env.EMAIL_FROM = "orders@example.com";

let captured = null;
globalThis.fetch = async (_url, init) => {
  captured = String(init?.body || "");
  return { ok: false, status: 500, json: async () => ({}), text: async () => ("captured") };
};

const mail = await import("../lib/mail.js");

/* Names and notes are exactly the strings a checkout form can carry: quotes to
   snap out of JS strings, tags to break out of the HTML, a plan line to hit the
   old esc()-undefined path in fulfilment(), and a discount code with a quote. */
const order = {
  number: "RC-9999",
  name: "Eve `x`'><script>alert(1)</script>",
  email: "eve@example.com",
  phone: "403-555-0100",
  address: '1 Escape "<script>" Way, Calgary',
  notes: "Ring twice, then </p><script>alert(0)</script> please",
  method: "delivery",
  payment: "etransfer",
  status: "awaiting_etransfer",
  subtotal_cents: 1000,
  delivery_cents: 0,
  total_cents: 1000,
  discount_cents: 500,
  discount_code: "EVO'--DROP",
  items: [
    {
      id: "yogurt-6", sku: "RC-YOG-6-750",
      name: "Yogurt'><script>alert(1)</script> 750 g — 8-week plan, 1 a week",
      price_cents: 1000, qty: 1, plan_weeks: 8, plan_tubs: 1
    }
  ]
};

let failures = 0;
const check = (label, ok) => {
  console.log((ok ? "PASS " : "FAIL ") + label);
  if (!ok) failures += 1;
};

const cases = [
  ["sendOrderConfirmation", () => mail.sendOrderConfirmation(order, "https://x/order/t")],
  ["sendOrderUpdate (paid)", () => mail.sendOrderUpdate({ ...order, status: "paid" }, "https://x/order/t")],
  ["sendOwnerOrderAlert", () => mail.sendOwnerOrderAlert(order, "https://x/admin")],
  ["sendEtransferDigest", () => mail.sendEtransferDigest([order], "https://x/admin")],
  ["sendWeeklySummary", () => mail.sendWeeklySummary([order], "https://x/admin")]
];

for (const [label, run] of cases) {
  try {
    await run();
    if (label === "sendOrderConfirmation" || label === "sendOwnerOrderAlert") {
      // these two build the plan-card line and the owner body respectively —
      // the two paths the audit flagged.
      const j = JSON.parse(captured);
      const rawInHtml = /<script[^>]*>?/i.test(j.html);
      check(`${label}: builds without throwing`, true);
      check(`${label}: no raw <script> in outgoing HTML`, !rawInHtml);
      check(`${label}: payload escaped to entities`, j.html.includes("&lt;script&gt;"));
    } else {
      check(`${label}: builds without throwing`, true);
      check(`${label}: no raw <script> in outgoing HTML`, !/<script[^>]*>?/i.test(JSON.parse(captured).html));
    }
  } catch (err) {
    check(`${label}: builds without throwing (threw: ${err})`, false);
  }
}

process.exit(failures ? 1 : 0);
