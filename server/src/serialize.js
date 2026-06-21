/**
 * Row → API-object serializers. These define the exact shapes the React
 * frontend reads, so keep them in sync with the components.
 */

const isoDate = (d) => {
  if (!d) return null;
  // DATE columns come back as JS Date at local midnight; emit YYYY-MM-DD.
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
};
const isoTs = (d) => (d ? new Date(d).toISOString() : null);

export function licenseStatus(lic) {
  if (lic.revoked) return "revoked";
  if (lic.expires && new Date(isoDate(lic.expires)) < new Date(new Date().toISOString().slice(0, 10)))
    return "expired";
  return "active";
}

function daysLeft(lic) {
  if (!lic.expires) return null;
  const ms = new Date(isoDate(lic.expires)).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

export function toLicense(lic) {
  if (!lic) return null;
  return {
    id: lic.id,
    token: lic.token,
    customer: lic.customer,
    service_key: lic.service_key,
    service: lic.service_name,
    edition: lic.edition,
    issued: isoDate(lic.issued),
    expires: isoDate(lic.expires),
    machine_id: lic.machine_id,
    status: licenseStatus(lic),
    days_left: daysLeft(lic),
    requires_device: lic.requires_device !== false,
  };
}

export function toAgreement(a) {
  if (!a) return null;
  return {
    id: a.id,
    status: a.status,
    accepted_at: isoTs(a.accepted_at),
    service: a.service_name,
    machine_id: a.machine_id,
    terms: a.terms || {},
  };
}

export function toOrder(o, { license = null, agreement = null } = {}) {
  if (!o) return null;
  return {
    id: o.id,
    service: o.service_name,
    plan: o.plan_name,
    amount_kes: Number(o.amount_kes),
    status: o.status,
    created_at: isoTs(o.created_at),
    license: license ? toLicense(license) : null,
    agreement: agreement ? toAgreement(agreement) : null,
  };
}

/** Order with the customer name + payment block, for admin tables. */
export function toAdminOrder(o) {
  return {
    id: o.id,
    customer: o.customer_name,
    service: o.service_name,
    plan: o.plan_name,
    amount_kes: Number(o.amount_kes),
    status: o.status,
    payment: {
      method: o.method || null,
      mpesa_receipt: o.mpesa_receipt || null,
      provider_ref: o.provider_ref || null,
    },
    created_at: isoTs(o.created_at),
  };
}

export function toDevice(d) {
  return { id: d.id, machine_id: d.machine_id, label: d.label || null, created_at: isoTs(d.created_at) };
}

export function toPlan(p) {
  return {
    id: p.id,
    name: p.name,
    edition: p.edition,
    price_kes: Number(p.price_kes),
    period: p.period,
    duration_days: p.duration_days,
    features: Array.isArray(p.features) ? p.features : [],
    is_active: p.is_active,
  };
}

/** Public service shape (only active plans, for the storefront). */
export function toService(s, plans, { activeOnly = true } = {}) {
  return {
    id: s.id,
    key: s.key,
    name: s.name,
    tagline: s.tagline,
    description: s.description,
    requires_device: s.requires_device,
    plans: plans.filter((p) => (activeOnly ? p.is_active : true)).map(toPlan),
  };
}

/** Admin service shape (status fields + all plans). */
export function toAdminService(s, plans) {
  return {
    id: s.id,
    key: s.key,
    name: s.name,
    tagline: s.tagline,
    description: s.description,
    requires_device: s.requires_device,
    download_url: s.download_url || null,
    status: s.status,
    status_message: s.status_message || null,
    is_active: s.is_active,
    plans: plans.map(toPlan),
  };
}
