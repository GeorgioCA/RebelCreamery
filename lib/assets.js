import crypto from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// Versioned asset URLs so a deploy always bypasses a stale CDN/browser cache.
// Hash the files we link with ?v=... ; text SVG logo is fetched directly and rarely changes.
const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));

const hashOf = (file) => {
  try {
    return crypto.createHash("sha1").update(fs.readFileSync(PUBLIC + file)).digest("hex").slice(0, 10);
  } catch {
    return "dev";
  }
};

export const assetVersion = hashOf("styles.css") + hashOf("app.js");
