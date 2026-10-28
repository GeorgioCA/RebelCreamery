import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";

/* Restore is applied at boot, never inside a live process: the app writes a
   "pending" snapshot, exits, and Docker's restart policy brings it back up.
   On the way up this runs before the database is opened, so the swap is clean
   and the WAL files that belonged to the old file are gone with it.          */

const DATA_DIR = process.env.DATA_DIR || "./data";
const META = path.join(DATA_DIR, "restore.pending.json");
const SNAPSHOT = path.join(DATA_DIR, "restore.pending.sqlite");
const UPLOADS = path.join(DATA_DIR, "restore.pending.tgz");
const LOG = path.join(DATA_DIR, "restore.log");

const log = (line) => {
  try { fs.appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`); } catch { /* logging must never block a restore */ }
};

function checkSnapshot(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const integrity = db.prepare("PRAGMA integrity_check").get();
    const ok = integrity && Object.values(integrity)[0] === "ok";
    if (!ok) throw new Error("integrity check failed");
    const orders = db.prepare("SELECT COUNT(*) AS n FROM orders").get().n;
    const products = db.prepare("SELECT COUNT(*) AS n FROM products").get().n;
    return { orders, products };
  } finally {
    db.close();
  }
}

export function applyPendingRestore() {
  if (!fs.existsSync(META) || !fs.existsSync(SNAPSHOT)) return null;

  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(META, "utf8")); } catch { /* fall through */ }

  try {
    const counts = checkSnapshot(SNAPSHOT);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const live = path.join(DATA_DIR, "store.db");

    // Keep the database that is being replaced — a restore is not reversible otherwise.
    if (fs.existsSync(live)) fs.renameSync(live, path.join(DATA_DIR, `store.db.pre-restore-${stamp}`));
    fs.rmSync(`${live}-wal`, { force: true });
    fs.rmSync(`${live}-shm`, { force: true });

    fs.copyFileSync(SNAPSHOT, live);

    if (fs.existsSync(UPLOADS)) {
      const dir = path.join(DATA_DIR, "uploads");
      if (fs.existsSync(dir)) fs.renameSync(dir, path.join(DATA_DIR, `uploads.pre-restore-${stamp}`));
      fs.mkdirSync(dir, { recursive: true });
      execFileSync("tar", ["xzf", UPLOADS, "-C", DATA_DIR]);
    }

    fs.rmSync(META, { force: true });
    fs.rmSync(SNAPSHOT, { force: true });
    fs.rmSync(UPLOADS, { force: true });

    const line = `restored ${meta.file || "snapshot"} (${counts.orders} orders, ${counts.products} products)`;
    log(line);
    console.log(`[restore] ${line}`);
    return { ...counts, file: meta.file, at: new Date().toISOString() };
  } catch (err) {
    // A bad snapshot must not take the shop down: keep serving the current data.
    log(`restore FAILED: ${err.message}`);
    console.error(`[restore] failed: ${err.message}`);
    fs.renameSync(SNAPSHOT, `${SNAPSHOT}.failed`);
    fs.rmSync(META, { force: true });
    fs.rmSync(UPLOADS, { force: true });
    return null;
  }
}

/* Called by the admin route: stage the files, then let the caller restart. */
export function stageRestore({ snapshotPath, uploadsPath, file }) {
  const counts = checkSnapshot(snapshotPath);
  fs.copyFileSync(snapshotPath, SNAPSHOT);
  if (uploadsPath && fs.existsSync(uploadsPath)) fs.copyFileSync(uploadsPath, UPLOADS);
  fs.writeFileSync(META, JSON.stringify({ file, stagedAt: new Date().toISOString(), ...counts }, null, 2));
  return counts;
}

export function restoreLog(limit = 20) {
  try {
    return fs.readFileSync(LOG, "utf8").trim().split("\n").filter(Boolean).slice(-limit).reverse();
  } catch {
    return [];
  }
}
