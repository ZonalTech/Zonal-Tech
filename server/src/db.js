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
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
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
  "You are the friendly customer-support assistant for Zonal Tech, a company that " +
  "builds and licenses business software for African (especially Kenyan) teams: a " +
  "point-of-sale, ERPNext, HR & payroll, time & attendance, plus web development, " +
  "e-commerce and web hosting services.\n\n" +
  "Answer questions clearly and concisely (2-4 sentences) in a warm, helpful tone. " +
  "Only answer based on the information you are given about Zonal Tech and its " +
  "services; if you don't know or it's account-specific, say so and point the " +
  "customer to the Contact page or support@zonaltech.co.ke.\n\n" +
  "Key facts: Payments are by M-Pesa (Safaricom STK push). Licences are signed " +
  "tokens; device-locked products like the POS bind to a Machine ID shown on the " +
  "app's activation screen, where the customer pastes the token to activate. " +
  "Renewals stack on top of remaining time. Each plan includes a Service Level " +
  "Agreement the customer accepts from their dashboard after purchase.\n\n" +
  "Never invent prices, features, or policies you weren't given.";

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
    key: "hosting",
    name: "Hosting",
    tagline: "Managed cloud hosting with backups, monitoring and support.",
    description:
      "Reliable, managed hosting for your websites and Zonal Tech apps. We handle the " +
      "servers, backups, monitoring and HTTPS so you don't have to. Powered by Zonal " +
      "Cloud — deploy from Git and go live with a URL in seconds.",
    requires_device: false,
    download_url: "",
    plans: [
      { name: "Starter", edition: "starter", price_kes: 2500, period: "month", duration_days: 30,
        features: ["1 app or site", "Daily backups", "Automatic HTTPS", "Email support"] },
      { name: "Business", edition: "business", price_kes: 6000, period: "month", duration_days: 30,
        features: ["Up to 5 apps", "Managed PostgreSQL", "Monitoring & alerts", "Priority support"] },
      { name: "Scale", edition: "scale", price_kes: 15000, period: "month", duration_days: 30,
        features: ["Unlimited apps", "Dedicated resources", "99.9% uptime SLA", "Phone & email support"] },
    ],
  },
  {
    key: "zt-pos",
    name: "Point of Sale (POS)",
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
    key: "erpnext",
    name: "ERPNext",
    tagline: "Complete open-source ERP — accounting, sales, stock and more.",
    description:
      "Run your whole business on ERPNext: accounting, sales, purchasing, inventory, " +
      "manufacturing and projects in one system. We deploy, configure, customise and " +
      "support it for you on managed infrastructure.",
    requires_device: false,
    download_url: "",
    plans: [
      { name: "Standard", edition: "standard", price_kes: 18000, period: "month", duration_days: 30,
        features: ["Up to 10 users", "Hosting & backups", "Email support", "Quarterly updates"] },
      { name: "Enterprise", edition: "enterprise", price_kes: 45000, period: "month", duration_days: 30,
        features: ["Unlimited users", "Custom modules", "Dedicated support", "Onboarding & training"] },
    ],
  },
  {
    key: "zt-time",
    name: "Time & Attendance",
    tagline: "Biometric clock-in/out with shifts, overtime and reports.",
    description:
      "Track attendance accurately with biometric or PIN clock-in, shift scheduling, " +
      "overtime rules and exportable timesheets. Integrates with our HR and payroll, " +
      "and pairs with Zonal Tech biometric hardware.",
    requires_device: true,
    download_url: "",
    plans: [
      { name: "Standard", edition: "standard", price_kes: 8000, period: "year", duration_days: 365,
        features: ["Up to 50 staff", "Biometric & PIN", "Shift scheduling", "Timesheet exports"] },
      { name: "Enterprise", edition: "enterprise", price_kes: 20000, period: "year", duration_days: 365,
        features: ["Unlimited staff", "Multiple sites", "Overtime & leave rules", "Priority support"] },
    ],
  },
  {
    key: "zt-hr",
    name: "Human Resources (HR)",
    tagline: "Employee records, payroll, leave and performance in one place.",
    description:
      "A full HR suite: employee records, payroll with statutory deductions, leave " +
      "management, contracts and performance reviews. Built for Kenyan compliance and " +
      "integrates with Time & Attendance.",
    requires_device: false,
    download_url: "",
    plans: [
      { name: "Standard", edition: "standard", price_kes: 12000, period: "year", duration_days: 365,
        features: ["Up to 50 employees", "Payroll & payslips", "Leave management", "Email support"] },
      { name: "Enterprise", edition: "enterprise", price_kes: 30000, period: "year", duration_days: 365,
        features: ["Unlimited employees", "Performance reviews", "Custom workflows", "Priority support"] },
    ],
  },
  {
    key: "vehicle-tracking",
    name: "Vehicle Tracking",
    tagline: "Real-time GPS fleet tracking with alerts and trip history.",
    description:
      "Track your fleet in real time: live location, trip history, geofencing, speed " +
      "and fuel alerts, and driver reports. Works with Zonal Tech GPS tracker hardware " +
      "and bills per vehicle.",
    requires_device: true,
    download_url: "",
    plans: [
      { name: "Per Vehicle", edition: "standard", price_kes: 800, period: "month", duration_days: 30,
        features: ["1 vehicle", "Live GPS tracking", "Trip history", "Speed & fuel alerts"] },
      { name: "Fleet", edition: "fleet", price_kes: 12000, period: "month", duration_days: 30,
        features: ["Up to 20 vehicles", "Geofencing", "Driver reports", "Priority support"] },
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
  // Idempotent migrations for databases created before a column was added.
  await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE");
  await seed();
}
