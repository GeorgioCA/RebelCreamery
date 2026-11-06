# AGENTS.md

Instructions for anyone — human or coding agent — working in this repository.

## What this is

Rebel Creamery's storefront: a small-batch dairy in Calgary selling yogurt (3% and 6%), cream cheese, halloumi and cultured butter for pickup or Friday delivery. One Node process, one SQLite file, one container. Not a framework, not a CMS.

**Stack:** Node 22 (ESM, no build step) · Express 5 · `node:sqlite` · server-rendered HTML strings · plain CSS and vanilla JS · Stripe Checkout · Resend email · Brother QL-800 labels.

**Live:** https://rebelcreamery.ca — Coolify app `rebel-creamery` (`5hdzdzzokv7syf5wgsz0whqu`), compose resource from this repo, domain routed to container port 3000.

## Run it

```sh
npm install
cp .env.example .env          # then edit
node --env-file=.env server.js # http://localhost:3000
```

Local preview used during development (port 3100, logs to /tmp/creamery.log):

```sh
./scripts/restart-preview.sh          # restart, keep data
./scripts/restart-preview.sh --fresh  # wipe data/ and reseed
```

## Layout

| Path | What lives there |
|---|---|
| `server.js` | All routes: storefront, checkout, admin, print API, Stripe webhook |
| `lib/db.js` | SQLite schema, migrations, product/order/print-job queries |
| `lib/views.js` | Every HTML template as a template literal, plus the inline SVG product illustrations |
| `lib/catalog.js` | Seed products, site copy defaults, delivery config |
| `lib/mail.js` | Resend templates (confirmation, status update, owner alert, digests) |
| `lib/catalog.js` | Env defaults for store text/pricing + `applySettings()` mutating `site`/`delivery` |
| `lib/labels.js` | 62 mm label rendering |
| `lib/assets.js` | Content-hash query strings for CSS/JS |
| `public/` | `styles.css`, `app.js` (cart, checkout, address autofill) |
| `print-agent/` | Standalone Python label daemon (Linux, macOS or Windows — see its README) |
| `metrics/` | Separate read-only container: dashboard, profit, `/metrics`, `/api/summary.json` (costs in `COSTS.md`) |
| `tests/` | Playwright and smoke tests, run by hand |
| `data/` | SQLite + uploaded photos. **Gitignored. This is the business record.** |

## Admin surfaces

- `/admin` — order book: summary tiles, paginated order table (`?page=`), status dropdown, Label, View.
- `/admin/orders/:number` — one order: customer, fulfilment, items, status/label/thank-you sticker/resend actions.
- `/admin/products` — product table; `/admin/products/:id` edits a product, sets stock and sold-out, and queues labels.
- Stock and the sold-out flag are only editable per product — there are no stock cards on the dashboard.

## Product quick view

Clicking a card's illustration or its **Ingredients & details →** link opens a detail
dialog on the home page (`#qv` in `lib/views.js`). The content is **server-rendered into
an inert `<template data-qv-tpl="<id>">` inside each card** and cloned in by
`public/app.js` — do not rebuild the art, fat percentage or prices in client JS. A
product change (new field, sale price, sold-out state) belongs in `quickViewTemplate()`,
not in a second client-side source of truth.

- Desktop: centred two-column modal. ≤720 px: bottom sheet with a **sticky action bar**
  so Add is never below the fold; the copy scrolls under it.
- Uses `100dvh` (not `vh`) and `env(safe-area-inset-bottom)` — iOS Safari's URL bar and
  home indicator otherwise clip the sheet.
- Escape, backdrop and the close button dismiss; focus is trapped while open and
  returned to the trigger on close. Body scroll is locked.
- Label QR codes point at `/#product-<id>`, which opens that product's detail on load.
- Adding from the dialog closes it before opening the cart (the cart drawer sits at a
  lower z-index and would otherwise open behind the modal).

## Conventions

