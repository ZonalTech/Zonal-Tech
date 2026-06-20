import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  DEMO_SEED_B64,
  buildLicense,
  generateSeedB64,
  publicKeyB64,
  selfVerify,
} from "../lib/license";
import CopyButton from "../components/CopyButton.jsx";
import { useDialog } from "../components/Dialog.jsx";
import Icon from "../components/Icon.jsx";
import "./Generator.css";

const SEED_STORAGE_KEY = "zt.license.seed";
const EDITIONS = ["standard", "basic", "pro", "enterprise", "trial"];

const todayISO = () => new Date().toISOString().slice(0, 10);
function plusYearsISO(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

/**
 * Admin-only manual License Generator (signs in the browser with the vendor's
 * private seed). Complements the portal's automated, server-side signing — use
 * this for offline sales, comps, replacements or one-off keys. The default seed
 * matches the server's, so manual licences validate in products too.
 */
export default function Generator() {
  const { confirm, alert } = useDialog();
  const [seed, setSeed] = useState(() => localStorage.getItem(SEED_STORAGE_KEY) || DEMO_SEED_B64);
  const [seedDraft, setSeedDraft] = useState("");
  const [showSeed, setShowSeed] = useState(false);

  useEffect(() => { localStorage.setItem(SEED_STORAGE_KEY, seed); }, [seed]);

  const keyInfo = useMemo(() => {
    try { return { pub: publicKeyB64(seed), error: null }; }
    catch (e) { return { pub: null, error: e.message }; }
  }, [seed]);
  const isDemo = seed === DEMO_SEED_B64;

  const [customer, setCustomer] = useState("");
  const [machineId, setMachineId] = useState("");
  const [app, setApp] = useState("zt-pos");
  const [wrapper, setWrapper] = useState("ZT-POS LICENSE");
  const [edition, setEdition] = useState("standard");
  const [issued, setIssued] = useState(todayISO());
  const [perpetual, setPerpetual] = useState(false);
  const [expires, setExpires] = useState(plusYearsISO(1));

  const [generated, setGenerated] = useState(null);
  const [genError, setGenError] = useState(null);

  const reset = () => { setGenerated(null); setGenError(null); };
  const bind = (setter) => (e) => { setter(e.target.value); reset(); };
  const canGenerate = customer.trim() && machineId.trim() && !keyInfo.error;

  function generate() {
    try {
      const r = buildLicense(seed,
        { app, customer, machineId, edition, issued, expires: perpetual ? "" : expires },
        wrapper);
      setGenerated({ ...r, verified: selfVerify(seed, r.token) });
      setGenError(null);
    } catch (e) { setGenError(e.message); setGenerated(null); }
  }

  async function regenerateKey() {
    const ok = await confirm({
      title: "Generate a new signing key?", danger: true, confirmText: "Generate new key",
      message: "Every licence issued with the current key will stop validating. You must copy the "
             + "new public key into each app's LICENSE_PUBLIC_KEY.",
    });
    if (!ok) return;
    setSeed(generateSeedB64());
    reset();
  }

  function importSeed() {
    try { publicKeyB64(seedDraft.trim()); setSeed(seedDraft.trim()); setSeedDraft(""); reset(); }
    catch (e) { alert({ title: "Invalid seed", message: e.message }); }
  }

  function downloadLicense() {
    if (!generated) return;
    const safe = (customer || "license").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const blob = new Blob([generated.token + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${safe}.lic`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="section generator" style={{ paddingTop: "2.5rem" }}>
      <div className="container">
        <div className="page-head">
          <div>
            <h1>License Generator</h1>
            <p style={{ margin: 0 }}>Issue signed Ed25519 licences manually — offline sales, comps or replacements.</p>
          </div>
          <Link to="/admin" className="btn btn-ghost btn-sm">← Back to admin</Link>
        </div>

        <div className="alert alert-info">
          This signs in your browser with the vendor private seed. For normal paid sales the portal
          issues licences automatically on the server — use this only for manual cases.
        </div>

        <div className="grid-2">
          {/* ---- New licence ---- */}
          <section className="card card-pad-lg">
            <div className="card-head"><h2>New licence</h2></div>

            <label className="field">
              <span>Customer name *</span>
              <input value={customer} onChange={bind(setCustomer)} placeholder="Zonal Tech Ltd" autoFocus />
            </label>
            <label className="field">
              <span>Device / Machine ID *</span>
              <input className="mono" value={machineId} onChange={bind(setMachineId)} placeholder="6DD4-DF54-3804-ADC6" />
              <small className="hint">Copied from the app's activation screen.</small>
            </label>

            <button className="btn btn-primary btn-block" onClick={generate} disabled={!canGenerate}>
              Generate licence
            </button>
            {genError && <div className="alert alert-error mt">{genError}</div>}

            <details className="mt">
              <summary>Advanced options</summary>
              <div className="field-grid mt">
                <label className="field">
                  <span>Edition</span>
                  <input list="editions" value={edition} onChange={bind(setEdition)} />
                  <datalist id="editions">{EDITIONS.map((e) => <option key={e} value={e} />)}</datalist>
                </label>
                <label className="field">
                  <span>Issued</span>
                  <input type="date" value={issued} onChange={bind(setIssued)} />
                </label>
              </div>
              <label className="field">
                <span>Expires</span>
                <div className="row">
                  <input type="date" value={expires} disabled={perpetual} onChange={bind(setExpires)} />
                  <label className="check">
                    <input type="checkbox" checked={perpetual}
                      onChange={(e) => { setPerpetual(e.target.checked); reset(); }} />
                    Perpetual
                  </label>
                </div>
                {!perpetual && (
                  <div className="row wrap quick">
                    {[1, 2, 3].map((y) => (
                      <button key={y} className="btn btn-ghost btn-sm"
                        onClick={() => { setExpires(plusYearsISO(y)); reset(); }}>+{y}y</button>
                    ))}
                  </div>
                )}
              </label>
              <div className="field-grid">
                <label className="field">
                  <span>App id</span>
                  <input value={app} onChange={bind(setApp)} placeholder="zt-pos" />
                </label>
                <label className="field">
                  <span>Token label</span>
                  <input value={wrapper} onChange={bind(setWrapper)} placeholder="ZT-POS LICENSE" />
                </label>
              </div>
            </details>
          </section>

          {/* ---- Signing key ---- */}
          <section className="card card-pad-lg">
            <div className="card-head">
              <h2>Signing key</h2>
              {isDemo && <span className="badge badge-warn">demo key</span>}
            </div>
            <p className="hint">
              The vendor's private key. It never leaves this browser. The matching{" "}
              <strong>public key</strong> below goes into each app's <code>LICENSE_PUBLIC_KEY</code>.
            </p>

            <label className="field">
              <span>Public key (paste into app config)</span>
              <div className="row">
                <input readOnly value={keyInfo.pub || ""} className="mono" />
                <CopyButton text={keyInfo.pub} />
              </div>
            </label>

            <div className="row wrap">
              <button className="btn btn-sm" onClick={() => setShowSeed((s) => !s)}>
                {showSeed ? "Hide" : "Show"} private seed
              </button>
              <button className="btn btn-danger btn-sm" onClick={regenerateKey}>Generate new key</button>
              {!isDemo && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setSeed(DEMO_SEED_B64); reset(); }}>
                  Load demo seed
                </button>
              )}
            </div>

            {showSeed && (
              <label className="field mt">
                <span>Private seed — keep secret</span>
                <div className="row">
                  <input readOnly value={seed} className="mono-danger" />
                  <CopyButton text={seed} />
                </div>
              </label>
            )}

            <details className="mt">
              <summary>Import an existing seed</summary>
              <div className="row mt">
                <input placeholder="Paste base64 seed (32 bytes)…" value={seedDraft}
                  onChange={(e) => setSeedDraft(e.target.value)} />
                <button className="btn btn-sm" onClick={importSeed} disabled={!seedDraft.trim()}>Import</button>
              </div>
            </details>
          </section>

          {/* ---- Output ---- */}
          {generated && (
            <section className="card card-pad-lg" style={{ gridColumn: "1 / -1" }}>
              <div className="card-head">
                <h2>Generated licence</h2>
                {generated.verified
                  ? <span className="badge badge-ok">signature verified ✓</span>
                  : <span className="badge badge-warn">unverified</span>}
              </div>
              <pre className="token">{generated.token}</pre>
              <div className="row wrap">
                <CopyButton text={generated.token} label="Copy licence" className="btn btn-primary btn-sm" />
                <button className="btn btn-sm" onClick={downloadLicense}><Icon name="download" /> Download .lic</button>
              </div>
              <details className="payload mt">
                <summary>Payload (decoded JSON)</summary>
                <pre>{JSON.stringify(generated.payload, null, 2)}</pre>
              </details>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
