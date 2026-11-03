# metrics — a separate container for the numbers

A second container in the same Coolify stack as the store. It mounts the
`creamery-data` volume and **reads** `store.db`; it never writes to it, and the
store has no idea it exists. Stop it and nothing about selling changes.

Two outputs from the same read:

- an HTML dashboard at `/`
- Prometheus text at `/metrics` (plus `/api/summary.json` for anything else)

```sh
docker build -t creamery-metrics ./metrics
docker run --rm -p 9110:9110 \
  -v rebel-creamery_creamery-data:/data \
  -e METRICS_PASSWORD=… \
  creamery-metrics
```

In the Coolify stack this is the `metrics` service in
`docker-compose.coolify.yml`; give it a domain (e.g. `metrics.rebelcreamery.ca`)
and set `METRICS_PASSWORD` in the environment. Without a password the service
answers **503** — the same fail-closed behaviour as `/admin`.

## What it reports

Money is integer cents, read the same way the store writes it.

- **Revenue** counts orders in `paid`, `packed` or `completed` only. `pending`
  (card, unpaid), `awaiting_etransfer` and `cancelled` are shown separately.
- **AOV** is revenue ÷ paid orders.
- **Windows**: today, 7 days, 30 days, all time, bucketed in
  `America/Edmonton` — not UTC — so a Friday-night order lands on Friday.
- **Prepaid plans** mirror `subscriptionSummary()`: open cards, tubs still owed,
  money taken but not yet earned.
- **Ops**: e-Transfers waiting, card orders unpaid after 24 h, label queue,
  sold out, low stock, discount usage.
- **Trend**: 30 daily bars, hover for the exact number.

## Prometheus

Every series is prefixed `creamery_`:

```
creamery_up
creamery_revenue_cents{window="30d"}
creamery_orders{window="7d"}
creamery_aov_cents{window="30d"}
creamery_orders_by_status{status="paid"}
creamery_awaiting_etransfer
creamery_subscription_tubs_outstanding
creamery_print_jobs{status="queued"}
creamery_db_modified_age_seconds
```

Point a scraper at `http://metrics:9110/metrics` with basic auth if you add one
later; there is no separate token.

## Notes

- **Read-only mount, writable volume.** SQLite needs write access to the `-shm`
  file to read a WAL database, so the volume is mounted read-write and the
  connection is opened `mode=ro` with `PRAGMA query_only = 1`. The container
  never issues a write.
- **No cache of the data on disk.** Each summary is computed from the live file
  and memoised in memory for `CACHE_SECONDS` (15 s).
- **Bad database = empty page, not a crash.** A missing file or a schema older
  than the queries renders the error and `creamery_up 1`-style failure metrics
  instead of a 500 loop.
- Timezone comes from `TZ_NAME`; the image installs `tzdata` so `zoneinfo` works.