- **Money is integer cents**, CAD, everywhere. Format only at the edge with `money()`. No floats for money.
- **No client framework.** Views are template literals; interactivity is plain DOM in `public/app.js`. Don't introduce React/Vue/Tailwind for a five-product shop.
- **Server-rendered forms post and redirect.** No JSON APIs for admin screens.
- **Products are data, not code.** Adding a SKU must never require a deploy.
- **Escape everything interpolated into HTML** with `esc()`. Most values come from the owner or customers.
- **Dates:** store ISO strings; render in `America/Edmonton`.
- **Copy:** short sentences, concrete numbers, no wellness claims. See `Socials.md` in the business vault for voice.

## Data rules

- Schema changes go through the **column migration block** in `lib/db.js` — `ALTER TABLE ... ADD COLUMN` guarded by a `PRAGMA table_info` check. Never drop or rewrite a table that holds orders.
- `orders` and `order_items` are append-only history. Products may be deleted; past orders keep their own copy of name and price.
- The SQLite file lives on the `creamery-data` volume at `/data`. Back it up before any migration you're unsure about.
- Every product carries a **SKU** generated from name and size (`RC-YOG-6-750`, `RC-LAB-ZAT-500`), editable and unique. It is printed on product labels and stored on order lines as a snapshot, so a later SKU change never rewrites history. Export `/admin/products.csv` for bookkeeping.
- Stock semantics: `MADE_TO_ORDER=1` (default) means stock **never gates** an order — it's a capacity note. The per-product `sold_out` flag is the only thing that stops sales. `MADE_TO_ORDER=0` restores counted stock with automatic sold-out at zero.

## Auth and secrets

- Admin is `/admin` with a **signed cookie session** (`ADMIN_USER`, `ADMIN_PASSWORD`, HMAC via `SESSION_SECRET` or the password). Basic auth is still accepted for curl and scripts.
- Never commit `.env`, `data/`, `screenshots/`, or credentials. `PUBLIC_BASE_URL`, `STRIPE_*`, `RESEND_API_KEY`, `ADMIN_*`, `PRINT_TOKEN` live in Coolify env.
- Print API uses `PRINT_TOKEN` as a bearer token, separate from admin.

## Deploy

Push to `main`, then trigger the Coolify deploy (API token lives with the owner). The container builds from `docker-compose.coolify.yml`; the domain is attached to the `web` service.

Two rules learned the hard way:

1. **Asset URLs are content-hashed** (`lib/assets.js`). Cloudflare caches `styles.css` for 7 days; if you add CSS without the hash, nobody sees it.
2. **The compose file lists env vars explicitly.** A new variable in Coolify does nothing unless it's also added to `docker-compose.coolify.yml`.

## Integrations

- **Stripe** — Checkout Sessions; `locale: "auto"` (Stripe rejects `en-CA`). Webhook `/api/stripe/webhook` handles `checkout.session.completed` and `checkout.session.async_payment_succeeded`, and only marks paid when `payment_status === "paid"`. **Refunds are manual, by design** — cancelling an order does not refund. Unpaid card orders auto-cancel after 48 h (sessions themselves expire at 23 h) and return held stock; e-Transfer orders never auto-cancel.
- **Resend** — sends from `orders@rebelcreamery.ca`, domain verified. Customers get a confirmation at checkout and a note on status changes (paid/packed/completed/cancelled). The owner gets a one-per-order alert at `OWNER_EMAIL` (currently `hello@rebelcreamery.ca`) on card payment and on e-Transfer order creation; reply-to is the customer. Failures log, never block a sale.
- **Address autofill** — `/api/address` proxies Photon (OSM), `/api/postal/:fsa` proxies Zippopotam. Free and keyless; cached in memory and rate-limited. Neither confirms deliverability.
- **Settings live in SQLite** (`settings` table), applied at boot by `applySettings()`, which mutates the shared `site`/`delivery` objects — so edits take effect on the next render with no restart. Env vars stay the defaults; `/admin/settings` is the runtime editor. Anything that changes stock semantics (`MADE_TO_ORDER`) or credentials (Stripe, Resend) stays in env.
- **Never read `process.env` for store text at render time** — use `site.*` / `delivery.*`, or a settings edit will be ignored in that one place (this bit the e-Transfer address in four files).
- **Scheduled mail** (America/Edmonton, in-process `setInterval`, `.unref()`): 08:00 daily → e-Transfer digest, only when something is unconfirmed; Thursday 19:00 → batch summary (make list, pickup/delivery, unpaid). Both guard on the local date so a restart can't double-send. No cron on the host.
- **Stripe/Resend failures must degrade, not 500.** Checkout works with email down; the store works with Stripe unset (e-Transfer only).

