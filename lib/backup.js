import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db } from "./db.js";

/* Nightly backup to Backblaze B2.
   - SQLite is snapshotted with VACUUM INTO, which is safe while the app is
     writing (a plain cp can miss committed WAL transactions).
   - uploads/ is tarred as one object.
   - Both land under <prefix>/db/ and <prefix>/uploads/, dated by local day.
   - Objects older than RETENTION_DAYS are removed, so the bucket can't grow
     without bound.

   B2 credentials are a bucket-scoped application key: it cannot list buckets,
   so B2_BUCKET_ID is required. Every failure is reported, never swallowed —
   a backup that silently stops running is worse than none.                   */

const PREFIX = (process.env.B2_PREFIX || "rebel-creamery").replace(/\/+$/, "");
const RETENTION_DAYS = Math.max(1, parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 30);
const DATA_DIR = process.env.DATA_DIR || path.resolve("data");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const STATUS_FILE = path.join(BACKUP_DIR, "last.json");

export const backupEnabled = () => Boolean(process.env.B2_KEY_ID && process.env.B2_APP_KEY && process.env.B2_BUCKET_ID);

const dayStamp = (d = new Date()) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return p; // en-CA renders YYYY-MM-DD
};

async function b2(pathname, body, token = null, version = "v2") {
  const apiUrl = process.env.B2_API_URL || "https://api.backblazeb2.com";
  const url = token ? `${token.baseUrl}/b2api/${version}/${pathname}` : `${apiUrl}/b2api/${version}/${pathname}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: token.token } : {}),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`B2 ${pathname} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function authorize() {
  const basic = Buffer.from(`${process.env.B2_KEY_ID}:${process.env.B2_APP_KEY}`).toString("base64");
  const res = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
    headers: { Authorization: `Basic ${basic}` }
  });
  if (!res.ok) throw new Error(`B2 authorize failed: ${res.status}`);
  const d = await res.json();
  const s = d.apiInfo.storageApi;
  return {
    baseUrl: s.apiUrl,
    downloadUrl: s.downloadUrl,
    bucketName: s.bucketName,
    token: d.authorizationToken,
    bucketId: process.env.B2_BUCKET_ID || s.bucketId
  };
}

