import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtKES } from "../api";
import Icon, { serviceIcon } from "../components/Icon.jsx";

const FEATURES = [
  { ico: "lock", t: "Cryptographic licensing", d: "Every licence is a signed Ed25519 token bound to one machine — impossible to forge or share. Issued the instant payment clears." },
  { ico: "phone", t: "Pay with M-Pesa", d: "Customers buy with an STK push straight to their phone. No cards, no friction — the way Kenya pays." },
  { ico: "zap", t: "Instant activation", d: "Pay, copy the licence into the app, done. No waiting on a human, no emailing keys back and forth." },
  { ico: "monitor", t: "Per-device control", d: "Register each machine, track expiry, renew or revoke from one dashboard — across every service you run." },
  { ico: "repeat", t: "Renewals that stack", d: "Renew early and the new term is added on top of what's left. Customers are never penalised for paying ahead." },
  { ico: "globe", t: "Works offline", d: "Licences verify with no internet. Perfect for tills and field devices on flaky connections." },
];

export default function Home() {
  const [services, setServices] = useState([]);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    api("/services", { auth: false })
      .then(({ services }) => {
        setServices(services);
        setPos(services.find((s) => s.key === "zt-pos") || services[0] || null);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Software & licensing platform</span>
            <h1>Run your business on <span className="gradient-text">software that pays its own way.</span></h1>
            <p className="lead">
              Zonal Tech builds, licenses and hosts business software for African teams —
              from a powerful offline point-of-sale to Zonal Cloud, our self-hosted
              deployment platform. Buy with M-Pesa, get a signed licence in seconds, and
              ship apps with a single push.
            </p>
            <div className="hero-cta">
              <Link to="/register" className="btn btn-primary btn-lg">Create free account</Link>
              <Link to="/services" className="btn btn-lg">Browse services</Link>
            </div>
            <div className="hero-stats">
              <div><div className="n gradient-text">Ed25519</div><div className="l">Signed licences</div></div>
              <div><div className="n gradient-text">M-Pesa</div><div className="l">Instant payments</div></div>
              <div><div className="n gradient-text">Offline</div><div className="l">Always-on verification</div></div>
            </div>
          </div>

          <div className="hero-card">
            <div className="row-head">
              <span className="badge badge-ok">● Licence active</span>
              <div className="dots"><i/><i/><i/></div>
            </div>
            <div className="license-preview">{`-----BEGIN ZT-POS LICENSE-----
eyJ2IjoxLCJtYWNoaW5lX2lkIjoiNkRENC1ERjU0
LTM4MDQtQURDNiIsImFwcCI6Inp0LXBvcyIsImN1
c3RvbWVyIjoiQWNtZSBSZXRhaWwgTHRkIiwiZWRp
dGlvbiI6InBybyIsImlzc3VlZCI6IjIwMjYtMDYt
MjAiLCJleHBpcmVzIjoiMjAyNy0wNi0yMCJ9.Idc
kVuEZUkK80yPr7ecot7Pk0o2KGxGgV-hSIfrJNRy
H_Q2lMlxdCgysXYXiU6A2-GFM9Xy3Rpq5KEDljPp
-----END ZT-POS LICENSE-----`}</div>
            <div className="kv" style={{ marginTop: "1rem" }}>
              <div><span className="k">Customer</span><br/>Zonal Tech Ltd</div>
              <div><span className="k">Edition</span><br/>Pro</div>
              <div><span className="k">Expires</span><br/>20 Jun 2027</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Why Zonal Tech</span>
            <h2>Everything you need to sell and run licensed software.</h2>
            <p>From the first payment to the last renewal, the whole lifecycle is handled — securely, automatically, and built for how the region actually works.</p>
          </div>
          <div className="grid-3">
            {FEATURES.map((f) => (
              <article key={f.t} className="card feature">
                <div className="ico"><Icon name={f.ico} size={22} /></div>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Zonal Cloud highlight ---------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cloud-band">
            <div>
              <span className="eyebrow">Introducing Zonal Cloud</span>
              <h2>Deploy any app on your own server.</h2>
              <p>
                Zonal Cloud is our self-hosted Platform-as-a-Service. Push to deploy static
                sites, Node.js backends, full-stack apps and Node-RED flows — each in its own
                Docker container, with a managed PostgreSQL database, a dedicated URL and
                automatic HTTPS. The same platform runs on a laptop or a VPS.
              </p>
              <ul className="cloud-band-list">
                <li><Icon name="check" size={18} /> Push-to-deploy from GitHub or any Git repo</li>
                <li><Icon name="check" size={18} /> Managed PostgreSQL for full-stack apps</li>
                <li><Icon name="check" size={18} /> A URL and automatic HTTPS for every app</li>
                <li><Icon name="check" size={18} /> Multi-tenant — many teams, one server</li>
              </ul>
              <div className="hero-cta" style={{ marginTop: "1.4rem" }}>
                <Link to="/cloud" className="btn btn-primary">Explore Zonal Cloud</Link>
              </div>
            </div>
            <div className="cloud-band-card">
              <div className="row-head">
                <span className="badge badge-ok">● Deploy succeeded</span>
                <div className="dots"><i/><i/><i/></div>
              </div>
              <div className="license-preview">{`$ git push zonal main
→ Building "storefront" (fullstack)
  ✓ Image built
  ✓ Postgres provisioned
  ✓ Route + HTTPS issued

  Live at https://storefront.zonal.app`}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Services ---------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Our services</span>
            <h2>Products you can license today.</h2>
          </div>
          <div className="grid-3">
            {services.map((s) => {
              const from = s.plans?.length ? Math.min(...s.plans.map((p) => p.price_kes)) : null;
              return (
                <Link to={`/services/${s.key}`} key={s.id} className="card service-card">
                  <div className="ico"><Icon name={serviceIcon(s.key)} size={22} /></div>
                  <h3>{s.name}</h3>
                  <p>{s.tagline}</p>
                  {from != null && <div className="price">{fmtKES(from)} <span>/ from</span></div>}
                </Link>
              );
            })}
            {services.length === 0 && <p className="muted">Loading services…</p>}
          </div>
        </div>
      </section>

      {/* ---------- Pricing ---------- */}
      {pos && (
        <section className="section" id="pricing" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head">
              <span className="eyebrow">Pricing</span>
              <h2>{pos.name} plans</h2>
              <p>{pos.tagline}</p>
            </div>
            <div className="pricing-grid">
              {pos.plans?.map((p, i) => (
                <article key={p.id} className={`card plan ${i === 1 ? "featured" : ""}`}>
                  {i === 1 && <span className="ribbon">Most popular</span>}
                  <h3>{p.name}</h3>
                  <div className="amount">{fmtKES(p.price_kes)}
                    <span> / {p.period === "perpetual" ? "once" : p.period}</span>
                  </div>
                  <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
                  <Link to={`/checkout/${p.id}`} className={`btn ${i === 1 ? "btn-primary" : ""} btn-block`}>
                    Choose {p.edition}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- CTA ---------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cta-band">
            <h2>Ready to get licensed?</h2>
            <p>Create an account, register your device, and pay with M-Pesa. Your signed licence is ready in seconds.</p>
            <Link to="/register" className="btn btn-primary btn-lg">Get started — it's free</Link>
          </div>
        </div>
      </section>
    </>
  );
}