## Testing

No test runner in CI. Verify changes with the preview server plus a Playwright script:

- Checkout end to end: add to cart → checkout → order page → admin detail.
- Product CRUD in `/admin/products`, including hide, sold out, and delete.
- Existing scripts: `tests/e2e.py` (checkout), `tests/product_flow.py` (admin CRUD), `tests/check.py` (live sanity), `tests/labelprint_smoke.py` (renderer). `tests/shot*.py` take screenshots.
- Anything touching money, stock or the webhook: test against a Stripe test key, never a live charge.

## Gotchas

- `node:sqlite` is still marked experimental — the warning on boot is expected.
- `MAX(0, stock - ?)` means stock can't go negative; don't read it as a demand signal.
- Route order matters in Express: `/admin/orders/:number` must not shadow the more specific routes.
- The print agent runs on the machine with the printer, not in the container. Labels are queued in SQLite and polled. On Windows it needs a WinUSB binding via Zadig, not a Brother driver — see `print-agent/README.md`.
- Label type size is one knob in each renderer: `TEXT_SCALE` in `print-agent/labelprint.py` and `--ts` in `lib/labels.js`. Change both or the browser and printed labels drift apart.
- Product labels carry the product's storefront illustration (rasterised server-side to a base64 PNG) and a QR to `${PUBLIC_BASE_URL}/#product-<id>`. The payload ships the QR module matrix and the PNG, so the agent needs no SVG/QR library — but an agent older than this change ignores both fields, so copy the updated `labelprint.py` to the machine that prints.
- The yogurt illustration shows `{{FAT}}`, filled from the product name or tags (`artFor`). Don't hardcode a percentage into the SVG.
- WhatsApp/SMS do not exist. Email is the only outbound channel.

## Discount codes

Codes live in the `discounts` table (code, kind `percent|fixed`, value, min subtotal, max uses, uses, expires_at, active).
`evaluateDiscount()` in `lib/discounts.js` is the only place that decides whether a code is usable — the preview endpoint
(`GET /api/discount?code=&subtotal=`) and order creation both call it, so they cannot disagree. The checkout is
all-or-nothing: a code that does not apply returns 400 instead of silently charging full price.

Order rows snapshot `discount_cents` and `discount_code`; line prices are never mutated. Uses are incremented when an
order is created for e-Transfer and only when payment succeeds for card, so abandoned Stripe checkouts do not burn a use.

Stripe needs a coupon object for a discount, so a one-shot `amount_off` coupon is created per checkout and passed as
`discounts: [{ coupon }]`.

## Sale prices

`products.sale_cents` holds an optional sale price; `price_cents` stays the regular price. `priceOf(p)` in
`lib/catalog.js` is the single source of truth for what a customer pays, and it is used at checkout, in
`/api/store.json`, and mirrored in `public/app.js`. Cards render the regular price struck through next to the
sale price; the admin product form rejects a sale price that is not below the regular price. Order lines
snapshot the charged price, so ending a sale never rewrites history.

## Metrics (separate container)

`metrics/` is a second service in `docker-compose.coolify.yml`. It mounts
`creamery-data`, opens `store.db` with `mode=ro` and `PRAGMA query_only`, and serves a
dashboard at `/`, Prometheus text at `/metrics`, and the same numbers as JSON at
`/api/summary.json`. Stdlib Python only — no dependencies, no build step of its own.

