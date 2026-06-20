import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtKES } from "../api";

export default function Services() {
  const [services, setServices] = useState(null);

  useEffect(() => {
    api("/services", { auth: false }).then(({ services }) => setServices(services)).catch(() => setServices([]));
  }, []);

  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Our services</span>
          <h2>License a Zonal Tech product</h2>
          <p>Pick a service to see its plans and buy a licence with M-Pesa.</p>
        </div>

        {services === null ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : services.length === 0 ? (
          <div className="empty">No services are available yet. Check back soon.</div>
        ) : (
          <div className="grid-3">
            {services.map((s) => {
              const from = s.plans?.length ? Math.min(...s.plans.map((p) => p.price_kes)) : null;
              return (
                <Link to={`/services/${s.key}`} key={s.id} className="card service-card">
                  <div className="ico">{s.icon || "📦"}</div>
                  <h3>{s.name}</h3>
                  <p>{s.tagline}</p>
                  {from != null && <div className="price">{fmtKES(from)} <span>/ from</span></div>}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
