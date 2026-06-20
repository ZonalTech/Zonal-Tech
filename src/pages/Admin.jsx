import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtKES, fmtDate } from "../api";
import CopyButton from "../components/CopyButton.jsx";

function Stat({ n, l }) {
  return <div className="card stat"><div className="n gradient-text">{n}</div><div className="l">{l}</div></div>;
}

export default function Admin() {
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [msg, setMsg] = useState(null);

  const loadStats = () => api("/admin/stats").then(setStats);
  const loadLicenses = () => api("/admin/licenses").then(({ licenses }) => setLicenses(licenses));

  useEffect(() => {
    loadStats();
    api("/admin/customers").then(({ customers }) => setCustomers(customers));
    api("/admin/orders").then(({ orders }) => setOrders(orders));
    loadLicenses();
  }, []);

  async function revoke(id) {
    if (!confirm("Revoke this licence? It will stop validating in the product.")) return;
    await api(`/admin/licenses/${id}/revoke`, { method: "POST" });
    loadLicenses(); loadStats();
  }
  async function renew(id) {
    await api(`/admin/licenses/${id}/renew`, { method: "POST", body: { days: 365 } });
    setMsg("Licence renewed for 365 days."); loadLicenses(); loadStats();
  }

  const TABS = [["overview", "Overview"], ["licenses", "Licences"], ["orders", "Orders"], ["customers", "Customers"], ["issue", "Issue licence"]];

  return (
    <section className="section" style={{ paddingTop: "2.5rem" }}>
      <div className="container">
        <div className="page-head">
          <div>
            <h1>Admin</h1>
            <p style={{ margin: 0 }}>Customers, payments and licence control.</p>
          </div>
          <div className="row wrap">
            {stats && <span className={`badge ${stats.payment_mode === "mpesa" ? "badge-ok" : "badge-warn"}`}>
              Payments: {stats.payment_mode === "mpesa" ? "M-Pesa live" : "simulated"}
            </span>}
            <Link to="/admin/generator" className="btn btn-sm">🔑 License Generator</Link>
          </div>
        </div>

        {msg && <div className="alert alert-ok">{msg}</div>}

        <div className="tabs">
          {TABS.map(([k, l]) => (
            <button key={k} className={tab === k ? "active" : ""} onClick={() => { setTab(k); setMsg(null); }}>{l}</button>
          ))}
        </div>

        {tab === "overview" && stats && (
          <>
            <div className="stat-grid">
              <Stat n={fmtKES(stats.revenue_kes)} l="Revenue (paid)" />
              <Stat n={stats.active_licenses} l="Active licences" />
              <Stat n={stats.customers} l="Customers" />
              <Stat n={stats.paid_orders} l="Paid orders" />
            </div>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Signing public key</h3>
              <p className="hint" style={{ marginTop: 0 }}>Paste into a product's <code>LICENSE_PUBLIC_KEY</code> so it can verify portal-issued licences.</p>
              <div className="row wrap">
                <code className="mono" style={{ wordBreak: "break-all" }}>{stats.public_key}</code>
                <CopyButton text={stats.public_key} />
              </div>
            </div>
            <h3 style={{ marginTop: "2rem" }}>Expiring within 30 days</h3>
            {stats.expiring_soon.length === 0 ? <div className="empty">Nothing expiring soon.</div> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Service</th><th>Customer</th><th>Machine</th><th>Expires</th><th>Days</th></tr></thead>
                  <tbody>{stats.expiring_soon.map((l) => (
                    <tr key={l.id}><td>{l.service}</td><td>{l.customer}</td><td className="mono">{l.machine_id}</td><td>{fmtDate(l.expires)}</td><td>{l.days_left}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === "licenses" && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Service</th><th>Customer</th><th>Machine</th><th>Edition</th><th>Expires</th><th>Status</th><th>Token</th><th></th></tr></thead>
              <tbody>
                {licenses.map((l) => (
                  <tr key={l.id}>
                    <td>{l.id}</td><td>{l.service}</td><td>{l.customer_email}</td>
                    <td className="mono">{l.machine_id}</td>
                    <td style={{ textTransform: "capitalize" }}>{l.edition}</td>
                    <td>{l.expires ? fmtDate(l.expires) : "Never"}</td>
                    <td><span className={`badge ${l.status === "active" ? "badge-ok" : l.status === "expired" ? "badge-warn" : "badge-danger"}`}>{l.status}</span></td>
                    <td><CopyButton text={l.token} className="btn btn-sm" /></td>
                    <td>
                      <div className="row">
                        <button className="btn btn-sm" onClick={() => renew(l.id)}>Renew</button>
                        {l.status !== "revoked" && <button className="btn btn-danger btn-sm" onClick={() => revoke(l.id)}>Revoke</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "orders" && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Customer</th><th>Service</th><th>Plan</th><th>Amount</th><th>Status</th><th>M-Pesa</th><th>Date</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.id}</td><td>{o.customer}</td><td>{o.service}</td><td>{o.plan}</td>
                    <td>{fmtKES(o.amount_kes)}</td>
                    <td><span className={`badge ${o.status === "paid" ? "badge-ok" : o.status === "failed" ? "badge-danger" : "badge-warn"}`}>{o.status}</span></td>
                    <td className="mono">{o.payment?.mpesa_receipt || "—"}</td>
                    <td>{fmtDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "customers" && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Company</th><th>Role</th><th>Licences</th><th>Joined</th></tr></thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td><td>{c.name}</td><td>{c.email}</td><td>{c.company || "—"}</td>
                    <td><span className={`badge ${c.role === "admin" ? "badge-accent" : ""}`}>{c.role}</span></td>
                    <td>{c.license_count}</td><td>{fmtDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "issue" && <IssueLicense onIssued={() => { loadLicenses(); loadStats(); setMsg("Licence issued."); setTab("licenses"); }} />}
      </div>
    </section>
  );
}

function IssueLicense({ onIssued }) {
  const [form, setForm] = useState({ email: "", service_key: "zt-pos", machine_id: "", edition: "standard", duration_days: 365 });
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setError(null);
    try {
      const { license } = await api("/admin/licenses", { method: "POST", body: { ...form, duration_days: Number(form.duration_days) } });
      setResult(license);
      onIssued?.();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="grid-2">
      <form className="card card-pad-lg" onSubmit={submit}>
        <h3 style={{ marginTop: 0 }}>Issue a licence manually</h3>
        <p className="hint" style={{ marginTop: 0 }}>For comps, support replacements or offline sales. The customer must already have an account.</p>
        {error && <div className="alert alert-error">{error}</div>}
        <label className="field"><span>Customer email</span>
          <input type="email" value={form.email} onChange={set("email")} required placeholder="jane@acme.co.ke" /></label>
        <div className="grid-2" style={{ gap: ".75rem" }}>
          <label className="field"><span>Service key</span>
            <input value={form.service_key} onChange={set("service_key")} required /></label>
          <label className="field"><span>Edition</span>
            <input value={form.edition} onChange={set("edition")} /></label>
        </div>
        <label className="field"><span>Machine ID</span>
          <input className="mono" value={form.machine_id} onChange={set("machine_id")} required placeholder="6DD4-DF54-3804-ADC6" /></label>
        <label className="field"><span>Duration (days, 0 = perpetual)</span>
          <input type="number" value={form.duration_days} onChange={set("duration_days")} /></label>
        <button className="btn btn-primary btn-block">Generate & issue</button>
      </form>
      {result && (
        <div className="card card-pad-lg">
          <div className="alert alert-ok">Issued for {result.customer}.</div>
          <pre className="token-box">{result.token}</pre>
          <CopyButton text={result.token} label="Copy licence" className="btn btn-primary btn-sm" />
        </div>
      )}
    </div>
  );
}
