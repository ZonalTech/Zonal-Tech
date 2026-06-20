import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtKES } from "../api";
import { useDialog } from "../components/Dialog.jsx";
import Icon, { serviceIcon } from "../components/Icon.jsx";

export default function AdminServices() {
  const { confirm } = useDialog();
  const [services, setServices] = useState(null);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const [activeId, setActiveId] = useState(null);
  const tabsRef = useRef(null);
  const scrollTabs = (dir) => tabsRef.current?.scrollBy({ left: dir * 260, behavior: "smooth" });
  const load = () => api("/admin/services").then(({ services }) => {
    setServices(services);
    setActiveId((id) => (id != null && services.some((s) => s.id === id)) ? id : services[0]?.id ?? null);
  });
  useEffect(() => { load(); }, []);

  function flash(setter, t) { setter(t); setTimeout(() => setter(null), 3000); }
  const editPlan = (si, pi, field, val) => {
    const copy = structuredClone(services);
    copy[si].plans[pi][field] = val;
    if (field === "period" && val === "perpetual") copy[si].plans[pi].duration_days = 0;
    setServices(copy);
  };
  const editService = (si, field, val) => {
    const copy = structuredClone(services);
    copy[si][field] = val;
    setServices(copy);
  };

  async function savePlan(p) {
    setErr(null);
    try {
      await api(`/admin/plans/${p.id}`, { method: "PUT", body: {
        name: p.name, edition: p.edition, price_kes: Number(p.price_kes) || 0,
        period: p.period, duration_days: Number(p.duration_days) || 0,
        features: Array.isArray(p.features) ? p.features.join("\n") : p.features,
        is_active: p.is_active,
      }});
      flash(setMsg, `Saved “${p.name}”.`);
    } catch (e) { flash(setErr, e.message); }
  }
  async function saveService(s) {
    setErr(null);
    try {
      await api(`/admin/services/${s.id}`, { method: "PUT", body: {
        download_url: s.download_url, tagline: s.tagline, is_active: s.is_active,
        status: s.status, status_message: s.status_message,
      }});
      flash(setMsg, `Saved ${s.name}.`);
    } catch (e) { flash(setErr, e.message); }
  }
  async function addPlan(s) {
    await api(`/admin/services/${s.id}/plans`, { method: "POST", body: {
      name: "New plan", edition: "standard", price_kes: 0, period: "year",
      duration_days: 365, sort_order: (s.plans.length + 1),
    }});
    load();
  }
  async function deletePlan(p) {
    if (!(await confirm({ title: "Delete plan", danger: true, confirmText: "Delete",
      message: `Delete the “${p.name}” plan? Existing licences are unaffected.` }))) return;
    await api(`/admin/plans/${p.id}`, { method: "DELETE" });
    load();
  }

  if (!services) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <section className="section" style={{ paddingTop: "2.5rem" }}>
      <div className="container">
        <div className="page-head">
          <div>
            <h1>Services &amp; Pricing</h1>
            <p style={{ margin: 0 }}>Edit prices, subscription durations, plans and installer links.</p>
          </div>
          <Link to="/admin" className="btn btn-ghost btn-sm">← Back to admin</Link>
        </div>
        {msg && <div className="alert alert-ok">{msg}</div>}
        {err && <div className="alert alert-error">{err}</div>}

        <div className="tabs-nav">
          <button type="button" className="tab-arrow" onClick={() => scrollTabs(-1)} aria-label="Previous services">‹</button>
          <div className="tabs tabs-scroll" ref={tabsRef}>
            {services.map((s) => (
              <button key={s.id} className={activeId === s.id ? "active" : ""} onClick={() => setActiveId(s.id)}>
                <Icon name={serviceIcon(s.key)} /> {s.name}
              </button>
            ))}
          </div>
          <button type="button" className="tab-arrow" onClick={() => scrollTabs(1)} aria-label="Next services">›</button>
        </div>

        {(() => {
          const si = services.findIndex((x) => x.id === activeId);
          const s = services[si];
          if (!s) return <div className="empty">No services yet.</div>;
          return (
            <div key={s.id} className="card card-pad-lg">
              <div className="row between wrap" style={{ marginBottom: ".6rem" }}>
                <h3 style={{ margin: 0 }}><Icon name={serviceIcon(s.key)} size={20} /> {s.name} <small className="muted">· {s.key}</small></h3>
                {!s.is_active && <span className="badge badge-warn">inactive</span>}
              </div>

              <div className="grid-2" style={{ gap: ".9rem" }}>
                <label className="field"><span>Service status (shown on the public status page)</span>
                  <select value={s.status || "operational"} onChange={(e) => editService(si, "status", e.target.value)}>
                    <option value="operational">Operational</option>
                    <option value="degraded">Degraded</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="outage">Outage</option>
                  </select>
                </label>
                <label className="field"><span>Status message (optional)</span>
                  <div className="row">
                    <input value={s.status_message || ""} onChange={(e) => editService(si, "status_message", e.target.value)} placeholder="e.g. Investigating slow logins" />
                    <button className="btn btn-sm" onClick={() => saveService(s)}>Save</button>
                  </div>
                </label>
              </div>

              <label className="field"><span>Installer / download URL (the POS setup file customers download)</span>
                <div className="row">
                  <input className="mono" value={s.download_url || ""} onChange={(e) => editService(si, "download_url", e.target.value)}
                    placeholder="https://…/ZTPOS-Setup.exe" />
                  <button className="btn btn-sm" onClick={() => saveService(s)}>Save</button>
                </div>
              </label>

              <div className="table-wrap" style={{ marginTop: "1rem" }}>
                <table>
                  <thead><tr><th>Plan</th><th>Edition</th><th>Price (KES)</th><th>Period</th><th>Duration (days)</th><th>Active</th><th></th></tr></thead>
                  <tbody>
                    {s.plans.map((p, pi) => (
                      <tr key={p.id}>
                        <td><input value={p.name} onChange={(e) => editPlan(si, pi, "name", e.target.value)} style={{ minWidth: 140 }} /></td>
                        <td><input value={p.edition} onChange={(e) => editPlan(si, pi, "edition", e.target.value)} style={{ width: 110 }} /></td>
                        <td><input type="number" min="0" value={p.price_kes} onChange={(e) => editPlan(si, pi, "price_kes", e.target.value)} style={{ width: 100 }} /></td>
                        <td>
                          <select value={p.period} onChange={(e) => editPlan(si, pi, "period", e.target.value)} style={{ width: 110 }}>
                            <option value="year">year</option><option value="month">month</option><option value="perpetual">perpetual</option>
                          </select>
                        </td>
                        <td><input type="number" min="0" value={p.duration_days} disabled={p.period === "perpetual"}
                          onChange={(e) => editPlan(si, pi, "duration_days", e.target.value)} style={{ width: 90 }} /></td>
                        <td><input type="checkbox" checked={!!p.is_active} onChange={(e) => editPlan(si, pi, "is_active", e.target.checked)} style={{ width: "auto", accentColor: "var(--accent)" }} /></td>
                        <td>
                          <div className="row" style={{ gap: ".4rem" }}>
                            <button className="btn btn-sm" onClick={() => savePlan(p)}>Save</button>
                            <button className="btn btn-danger btn-sm" onClick={() => deletePlan(p)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row" style={{ marginTop: ".8rem" }}>
                <button className="btn btn-sm" onClick={() => addPlan(s)}>+ Add plan</button>
                <span className="muted" style={{ fontSize: ".85rem" }}>
                  From {s.plans.length ? fmtKES(Math.min(...s.plans.map((p) => Number(p.price_kes) || 0))) : "—"} ·
                  Edit features per plan from the API (kept simple here).
                </span>
              </div>
            </div>
          );
        })()}
      </div>
    </section>
  );
}
