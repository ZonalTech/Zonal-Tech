/**
 * /api/admin/* — operator panel. All routes require an admin user.
 */
import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  one, many, q, getSetting, putSetting,
  DEFAULT_AI_SETTINGS, DEFAULT_PAYMENT_SETTINGS, DEFAULT_AI_INSTRUCTIONS,
} from "../db.js";
import { requireAdmin, publicUser } from "../auth.js";
import {
  toAdminOrder, toAdminService, toPlan, licenseStatus,
} from "../serialize.js";
import { publicKeyB64, usingDemoSeed } from "../license.js";
import { issueLicense, fulfillOrder } from "../issue.js";
import { chat } from "../assistant.js";

const router = Router();
router.use(requireAdmin);

const isoDate = (d) => (d ? (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)) : null);
const isoTs = (d) => (d ? new Date(d).toISOString() : null);
const daysLeft = (expires) =>
  expires ? Math.max(0, Math.ceil((new Date(isoDate(expires)).getTime() - Date.now()) / 86400000)) : null;

// --- stats -----------------------------------------------------------------
router.get("/stats", async (_req, res) => {
  const revenue = await one("SELECT COALESCE(SUM(amount_kes),0) AS v FROM orders WHERE status='paid'");
  const activeLic = await many("SELECT * FROM licenses");
  const customers = await one("SELECT COUNT(*) AS v FROM users WHERE role='customer'");
  const paid = await one("SELECT COUNT(*) AS v FROM orders WHERE status='paid'");
  const pending = await many(
    `SELECT o.*, u.name AS customer_name FROM orders o JOIN users u ON u.id=o.user_id
     WHERE o.status='pending' ORDER BY o.created_at DESC`
  );
  const expiring = await many(
    `SELECT * FROM licenses WHERE revoked=FALSE AND expires IS NOT NULL
       AND expires >= CURRENT_DATE AND expires <= CURRENT_DATE + INTERVAL '30 days'
     ORDER BY expires ASC`
  );
  const pay = { ...DEFAULT_PAYMENT_SETTINGS, ...(await getSetting("payments", {})) };
  const liveMpesa = pay.mpesa?.enabled && pay.mpesa?.simulated === false;

  res.json({
    stats: {
      revenue_kes: Number(revenue.v),
      active_licenses: activeLic.filter((l) => licenseStatus(l) === "active").length,
      customers: Number(customers.v),
      paid_orders: Number(paid.v),
      pending_orders: pending.length,
      pending_orders_list: pending.map((o) => ({
        id: o.id,
        customer: o.customer_name,
        service: o.service_name,
        plan: o.plan_name,
        amount_kes: Number(o.amount_kes),
        payment: { method: o.method || null, mpesa_receipt: o.mpesa_receipt || null, provider_ref: o.provider_ref || null },
        created_at: isoTs(o.created_at),
      })),
      payment_mode: liveMpesa ? "mpesa" : "simulated",
      public_key: publicKeyB64(),
      using_demo_key: usingDemoSeed(),
      expiring_soon: expiring.map((l) => ({
        id: l.id, service: l.service_name, customer: l.customer,
        machine_id: l.machine_id, expires: isoDate(l.expires), days_left: daysLeft(l.expires),
      })),
    },
  });
});

// --- users -----------------------------------------------------------------
async function userRow(id) {
  return one(
    `SELECT u.*, (SELECT COUNT(*) FROM licenses l WHERE l.user_id=u.id) AS license_count
     FROM users u WHERE u.id=$1`, [id]
  );
}

router.get("/users", async (req, res) => {
  const rows = await many(
    `SELECT u.*, (SELECT COUNT(*) FROM licenses l WHERE l.user_id=u.id) AS license_count
     FROM users u ORDER BY u.created_at DESC`
  );
  res.json({ users: rows.map((u) => publicUser(u, { is_self: u.id === req.user.id })) });
});

