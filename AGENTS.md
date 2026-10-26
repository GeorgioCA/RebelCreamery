# AGENTS.md

Instructions for anyone — human or coding agent — working in this repository.

## What this is

Rebel Creamery's storefront: a small-batch dairy in Calgary selling yogurt, cream cheese and halloumi for pickup or Friday delivery. One Node process, one SQLite file, one container. Not a framework, not a CMS.

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
| `lib/views.js` | Every HTML template as a template literal |
| `lib/catalog.js` | Seed products, site copy defaults, delivery config |
| `lib/mail.js` | Resend templates (confirmation, status update) |
| `lib/labels.js` | 62 mm label rendering |
| `lib/assets.js` | Content-hash query strings for CSS/JS |
| `public/` | `styles.css`, `app.js` (cart, checkout, address autofill) |
| `print-agent/` | Standalone Python label daemon — separate from the web app |
| `tests/` | Playwright and smoke tests, run by hand |
| `data/` | SQLite + uploaded photos. **Gitignored. This is the business record.** |

## Conventions

- **Money is integer cents**, CAD, everywhere. Format only at the edge with `money()`. No floats for money.
- **No client framework.** Views are template literals; interactivity is plain DOM in `public/app.js`. Don't introduce React/Vue/Tailwind for a 3-SKU shop.
- **Server-rendered forms post and redirect.** No JSON APIs for admin screens.
- **Products are data, not code.** Adding a SKU must never require a deploy.
- **Escape everything interpolated into HTML** with `esc()`. Most values come from the owner or customers.
- **Dates:** store ISO strings; render in `America/Edmonton`.
- **Copy:** short sentences, concrete numbers, no wellness claims. See `Socials.md` in the business vault for voice.

## Data rules

- Schema changes go through the **column migration block** in `lib/db.js` — `ALTER TABLE ... ADD COLUMN` guarded by a `PRAGMA table_info` check. Never drop or rewrite a table that holds orders.
- `orders` and `order_items` are append-only history. Products may be deleted; past orders keep their own copy of name and price.
- The SQLite file lives on the `creamery-data` volume at `/data`. Back it up before any migration you're unsure about.
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
- **Resend** — `orders@rebelcreamery.ca`, domain verified. Emails send on checkout and on status changes (paid/packed/completed/cancelled). Failures log, never block a sale.
- **Address autofill** — `/api/address` proxies Photon (OSM), `/api/postal/:fsa` proxies Zippopotam. Free and keyless; cached in memory and rate-limited. Neither confirms deliverability.
- **Stripe/Resend failures must degrade, not 500.** Checkout works with email down; the store works with Stripe unset (e-Transfer only).

## Testing

No test runner in CI. Verify changes with the preview server plus a Playwright script:

- Checkout end to end: add to cart → checkout → order page → admin detail.
- Product CRUD in `/admin/products`, including hide, sold out, and delete.
- `tests/product_flow.py` and `tests/labelprint_smoke.py` are the existing scripts.
- Anything touching money, stock or the webhook: test against a Stripe test key, never a live charge.

## Gotchas

- `node:sqlite` is still marked experimental — the warning on boot is expected.
- `MAX(0, stock - ?)` means stock can't go negative; don't read it as a demand signal.
- Route order matters in Express: `/admin/orders/:number` must not shadow the more specific routes.
- The print agent runs on the machine with the printer, not in the container. Labels are queued in SQLite and polled.
- WhatsApp/SMS do not exist. Email is the only outbound channel.
