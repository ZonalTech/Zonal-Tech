import { useState } from "react";
import { api, fmtDate } from "../api";

/**
 * Renders a Service Level Agreement (the structured snapshot from the backend)
 * and, when not yet accepted, an Accept button. Calls onAccepted with the
 * updated agreement.
 */
export default function SLA({ agreement, onAccepted, compact }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  if (!agreement) return null;
  const t = agreement.terms || {};
  const accepted = agreement.status === "accepted";

  async function accept() {
    setBusy(true); setErr(null);
    try {
      const { agreement: updated } = await api(`/me/agreements/${agreement.id}/accept`, { method: "POST" });
      onAccepted?.(updated);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="sla">
      <div className="row between wrap" style={{ marginBottom: ".6rem" }}>
        <h3 style={{ margin: 0 }}>Service Level Agreement <small className="muted">· {t.tier} · v{t.version}</small></h3>
        <span className={`badge ${accepted ? "badge-ok" : "badge-warn"}`}>
          {accepted ? `Accepted ${fmtDate(agreement.accepted_at)}` : "Action needed"}
        </span>
      </div>
      {t.summary && <p style={{ marginTop: 0 }}>{t.summary}</p>}

      {t.commitments && (
        <div className="sla-grid">
          {Object.entries(t.commitments).map(([k, v]) => (
            <div key={k} className="sla-cell"><span className="k">{k}</span><strong>{v}</strong></div>
          ))}
        </div>
      )}

      {!compact && t.clauses && (
        <ol className="sla-clauses">
          {t.clauses.map((c, i) => <li key={i}>{c}</li>)}
        </ol>
      )}

      {err && <div className="alert alert-error" style={{ marginTop: ".8rem" }}>{err}</div>}

      {!accepted && (
        <div className="row" style={{ marginTop: "1rem" }}>
          <button className="btn btn-primary" onClick={accept} disabled={busy}>
            {busy ? <span className="spinner" /> : "✓ I accept this agreement"}
          </button>
          <small className="muted">Recorded with a timestamp on your account.</small>
        </div>
      )}
    </div>
  );
}
