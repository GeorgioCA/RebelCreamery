// Catalog and store configuration.
// Prices are in CAD cents. Change them here — the UI and checkout both read from this file.

export const site = {
  name: process.env.SITE_NAME || "Rebel Creamery",
  tagline: process.env.SITE_TAGLINE || "Small-batch dairy, made in Calgary.",
  email: process.env.CONTACT_EMAIL || "hello@rebelcreamery.ca",
  phone: process.env.CONTACT_PHONE || "",
  city: "Calgary, Alberta",
  pickupLocation: process.env.PICKUP_LOCATION || "Calgary Farmers' Market — 510 77 Ave SE",
  pickupWindow: process.env.PICKUP_WINDOW || "Saturdays, 9 am – 2 pm",
  cutoff: process.env.CUTOFF_TEXT || "Order by Thursday 6 pm for weekend pickup",
  instagram: process.env.INSTAGRAM || "",
  // Food sold as basic groceries is zero-rated in Canada, so no tax line is applied.
  licence: process.env.LICENCE_TEXT || "Made in Alberta under provincial food-safety rules. Licensing and inspection details available on request."
};

export const delivery = {
  feeCents: Number(process.env.DELIVERY_FEE_CENTS || 800),
  freeOverCents: Number(process.env.FREE_DELIVERY_THRESHOLD_CENTS || 4000),
  area: process.env.DELIVERY_AREA || "Calgary city limits",
  windows: process.env.DELIVERY_WINDOWS || "Fridays, 12 – 6 pm"
};

export const products = [
  {
    id: "yogurt-6",
    name: "Yogurt 6%",
    weight: "750 g",
    priceCents: 449,
    unit: "each",
    note: "Whole milk and cream, cultured slowly. Thick enough to stand a spoon in.",
    tags: ["6% M.F.", "Plain", "Live cultures"],
    art: "yogurt",
    stock: 24,
    maxPerOrder: 12
  },
  {
    id: "cream-cheese",
    name: "Cream Cheese",
    weight: "227 g",
    priceCents: 549,
    unit: "each",
    note: "Cultured cream and whole milk, drained in cloth. Tangy, spreadable, no gums.",
    tags: ["Cultured", "Spreadable"],
    art: "creamcheese",
    stock: 18,
    maxPerOrder: 12
  },
  {
    id: "halloumi",
    name: "Halloumi",
    weight: "250 g",
    priceCents: 799,
    unit: "each",
    note: "Squeaky, salty, grill-ready. Brined 24 hours; fry it until it blisters.",
    tags: ["Grilling", "Brined"],
    art: "halloumi",
    stock: 12,
    maxPerOrder: 8
  }
];

export const productsById = Object.fromEntries(products.map((p) => [p.id, p]));

export function money(cents) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}
