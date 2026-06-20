import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtKES, fmtDate } from "../api";
import { useAuth } from "../auth.jsx";
import CopyButton from "../components/CopyButton.jsx";
import SLA from "../components/SLA.jsx";
import Icon from "../components/Icon.jsx";

const STATUS_BADGE = { active: "badge-ok", expired: "badge-warn", revoked: "badge-danger" };

function LicenseCard({ lic }) {
  const [open, setOpen] = useState(false);
  function download() {
    const safe = (lic.customer || "license").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const blob = new Blob([lic.token + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${safe}-${lic.service_key}.lic`; a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="card license-card">
      <div className="lc-head">
        <div>
          <h3 style={{ margin: 0 }}>{lic.service} <small style={{ textTransform: "capitalize" }}>· {lic.edition}</small></h3>
          <div className="mono" style={{ color: "var(--muted)", fontSize: ".85rem" }}>{lic.machine_id}</div>
        </div>
        <span className={`badge ${STATUS_BADGE[lic.status] || ""}`}>{lic.status}</span>
      </div>
      <div className="kv">
        <div><span className="k">Issued</span><br />{fmtDate(lic.issued)}</div>
        <div><span className="k">Expires</span><br />{lic.expires ? fmtDate(lic.expires) : "Never"}</div>
        {lic.days_left != null && <div><span className="k">Days left</span><br />{lic.days_left}</div>}
      </div>
      {open && <pre className="token-box">{lic.token}</pre>}
      <div className="row wrap">
        <button className="btn btn-sm" onClick={() => setOpen((o) => !o)}>{open ? "Hide token" : "Show token"}</button>
        <CopyButton text={lic.token} label="Copy" className="btn btn-sm" />
        <button className="btn btn-sm" onClick={download}><Icon name="download" /> .lic</button>
        {lic.requires_device && (
          <a className="btn btn-primary btn-sm" href={`/api/download/${lic.service_key}`}><Icon name="download" /> Download installer</a>
        )}
        <Link to={`/services/${lic.service_key}`} className="btn btn-ghost btn-sm">Renew / buy again</Link>
      </div>
    </div>
  );
}

function Devices() {
  const [devices, setDevices] = useState([]);
  const [machine, setMachine] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState(null);

  const load = () => api("/me/devices").then(({ devices }) => setDevices(devices));
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault(); setError(null);
    try {
      await api("/me/devices", { method: "POST", body: { machine_id: machine, label } });
      setMachine(""); setLabel(""); load();
    } catch (err) { setError(err.message); }
  }
  async function remove(id) {
    await api(`/me/devices/${id}`, { method: "DELETE" }); load();
  }

  return (
    <div className="grid-2">
      <div className="stack">
        {devices.length === 0 && <div className="empty">No devices registered yet.</div>}
        {devices.map((d) => (
          <div key={d.id} className="card row between">
            <div>
              <div className="mono">{d.machine_id}</div>
              <small>{d.label || "—"} · added {fmtDate(d.created_at)}</small>
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => remove(d.id)}>Remove</button>
          </div>
        ))}
      </div>
      <form className="card" onSubmit={add}>
        <h3 style={{ marginTop: 0 }}>Register a device</h3>
        {error && <div className="alert alert-error">{error}</div>}
        <label className="field"><span>Machine ID</span>
          <input className="mono" value={machine} onChange={(e) => setMachine(e.target.value)} placeholder="6DD4-DF54-3804-ADC6" required />
        </label>
        <label className="field"><span>Label (optional)</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Front till" />
        </label>
        <button className="btn btn-primary btn-block">Add device</button>
      </form>
    </div>
  );
}

function Agreements() {
  const [agreements, setAgreements] = useState(null);
  useEffect(() => {
    api("/me/agreements").then(({ agreements }) => setAgreements(agreements)).catch(() => setAgreements([]));
  }, []);
  function onAccepted(updated) {
    setAgreements((list) => list.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
  }
  if (agreements === null) return <div className="loading-page"><div className="spinner" /></div>;
  if (agreements.length === 0) return <div className="empty">No agreements yet. They're created with each licence you buy.</div>;
  return (
    <div className="stack">
      {agreements.map((a) => (
        <div key={a.id} className="card">
          <div className="muted" style={{ fontSize: ".85rem", marginBottom: ".4rem" }}>
            {a.service} · <span className="mono">{a.machine_id}</span>
          </div>
          <SLA agreement={a} onAccepted={onAccepted} />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("licenses");
  const [licenses, setLicenses] = useState(null);
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    api("/me/licenses").then(({ licenses }) => setLicenses(licenses)).catch(() => setLicenses([]));
    api("/me/orders").then(({ orders }) => setOrders(orders)).catch(() => setOrders([]));
  }, []);

  return (
    <section className="section" style={{ paddingTop: "2.5rem" }}>
      <div className="container">
        <div className="page-head">
          <div>
            <h1>Hi, {user.name.split(" ")[0]}</h1>
            <p style={{ margin: 0 }}>Manage your licences, devices and purchases.</p>
          </div>
          <Link to="/services" className="btn btn-primary">+ Buy a licence</Link>
        </div>

        <div className="tabs">
          <button className={tab === "licenses" ? "active" : ""} onClick={() => setTab("licenses")}>Licences</button>
          <button className={tab === "devices" ? "active" : ""} onClick={() => setTab("devices")}>Devices</button>
          <button className={tab === "agreements" ? "active" : ""} onClick={() => setTab("agreements")}>Agreements</button>
          <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>Orders</button>
        </div>

        {tab === "licenses" && (
          licenses === null ? <div className="loading-page"><div className="spinner" /></div>
            : licenses.length === 0 ? (
              <div className="empty">
                No licences yet. <Link to="/services" style={{ color: "var(--accent)" }}>Browse services</Link> to buy your first one.
              </div>
            ) : <div className="grid-2">{licenses.map((l) => <LicenseCard key={l.id} lic={l} />)}</div>
        )}

        {tab === "devices" && <Devices />}

        {tab === "agreements" && <Agreements />}

        {tab === "orders" && (
          orders === null ? <div className="loading-page"><div className="spinner" /></div>
            : orders.length === 0 ? <div className="empty">No orders yet.</div> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>#</th><th>Service</th><th>Plan</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>{o.id}</td>
                        <td>{o.service}</td>
                        <td>{o.plan}</td>
                        <td>{fmtKES(o.amount_kes)}</td>
                        <td><span className={`badge ${o.status === "paid" ? "badge-ok" : o.status === "failed" ? "badge-danger" : "badge-warn"}`}>{o.status}</span></td>
                        <td>{fmtDate(o.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        )}
      </div>
    </section>
  );
}