- **It must never write.** No `INSERT`/`UPDATE`/`PRAGMA` other than `query_only`; the
  store owns the file and the metrics container is a passenger. The volume is mounted
  read-write only because SQLite needs the `-shm` file to read a WAL database.
- **Money rules are copied, not imported.** Revenue = `paid` + `packed` + `completed`.
  Prepaid-plan figures mirror `subscriptionSummary()` in `lib/db.js` — change one,
  change the other.
- **Days bucket in `America/Edmonton`**, not UTC, so a Friday-night order lands on Friday.
- **Fail closed.** Empty `METRICS_PASSWORD` → 503, like `/admin`. `/health` is the only
  unauthenticated route and carries no business data.
- **Schema-tolerant.** It reads with `SELECT *` and checks `sqlite_master`, so an older
  database (no `subscriptions` table) renders with zeros instead of crashing.
- **The admin page is a client, not a second implementation.** `/admin/metrics` (route in
  `server.js`, `renderMetrics` in `lib/views.js`, fetch in `lib/metrics.js`) renders
  `/api/summary.json` from the sidecar over the compose network (`METRICS_INTERNAL_URL`,
  default `http://metrics:9110`) behind the admin session. It never queries SQLite itself —
  if it did, "what counts as revenue" would exist twice and the pages would drift.
- The nav item is gated on `site.metricsUrl` (`METRICS_URL`), which also powers the
  `Standalone dashboard ↗` link; empty hides both.
- A schema change here does not need a store deploy, but both services build from the
  same repo — pushing to `main` redeploys the whole stack.

## Visitor analytics (Umami)

`umami` + `umami-db` live in the same compose. Cookieless and first-party: no cookie,
no consent banner, nothing sent to a third party.

- **One script tag, gated.** `layout()` renders it only when `UMAMI_SCRIPT_URL` and
  `UMAMI_WEBSITE_ID` are set, and never on `admin` pages or the success/order page —
  that URL carries the customer's order token and would end up in the pageview path.
- **`CLIENT_IP_HEADER=cf-connecting-ip` is not optional.** Cloudflare terminates TLS;
  without it every visitor resolves to an edge IP and the country report is fiction.
- **The dashboard is its own app with its own login.** It cannot borrow the admin
  session; the back office links to it (`ANALYTICS_URL`, `Visitors ↗`) instead.
- **Umami v2 posts pageviews to `/api/send`**, not `/api/collect` (v1). A 404 on
  `/api/collect` is the version, not a broken tracker.
- **Provisioning through its API needs a browser User-Agent.** Cloudflare answers the
  default Python/curl UA with `403 error code: 1010`, which reads like an Umami auth
  failure. Send a Chrome UA; then `POST /api/auth/login` (admin/umami on first boot),
  `POST /api/users/{id}` with `{password}` to rotate, and `POST /api/websites`
  `{name, domain}` for the site id.

## Backups

`lib/backup.js` runs nightly at 3 am mountain (in-process scheduler, date-guarded so a redeploy cannot double-run)
and can be triggered by hand from **Settings → Backups**. Each run:

- snapshots SQLite with `VACUUM INTO` (`data/backups/<day>.sqlite`) — never a plain `cp`, which can miss committed WAL data
- tars `uploads/` when it has files
- uploads both to B2 under `rebel-creamery/db/<day>.sqlite` and `rebel-creamery/uploads/<day>.tgz`
- prunes objects and local snapshots older than `BACKUP_RETENTION_DAYS` (30)

The key is bucket-scoped and cannot list buckets, so `B2_BUCKET_ID` is required (bucket `EComStore`).
Status of the last run is shown on the Settings page and stored in `data/backups/last.json`.

**Download backup** at the top of Settings streams a fresh `VACUUM INTO` snapshot as
`rebel-creamery-YYYY-MM-DD.sqlite` straight from the running app. It works even when B2 is not configured; it contains
the database only (orders, products, settings), not `uploads/`.

**Restore:** see `docs/RESTORE.md` — tested end to end (download → integrity check → boot → order count).