router.post("/users", async (req, res) => {
  const { name, email, company, phone, role, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: "Name, email and password are required." });
  if (String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  const e = String(email).trim().toLowerCase();
  if (await one("SELECT 1 FROM users WHERE email=$1", [e]))
    return res.status(409).json({ error: "That email is already in use." });
  const hash = await bcrypt.hash(password, 10);
  const u = await one(
    `INSERT INTO users (name, email, company, phone, password_hash, role)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [String(name).trim(), e, company || null, phone || null, hash, role === "admin" ? "admin" : "customer"]
  );
  res.json({ user: publicUser(await userRow(u.id)) });
});

router.put("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const target = await one("SELECT * FROM users WHERE id=$1", [id]);
  if (!target) return res.status(404).json({ error: "User not found." });

  const patch = req.body || {};
  if ("is_active" in patch && id === req.user.id && patch.is_active === false)
    return res.status(400).json({ error: "You can't disable your own account." });
  if ("role" in patch && id === req.user.id && patch.role !== "admin")
    return res.status(400).json({ error: "You can't remove your own admin role." });

  const sets = [], vals = [];
  let i = 1;
  if ("role" in patch) { sets.push(`role=$${i++}`); vals.push(patch.role === "admin" ? "admin" : "customer"); }
  if ("is_active" in patch) { sets.push(`is_active=$${i++}`); vals.push(!!patch.is_active); }
  if ("name" in patch) { sets.push(`name=$${i++}`); vals.push(String(patch.name).trim()); }
  if ("company" in patch) { sets.push(`company=$${i++}`); vals.push(patch.company || null); }
  if ("phone" in patch) { sets.push(`phone=$${i++}`); vals.push(patch.phone || null); }
  if (!sets.length) return res.json({ user: publicUser(await userRow(id)) });
  vals.push(id);
  await q(`UPDATE users SET ${sets.join(", ")} WHERE id=$${i}`, vals);
  res.json({ user: publicUser(await userRow(id)) });
});

router.post("/users/:id/password", async (req, res) => {
  const { password } = req.body || {};
  if (!password || String(password).length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  const hash = await bcrypt.hash(password, 10);
  const u = await one("UPDATE users SET password_hash=$1 WHERE id=$2 RETURNING id", [hash, req.params.id]);
  if (!u) return res.status(404).json({ error: "User not found." });
  res.json({ ok: true });
});

router.delete("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: "You can't delete your own account." });
  const u = await one("DELETE FROM users WHERE id=$1 RETURNING id", [id]); // cascades licences/devices/orders
  if (!u) return res.status(404).json({ error: "User not found." });
  res.json({ ok: true });
});

// --- customers -------------------------------------------------------------
router.get("/customers", async (_req, res) => {
  const rows = await many(
    `SELECT u.*, (SELECT COUNT(*) FROM licenses l WHERE l.user_id=u.id) AS license_count
     FROM users u WHERE u.role='customer' ORDER BY u.created_at DESC`
  );
  res.json({
    customers: rows.map((u) => ({
      id: u.id, name: u.name, email: u.email, company: u.company || null,
      role: u.role, license_count: Number(u.license_count), created_at: isoTs(u.created_at),
    })),
  });
});

// --- licenses --------------------------------------------------------------
router.get("/licenses", async (_req, res) => {
  const rows = await many(
    `SELECT l.*, u.email AS customer_email FROM licenses l JOIN users u ON u.id=l.user_id
     ORDER BY l.created_at DESC`
  );
  res.json({
    licenses: rows.map((l) => ({
      id: l.id, service: l.service_name, customer_email: l.customer_email,
      machine_id: l.machine_id, edition: l.edition, expires: isoDate(l.expires),
      status: licenseStatus(l), token: l.token,
    })),
  });
});

router.post("/licenses", async (req, res) => {
  const { email, service_key, machine_id, edition, duration_days } = req.body || {};
  const user = await one("SELECT * FROM users WHERE email=$1", [String(email || "").trim().toLowerCase()]);
  if (!user) return res.status(404).json({ error: "No user with that email." });
  const service = await one("SELECT * FROM services WHERE key=$1", [service_key]);
  if (!service) return res.status(404).json({ error: "Unknown service key." });

  const { license } = await issueLicense({
    user,
    serviceKey: service.key,
    serviceName: service.name,
    edition: edition || "standard",
    machineId: machine_id ? String(machine_id).trim().toUpperCase() : null,
    durationDays: Number(duration_days) || 0,
    requiresDevice: service.requires_device !== false,
  });
  res.json({ license: { customer: license.customer, token: license.token } });
});

router.post("/licenses/:id/renew", async (req, res) => {
  const days = Number(req.body?.days) || 365;
  const lic = await one("SELECT * FROM licenses WHERE id=$1", [req.params.id]);
  if (!lic) return res.status(404).json({ error: "Licence not found." });
  // Extend from the later of today or the current expiry.
  const baseISO = lic.expires && new Date(isoDate(lic.expires)) > new Date()
    ? isoDate(lic.expires) : new Date().toISOString().slice(0, 10);
  const next = new Date(baseISO);
  next.setDate(next.getDate() + days);
  await q("UPDATE licenses SET expires=$1, revoked=FALSE WHERE id=$2",
    [next.toISOString().slice(0, 10), lic.id]);
  res.json({ ok: true });
});

router.post("/licenses/:id/revoke", async (req, res) => {
  const lic = await one("UPDATE licenses SET revoked=TRUE WHERE id=$1 RETURNING id", [req.params.id]);
  if (!lic) return res.status(404).json({ error: "Licence not found." });
  res.json({ ok: true });
});

// --- orders ----------------------------------------------------------------
router.get("/orders", async (_req, res) => {
  const rows = await many(
    `SELECT o.*, u.name AS customer_name FROM orders o JOIN users u ON u.id=o.user_id
     ORDER BY o.created_at DESC`
  );
  res.json({ orders: rows.map(toAdminOrder) });
});

router.post("/orders/:id/confirm", async (req, res) => {
  const o = await one("SELECT * FROM orders WHERE id=$1", [req.params.id]);
  if (!o) return res.status(404).json({ error: "Order not found." });
  if (o.status === "paid") return res.json({ ok: true });
  const user = await one("SELECT * FROM users WHERE id=$1", [o.user_id]);
  await fulfillOrder(o, user, { provider_ref: "manual_confirm" });
  res.json({ ok: true });
});

// --- messages --------------------------------------------------------------
router.get("/messages", async (_req, res) => {
  const rows = await many("SELECT * FROM messages ORDER BY created_at DESC");
  res.json({
    messages: rows.map((m) => ({
      id: m.id, name: m.name, email: m.email, category: m.category,
      subject: m.subject, message: m.message, status: m.status, created_at: isoTs(m.created_at),
    })),
  });
});

router.post("/messages/:id/handled", async (req, res) => {
  const m = await one("UPDATE messages SET status='handled' WHERE id=$1 RETURNING id", [req.params.id]);
  if (!m) return res.status(404).json({ error: "Message not found." });
  res.json({ ok: true });
});

// --- services & plans ------------------------------------------------------
router.get("/services", async (_req, res) => {
  const services = await many("SELECT * FROM services ORDER BY sort_order, id");
  const plans = await many("SELECT * FROM plans ORDER BY sort_order, id");
  res.json({
    services: services.map((s) => toAdminService(s, plans.filter((p) => p.service_id === s.id))),
  });
});

router.put("/services/:id", async (req, res) => {
  const { download_url, tagline, is_active, status, status_message } = req.body || {};
  const valid = ["operational", "degraded", "maintenance", "outage"];
  const s = await one(
    `UPDATE services SET
       download_url = COALESCE($1, download_url),
       tagline      = COALESCE($2, tagline),
       is_active    = COALESCE($3, is_active),
       status       = COALESCE($4, status),
       status_message = $5
     WHERE id=$6 RETURNING id`,
    [
      download_url ?? null,
      tagline ?? null,
      typeof is_active === "boolean" ? is_active : null,
      status && valid.includes(status) ? status : null,
      status_message ?? null,
      req.params.id,
    ]
  );
  if (!s) return res.status(404).json({ error: "Service not found." });
  res.json({ ok: true });
});

function parseFeatures(features) {
  if (Array.isArray(features)) return features;
  if (typeof features === "string")
    return features.split("\n").map((f) => f.trim()).filter(Boolean);
  return [];
}

router.post("/services/:id/plans", async (req, res) => {
  const s = await one("SELECT id FROM services WHERE id=$1", [req.params.id]);
  if (!s) return res.status(404).json({ error: "Service not found." });
  const { name, edition, price_kes, period, duration_days, sort_order, features } = req.body || {};
  if (!name) return res.status(400).json({ error: "Plan name is required." });
  const p = await one(
    `INSERT INTO plans (service_id, name, edition, price_kes, period, duration_days, features, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [s.id, String(name).trim(), edition || "standard", Number(price_kes) || 0,
     period || "year", Number(duration_days) || 0, JSON.stringify(parseFeatures(features)), Number(sort_order) || 0]
  );
  res.json({ plan: toPlan(p) });
});

router.put("/plans/:id", async (req, res) => {
  const { name, edition, price_kes, period, duration_days, features, is_active } = req.body || {};
  const p = await one(
    `UPDATE plans SET
       name          = COALESCE($1, name),
       edition       = COALESCE($2, edition),
       price_kes     = COALESCE($3, price_kes),
       period        = COALESCE($4, period),
       duration_days = COALESCE($5, duration_days),
       features      = COALESCE($6, features),
       is_active     = COALESCE($7, is_active)
     WHERE id=$8 RETURNING *`,
    [
      name ?? null,
      edition ?? null,
      price_kes != null ? Number(price_kes) : null,
      period ?? null,
      duration_days != null ? Number(duration_days) : null,
      features != null ? JSON.stringify(parseFeatures(features)) : null,
      typeof is_active === "boolean" ? is_active : null,
      req.params.id,
    ]
  );
  if (!p) return res.status(404).json({ error: "Plan not found." });
  res.json({ plan: toPlan(p) });
});

router.delete("/plans/:id", async (req, res) => {
  const p = await one("DELETE FROM plans WHERE id=$1 RETURNING id", [req.params.id]);
  if (!p) return res.status(404).json({ error: "Plan not found." });
  res.json({ ok: true });
});

// --- settings: payments ----------------------------------------------------
// Secrets are never returned. We expose <field>_set + <field>_hint, and only
// overwrite a stored secret when a non-empty value is sent.
const SECRET_FIELDS = {
  mpesa: ["consumer_secret", "passkey"],
  stripe: ["secret_key"],
};
function maskPayments(saved) {
  const cfg = { ...DEFAULT_PAYMENT_SETTINGS, ...saved };
  const out = JSON.parse(JSON.stringify(cfg));
  for (const [group, fields] of Object.entries(SECRET_FIELDS)) {
    for (const f of fields) {
      const v = cfg[group]?.[f] || "";
      out[group][`${f}_set`] = !!v;
      out[group][`${f}_hint`] = v ? "••••" + String(v).slice(-4) : "";
      delete out[group][f];
    }
  }
  return out;
}

router.get("/settings/payments", async (_req, res) => {
  res.json({ settings: maskPayments(await getSetting("payments", {})) });
});

router.put("/settings/payments", async (req, res) => {
  const current = { ...DEFAULT_PAYMENT_SETTINGS, ...(await getSetting("payments", {})) };
  const body = req.body || {};
  for (const group of ["mpesa", "stripe", "bank"]) {
    if (!body[group]) continue;
    const incoming = { ...body[group] };
    // Preserve secrets when the field is blank/omitted.
    for (const f of SECRET_FIELDS[group] || []) {
      if (!incoming[f]) delete incoming[f];
    }
    current[group] = { ...current[group], ...incoming };
  }
  await putSetting("payments", current);
  res.json({ settings: maskPayments(current) });
});

// --- settings: AI ----------------------------------------------------------
function maskAi(saved) {
  const cfg = { ...DEFAULT_AI_SETTINGS, ...saved };
  const key = cfg.api_key || "";
  const out = { ...cfg };
  delete out.api_key;
  out.api_key_set = !!key;
  out.api_key_hint = key ? "••••" + key.slice(-6) : "";
  return out;
}

router.get("/settings/ai", async (_req, res) => {
  res.json({
    settings: maskAi(await getSetting("ai", {})),
    default_instructions: DEFAULT_AI_INSTRUCTIONS,
  });
});

router.put("/settings/ai", async (req, res) => {
  const current = { ...DEFAULT_AI_SETTINGS, ...(await getSetting("ai", {})) };
  const { provider, base_url, model, instructions, enabled, api_key } = req.body || {};
  if (provider != null) current.provider = provider;
  if (base_url != null) current.base_url = base_url;
  if (model != null) current.model = model;
  if (instructions != null) current.instructions = instructions;
  if (typeof enabled === "boolean") current.enabled = enabled;
  if (api_key) current.api_key = api_key; // only overwrite when non-empty
  await putSetting("ai", current);
  res.json({ settings: maskAi(current) });
});

router.post("/settings/ai/test", async (req, res) => {
  const saved = { ...DEFAULT_AI_SETTINGS, ...(await getSetting("ai", {})) };
  const { message, api_key, provider, base_url, model, instructions } = req.body || {};
  // Test the form's current values; fall back to the saved key if none typed.
  const cfg = {
    enabled: true,
    provider: provider || saved.provider,
    base_url: base_url || saved.base_url,
    model: model || saved.model,
    instructions: instructions ?? saved.instructions,
    api_key: api_key || saved.api_key,
  };
  const result = await chat(cfg, message || "Hello! Briefly, what does Zonal Tech do?", []);
  res.json(result);
});

export default router;
