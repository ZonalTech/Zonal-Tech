# Zonal Tech — Backend

The API + database layer for the Zonal Tech licensing portal. It's a Node.js
(Express) server backed by PostgreSQL that:

- serves the JSON API under `/api/*`,
- issues **Ed25519-signed licences** (byte-compatible with the in-browser
  License Generator and the verifier shipped in each product),
- runs the storefront, checkout, payments, customer dashboard and the full
  admin panel,
- serves the built React SPA (`../dist`) so the whole thing is **one app on one
  port**.

## Built for Zonal Cloud

This is designed to deploy as a Zonal Cloud **fullstack** app:

- Zonal Cloud auto-provisions a dedicated PostgreSQL database and injects
  `DATABASE_URL` — no manual DB setup.
- nixpacks builds the repo: `npm install` (also installs this server via the
  root `postinstall`), `npm run build` (Vite → `../dist`), then `npm start`
  (root → `npm start --prefix server`).
- The server listens on `$PORT` (injected by the platform).

On **first boot** it creates its schema and seeds demo content: an admin user,
three sample services with plans, and default payment/AI settings. All
idempotent.

## Run locally

```bash
# from the repo root
cp server/.env.example server/.env     # set DATABASE_URL + JWT_SECRET + admin
npm install                            # installs frontend + server deps
npm run build                          # build the SPA into dist/
npm start                              # serve API + SPA on $PORT (default 8000)
```

For frontend hot-reload during development, run the API and Vite separately —
Vite proxies `/api` to `:8000` (see `vite.config.js`):

```bash
npm run dev:server   # API on :8000
npm run dev          # Vite on :5173
```

Default seeded admin: `admin@zonaltech.co.ke` / value of `ADMIN_PASSWORD`
(or `admin12345` if unset — change it).

## Layout

```
server/src/
  index.js        entrypoint: route wiring, SPA host, $PORT listen
  db.js           pg pool, schema bootstrap, demo seed, settings, SLA terms
  auth.js         JWT + bcrypt helpers, requireAuth / requireAdmin guards
  license.js      Ed25519 signing (mirrors src/lib/license.js, same demo seed)
  issue.js        issue licence + SLA agreement; fulfil a paid order
  assistant.js    support chat (Mistral / Gemini / Claude) with fallback
  serialize.js    row → API-object shapes the frontend reads
  routes/
    auth.js       /api/auth/*  (register, login, me, forgot, reset)
    public.js     /api/services, /status, /contact, /assistant, /payment-methods
    me.js         /api/me/*  + /checkout, /orders/:id, /payments/*
    admin.js      /api/admin/*  (stats, users, services, plans, orders,
                  licences, messages, customers, settings)
```

## Licensing keys

The signing seed defaults to the demo seed shared with the browser tool, so
manual and automated licences validate against the same public key out of the
box. **Before selling**, set `LICENSE_SEED_B64` to a fresh secret seed and paste
the matching public key (shown on the admin dashboard) into each product's
`LICENSE_PUBLIC_KEY`.

### Activation by UID (replaces device Machine ID)

POS and other licensed products now activate against an account **UID** rather
than a per-device Machine ID. The signed token payload carries `uid`:

```json
{ "v": 1, "uid": "UID-1024", "app": "zt-pos", "customer": "...",
  "edition": "standard", "issued": "2026-06-22", "expires": "2027-06-22" }
```

**Product verifier change** (`apps/zt-pos/license.py` shipped inside the app):
read `payload["uid"]` where it previously read `payload["machine_id"]`, and
compare it to the account UID the app is bound to instead of the local machine
fingerprint. The signature, key handling and token format are unchanged, so
existing public keys keep working — only the bound field changes.

> The portal's `licenses`/`agreements` tables keep their `machine_id` columns
> (to avoid a destructive migration on live data); they now store the UID value.
> `buildLicense` accepts either `uid` (current) or `machineId` (legacy alias).

## Payments

Three methods, toggled in **Admin → Settings → Payments**:

- **M-Pesa** — demo/simulated by default (customer confirms in-app to issue the
  licence). Flip `simulated` off and fill credentials for a live STK push (the
  push/callback handlers are stubbed for you to wire to Daraja).
- **Bank transfer** — shows account details + a reference; the licence is issued
  when an admin confirms the order.
- **Card (Stripe)** — enabled when a secret key is set; the return flow is
  stubbed to confirm on redirect (wire a real Checkout Session for production).

Secrets are never returned by the API — settings responses expose only
`<field>_set` / `<field>_hint`, and a blank value on save keeps the stored one.
