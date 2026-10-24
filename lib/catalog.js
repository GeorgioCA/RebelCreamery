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
  // Food sold as basic groceries is zero-rated in Canada, so no tax line is applied.
  licence: process.env.LICENCE_TEXT || "Made in Alberta under provincial food-safety rules. Licensing and inspection details available on request."
};

export const delivery = {
  feeCents: Number(process.env.DELIVERY_FEE_CENTS || 800),
  freeOverCents: Number(process.env.FREE_DELIVERY_THRESHOLD_CENTS || 4000),
  area: process.env.DELIVERY_AREA || "Calgary city limits",
  windows: process.env.DELIVERY_WINDOWS || "Fridays, 12 – 6 pm"
};

// Built-in illustrations, used when a product has no photo.
export const artOptions = [
  { id: "yogurt", label: "Yogurt tub" },
  { id: "creamcheese", label: "Cream cheese tub" },
  { id: "halloumi", label: "Cheese block" },
  { id: "bottle", label: "Bottle" },
  { id: "butter", label: "Butter block" },
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
