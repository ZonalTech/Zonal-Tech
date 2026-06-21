/**
 * Public (unauthenticated) endpoints: storefront, status page, contact form,
 * support assistant, and the enabled payment methods.
 */
import { Router } from "express";
import { one, many, q, getSetting, DEFAULT_PAYMENT_SETTINGS } from "../db.js";
import { toService } from "../serialize.js";
import { chat, aiSettings } from "../assistant.js";

const router = Router();

async function loadServices({ activeOnly = true } = {}) {
  const services = await many(
    `SELECT * FROM services ${activeOnly ? "WHERE is_active = TRUE" : ""} ORDER BY sort_order, id`
  );
  const plans = await many("SELECT * FROM plans ORDER BY sort_order, id");
  return services.map((s) =>
    toService(s, plans.filter((p) => p.service_id === s.id), { activeOnly })
  );
}

router.get("/services", async (_req, res) => {
  res.json({ services: await loadServices() });
});

router.get("/services/:key", async (req, res) => {
  const s = await one("SELECT * FROM services WHERE key=$1 AND is_active=TRUE", [req.params.key]);
  if (!s) return res.status(404).json({ error: "Service not found." });
  const plans = await many("SELECT * FROM plans WHERE service_id=$1 ORDER BY sort_order, id", [s.id]);
  res.json({ service: toService(s, plans) });
});

router.get("/status", async (_req, res) => {
  const services = await many(
    "SELECT key, name, status, status_message FROM services WHERE is_active=TRUE ORDER BY sort_order, id"
  );
  const rank = { operational: 0, maintenance: 1, degraded: 2, outage: 3 };
  let worst = "operational";
  for (const s of services) if ((rank[s.status] ?? 0) > (rank[worst] ?? 0)) worst = s.status;
  const overall = worst === "operational" ? "operational" : worst === "outage" ? "outage" : "degraded";
  res.json({
    overall,
    services: services.map((s) => ({
      key: s.key,
      name: s.name,
      status: s.status,
      status_message: s.status_message || undefined,
    })),
  });
});

router.post("/contact", async (req, res) => {
  const { name, email, category, subject, message } = req.body || {};
  if (!name || !email || !message)
    return res.status(400).json({ error: "Name, email and message are required." });
  await q(
    `INSERT INTO messages (name, email, category, subject, message)
     VALUES ($1,$2,$3,$4,$5)`,
    [String(name).trim(), String(email).trim(), category || "general", subject || null, String(message).trim()]
  );
  res.json({ ok: true, message: "Thanks — we'll get back to you shortly." });
});

router.post("/assistant", async (req, res) => {
  const { message, history } = req.body || {};
  if (!message || !String(message).trim()) return res.status(400).json({ error: "Message is required." });
  const cfg = await aiSettings();
  const result = await chat(cfg, String(message), Array.isArray(history) ? history : []);
  res.json({ reply: result.reply });
});

router.get("/payment-methods", async (_req, res) => {
  const cfg = { ...DEFAULT_PAYMENT_SETTINGS, ...(await getSetting("payments", {})) };
  const methods = [];
  if (cfg.mpesa?.enabled)
    methods.push({ id: "mpesa", label: "M-Pesa", simulated: cfg.mpesa.simulated !== false });
  if (cfg.stripe?.enabled && cfg.stripe?.secret_key) methods.push({ id: "stripe", label: "Card" });
  if (cfg.bank?.enabled) methods.push({ id: "bank", label: "Bank transfer" });
  res.json({ methods });
});

export { loadServices };
export default router;
