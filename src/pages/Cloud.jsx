import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";

// Zonal Cloud — a self-hosted, multi-tenant Platform-as-a-Service. This page
// markets the full deployment feature set as a Zonal Tech product.
const CAPS = [
  { ico: "code", t: "Push-to-deploy from Git", d: "Connect a GitHub account or point at any Git repo. Every push builds and ships automatically — no manual steps, no downtime." },
  { ico: "server", t: "Static, Node, full-stack & Node-RED", d: "Deploy static frontends, Node.js backends, full-stack apps, and Node-RED flows — all in isolated Docker containers." },
  { ico: "globe", t: "A URL for every app", d: "A built-in reverse proxy gives each deployment its own address, with automatic HTTPS certificates issued and renewed for you." },
  { ico: "cpu", t: "Managed PostgreSQL", d: "Full-stack apps get a managed PostgreSQL database provisioned inside the shared server — connected and ready on first deploy." },
  { ico: "users", t: "Multi-tenant by design", d: "Run many teams and many apps on one server, each cleanly isolated. A dashboard for users, an admin panel for operators." },
  { ico: "server", t: "Runs anywhere", d: "The exact same platform runs on your laptop and on an Ubuntu VPS. Install from the zone operator CLI or from source." },
];

const STEPS = [
  { n: "01", t: "Connect your repo", d: "Link GitHub or paste a Git URL. Pick the app type — static, node, fullstack or nodered." },
  { n: "02", t: "We build it in Docker", d: "Zonal Cloud builds your app in an isolated container and provisions a database if it needs one." },
  { n: "03", t: "Go live with HTTPS", d: "The reverse proxy assigns a URL and issues a certificate. Push again to redeploy — instantly." },
];

export default function Cloud() {
  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Zonal Cloud — Platform as a Service</span>
            <h1>Deploy any app, <span className="gradient-text">on your own server.</span></h1>
            <p className="lead">
              Zonal Cloud is a self-hosted, multi-tenant platform that builds and runs
              static sites, Node.js backends, full-stack apps and Node-RED instances in
              Docker — each with its own URL and automatic HTTPS. Push to deploy, the same
              way on a laptop or a VPS.
            </p>
            <div className="hero-cta">
              <Link to="/register" className="btn btn-primary btn-lg">Get started</Link>
              <a href="#how" className="btn btn-lg">How it works</a>
            </div>
            <div className="hero-stats">
              <div><div className="n gradient-text">Push</div><div className="l">to deploy</div></div>
              <div><div className="n gradient-text">HTTPS</div><div className="l">automatic certs</div></div>
              <div><div className="n gradient-text">Postgres</div><div className="l">managed for you</div></div>
            </div>
          </div>

          <div className="hero-card">
            <div className="row-head">
              <span className="badge badge-ok">● Deploy succeeded</span>
              <div className="dots"><i/><i/><i/></div>
            </div>
            <div className="license-preview">{`$ git push zonal main
→ Building app "storefront" (fullstack)
  ✓ Image built          12.4s
  ✓ Postgres provisioned  1.1s
  ✓ Container started     0.8s
  ✓ Route + HTTPS issued  2.3s

  Live at https://storefront.zonal.app`}</div>
            <div className="kv" style={{ marginTop: "1rem" }}>
              <div><span className="k">App type</span><br/>Full-stack</div>
              <div><span className="k">Database</span><br/>PostgreSQL</div>
              <div><span className="k">Status</span><br/>Running</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Capabilities ---------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">Capabilities</span>
            <h2>Everything you need to ship and run apps.</h2>
            <p>From the first push to the last redeploy, the full lifecycle is handled — build, database, routing and certificates, all on infrastructure you control.</p>
          </div>
          <div className="grid-3">
            {CAPS.map((f) => (
              <article key={f.t} className="card feature">
                <div className="ico"><Icon name={f.ico} size={22} /></div>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="section" id="how" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">How it works</span>
            <h2>Three steps from repo to running app.</h2>
          </div>
          <div className="grid-3">
            {STEPS.map((s) => (
              <article key={s.n} className="card feature">
                <div className="step-n">{s.n}</div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cta-band">
            <h2>Ready to deploy on Zonal Cloud?</h2>
            <p>Create an account, connect a repository, and push. Your app is live with HTTPS in seconds.</p>
            <Link to="/register" className="btn btn-primary btn-lg">Get started — it's free</Link>
          </div>
        </div>
      </section>
    </>
  );
}
