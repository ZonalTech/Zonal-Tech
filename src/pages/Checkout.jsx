import { useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { api, fmtKES, fmtDate } from "../api";
import { useAuth } from "../auth.jsx";
import CopyButton from "../components/CopyButton.jsx";
import SLA from "../components/SLA.jsx";
import Icon from "../components/Icon.jsx";

const METHOD_META = {
  mpesa: { icon: "phone", label: "M-Pesa", desc: "STK push to your phone" },
  stripe: { icon: "card", label: "Card", desc: "Visa / Mastercard via Stripe" },
  bank: { icon: "building", label: "Bank transfer", desc: "Pay to our bank account" },
};

export default function Checkout() {
  const { planId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [plan, setPlan] = useState(null);
  const [methods, setMethods] = useState([]);
  const [method, setMethod] = useState("");
  const [devices, setDevices] = useState([]);
  const [machineId, setMachineId] = useState("");
  const [newMachine, setNewMachine] = useState("");
  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState(user?.phone || "");
  const [error, setError] = useState(null);

  const [stage, setStage] = useState("form"); // form | waiting | bank | paid
  const [order, setOrder] = useState(null);
  const [simulated, setSimulated] = useState(false);
  const [bankInfo, setBankInfo] = useState(null);
  const [license, setLicense] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const poll = useRef(null);

  useEffect(() => {
    api("/services", { auth: false }).then(({ services }) => {
      for (const s of services) {
        const p = (s.plans || []).find((pl) => String(pl.id) === String(planId));
        if (p) { setPlan({ ...p, service: s }); break; }
      }
    });
    api("/payment-methods", { auth: false }).then(({ methods }) => {
      setMethods(methods);
      if (methods[0]) setMethod((m) => m || methods[0].id);
    }).catch(() => {});
    api("/me/devices").then(({ devices }) => {
      setDevices(devices);
      if (devices[0]) setMachineId(devices[0].machine_id);
    }).catch(() => {});
    return () => clearInterval(poll.current);
  }, [planId]);

  // Returned from Stripe Checkout — verify and finish.
  useEffect(() => {
    const stripeOrder = params.get("stripe_order");
    if (!stripeOrder) return;
    setStage("waiting");
    (async () => {
      try {
        const { paid } = await api("/payments/stripe/verify", { method: "POST", body: { order_id: Number(stripeOrder) } });
        if (paid) startPolling(Number(stripeOrder));
        else { setError("Payment wasn't completed. You can try again."); setStage("form"); }
      } catch (e) { setError(e.message); setStage("form"); }
    })();
  }, [params]);

  const selected = methods.find((m) => m.id === method);
  const requiresDevice = plan ? plan.service?.requires_device !== false : true;
  const chosenMachine = machineId === "__new__" ? newMachine.trim().toUpperCase() : machineId;

  function startPolling(orderId) {
    clearInterval(poll.current);
    poll.current = setInterval(async () => {
      try {
        const { order } = await api(`/orders/${orderId}`);
        setOrder(order);
        if (order.status === "paid" && order.license) {
          clearInterval(poll.current);
          setLicense(order.license);
          if (order.agreement) setAgreement(order.agreement);
          setStage("paid");
        } else if (order.status === "failed") {
          clearInterval(poll.current);
          setError("The payment was cancelled or failed. Please try again.");
          setStage("form");
        }
      } catch { /* keep polling */ }
    }, 2500);
  }

  async function startPayment(e) {
    e.preventDefault();
    setError(null);
    if (requiresDevice && !chosenMachine) { setError("Select or enter the device's Machine ID."); return; }
    if (method === "mpesa" && !phone.trim()) { setError("Enter the M-Pesa phone number."); return; }
    try {
      const res = await api("/checkout", {
        method: "POST",
        body: { plan_id: plan.id, machine_id: chosenMachine, label, phone, method },
      });
      setOrder(res.order);
      if (res.method === "stripe" && res.redirect_url) {
        window.location.href = res.redirect_url;   // off to Stripe Checkout
        return;
      }
      if (res.method === "bank") {
        setBankInfo(res);
        setStage("bank");
        startPolling(res.order.id);                // admin confirms → licence
        return;
      }
      setSimulated(res.simulated);                 // mpesa
      setStage("waiting");
      startPolling(res.order.id);
    } catch (err) { setError(err.message); }
  }

  async function confirmSimulated() {
    try {
      const { license, agreement } = await api(`/payments/simulate/${order.id}`, { method: "POST" });
      setLicense(license);
      if (agreement) setAgreement(agreement);
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
  const payLabel = method === "mpesa" ? "Pay with M-Pesa" : method === "stripe" ? "Pay by card" : "Get bank details";

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: "60rem" }}>
        <h1 style={{ fontSize: "2rem" }}>Checkout</h1>
        <p>{plan.service?.name} — {plan.name}</p>

        <div className="checkout-grid" style={{ marginTop: "1.5rem" }}>
          <div className="card card-pad-lg">
            {error && <div className="alert alert-error">{error}</div>}

            {stage === "form" && (
              <form onSubmit={startPayment}>
                {requiresDevice && (
                  <>
                    <h3 style={{ marginTop: 0 }}>1 · Which device is this for?</h3>
                    <p className="hint" style={{ marginTop: 0 }}>
                      Open the app's activation screen and copy its <strong>Machine ID</strong> (e.g. 6DD4-DF54-3804-ADC6).
                    </p>
                    <div className="device-pick" style={{ marginBottom: "1rem" }}>
                      {devices.map((d) => (
                        <label key={d.id} className={`device-opt ${machineId === d.machine_id ? "sel" : ""}`}>
                          <input type="radio" name="dev" style={{ width: "auto" }} checked={machineId === d.machine_id} onChange={() => setMachineId(d.machine_id)} />
                          <div><div className="mono">{d.machine_id}</div>{d.label && <small>{d.label}</small>}</div>
                        </label>
                      ))}
                      <label className={`device-opt ${machineId === "__new__" ? "sel" : ""}`}>
                        <input type="radio" name="dev" style={{ width: "auto" }} checked={machineId === "__new__"} onChange={() => setMachineId("__new__")} />
                        <div>+ Use a new device</div>
                      </label>
                    </div>
                    {machineId === "__new__" && (
                      <div className="grid-2" style={{ gap: ".75rem" }}>
                        <label className="field"><span>Machine ID</span><input className="mono" value={newMachine} onChange={(e) => setNewMachine(e.target.value)} placeholder="6DD4-DF54-3804-ADC6" /></label>
                        <label className="field"><span>Label (optional)</span><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Front till" /></label>
                      </div>
                    )}
                  </>
                )}

                <h3>{requiresDevice ? "2" : "1"} · Payment method</h3>
                {methods.length === 0 ? (
                  <div className="alert alert-error">No payment methods are enabled. Please contact support.</div>
                ) : (
                  <div className="device-pick" style={{ marginBottom: "1rem" }}>
                    {methods.map((m) => (
                      <label key={m.id} className={`device-opt ${method === m.id ? "sel" : ""}`}>
                        <input type="radio" name="method" style={{ width: "auto" }} checked={method === m.id} onChange={() => setMethod(m.id)} />
                        <div>
                          <div><Icon name={METHOD_META[m.id]?.icon || "card"} /> <strong>{METHOD_META[m.id]?.label || m.label}</strong>
                            {m.id === "mpesa" && m.simulated && <span className="badge badge-warn" style={{ marginLeft: ".4rem" }}>demo</span>}</div>
                          <small>{METHOD_META[m.id]?.desc}</small>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {method === "mpesa" && (
                  <label className="field"><span>M-Pesa phone (Safaricom)</span>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" /></label>
                )}
                {method === "bank" && (
                  <p className="hint">You'll get our bank details and a reference next. Your licence is issued once we confirm the transfer.</p>
                )}

                <button className="btn btn-primary btn-block btn-lg" disabled={!methods.length}>
                  {payLabel} · {fmtKES(plan.price_kes)}
                </button>
              </form>
            )}

            {stage === "waiting" && (
              <div className="pay-status">
                <div className="big"><Icon name={method === "stripe" ? "card" : "phone"} size={46} /></div>
                <h3>{simulated ? "Awaiting confirmation" : method === "stripe" ? "Confirming payment" : "Check your phone"}</h3>
                <p>
                  {simulated ? "Payments are in demo mode — confirm below to issue your licence."
                    : method === "stripe" ? "Verifying your card payment…"
                      : `An M-Pesa request for ${fmtKES(plan.price_kes)} was sent to ${phone}. Enter your PIN to complete.`}
                </p>
                <div className="row" style={{ justifyContent: "center" }}>
                  <span className="spinner" /> <span className="muted">Waiting…</span>
                </div>
                {simulated && (
                  <button className="btn btn-primary" style={{ marginTop: "1.2rem" }} onClick={confirmSimulated}>
                    ✓ Simulate successful payment
                  </button>
                )}
              </div>
            )}

            {stage === "bank" && bankInfo && (
              <div>
                <div className="alert alert-info">Transfer {fmtKES(plan.price_kes)} to the account below, then we'll confirm and issue your licence.</div>
                <h3 style={{ marginTop: 0 }}>Bank transfer details</h3>
                <div className="kv" style={{ display: "grid", gap: ".5rem" }}>
                  {bankInfo.bank?.bank_name && <div><span className="k">Bank</span> — <strong>{bankInfo.bank.bank_name}</strong></div>}
                  {bankInfo.bank?.account_name && <div><span className="k">Account name</span> — <strong>{bankInfo.bank.account_name}</strong></div>}
                  {bankInfo.bank?.account_number && <div><span className="k">Account no.</span> — <strong className="mono">{bankInfo.bank.account_number}</strong></div>}
                  {bankInfo.bank?.branch && <div><span className="k">Branch</span> — {bankInfo.bank.branch}</div>}
                  {bankInfo.bank?.swift && <div><span className="k">SWIFT</span> — <span className="mono">{bankInfo.bank.swift}</span></div>}
                  <div><span className="k">Reference</span> — <strong className="mono">{bankInfo.reference}</strong> <CopyButton text={bankInfo.reference} className="btn btn-sm" /></div>
                </div>
                {bankInfo.bank?.instructions && <p className="hint" style={{ marginTop: ".8rem" }}>{bankInfo.bank.instructions}</p>}
                <div className="row" style={{ justifyContent: "center", marginTop: "1rem" }}>
                  <span className="spinner" /> <span className="muted">Waiting for confirmation… you can also check your dashboard later.</span>
                </div>
                <Link to="/dashboard" className="btn btn-ghost btn-sm" style={{ marginTop: "1rem" }}>Go to dashboard</Link>
              </div>
            )}

            {stage === "paid" && license && (
              <div>
                <div className="alert alert-ok">✓ Payment received — your licence is ready.</div>
                <h3 style={{ marginTop: 0 }}>Your {plan.service?.name} licence</h3>
                <p className="hint" style={{ marginTop: 0 }}>
                  {requiresDevice ? "Copy this into the app's activation screen, or download the .lic file."
                    : "This is your proof-of-purchase licence — keep it for your records. Our team will be in touch to set up your service."}
                </p>
                <pre className="token-box">{license.token}</pre>
                <div className="row wrap" style={{ marginTop: ".8rem" }}>
                  <CopyButton text={license.token} label="Copy licence" className="btn btn-primary btn-sm" />
                  <button className="btn btn-sm" onClick={downloadLicense}><Icon name="download" /> Download .lic</button>
                  {requiresDevice && (
                    <a className="btn btn-sm" href={`/api/download/${license.service_key}`}><Icon name="download" /> Download installer</a>
                  )}
                  <Link to="/dashboard" className="btn btn-ghost btn-sm">Go to dashboard</Link>
                </div>
                {agreement && (
                  <div style={{ marginTop: "1.6rem", borderTop: "1px solid var(--border)", paddingTop: "1.4rem" }}>
                    <p className="hint" style={{ marginTop: 0 }}>Now that your licence is ready, please review and accept the service level agreement for your plan.</p>
                    <SLA agreement={agreement} onAccepted={setAgreement} />
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="card card-pad-lg" style={{ position: "sticky", top: "90px" }}>
            <h3 style={{ marginTop: 0 }}>Order summary</h3>
            <div className="summary-row"><span>Service</span><strong>{plan.service?.name}</strong></div>
            <div className="summary-row"><span>Plan</span><strong>{plan.name}</strong></div>
            <div className="summary-row"><span>Edition</span><strong style={{ textTransform: "capitalize" }}>{plan.edition}</strong></div>
            <div className="summary-row"><span>Term</span><strong>{plan.period === "perpetual" ? "Perpetual" : `${plan.duration_days} days`}</strong></div>
            {requiresDevice && chosenMachine && <div className="summary-row"><span>Device</span><strong className="mono" style={{ fontSize: ".82rem" }}>{chosenMachine}</strong></div>}
            {selected && <div className="summary-row"><span>Method</span><strong>{METHOD_META[selected.id]?.label || selected.label}</strong></div>}
            <div className="summary-row total"><span>Total</span><span>{fmtKES(plan.price_kes)}</span></div>
            <p className="hint">Licence valid until {plan.period === "perpetual" ? "forever" : fmtDate(new Date(Date.now() + plan.duration_days * 86400000).toISOString())}. Renew anytime from your dashboard.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