async function upload(auth, name, buffer, contentType) {
  const { uploadUrl, authorizationToken } = await b2("b2_get_upload_url", { bucketId: auth.bucketId }, auth);
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "X-Bz-File-Name": encodeURIComponent(name).replace(/%2F/g, "/"),
      "Content-Type": contentType,
      "X-Bz-Content-Sha1": createHash("sha1").update(buffer).digest("hex")
    },
    body: buffer
  });
  if (!res.ok) throw new Error(`B2 upload ${name} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function prune(auth, today) {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000);
  let startFileName;
  let removed = 0;
  for (;;) {
    const listed = await b2("b2_list_file_names", {
      bucketId: auth.bucketId, startFileName, maxFileCount: 500, prefix: `${PREFIX}/`
    }, auth);
    for (const f of listed.files || []) {
      const m = f.fileName.match(/(\d{4}-\d{2}-\d{2})/);
      if (!m) continue;
      if (new Date(`${m[1]}T12:00:00Z`) < cutoff) {
        await b2("b2_delete_file_version", { fileName: f.fileName, fileId: f.fileId }, auth);
        removed += 1;
      }
    }
    startFileName = listed.nextFileName;
    if (!startFileName) break;
  }
  return removed;
}

export async function runBackup({ manual = false } = {}) {
  const startedAt = new Date().toISOString();
  const result = { startedAt, manual, ok: false, day: null, files: [], dbBytes: 0, uploadBytes: 0, pruned: 0 };
  try {
    if (!backupEnabled()) throw new Error("B2 backups are not configured.");
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const day = dayStamp();
    result.day = day;

    // 1. Consistent database snapshot.
    const dbFile = path.join(BACKUP_DIR, `${day}.sqlite`);
    fs.rmSync(dbFile, { force: true });
    db.exec(`VACUUM INTO '${dbFile.replace(/'/g, "''")}'`);
    const dbBuf = fs.readFileSync(dbFile);
    result.dbBytes = dbBuf.length;

    // 2. Product photos as one object (skip when there are none).
    let uploadBuf = null;
    const uploadsDir = path.join(DATA_DIR, "uploads");
    if (fs.existsSync(uploadsDir) && fs.readdirSync(uploadsDir).length) {
      const tgz = path.join(BACKUP_DIR, `${day}-uploads.tgz`);
      execFileSync("tar", ["czf", tgz, "-C", DATA_DIR, "uploads"]);
      uploadBuf = fs.readFileSync(tgz);
      result.uploadBytes = uploadBuf.length;
      fs.rmSync(tgz, { force: true });
    }

    const auth = await authorize();
    const dbName = `${PREFIX}/db/${day}.sqlite`;
    await upload(auth, dbName, dbBuf, "application/vnd.sqlite3");
    result.files.push(dbName);
    if (uploadBuf) {
      const upName = `${PREFIX}/uploads/${day}.tgz`;
      await upload(auth, upName, uploadBuf, "application/gzip");
      result.files.push(upName);
    }

    // Local snapshots are pruned too: they keep the last few nights on the box.
    for (const f of fs.readdirSync(BACKUP_DIR)) {
      const m = f.match(/^(\d{4}-\d{2}-\d{2})\.sqlite$/);
      if (m && new Date(`${m[1]}T12:00:00Z`) < new Date(Date.now() - RETENTION_DAYS * 86400000)) {
        fs.rmSync(path.join(BACKUP_DIR, f), { force: true });
      }
    }

    // 3. Retention is best-effort: a key without listFiles must not fail the run.
    try {
      result.pruned = await prune(auth, day);
    } catch (err) {
      result.pruneError = err.message;
    }

    result.ok = true;
  } catch (err) {
    result.error = err.message;
  }
  result.finishedAt = new Date().toISOString();
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.writeFileSync(STATUS_FILE, JSON.stringify(result, null, 2));
  } catch { /* status is a convenience; never fail the run over it */ }
  return result;
}

/* Already-uploaded snapshots, newest first — what the restore screen lists. */
export async function listBackups() {
  const auth = await authorize();
  const files = [];
  let startFileName;
  for (;;) {
    const r = await b2("b2_list_file_names", {
      bucketId: auth.bucketId, prefix: `${PREFIX}/db/`, startFileName, maxFileCount: 200
    }, auth);
    for (const f of r.files || []) {
      files.push({ fileName: f.fileName, bytes: f.contentLength, uploadedAt: f.uploadTimestamp });
    }
    startFileName = r.nextFileName;
    if (!startFileName) break;
  }
  return files.sort((a, b) => b.uploadedAt - a.uploadedAt);
}

async function download(auth, fileName) {
  const path = fileName.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`${auth.downloadUrl}/file/${encodeURIComponent(auth.bucketName)}/${path}`, {
    headers: { Authorization: auth.token }
  });
  if (!res.ok) throw new Error(`B2 download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/* Returns the snapshot plus the matching photo archive when that night had one. */
export async function fetchBackup(fileName) {
  const auth = await authorize();
  const snapshot = await download(auth, fileName);
  const day = (fileName.match(/(\d{4}-\d{2}-\d{2})/) || [])[1];
  let uploads = null;
  if (day) {
    try {
      uploads = await download(auth, `${PREFIX}/uploads/${day}.tgz`);
    } catch {
      uploads = null; // most nights have no photos
    }
  }
  return { snapshot, uploads, day };
}

export function lastBackup() {
  try { return JSON.parse(fs.readFileSync(STATUS_FILE, "utf8")); } catch { return null; }
}
