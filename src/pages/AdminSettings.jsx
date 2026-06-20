import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

const PROVIDERS = [
  { v: "mistral", l: "Mistral AI", base: "https://api.mistral.ai/v1", model: "mistral-small-latest" },
  { v: "gemini", l: "Google Gemini", base: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.0-flash" },
  { v: "claude", l: "Anthropic Claude", base: "", model: "claude-opus-4-8" },
];

export default function AdminSettings() {
  const [cfg, setCfg] = useState(null);
  const [defaultInstructions, setDefaultInstructions] = useState("");
  const [apiKey, setApiKey] = useState("");        // blank = keep existing
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const [testQ, setTestQ] = useState("What services do you offer and what do they cost?");
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api("/admin/settings/ai").then(({ settings, default_instructions }) => {
      setCfg(settings);
      setDefaultInstructions(default_instructions);
    });
  }, []);

  const set = (k) => (e) => setCfg({ ...cfg, [k]: e.target.value });

  function pickProvider(v) {
    const p = PROVIDERS.find((x) => x.v === v);
    setCfg({ ...cfg, provider: v, base_url: p.base, model: p.model });
  }

  async function save(e) {
    e?.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    try {
      const payload = {
        provider: cfg.provider, base_url: cfg.base_url, model: cfg.model,
        instructions: cfg.instructions, enabled: cfg.enabled,
      };
      if (apiKey.trim()) payload.api_key = apiKey.trim();
      const { settings } = await api("/admin/settings/ai", { method: "PUT", body: payload });
      setCfg(settings); setApiKey(""); setMsg("Settings saved.");
    } catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  }

  async function runTest() {
    setTesting(true); setTestResult(null);
    try {
      const body = { message: testQ };
      if (apiKey.trim()) body.api_key = apiKey.trim();   // test unsaved key too
      body.provider = cfg.provider; body.base_url = cfg.base_url;
      body.model = cfg.model; body.instructions = cfg.instructions;
      const r = await api("/admin/settings/ai/test", { method: "POST", body });
      setTestResult(r);
    } catch (e) { setTestResult({ ok: false, reply: e.message, mode: "error" }); }
    finally { setTesting(false); }
  }

  if (!cfg) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <section className="section" style={{ paddingTop: "2.5rem" }}>
      <div className="container" style={{ maxWidth: "56rem" }}>
        <div className="page-head">
          <div>
            <h1>AI Assistant Settings</h1>
            <p style={{ margin: 0 }}>Configure the model that answers customer questions, grounded in your live website data.</p>
          </div>
          <Link to="/admin" className="btn btn-ghost btn-sm">← Back to admin</Link>
        </div>

        {msg && <div className="alert alert-ok">{msg}</div>}
        {err && <div className="alert alert-error">{err}</div>}

        <form className="card card-pad-lg" onSubmit={save}>
          <label className="check" style={{ marginBottom: "1rem", fontSize: "1rem" }}>
            <input type="checkbox" checked={!!cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} style={{ width: "auto", accentColor: "var(--accent)" }} />
            &nbsp;Enable AI answers (when off, the assistant uses the built-in knowledge base)
          </label>

          <div className="grid-2" style={{ gap: ".9rem" }}>
            <label className="field"><span>Provider</span>
              <select value={cfg.provider} onChange={(e) => pickProvider(e.target.value)}>
                {PROVIDERS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
              </select>
            </label>
            <label className="field"><span>Model</span>
              <input value={cfg.model || ""} onChange={set("model")} placeholder="mistral-small-latest" />
            </label>
          </div>

          <label className="field"><span>API base URL</span>
            <input className="mono" value={cfg.base_url || ""} onChange={set("base_url")} placeholder="https://api.mistral.ai/v1" />
            <small className="hint">Mistral uses the OpenAI-compatible <code>/chat/completions</code> endpoint at this base URL.</small>
          </label>

          <label className="field">
            <span>API key {cfg.api_key_set && <span className="badge badge-ok" style={{ marginLeft: ".4rem" }}>saved {cfg.api_key_hint}</span>}</span>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder={cfg.api_key_set ? "•••••••• (leave blank to keep saved key)" : "Paste your Mistral API key"} autoComplete="off" />
            <small className="hint">Get a key from console.mistral.ai. Stored securely on the server — never shown again.</small>
          </label>

          <label className="field">
            <span>Instructions <small style={{ fontWeight: 400 }}>(how it should answer)</small></span>
            <textarea rows={9} value={cfg.instructions || ""} onChange={set("instructions")} />
            <small className="hint">
              Your live services &amp; prices are added automatically, so the assistant answers from real website data.{" "}
              <button type="button" className="btn btn-ghost btn-sm" style={{ padding: ".2rem .6rem" }}
                onClick={() => setCfg({ ...cfg, instructions: defaultInstructions })}>Reset to default</button>
            </small>
          </label>

          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? <span className="spinner" /> : "Save settings"}
          </button>
        </form>

        <div className="card card-pad-lg" style={{ marginTop: "1.5rem" }}>
          <h3 style={{ marginTop: 0 }}>Test the assistant</h3>
          <p className="hint" style={{ marginTop: 0 }}>Send a sample question using the settings above (saved or not) to confirm the key, URL and model work.</p>
          <div className="row wrap">
            <input value={testQ} onChange={(e) => setTestQ(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
            <button className="btn" onClick={runTest} disabled={testing}>{testing ? <span className="spinner" /> : "Run test"}</button>
          </div>
          {testResult && (
            <div className={`alert ${testResult.ok ? "alert-ok" : "alert-error"}`} style={{ marginTop: "1rem" }}>
              <div style={{ marginBottom: ".4rem" }}>
                <span className="badge">{testResult.mode}</span> {testResult.ok ? "answered by your provider ✓" : "fell back / failed"}
              </div>
              <div>{testResult.reply}</div>
              {testResult.note && <div className="hint" style={{ marginTop: ".4rem" }}>{testResult.note}</div>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
