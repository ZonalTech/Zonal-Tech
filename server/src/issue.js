/**
 * Issuing a licence + its SLA agreement. Shared by the customer checkout flow,
 * the demo "simulate payment" path, admin order-confirm, and admin manual issue.
 */
import { one, q, slaTerms } from "./db.js";
import { buildLicense } from "./license.js";

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}
const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Issue a signed licence for a user and create its agreement.
 *
 * @returns {{ license: object, agreement: object }} raw DB rows
 */
export async function issueLicense({
  user,
  serviceKey,
  serviceName,
  edition,
  uid,               // account/user identifier the licence binds to
  machineId,         // legacy alias for uid (kept for older callers)
  durationDays,      // 0 / null => perpetual
  requiresDevice = true,
  orderId = null,
}) {
  const issued = todayISO();
  const expires = durationDays && Number(durationDays) > 0 ? addDaysISO(durationDays) : null;
  const customer = user.company || user.name;

  // POS services now activate against the account UID rather than a device
  // Machine ID. Fall back to a stable per-account UID when none is supplied.
  const activationUid = uid || machineId || `UID-${user.id}`;

  const { token } = buildLicense(
    {
      app: serviceKey,
      customer,
      uid: activationUid,
      edition,
      issued,
      expires: expires || "",
    },
    `${serviceKey.toUpperCase()} LICENSE`
  );

  // NOTE: the `machine_id` DB columns are retained to avoid a destructive
  // migration on live data; they now hold the activation UID.
  const license = await one(
    `INSERT INTO licenses
       (user_id, order_id, service_key, service_name, customer, edition, machine_id,
        token, issued, expires, requires_device)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [user.id, orderId, serviceKey, serviceName, customer, edition,
     activationUid, token, issued, expires, requiresDevice]
  );

  const agreement = await one(
    `INSERT INTO agreements
       (user_id, license_id, order_id, service_name, machine_id, terms, status)
     VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING *`,
    [user.id, license.id, orderId, serviceName, activationUid,
     JSON.stringify(slaTerms(edition))]
  );

  return { license, agreement };
}

/** Mark an order paid and issue its licence + agreement (idempotent-ish). */
export async function fulfillOrder(order, user, paymentPatch = {}) {
  // Already fulfilled?
  const existing = await one("SELECT * FROM licenses WHERE order_id=$1", [order.id]);
  if (existing) {
    const ag = await one("SELECT * FROM agreements WHERE license_id=$1", [existing.id]);
    await q("UPDATE orders SET status='paid' WHERE id=$1", [order.id]);
    return { license: existing, agreement: ag };
  }

  const service = await one("SELECT requires_device FROM services WHERE key=$1", [order.service_key]);
  const { license, agreement } = await issueLicense({
    user,
    serviceKey: order.service_key,
    serviceName: order.service_name,
    edition: order.edition,
    machineId: order.machine_id,
    durationDays: order.duration_days,
    requiresDevice: service ? service.requires_device : true,
    orderId: order.id,
  });

  const sets = ["status='paid'"];
  const vals = [];
  let i = 1;
  for (const [k, v] of Object.entries(paymentPatch)) {
    sets.push(`${k}=$${i}`);
    vals.push(v);
    i++;
  }
  vals.push(order.id);
  await q(`UPDATE orders SET ${sets.join(", ")} WHERE id=$${i}`, vals);

  return { license, agreement };
}
