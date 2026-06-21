/**
 * PostgreSQL access + schema bootstrap.
 *
 * On Zonal Cloud, full-stack apps are handed a `DATABASE_URL` pointing at a
 * dedicated database on the shared Postgres server (host `postgres` on
 * `zonal_net`). We create our schema on first boot and seed demo content so the
 * portal is usable immediately after deploy. Everything here is idempotent.
 */
import pg from "pg";
import bcrypt from "bcryptjs";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://zonal:changeme@localhost:5432/zonal";

// Zonal Cloud's in-network Postgres doesn't use TLS; managed cloud providers
// often do. Opt in with PGSSL=1 (or a sslmode=require in the URL).
const ssl =
  process.env.PGSSL === "1" || /sslmode=require/.test(connectionString)
    ? { rejectUnauthorized: false }
    : undefined;

export const pool = new pg.Pool({ connectionString, ssl, max: 10 });

export const q = (text, params) => pool.query(text, params);
export const one = async (text, params) => (await pool.query(text, params)).rows[0] || null;
export const many = async (text, params) => (await pool.query(text, params)).rows;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  company       TEXT,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  reset_token   TEXT,
  reset_expires TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id             SERIAL PRIMARY KEY,
  key            TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  tagline        TEXT,
  description    TEXT,
  requires_device BOOLEAN NOT NULL DEFAULT TRUE,
  download_url   TEXT,
  status         TEXT NOT NULL DEFAULT 'operational',
  status_message TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plans (
  id            SERIAL PRIMARY KEY,
  service_id    INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  edition       TEXT NOT NULL DEFAULT 'standard',
  price_kes     NUMERIC NOT NULL DEFAULT 0,
  period        TEXT NOT NULL DEFAULT 'year',
  duration_days INTEGER NOT NULL DEFAULT 365,
  features      JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine_id TEXT NOT NULL,
  label      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, machine_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id      INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  plan_name    TEXT NOT NULL,
  service_key  TEXT NOT NULL,
  edition      TEXT NOT NULL DEFAULT 'standard',
  duration_days INTEGER NOT NULL DEFAULT 365,
  period       TEXT NOT NULL DEFAULT 'year',
  amount_kes   NUMERIC NOT NULL DEFAULT 0,
  machine_id   TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  method       TEXT,
  phone        TEXT,
  reference    TEXT,
  provider_ref TEXT,
  mpesa_receipt TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS licenses (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id    INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  service_key TEXT NOT NULL,
  service_name TEXT NOT NULL,
  customer    TEXT NOT NULL,
  edition     TEXT NOT NULL DEFAULT 'standard',
  machine_id  TEXT,
  token       TEXT NOT NULL,
  issued      DATE NOT NULL DEFAULT CURRENT_DATE,
  expires     DATE,
  revoked     BOOLEAN NOT NULL DEFAULT FALSE,
  requires_device BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agreements (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  license_id  INTEGER REFERENCES licenses(id) ON DELETE CASCADE,
  order_id    INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  machine_id  TEXT,
  terms       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status      TEXT NOT NULL DEFAULT 'pending',
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  category   TEXT,
  subject    TEXT,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb
);
`;

// SLA terms attached to every licence, keyed by edition. Mirrors the SLA
// component's expected { tier, version, summary, commitments, clauses } shape.
function slaTerms(edition) {
  const e = (edition || "standard").toLowerCase();
  const tier = e.charAt(0).toUpperCase() + e.slice(1);
  const byTier = {
    enterprise: { uptime: "99.9%", response: "2 business hours", restore: "4 hours" },
    pro:        { uptime: "99.5%", response: "4 business hours", restore: "8 hours" },
    professional: { uptime: "99.5%", response: "4 business hours", restore: "8 hours" },
    standard:   { uptime: "99.0%", response: "1 business day",   restore: "Next business day" },
    basic:      { uptime: "99.0%", response: "1 business day",   restore: "Next business day" },
    trial:      { uptime: "Best effort", response: "Best effort", restore: "Best effort" },
  };
  const c = byTier[e] || byTier.standard;
  return {
    tier,
    version: "1.0",
    summary:
      "This agreement covers the support and availability commitments Zonal Tech " +
      "provides for your licensed software during the licence term.",
    commitments: {
      "Target uptime": c.uptime,
      "Support response": c.response,
      "Restore objective": c.restore,
      "Support channel": "Email & phone, Mon–Fri 8am–6pm EAT",
    },
    clauses: [
      "Zonal Tech will make commercially reasonable efforts to meet the availability target above, measured monthly and excluding scheduled maintenance.",
      "Support requests are acknowledged within the response time stated for your edition.",
      "The customer is responsible for keeping the software updated and for the security of the device(s) on which it is activated.",
      "Licences are issued per device (Machine ID) and are non-transferable without re-issue by Zonal Tech.",
      "This agreement is governed by the laws of the Republic of Kenya.",
    ],
  };
}
export { slaTerms };

const DEFAULT_AI_SETTINGS = {
  enabled: false,
  provider: "mistral",
  base_url: "https://api.mistral.ai/v1",
  model: "mistral-small-latest",
  api_key: "",
  instructions: "",
};

const DEFAULT_PAYMENT_SETTINGS = {
  mpesa: {
    enabled: true,
    simulated: true,
    env: "sandbox",
    shortcode: "",
    consumer_key: "",
    consumer_secret: "",
    passkey: "",
    callback_base: "",
  },
  stripe: { enabled: false, secret_key: "", publishable_key: "" },
  bank: {
    enabled: true,
    bank_name: "Equity Bank Kenya",
    account_name: "Zonal Tech Ltd",
    account_number: "0100123456789",
    branch: "Nairobi CBD",
    swift: "EQBLKENA",
    instructions: "Use your order reference as the payment narration so we can match it quickly.",
  },
};

export const DEFAULT_AI_INSTRUCTIONS =
  "You are the Zonal Tech assistant. You help visitors understand Zonal Tech's " +
  "business software and licensing, pricing in Kenyan Shillings (KES), how to buy " +
  "with M-Pesa, card or bank transfer, and how to activate a licence on a device " +
  "using its Machine ID. Be concise, friendly and accurate. If you don't know " +
  "something, say so and suggest contacting support.";

async function getSetting(key, fallback) {
  const row = await one("SELECT value FROM settings WHERE key=$1", [key]);
  return row ? row.value : fallback;
}
async function putSetting(key, value) {
  await q(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value]
  );
  return value;
}
export { getSetting, putSetting, DEFAULT_AI_SETTINGS, DEFAULT_PAYMENT_SETTINGS };

const SEED_SERVICES = [
  {
    key: "zt-pos",
    name: "Zonal Tech POS",
    tagline: "Fast, offline-first point of sale for shops and restaurants.",
    description:
      "A complete point-of-sale built for African retail: works offline, syncs when " +
      "you're back online, handles M-Pesa, prints receipts, and tracks stock. Licensed " +
      "per till with a signed key that activates instantly.",
    requires_device: true,
    download_url: "",
    plans: [
      { name: "Basic", edition: "basic", price_kes: 12000, period: "year", duration_days: 365,
        features: ["1 till", "Sales & receipts", "Basic stock", "Email support"] },
      { name: "Pro", edition: "pro", price_kes: 24000, period: "year", duration_days: 365,
        features: ["Up to 3 tills", "Stock & suppliers", "M-Pesa reconciliation", "Priority support"] },
      { name: "Lifetime", edition: "pro", price_kes: 60000, period: "perpetual", duration_days: 0,
        features: ["Up to 3 tills", "All Pro features", "Perpetual licence", "1 year of updates"] },
    ],
  },
  {
    key: "zt-inventory",
    name: "Zonal Tech Inventory",
    tagline: "Multi-store stock control with low-stock alerts and reports.",
    description:
      "Keep every store's stock accurate. Transfers, purchase orders, supplier records, " +
      "barcode support and the reports you need to reorder on time.",
    requires_device: true,
    download_url: "",
    plans: [
      { name: "Standard", edition: "standard", price_kes: 18000, period: "year", duration_days: 365,
        features: ["1 store", "Stock & transfers", "Low-stock alerts", "Email support"] },
      { name: "Enterprise", edition: "enterprise", price_kes: 48000, period: "year", duration_days: 365,
        features: ["Unlimited stores", "Purchase orders", "Advanced reports", "Priority support"] },
    ],
  },
  {
    key: "zt-cloud-care",
    name: "Cloud Care",
    tagline: "Managed hosting, backups and support for your Zonal Tech apps.",
    description:
      "A subscription service where our team hosts, monitors, backs up and supports your " +
      "Zonal Tech deployment. No device activation required — we set everything up for you.",
    requires_device: false,
    download_url: "",
    plans: [
      { name: "Care", edition: "standard", price_kes: 5000, period: "month", duration_days: 30,
        features: ["Managed hosting", "Daily backups", "Monitoring", "Email & phone support"] },
    ],
  },
];

async function seed() {
  // --- settings ---
  if (!(await one("SELECT 1 FROM settings WHERE key='ai'")))
    await putSetting("ai", DEFAULT_AI_SETTINGS);
  if (!(await one("SELECT 1 FROM settings WHERE key='payments'")))
    await putSetting("payments", DEFAULT_PAYMENT_SETTINGS);

  // --- admin user ---
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@zonaltech.co.ke").toLowerCase();
  if (!(await one("SELECT 1 FROM users WHERE role='admin' LIMIT 1"))) {
    const pw = process.env.ADMIN_PASSWORD || "admin12345";
    const hash = await bcrypt.hash(pw, 10);
    await q(
      `INSERT INTO users (name, email, company, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin')
       ON CONFLICT (email) DO NOTHING`,
      ["Zonal Tech Admin", adminEmail, "Zonal Tech Ltd", hash]
    );
    console.log(`[seed] admin user ${adminEmail} (password: ${process.env.ADMIN_PASSWORD ? "from env" : pw})`);
  }

  // --- services & plans ---
  if (!(await one("SELECT 1 FROM services LIMIT 1"))) {
    for (let i = 0; i < SEED_SERVICES.length; i++) {
      const s = SEED_SERVICES[i];
      const svc = await one(
        `INSERT INTO services (key, name, tagline, description, requires_device, download_url, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [s.key, s.name, s.tagline, s.description, s.requires_device, s.download_url, i]
      );
      for (let j = 0; j < s.plans.length; j++) {
        const p = s.plans[j];
        await q(
          `INSERT INTO plans (service_id, name, edition, price_kes, period, duration_days, features, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [svc.id, p.name, p.edition, p.price_kes, p.period, p.duration_days, JSON.stringify(p.features), j]
        );
      }
    }
    console.log(`[seed] ${SEED_SERVICES.length} services with plans`);
  }
}

export async function init() {
  await q(SCHEMA);
  await seed();
}
