import { useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api, fmtKES, fmtDate } from "../api";
import { useAuth } from "../auth.jsx";
import CopyButton from "../components/CopyButton.jsx";

export default function Checkout() {
  const { planId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [plan, setPlan] = useState(null);
  const [devices, setDevices] = useState([]);
  const [machineId, setMachineId] = useState("");
  const [newMachine, setNewMachine] = useState("");
  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState(user?.phone || "");
  const [error, setError] = useState(null);

  const [stage, setStage] = useState("form"); // form | waiting | paid
  const [order, setOrder] = useState(null);
  const [simulated, setSimulated] = useState(false);
  const [license, setLicense] = useState(null);
  const poll = useRef(null);

  // Load plan (from the catalog) + the customer's devices.
  useEffect(() => {
    api("/services", { auth: false }).then(({ services }) => {
      for (const s of services) {
        const p = (s.plans || []).find((pl) => String(pl.id) === String(planId));
        if (p) { setPlan({ ...p, service: s }); break; }
      }
    });
    api("/me/devices").then(({ devices }) => {
      setDevices(devices);
      if (devices[0]) setMachineId(devices[0].machine_id);
    }).catch(() => {});
    return () => clearInterval(poll.current);
  }, [planId]);

  const chosenMachine = machineId === "__new__" ? newMachine.trim().toUpperCase() : machineId;

  async function startPayment(e) {
    e.preventDefault();
    setError(null);
    if (!chosenMachine) { setError("Select or enter the device's Machine ID."); return; }
    if (!phone.trim()) { setError("Enter the M-Pesa phone number."); return; }
    try {
      const res = await api("/checkout", {
        method: "POST",
        body: { plan_id: plan.id, machine_id: chosenMachine, phone, label },
      });
      setOrder(res.order);
      setSimulated(res.simulated);
      setStage("waiting");
      startPolling(res.order.id);
    } catch (err) {
      setError(err.message);
    }
  }

  function startPolling(orderId) {
    clearInterval(poll.current);
    poll.current = setInterval(async () => {
      try {
        const { order } = await api(`/orders/${orderId}`);
        setOrder(order);
        if (order.status === "paid" && order.license) {
          clearInterval(poll.current);
          setLicense(order.license);
          setStage("paid");
        } else if (order.status === "failed") {
          clearInterval(poll.current);
          setError("The payment was cancelled or failed. Please try again.");
          setStage("form");
        }
      } catch { /* keep polling */ }
    }, 2500);
  }

  async function confirmSimulated() {
    try {
      const { license } = await api(`/payments/simulate/${order.id}`, { method: "POST" });
      setLicense(license);
      setStage("paid");
      clearInterval(poll.current);
    } catch (err) { setError(err.message); }
  }

  function downloadLicense() {
    const safe = (license.customer || "license").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const blob = new Blob([license.token + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${safe}-${license.service_key}.lic`; a.click();
    URL.revokeObjectURL(url);
  }

  if (!plan) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: "60rem" }}>
        <h1 style={{ fontSize: "2rem" }}>Checkout</h1>
        <p>{plan.service?.name} — {plan.name}</p>

        <div className="checkout-grid" style={{ marginTop: "1.5rem" }}>
          {/* ----- Left: form / status ----- */}
          <div className="card card-pad-lg">
            {error && <div className="alert alert-error">{error}</div>}

            {stage === "form" && (
              <form onSubmit={startPayment}>
                <h3 style={{ marginTop: 0 }}>1 · Which device is this for?</h3>
                <p className="hint" style={{ marginTop: 0 }}>
                  Open the app's activation screen and copy its <strong>Machine ID</strong> (e.g. 6DD4-DF54-3804-ADC6).
                </p>
                <div className="device-pick" style={{ marginBottom: "1rem" }}>
                  {devices.map((d) => (
                    <label key={d.id} className={`device-opt ${machineId === d.machine_id ? "sel" : ""}`}>
                      <input type="radio" name="dev" style={{ width: "auto" }}
                        checked={machineId === d.machine_id}
                        onChange={() => setMachineId(d.machine_id)} />
                      <div>
                        <div className="mono">{d.machine_id}</div>
                        {d.label && <small>{d.label}</small>}
                      </div>
                    </label>
                  ))}
                  <label className={`device-opt ${machineId === "__new__" ? "sel" : ""}`}>
                    <input type="radio" name="dev" style={{ width: "auto" }}
                      checked={machineId === "__new__"} onChange={() => setMachineId("__new__")} />
                    <div>+ Use a new device</div>
                  </label>
                </div>
                {machineId === "__new__" && (
                  <div className="grid-2" style={{ gap: ".75rem" }}>
                    <label className="field">
                      <span>Machine ID</span>
                      <input className="mono" value={newMachine} onChange={(e) => setNewMachine(e.target.value)} placeholder="6DD4-DF54-3804-ADC6" />
                    </label>
                    <label className="field">
                      <span>Label (optional)</span>
                      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Front till" />
                    </label>
                  </div>
                )}

                <h3>2 · M-Pesa number</h3>
                <label className="field">
                  <span>Phone (Safaricom)</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" />
                </label>

                <button className="btn btn-primary btn-block btn-lg">
                  Pay {fmtKES(plan.price_kes)} with M-Pesa
                </button>
              </form>
            )}

            {stage === "waiting" && (
              <div className="pay-status">
                <div className="big">📲</div>
                <h3>{simulated ? "Awaiting confirmation" : "Check your phone"}</h3>
                <p>
                  {simulated
                    ? "Payments are in demo mode — confirm below to issue your licence."
                    : `An M-Pesa request for ${fmtKES(plan.price_kes)} was sent to ${phone}. Enter your PIN to complete.`}
                </p>
                <div className="row" style={{ justifyContent: "center" }}>
                  <span className="spinner" /> <span className="muted">Waiting for payment…</span>
                </div>
                {simulated && (
                  <button className="btn btn-primary" style={{ marginTop: "1.2rem" }} onClick={confirmSimulated}>
                    ✓ Simulate successful payment
                  </button>
                )}
              </div>
            )}

            {stage === "paid" && license && (
              <div>
                <div className="alert alert-ok">✓ Payment received — your licence is ready.</div>
                <h3 style={{ marginTop: 0 }}>Your {plan.service?.name} licence</h3>
                <p className="hint" style={{ marginTop: 0 }}>
                  Copy this into the app's activation screen, or download the .lic file.
                </p>
                <pre className="token-box">{license.token}</pre>
                <div className="row wrap" style={{ marginTop: ".8rem" }}>
                  <CopyButton text={license.token} label="Copy licence" className="btn btn-primary btn-sm" />
                  <button className="btn btn-sm" onClick={downloadLicense}>⬇ Download .lic</button>
                  <Link to="/dashboard" className="btn btn-ghost btn-sm">Go to dashboard</Link>
                </div>
              </div>
            )}
          </div>

          {/* ----- Right: order summary ----- */}
          <aside className="card card-pad-lg" style={{ position: "sticky", top: "90px" }}>
            <h3 style={{ marginTop: 0 }}>Order summary</h3>
            <div className="summary-row"><span>Service</span><strong>{plan.service?.name}</strong></div>
            <div className="summary-row"><span>Plan</span><strong>{plan.name}</strong></div>
            <div className="summary-row"><span>Edition</span><strong style={{ textTransform: "capitalize" }}>{plan.edition}</strong></div>
            <div className="summary-row">
              <span>Term</span>
              <strong>{plan.period === "perpetual" ? "Perpetual" : `${plan.duration_days} days`}</strong>
            </div>
            {chosenMachine && <div className="summary-row"><span>Device</span><strong className="mono" style={{ fontSize: ".82rem" }}>{chosenMachine}</strong></div>}
            <div className="summary-row total"><span>Total</span><span>{fmtKES(plan.price_kes)}</span></div>
            <p className="hint">Licence valid until {plan.period === "perpetual" ? "forever" : fmtDate(new Date(Date.now() + plan.duration_days * 86400000).toISOString())}. Renew anytime from your dashboard.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
