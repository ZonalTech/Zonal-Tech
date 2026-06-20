import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, fmtKES } from "../api";

export default function ServiceDetail() {
  const { key } = useParams();
  const [service, setService] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/services/${key}`, { auth: false })
      .then(({ service }) => setService(service))
      .catch((e) => setError(e.message));
  }, [key]);

  if (error) return <div className="container section"><div className="empty">{error}</div></div>;
  if (!service) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <section className="section">
      <div className="container">
        <Link to="/services" className="muted" style={{ fontSize: ".9rem" }}>← All services</Link>
        <div className="row wrap" style={{ alignItems: "flex-start", gap: "1.2rem", margin: "1rem 0 2.5rem" }}>
          <div className="ico" style={{ width: 64, height: 64, fontSize: "2rem" }}>{service.icon || "📦"}</div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 style={{ fontSize: "2.2rem", marginBottom: ".4rem" }}>{service.name}</h1>
            <p style={{ fontSize: "1.1rem", maxWidth: "44rem" }}>{service.description || service.tagline}</p>
            {service.download_url && (
              <a href={service.download_url} target="_blank" rel="noreferrer" className="btn btn-sm">
                ⬇ Download installer
              </a>
            )}
          </div>
        </div>

        <h2 style={{ marginBottom: "1.4rem" }}>Choose a plan</h2>
        <div className="pricing-grid">
          {service.plans?.map((p, i) => (
            <article key={p.id} className={`card plan ${i === 1 ? "featured" : ""}`}>
              {i === 1 && <span className="ribbon">Most popular</span>}
              <h3>{p.name}</h3>
              <div className="amount">{fmtKES(p.price_kes)}
                <span> / {p.period === "perpetual" ? "once" : p.period}</span>
              </div>
              <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
              <Link to={`/checkout/${p.id}`} className={`btn ${i === 1 ? "btn-primary" : ""} btn-block`}>
                Buy {p.edition}
              </Link>
            </article>
          ))}
          {(!service.plans || service.plans.length === 0) && (
            <div className="empty">No plans are configured for this service yet.</div>
          )}
        </div>
      </div>
    </section>
  );
}
