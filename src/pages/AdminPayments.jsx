import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Icon from "../components/Icon.jsx";

export default function AdminPayments() {
  const [cfg, setCfg] = useState(null);
  const [tab, setTab] = useState("mpesa");
  const [secrets, setSecrets] = useState({ consumer_secret: "", passkey: "", secret_key: "" });
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api("/admin/settings/payments").then(({ settings }) => setCfg(settings)); }, []);

  const upd = (group, field) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setCfg({ ...cfg, [group]: { ...cfg[group], [field]: v } });
  };
  const setSecret = (k) => (e) => setSecrets({ ...secrets, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    try {
      const payload = {
        mpesa: { ...cfg.mpesa }, stripe: { ...cfg.stripe }, bank: { ...cfg.bank },
      };
      // only send secrets when re-entered (blank keeps the saved value)
      if (secrets.consumer_secret.trim()) payload.mpesa.consumer_secret = secrets.consumer_secret.trim();
      if (secrets.passkey.trim()) payload.mpesa.passkey = secrets.passkey.trim();
      if (secrets.secret_key.trim()) payload.stripe.secret_key = secrets.secret_key.trim();
      const { settings } = await api("/admin/settings/payments", { method: "PUT", body: payload });
      setCfg(settings); setSecrets({ consumer_secret: "", passkey: "", secret_key: "" });
      setMsg("Payment settings saved.");
    } catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  }

  if (!cfg) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <section className="section" style={{ paddingTop: "2.5rem" }}>
      <div className="container" style={{ maxWidth: "56rem" }}>
        <div className="page-head">
          <div>
            <h1>Payment Settings</h1>
            <p style={{ margin: 0 }}>Configure how customers pay. Enabled methods appear at checkout.</p>
          </div>
          <Link to="/admin" className="btn btn-ghost btn-sm">← Back to admin</Link>
        </div>
        {msg && <div className="alert alert-ok">{msg}</div>}
        {err && <div className="alert alert-error">{err}</div>}

        <div className="tabs" style={{ marginBottom: "1.5rem" }}>
          <button type="button" className={tab === "mpesa" ? "active" : ""} onClick={() => setTab("mpesa")}><Icon name="phone" /> M-Pesa{cfg.mpesa.enabled ? "" : " · off"}</button>
          <button type="button" className={tab === "stripe" ? "active" : ""} onClick={() => setTab("stripe")}><Icon name="card" /> Stripe{cfg.stripe.enabled ? "" : " · off"}</button>
          <button type="button" className={tab === "bank" ? "active" : ""} onClick={() => setTab("bank")}><Icon name="building" /> Bank{cfg.bank.enabled ? "" : " · off"}</button>
        </div>

        <form onSubmit={save} className="stack">
          {/* M-PESA */}
          {tab === "mpesa" && (
          <div className="card card-pad-lg">
            <label className="check" style={{ fontSize: "1.05rem", fontWeight: 700 }}>
              <input type="checkbox" checked={!!cfg.mpesa.enabled} onChange={upd("mpesa", "enabled")} style={{ width: "auto", accentColor: "var(--accent)" }} />
              &nbsp;<Icon name="phone" /> M-Pesa (STK Push)
            </label>
            <p className="hint">Leave the consumer key blank to run in <strong>simulate</strong> mode (full flow, no live Daraja credentials). Fill these from your Safaricom Daraja app to go live.</p>
            <div className="grid-2" style={{ gap: ".9rem" }}>
              <label className="field"><span>Environment</span>
                <select value={cfg.mpesa.env} onChange={upd("mpesa", "env")}><option value="sandbox">sandbox</option><option value="production">production</option></select>
              </label>
              <label className="field"><span>Business shortcode</span><input value={cfg.mpesa.shortcode || ""} onChange={upd("mpesa", "shortcode")} placeholder="174379" /></label>
            </div>
            <label className="field"><span>Consumer key</span><input className="mono" value={cfg.mpesa.consumer_key || ""} onChange={upd("mpesa", "consumer_key")} placeholder="from Daraja" /></label>
            <div className="grid-2" style={{ gap: ".9rem" }}>
              <label className="field"><span>Consumer secret {cfg.mpesa.consumer_secret_set && <span className="badge badge-ok">saved {cfg.mpesa.consumer_secret_hint}</span>}</span>
                <input type="password" value={secrets.consumer_secret} onChange={setSecret("consumer_secret")} placeholder={cfg.mpesa.consumer_secret_set ? "•••• (blank = keep)" : "from Daraja"} autoComplete="off" /></label>
              <label className="field"><span>Passkey {cfg.mpesa.passkey_set && <span className="badge badge-ok">saved {cfg.mpesa.passkey_hint}</span>}</span>
                <input type="password" value={secrets.passkey} onChange={setSecret("passkey")} placeholder={cfg.mpesa.passkey_set ? "•••• (blank = keep)" : "Lipa na M-Pesa passkey"} autoComplete="off" /></label>
            </div>
            <label className="field"><span>Callback base URL <small style={{ fontWeight: 400 }}>(public URL Safaricom can reach, e.g. ngrok)</small></span>
              <input className="mono" value={cfg.mpesa.callback_base || ""} onChange={upd("mpesa", "callback_base")} placeholder="https://abc123.ngrok.io" /></label>
          </div>
          )}

          {/* STRIPE */}
          {tab === "stripe" && (
          <div className="card card-pad-lg">
            <label className="check" style={{ fontSize: "1.05rem", fontWeight: 700 }}>
              <input type="checkbox" checked={!!cfg.stripe.enabled} onChange={upd("stripe", "enabled")} style={{ width: "auto", accentColor: "var(--accent)" }} />
              &nbsp;<Icon name="card" /> Stripe (Card payments)
            </label>
            <p className="hint">Hosted Stripe Checkout. Get keys from dashboard.stripe.com → Developers → API keys.</p>
            <label className="field"><span>Secret key {cfg.stripe.secret_key_set && <span className="badge badge-ok">saved {cfg.stripe.secret_key_hint}</span>}</span>
              <input type="password" value={secrets.secret_key} onChange={setSecret("secret_key")} placeholder={cfg.stripe.secret_key_set ? "•••• (blank = keep)" : "sk_live_… or sk_test_…"} autoComplete="off" /></label>
            <label className="field"><span>Publishable key</span><input className="mono" value={cfg.stripe.publishable_key || ""} onChange={upd("stripe", "publishable_key")} placeholder="pk_live_… or pk_test_…" /></label>
          </div>
          )}

          {/* BANK */}
          {tab === "bank" && (
          <div className="card card-pad-lg">
            <label className="check" style={{ fontSize: "1.05rem", fontWeight: 700 }}>
              <input type="checkbox" checked={!!cfg.bank.enabled} onChange={upd("bank", "enabled")} style={{ width: "auto", accentColor: "var(--accent)" }} />
              &nbsp;<Icon name="building" /> Bank transfer
            </label>
            <p className="hint">Shown to customers as deposit details. You confirm the payment from the Orders tab once funds arrive, which issues the licence.</p>
            <div className="grid-2" style={{ gap: ".9rem" }}>
              <label className="field"><span>Bank name</span><input value={cfg.bank.bank_name || ""} onChange={upd("bank", "bank_name")} placeholder="Equity Bank" /></label>
              <label className="field"><span>Account name</span><input value={cfg.bank.account_name || ""} onChange={upd("bank", "account_name")} placeholder="Zonal Tech Ltd" /></label>
            </div>
            <div className="grid-2" style={{ gap: ".9rem" }}>
              <label className="field"><span>Account number</span><input className="mono" value={cfg.bank.account_number || ""} onChange={upd("bank", "account_number")} placeholder="1234567890" /></label>
              <label className="field"><span>Branch</span><input value={cfg.bank.branch || ""} onChange={upd("bank", "branch")} placeholder="Westlands" /></label>
            </div>
            <label className="field"><span>SWIFT / BIC</span><input className="mono" value={cfg.bank.swift || ""} onChange={upd("bank", "swift")} placeholder="EQBLKENA" /></label>
            <label className="field"><span>Instructions to customer</span><textarea rows={3} value={cfg.bank.instructions || ""} onChange={upd("bank", "instructions")} placeholder="Use your order reference as the deposit narration." /></label>
          </div>
          )}

          <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? <span className="spinner" /> : "Save payment settings"}</button>
        </form>
      </div>
    </section>
  );
}
