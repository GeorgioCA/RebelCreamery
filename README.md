# Rebel Creamery — storefront

Self-hosted storefront for a small dairy: product cards, cart, Stripe Checkout, Interac e-Transfer,
and a password-protected order book. One Node process, one SQLite file, one Docker container.

No page builder, no plugins, no external SaaS besides Stripe.

## Why this instead of WooCommerce

- **One container, no plugin surface.** WooCommerce means WordPress + PHP + a payment plugin + update
  churn on four moving parts. This is ~900 lines you can read in an afternoon.
- **Design is not constrained by a theme.** Every pixel is in `public/styles.css`.
- **The catalog matches the cost model.** Prices and pack sizes in `lib/catalog.js` are the same numbers
  used in `Business/Dairy Shop/The Numbers`.
- **Payments are hosted.** Stripe Checkout means card data never touches the server (SAQ A).
- **e-Transfer for locals.** Zero-fee option for Calgary customers who prefer it.

Trade-off: marketing copy still lives in `lib/views.js` / env vars — but products, prices, stock and photos are managed in the back office, not in code.

## Run it

```sh
cp .env.example .env         # edit the values
docker compose up -d --build # http://localhost:3000
```

Without Docker:

```sh
npm install
node --env-file=.env server.js
```

First run creates `./data/store.db` and seeds stock from `lib/catalog.js`.

## Products

Add, edit, hide or delete products at **`/admin/products`** — no deploy needed. Each product has a name,
size, price, description, tags, stock, max-per-order, sort order and either an uploaded photo (JPG/PNG/WebP,
5 MB) or one of the built-in illustrations.

- **New product** → fills the form, appears on the storefront immediately.
- **Hide** (uncheck "Show on the storefront") keeps the row and its stock but removes it from sale.
- **Delete** removes the product; past orders keep their own copy of name and price, so the order book
  stays accurate. The uploaded photo is unlinked when no other product uses it.
- **Sort order** controls the order cards appear in (lower first).
- Stock is per product and is reserved when an order is placed, released when it is cancelled.

The seed catalog in `lib/catalog.js` is only used once, to populate an empty database.

## Labels (Brother QL-800)

Two ways to print, both sized for **62 mm continuous DK-22205 tape** at 300 dpi (696 px):

1. **Queue from the back office** — `Label` on any order, or `Queue labels` on a product page with a
   copy count. The store writes a `print_jobs` row; the agent on the machine with the printer picks
   it up, renders and prints it over USB. Works with the shop on any server, printer behind a home
   router, no port forwarding.
2. **Print from the browser** — `/admin/labels/order/<number>` or `/admin/labels/product/<id>` renders
   a 62 mm page and opens the print dialog. Needs Brother's own driver/CUPS on that machine.

Set `PRINT_TOKEN` to the same value on the store and the agent; leaving it empty disables `/api/print/*`
(503) and the queue endpoints. `BUSINESS_ADDRESS` is printed in the footer of every label.

The daemon lives in [`print-agent/labelprint.py`](print-agent/) — one script, three sources (shop
queue, spool folder, LAN HTTP) and three backends (Brother USB, CUPS, PNG files). Run the shop path with
`STORE_URL=… PRINT_TOKEN=… python3 labelprint.py run --source store --backend brother`; `--backend file`
renders PNGs so you can check layout before wasting tape. Full setup, job format, udev rules and a
systemd unit are in [`print-agent/README.md`](print-agent/README.md).

Products carry their own **ingredients**, **allergens** and **shelf life (days)**; best-before is
computed from the print date. These labels are operational (name, net weight, ingredients, allergen,
packed/best-before, storage) — they are not a substitute for a nutrition facts panel or bilingual
retail labelling if you move into grocery.

## Configuration

### Order email

