import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtKES, fmtDate } from "../api";
import CopyButton from "../components/CopyButton.jsx";
import { useDialog } from "../components/Dialog.jsx";
import Icon from "../components/Icon.jsx";

function Stat({ n, l }) {
  return <div className="card stat"><div className="n gradient-text">{n}</div><div className="l">{l}</div></div>;
}

export default function Admin() {
  const { confirm } = useDialog();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [messages, setMessages] = useState([]);
  const [msg, setMsg] = useState(null);

  const loadStats = () => api("/admin/stats").then(setStats);
  const loadLicenses = () => api("/admin/licenses").then(({ licenses }) => setLicenses(licenses));
  const loadMessages = () => api("/admin/messages").then(({ messages }) => setMessages(messages));
  const loadOrders = () => api("/admin/orders").then(({ orders }) => setOrders(orders));

  useEffect(() => {
    loadStats();
    api("/admin/customers").then(({ customers }) => setCustomers(customers));
    loadOrders();
    loadLicenses();
    loadMessages();
  }, []);

  async function confirmOrder(id) {
    const ok = await confirm({ title: "Confirm payment", confirmText: "Confirm & issue",
      message: "Mark this order as paid and issue the licence? Do this only after funds have arrived." });
    if (!ok) return;
    await api(`/admin/orders/${id}/confirm`, { method: "POST" });
    loadOrders(); loadLicenses(); loadStats();
  }

  async function markHandled(id) {
    await api(`/admin/messages/${id}/handled`, { method: "POST" });
    loadMessages(); loadStats();
  }

  async function revoke(id) {
    const ok = await confirm({ title: "Revoke licence", danger: true, confirmText: "Revoke",
      message: "Revoke this licence? It will stop validating in the product." });
    if (!ok) return;
    await api(`/admin/licenses/${id}/revoke`, { method: "POST" });
    loadLicenses(); loadStats();
  }
  async function renew(id) {
    await api(`/admin/licenses/${id}/renew`, { method: "POST", body: { days: 365 } });
    setMsg("Licence renewed for 365 days."); loadLicenses(); loadStats();
  }

  const newMsgs = messages.filter((m) => m.status === "new").length;
  const pendingCount = stats?.pending_orders || 0;
  const TABS = [["overview", "Overview"], ["licenses", "Licences"],
    ["orders", `Orders${pendingCount ? ` (${pendingCount})` : ""}`],
    ["customers", "Customers"], ["messages", `Messages${newMsgs ? ` (${newMsgs})` : ""}`], ["issue", "Issue licence"]];

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
            <Link to="/admin/users" className="btn btn-sm"><Icon name="users" /> Users</Link>
            <Link to="/admin/services" className="btn btn-sm"><Icon name="tag" /> Services & Pricing</Link>
            <Link to="/admin/payments" className="btn btn-sm"><Icon name="card" /> Payments</Link>
            <Link to="/admin/settings" className="btn btn-sm"><Icon name="cpu" /> AI Settings</Link>
            <Link to="/admin/generator" className="btn btn-sm"><Icon name="key" /> License Generator</Link>
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

            {stats.pending_orders_list?.length > 0 && (
              <div className="card" style={{ borderColor: "rgba(251,191,36,.4)", marginBottom: "2rem" }}>
                <h3 style={{ marginTop: 0 }}><Icon name="bell" size={20} /> Orders awaiting confirmation ({stats.pending_orders})</h3>
                <p className="hint" style={{ marginTop: 0 }}>Confirm an order once the customer's payment has arrived — this issues their licence.</p>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>#</th><th>Customer</th><th>Service</th><th>Plan</th><th>Amount</th><th>Method</th><th>Placed</th><th></th></tr></thead>
                    <tbody>
                      {stats.pending_orders_list.map((o) => (
                        <tr key={o.id}>
                          <td>{o.id}</td><td>{o.customer}</td><td>{o.service}</td><td>{o.plan}</td>
                          <td>{fmtKES(o.amount_kes)}</td><td>{o.payment?.method || "—"}</td>
                          <td>{fmtDate(o.created_at)}</td>
                          <td><button className="btn btn-primary btn-sm" onClick={() => confirmOrder(o.id)}>Confirm payment</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
              <thead><tr><th>#</th><th>Customer</th><th>Service</th><th>Plan</th><th>Amount</th><th>Method</th><th>Status</th><th>Ref</th><th>Date</th><th></th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.id}</td><td>{o.customer}</td><td>{o.service}</td><td>{o.plan}</td>
                    <td>{fmtKES(o.amount_kes)}</td>
                    <td>{o.payment?.method || "—"}</td>
                    <td><span className={`badge ${o.status === "paid" ? "badge-ok" : o.status === "failed" ? "badge-danger" : "badge-warn"}`}>{o.status}</span></td>
                    <td className="mono" style={{ fontSize: ".8rem" }}>{o.payment?.mpesa_receipt || o.payment?.provider_ref || "—"}</td>
                    <td>{fmtDate(o.created_at)}</td>
                    <td>{o.status === "pending" && <button className="btn btn-sm" onClick={() => confirmOrder(o.id)}>Confirm</button>}</td>
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

        {tab === "messages" && (
          messages.length === 0 ? <div className="empty">No messages yet.</div> : (
            <div className="stack">
              {messages.map((m) => (
                <div key={m.id} className="card">
                  <div className="row between wrap">
                    <div>
                      <strong>{m.name}</strong> · <a href={`mailto:${m.email}`} style={{ color: "var(--accent)" }}>{m.email}</a>
                      <span className="badge" style={{ marginLeft: ".5rem" }}>{m.category}</span>
                      {m.status === "new" && <span className="badge badge-warn" style={{ marginLeft: ".4rem" }}>new</span>}
                    </div>
                    <small>{fmtDate(m.created_at)}</small>
                  </div>
                  {m.subject && <div style={{ marginTop: ".5rem", fontWeight: 600 }}>{m.subject}</div>}
                  <p style={{ margin: ".4rem 0 .8rem" }}>{m.message}</p>
                  {m.status === "new" && <button className="btn btn-sm" onClick={() => markHandled(m.id)}>Mark handled</button>}
                </div>
              ))}
            </div>
          )
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
          <input type="email" value={form.email} onChange={set("email")} required placeholder="customer@zonaltech.co.ke" /></label>
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
