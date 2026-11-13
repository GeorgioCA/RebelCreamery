// Store configuration and the seed catalog.
// Products live in the database at runtime — this file is only used to seed an empty store
// and to define the built-in illustration styles.

export const site = {
  name: process.env.SITE_NAME || "Rebel Creamery",
  tagline: process.env.SITE_TAGLINE || "Small-batch dairy, made in Calgary.",
  email: process.env.CONTACT_EMAIL || "hello@rebelcreamery.ca",
  phone: process.env.CONTACT_PHONE || "",
  city: "Calgary, Alberta",
  pickupLocation: process.env.PICKUP_LOCATION || "1008 9 St SW, Calgary, AB T2R 1B1",
  pickupWindow: process.env.PICKUP_WINDOW || "Saturdays, 9 am – 2 pm",
  cutoff: process.env.CUTOFF_TEXT || "Order by Thursday 6 pm for weekend pickup",
  instagram: process.env.INSTAGRAM || "",
  // Separate metrics container. Empty hides the back-office link, so a fork
  // without the sidecar shows nothing rather than a dead link.
  metricsUrl: process.env.METRICS_URL || "",
  // Umami (self-hosted analytics). The script only renders when both are set;
  // admin pages and the order page are excluded in the layout.
  umamiSrc: process.env.UMAMI_SCRIPT_URL || "",
  umamiWebsiteId: process.env.UMAMI_WEBSITE_ID || "",
  // Dashboard URL for the back-office link (Umami lives on its own host).
  analyticsUrl: process.env.ANALYTICS_URL || "",
  etransferEmail: process.env.ETRANSFER_EMAIL || process.env.CONTACT_EMAIL || "hello@rebelcreamery.ca",
  // Food sold as basic groceries is zero-rated in Canada, so no tax line is applied.
  licence: process.env.LICENCE_TEXT || "Made in Alberta under provincial food-safety rules. Licensing and inspection details available on request."
};

// Weekly cards: how many tubs a household may take per week. Editable in
// /admin/settings, because that number is a packing decision, not code.
export const plans = {
  maxTubsPerWeek: Number(process.env.PLAN_MAX_TUBS_PER_WEEK || 3)
};

// Made to order: stock is capacity, not a gate. MADE_TO_ORDER=0 makes every
// product's stock a hard limit. A single product can opt into a hard count
// either way with its own `count_stock` flag, so one batch can sell out while
// the rest of the catalogue stays made to order.
export const MADE_TO_ORDER = process.env.MADE_TO_ORDER !== "0";
export const countsStock = (p) => !!p?.countStock || !MADE_TO_ORDER;

export const delivery = {
  feeCents: Number(process.env.DELIVERY_FEE_CENTS || 800),
  freeOverCents: Number(process.env.FREE_DELIVERY_THRESHOLD_CENTS || 4000),
  area: process.env.DELIVERY_AREA || "Calgary city limits",
  windows: process.env.DELIVERY_WINDOWS || "Fridays, 12 – 6 pm",
  // Percentages offered to the buyer at checkout when they choose delivery.
  // Editable in /admin/settings; the server accepts only these values.
  tipPresets: [5, 10, 15]
};

export const DEFAULT_TIP_PRESETS = [5, 10, 15];
export const TIP_MAX_CENTS = 10000; // $100 — a cap, not a suggestion

/* "5, 10, 15" -> [5,10,15]. Anything unusable falls back to the default, so a
   typo in the settings form cannot remove the tip option or create a 0%.     */
export function parseTipPresets(raw) {
  const list = String(raw ?? "")
    .split(/[,\s]+/)
    .map((s) => Number(String(s).replace("%", "")))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 50)
    .map((n) => Math.round(n));
  const unique = [...new Set(list)].slice(0, 4);
  return unique.length ? unique : [...DEFAULT_TIP_PRESETS];
}

