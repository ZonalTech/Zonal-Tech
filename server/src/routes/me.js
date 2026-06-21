/**
 * /api/me/* and the checkout/payment flow — all require an authenticated user.
 */
import { Router } from "express";
import crypto from "node:crypto";
import { one, many, q, getSetting, DEFAULT_PAYMENT_SETTINGS } from "../db.js";
import { requireAuth } from "../auth.js";
import { toLicense, toOrder, toAgreement, toDevice } from "../serialize.js";
import { issueLicense, fulfillOrder } from "../issue.js";

const router = Router();
router.use(requireAuth);

const paymentCfg = async () => ({ ...DEFAULT_PAYMENT_SETTINGS, ...(await getSetting("payments", {})) });

// --- licences --------------------------------------------------------------
router.get("/licenses", async (req, res) => {
  const rows = await many(
    "SELECT * FROM licenses WHERE user_id=$1 ORDER BY created_at DESC",
    [req.user.id]
  );
  res.json({ licenses: rows.map(toLicense) });
});

// --- orders ----------------------------------------------------------------
router.get("/orders", async (req, res) => {
  const rows = await many(
    "SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC",
    [req.user.id]
  );
  res.json({ orders: rows.map((o) => toOrder(o)) });
});

// --- devices ---------------------------------------------------------------
router.get("/devices", async (req, res) => {
  const rows = await many("SELECT * FROM devices WHERE user_id=$1 ORDER BY created_at DESC", [req.user.id]);
  res.json({ devices: rows.map(toDevice) });
});

router.post("/devices", async (req, res) => {
  const machine_id = String(req.body?.machine_id || "").trim().toUpperCase();
  const label = req.body?.label ? String(req.body.label).trim() : null;
  if (!machine_id) return res.status(400).json({ error: "Machine ID is required." });
  try {
    const d = await one(
      `INSERT INTO devices (user_id, machine_id, label) VALUES ($1,$2,$3) RETURNING *`,
      [req.user.id, machine_id, label]
    );
    res.json({ device: toDevice(d) });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "That device is already registered." });
    throw e;
  }
});

