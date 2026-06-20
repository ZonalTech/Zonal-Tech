import { useEffect, useState } from "react";
import { api } from "../api";
import Icon, { serviceIcon } from "../components/Icon.jsx";

const META = {
  operational: { label: "Operational", cls: "badge-ok", dot: "#34d399" },
  degraded: { label: "Degraded", cls: "badge-warn", dot: "#fbbf24" },
  maintenance: { label: "Maintenance", cls: "badge-accent", dot: "#22d3ee" },
  outage: { label: "Outage", cls: "badge-danger", dot: "#fb7185" },
};

const OVERALL = {
  operational: "All systems operational",
  degraded: "Some systems degraded",
  outage: "Service outage in progress",
};

export default function Status() {
  const [data, setData] = useState(null);

  const load = () => api("/status", { auth: false }).then(setData).catch(() => setData({ overall: "operational", services: [] }));
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);   // refresh every 30s
    return () => clearInterval(t);
  }, []);

  if (!data) return <div className="loading-page"><div className="spinner" /></div>;
  const o = META[data.overall] || META.operational;

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: "50rem" }}>
        <div className="section-head">
          <span className="eyebrow">System status</span>
          <h2>Service status</h2>
          <p>Live status of Zonal Tech services. This page refreshes automatically.</p>
        </div>

        <div className="card card-pad-lg" style={{ borderColor: o.dot, marginBottom: "1.5rem" }}>
          <div className="row" style={{ gap: ".7rem" }}>
            <span className="status-dot" style={{ background: o.dot }} />
            <h3 style={{ margin: 0 }}>{OVERALL[data.overall] || OVERALL.operational}</h3>
          </div>
        </div>

        <div className="stack">
          {data.services.map((s) => {
            const m = META[s.status] || META.operational;
            return (
              <div key={s.key} className="card row between wrap" style={{ gap: "1rem" }}>
                <div className="row" style={{ gap: ".7rem" }}>
                  <Icon name={serviceIcon(s.key)} size={22} />
                  <div>
                    <strong>{s.name}</strong>
                    {s.status_message && <div className="hint" style={{ margin: 0 }}>{s.status_message}</div>}
                  </div>
                </div>
                <span className={`badge ${m.cls}`}><span className="status-dot" style={{ background: m.dot }} /> {m.label}</span>
              </div>
            );
          })}
          {data.services.length === 0 && <div className="empty">No services to report.</div>}
        </div>

        <p className="hint" style={{ marginTop: "1.5rem", textAlign: "center" }}>
          Seeing a problem not shown here? <a href="/contact" style={{ color: "var(--accent)" }}>Let us know</a>.
        </p>
      </div>
    </section>
  );
}