// Settings that can be changed from /admin/settings, in the order they appear there.
export const SETTING_KEYS = {
  site_name: (v) => (site.name = v),
  site_tagline: (v) => (site.tagline = v),
  contact_email: (v) => (site.email = v),
  contact_phone: (v) => (site.phone = v),
  instagram: (v) => (site.instagram = v),
  pickup_location: (v) => (site.pickupLocation = v),
  pickup_window: (v) => (site.pickupWindow = v),
  cutoff_text: (v) => (site.cutoff = v),
  licence_text: (v) => (site.licence = v),
  etransfer_email: (v) => (site.etransferEmail = v),
  delivery_area: (v) => (delivery.area = v),
  delivery_windows: (v) => (delivery.windows = v),
  // Owner-entered cents must stay non-negative integers; a stray NaN or -1 from
  // the settings table should degrade to "free" or "no fee", not poison the math.
  delivery_fee_cents: (v) => (delivery.feeCents = Math.max(0, Math.round(Number(v)) || 0)),
  free_delivery_over_cents: (v) => (delivery.freeOverCents = Math.max(0, Math.round(Number(v)) || 0)),
  delivery_tip_presets: (v) => (delivery.tipPresets = parseTipPresets(v)),
  plan_max_tubs: (v) => (plans.maxTubsPerWeek = Math.min(12, Math.max(1, Math.round(Number(v) || 3))))
};

/* Mutates the shared site/delivery objects, so every importer sees new values
   on the next render — no restart, no cache to clear.                       */
export function applySettings(values = {}) {
  for (const [key, apply] of Object.entries(SETTING_KEYS)) {
    if (values[key] !== undefined && values[key] !== null) apply(String(values[key]));
  }
}

// Built-in illustrations, used when a product has no photo.
export const artOptions = [
  { id: "yogurt", label: "Yogurt tub" },
  { id: "creamcheese", label: "Cream cheese tub" },
  { id: "creamcheese-cinnamon", label: "Cream cheese — cinnamon sugar" },
  { id: "creamcheese-strawberry", label: "Cream cheese — strawberry" },
  { id: "creamcheese-blueberry", label: "Cream cheese — blueberry" },
  { id: "creamcheese-dill", label: "Cream cheese — dill pickle" },
  { id: "creamcheese-jalapeno", label: "Cream cheese — jalapeño cheddar" },
  { id: "creamcheese-pesto", label: "Cream cheese — pesto" },
  { id: "creamcheese-nutella", label: "Cream cheese — chocolate hazelnut" },
  { id: "halloumi", label: "Cheese block" },
  { id: "oaxaca", label: "Oaxaca cheese ball" },
  { id: "bottle", label: "Bottle" },
  { id: "butter", label: "Butter block" },
  { id: "ricotta", label: "Ricotta basket" },
  { id: "labneh", label: "Labneh jar" },
  { id: "cremefraiche", label: "Crème fraîche jar" },
  { id: "zatar", label: "Za'atar jar" },
  { id: "generic", label: "Plain jar" }
];

// Seeded once, into an empty database. Edit products in /admin afterwards.
export const productsSeed = [
  {
    id: "yogurt-6",
    name: "Yogurt 6%",
    weight: "750 g",
    priceCents: 449,
    note: "Whole milk and cream, cultured slowly. Thick enough to stand a spoon in.",
    tags: ["6% M.F.", "Plain", "Live cultures"],
    art: "yogurt",
    ingredients: "Whole milk, cream, live bacterial cultures.",
    allergens: "Milk",
    shelfLifeDays: 21,
    subscribable: true,
    stock: 24,
    maxPerOrder: 12
  },
  {
    id: "cream-cheese",
    name: "Cream Cheese",
    weight: "227 g",
    priceCents: 549,
    note: "Cultured cream and whole milk, drained in cloth. Tangy, spreadable, no gums.",
    tags: ["Cultured", "Spreadable"],
    art: "creamcheese",
    ingredients: "Whole milk, cream, salt, bacterial cultures, microbial rennet.",
    allergens: "Milk",
    shelfLifeDays: 14,
    stock: 18,
    maxPerOrder: 12
  },
  {
    id: "halloumi",
    name: "Halloumi",
    weight: "250 g",
    priceCents: 799,
    note: "Squeaky, salty, grill-ready. Brined 24 hours; fry it until it blisters.",
    tags: ["Grilling", "Brined"],
    art: "halloumi",
    ingredients: "Whole milk, salt, microbial rennet, calcium chloride.",
    allergens: "Milk",
    shelfLifeDays: 21,
    stock: 12,
    maxPerOrder: 8
  }
];

export function money(cents) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}

/* What the customer actually pays: the sale price when one is set and lower. */
export const priceOf = (p) => {
  const sale = Number(p?.saleCents);
  return Number.isInteger(sale) && sale > 0 && sale < p.priceCents ? sale : p.priceCents;
};
