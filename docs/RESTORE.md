# Restoring Rebel Creamery from backup

Backups are written nightly to Backblaze B2, bucket `EComStore`:

- `rebel-creamery/db/YYYY-MM-DD.sqlite` — the database (65 KB today)
- `rebel-creamery/uploads/YYYY-MM-DD.tgz` — product photos (only when photos exist)

They are kept for 30 days. A copy of the last few nights also sits in the app volume at `/data/backups/`.

This procedure was tested on 2026-10-28: the snapshot downloaded from B2 passed `PRAGMA integrity_check`, booted the
app against a clean data directory, and served all 8 orders and 12 products.

## 1. Get the snapshot

**From the B2 web console** — Buckets → `EComStore` → `rebel-creamery/db/` → pick a date → Download.

**Or with the `b2` CLI:**

```bash
b2 account authorize          # paste the key ID and application key
b2 file download b2://EComStore/rebel-creamery/db/2026-10-28.sqlite ./2026-10-28.sqlite
b2 file download b2://EComStore/rebel-creamery/uploads/2026-10-28.tgz ./uploads.tgz   # if it exists
```

Sanity-check before touching anything. This must print `ok`, and the counts should look like the shop:

```bash
sqlite3 2026-10-28.sqlite "PRAGMA integrity_check; SELECT COUNT(*) FROM orders; SELECT COUNT(*) FROM products;"
```

## 2. Stop the app

Coolify → the Rebel Creamery app → **Stop**. Editing files under a running SQLite process is how restores
turn into two half-databases.

## 3. Put the files back

On the Coolify host:

```bash
docker ps --format '{{.Names}}' | grep -i rebel        # find the container name
NAME=<container-from-above>

# Keep what is there now, so a bad restore can be undone
docker exec "$NAME" cp -a /data/store.db /data/store.db.pre-restore

docker cp 2026-10-28.sqlite "$NAME":/data/store.db

# WAL and SHM belong to the old database — leaving them corrupts the restored file
docker exec "$NAME" rm -f /data/store.db-wal /data/store.db-shm

# Photos, if you downloaded the archive
docker cp uploads.tgz "$NAME":/tmp/uploads.tgz
docker exec "$NAME" tar xzf /tmp/uploads.tgz -C /data
docker exec "$NAME" rm -f /tmp/uploads.tgz

docker exec "$NAME" chown node:node /data/store.db
```

## 4. Start and verify

Coolify → **Start**, then:

```bash
curl -s https://rebelcreamery.ca/health            # {"ok":true}
```

Sign in to `/admin` and check three things:

1. the order count matches what you expect
2. the newest order opens and shows its line items
3. the storefront lists the right products with the right prices

If the count is wrong or the shop is empty, stop the app and put the old file back:

```bash
docker exec "$NAME" mv /data/store.db.pre-restore /data/store.db
docker exec "$NAME" rm -f /data/store.db-wal /data/store.db-shm
```

then start it again.

## Full disaster (server gone)

Stand up a new host, deploy the app from Coolify as usual (same env vars, especially `B2_*`), let it create an empty
volume, then run steps 2–4 against the new container. The backup job resumes on its own the following night.

## What is not in the backup

- Coolify's own configuration and environment variables (they live in the panel)
- The repo itself — that is on GitHub
- Stripe and Resend state — both are external services and unaffected