router.delete("/devices/:id", async (req, res) => {
  await q("DELETE FROM devices WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// --- agreements ------------------------------------------------------------
router.get("/agreements", async (req, res) => {
  const rows = await many("SELECT * FROM agreements WHERE user_id=$1 ORDER BY created_at DESC", [req.user.id]);
  res.json({ agreements: rows.map(toAgreement) });
});

router.post("/agreements/:id/accept", async (req, res) => {
  const a = await one(
    "UPDATE agreements SET status='accepted', accepted_at=now() WHERE id=$1 AND user_id=$2 RETURNING *",
    [req.params.id, req.user.id]
  );
  if (!a) return res.status(404).json({ error: "Agreement not found." });
  res.json({ agreement: toAgreement(a) });
});

export default router;

/**
 * Order + checkout + payment routes live at the /api root (not /api/me) to
 * match the frontend paths. They're exported as three small guarded routers so
 * the index can mount each at its own prefix (/checkout, /orders, /payments)
 * — a router-level guard only ever sees its own paths that way.
 */
export const checkoutRouter = Router();
export const ordersRouter = Router();
export const paymentsRouter = Router();
checkoutRouter.use(requireAuth);
ordersRouter.use(requireAuth);
paymentsRouter.use(requireAuth);

function registerDevice(userId, machineId, label) {
  if (!machineId) return;
  return q(
    `INSERT INTO devices (user_id, machine_id, label) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, machine_id) DO NOTHING`,
    [userId, machineId, label || null]
  );
}

checkoutRouter.post("/", async (req, res) => {
  const { plan_id, machine_id, label, phone, method } = req.body || {};
  const plan = await one("SELECT * FROM plans WHERE id=$1 AND is_active=TRUE", [plan_id]);
  if (!plan) return res.status(404).json({ error: "Plan not found." });
  const service = await one("SELECT * FROM services WHERE id=$1", [plan.service_id]);
  if (!service) return res.status(404).json({ error: "Service not found." });

  const cfg = await paymentCfg();
  const requiresDevice = service.requires_device !== false;
  const machine = machine_id ? String(machine_id).trim().toUpperCase() : null;
  if (requiresDevice && !machine) return res.status(400).json({ error: "A device Machine ID is required." });

  const allowed = { mpesa: cfg.mpesa?.enabled, stripe: cfg.stripe?.enabled && cfg.stripe?.secret_key, bank: cfg.bank?.enabled };
  if (!allowed[method]) return res.status(400).json({ error: "That payment method isn't available." });

  if (machine) await registerDevice(req.user.id, machine, label);

  const reference = "ZT-" + crypto.randomBytes(3).toString("hex").toUpperCase();
  const order = await one(
    `INSERT INTO orders
       (user_id, plan_id, service_name, plan_name, service_key, edition, duration_days, period,
        amount_kes, machine_id, status, method, phone, reference)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,$12,$13) RETURNING *`,
    [req.user.id, plan.id, service.name, plan.name, service.key, plan.edition,
     plan.duration_days, plan.period, plan.price_kes, machine, method, phone || null, reference]
  );

  const out = { order: toOrder(order), method };

  if (method === "bank") {
    out.reference = reference;
    out.bank = {
      bank_name: cfg.bank.bank_name,
      account_name: cfg.bank.account_name,
      account_number: cfg.bank.account_number,
      branch: cfg.bank.branch,
      swift: cfg.bank.swift,
      instructions: cfg.bank.instructions,
    };
    return res.json(out); // licence issued when admin confirms the transfer
  }

  if (method === "stripe") {
    // No live Stripe session in this build; hand back a return URL that lands
    // on checkout with ?stripe_order=ID so the verify step can complete it.
    const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
    out.redirect_url = `${base}/checkout/${plan.id}?stripe_order=${order.id}`;
    return res.json(out);
  }

  // mpesa
  out.simulated = cfg.mpesa.simulated !== false;
  if (!out.simulated) {
    // A real STK push would go here; we record intent and wait for the callback.
    out.simulated = false;
  }
  res.json(out);
});

ordersRouter.get("/:id", async (req, res) => {
  const o = await one("SELECT * FROM orders WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
  if (!o) return res.status(404).json({ error: "Order not found." });
  let license = null, agreement = null;
  if (o.status === "paid") {
    license = await one("SELECT * FROM licenses WHERE order_id=$1", [o.id]);
    if (license) agreement = await one("SELECT * FROM agreements WHERE license_id=$1", [license.id]);
  }
  res.json({ order: toOrder(o, { license, agreement }) });
});

// Demo "simulate successful payment" — issues the licence immediately.
paymentsRouter.post("/simulate/:id", async (req, res) => {
  const o = await one("SELECT * FROM orders WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
  if (!o) return res.status(404).json({ error: "Order not found." });
  if (o.status === "paid") {
    const lic = await one("SELECT * FROM licenses WHERE order_id=$1", [o.id]);
    const ag = lic ? await one("SELECT * FROM agreements WHERE license_id=$1", [lic.id]) : null;
    return res.json({ license: toLicense(lic), agreement: toAgreement(ag) });
  }
  const { license, agreement } = await fulfillOrder(o, req.user, { mpesa_receipt: "SIM" + Date.now() });
  res.json({ license: toLicense(license), agreement: toAgreement(agreement) });
});

// Stripe return — in this build we treat the return as confirmation.
paymentsRouter.post("/stripe/verify", async (req, res) => {
  const o = await one("SELECT * FROM orders WHERE id=$1 AND user_id=$2", [req.body?.order_id, req.user.id]);
  if (!o) return res.status(404).json({ error: "Order not found." });
  if (o.status !== "paid") {
    await fulfillOrder(o, req.user, { method: "stripe", provider_ref: "stripe_sim_" + o.id });
  }
  res.json({ paid: true });
});