Customers get a confirmation with their order link when they check out, and a short note when you change the status to paid, packed, completed or cancelled. Sending goes through [Resend](https://resend.com) — one API call, no extra dependency.

```
RESEND_API_KEY=re_...
EMAIL_FROM=Rebel Creamery <orders@rebelcreamery.ca>
```

`EMAIL_FROM` must be on a domain verified in Resend (add the domain in their dashboard, then copy the DKIM/SPF records into Cloudflare DNS). Until it is verified, the fallback `onboarding@resend.dev` only delivers to the Resend account owner — customer addresses will be rejected by the API.

Everything else lives in `.env`:

| Variable | What it does |
|---|---|
| `SITE_NAME`, `SITE_TAGLINE` | Wordmark and meta description |
| `PICKUP_LOCATION`, `PICKUP_WINDOW`, `CUTOFF_TEXT` | Pickup copy across the site |
| `DELIVERY_FEE_CENTS`, `FREE_DELIVERY_THRESHOLD_CENTS` | Delivery pricing (cents) |
| `ETRANSFER_EMAIL` | Where Interac e-Transfers land |
| `STRIPE_SECRET_KEY` | `sk_live_…` or `sk_test_…` — enables real card checkout |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the webhook endpoint |
| `DEMO_MODE=1` | Simulates card payments when no Stripe key is set (for testing) |
| `ADMIN_USER`, `ADMIN_PASSWORD` | HTTP Basic auth for `/admin` |
| `PUBLIC_BASE_URL` | Public origin, used for Stripe redirect URLs |

Products, prices and stock live in `lib/catalog.js`. Stock is also editable from the order book.

## Payments

### Stripe

1. Create the account, grab the secret key, set `STRIPE_SECRET_KEY`.
2. Add a webhook endpoint: `https://your-domain/api/stripe/webhook`, event
   `checkout.session.completed`. Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Set `DEMO_MODE=0` and redeploy.

Card data never reaches this app. The webhook is what marks an order paid — without it, orders sit in
`pending`. Test with `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

### Interac e-Transfer

No integration needed: the order is recorded as `awaiting_etransfer` with the order number as the
message, the customer is shown the amount and your `ETRANSFER_EMAIL`, and you mark it `paid` in
`/admin` when it lands. Auto-deposit on your bank account means no security question.

## Order lifecycle

`pending` (card, awaiting Stripe) → `paid` → `packed` → `completed`
`awaiting_etransfer` (e-Transfer) → `paid` …
`cancelled` returns the reserved stock to the cooler.

Stock is reserved when the order is placed, not when it is paid — otherwise two people can buy the last
halloumi while one is still paying.

## Deploy on Coolify

Use **`docker-compose.coolify.yml`** — not the dev `docker-compose.yml`, which publishes a host port.

1. **New resource → Docker Compose**, point at `https://github.com/GeorgioCA/RebelCreamery`, branch `main`,
   compose location `/docker-compose.coolify.yml`.
2. **Domain** on the `web` service: enter it with the container port, e.g. `https://shop.example.ca:3000`.
   The `:3000` is what Coolify's proxy routes to; the public site is still 443. Coolify fills
   `SERVICE_FQDN_WEB_3000` from the first domain in that list.
3. **Environment variables** — set these in the panel; the compose substitutes them into the container:

   | Variable | Required | Default if unset |
   |---|---|---|
   | `ADMIN_PASSWORD` | yes (else `/admin` returns 503) | empty |
   | `ADMIN_USER` | no | `owner` |
   | `STRIPE_SECRET_KEY` | for cards | empty — card option hidden |
   | `STRIPE_WEBHOOK_SECRET` | for cards | empty — orders stay `pending` |
   | `ETRANSFER_EMAIL` | yes | `hello@rebelcreamery.ca` |
   | `SITE_NAME`, `CONTACT_EMAIL`, `PICKUP_LOCATION`, `PICKUP_WINDOW` | no | dairy defaults |
   | `PUBLIC_BASE_URL` | no | derived from the request |

4. **Volume**: `creamery-data` mounts at `/data` — that is the entire order book. It is declared in the
   compose, so it is read-only in the panel's Persistent Storage page; back it up from the host.
5. **Healthcheck** hits `/health` inside the container. The stack declares `expose:` only (no `ports:`),
   so the app is never reachable except through Coolify's proxy.
6. `DEMO_MODE` defaults to `0` here: card checkout stays disabled until a Stripe key exists, rather than
   silently simulating payments in production.

No database container, no migrations to run, no build step beyond the Dockerfile.

## Backups

The entire business state is `/data/store.db` (plus `-wal`/`-shm`). Copy it nightly:

```sh
docker run --rm -v rebel-creamery_creamery-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/creamery-$(date +%F).tgz -C /data .
```

## Files

```
server.js              routes, checkout, webhook, admin auth
lib/catalog.js         site copy, delivery rules, illustration styles, seed catalog
lib/db.js              SQLite schema, products, orders, stock, print queue
lib/labels.js          label payloads + 62 mm HTML labels
print-agent/           labelprint.py — background label printer (store/spool/HTTP → USB/CUPS/file)
lib/views.js           server-rendered HTML (home, checkout, success, admin)
public/styles.css      the whole design system
public/app.js          cart, drawer, checkout form
public/fonts/          Fraunces + Inter, self-hosted (no Google request at runtime)
scripts/               restart-preview.sh — local server on :3100
tests/                 e2e.py (Playwright checkout flow), shot.py (screenshots), check.py (layout probes)
```

## Known gaps

- No transactional email — the confirmation is the success page. Add Resend/Postmark if wanted.
- No pickup-time slotting; one window for everyone.
- Single admin user; no audit log.
- SQLite is fine to a few thousand orders; move to Postgres beyond that.
