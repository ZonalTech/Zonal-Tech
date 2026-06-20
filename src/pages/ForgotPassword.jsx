import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await api("/auth/forgot", { method: "POST", auth: false, body: { email } });
      setResult(r);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      <div className="card card-pad-lg auth-card">
        <h1>Reset your password</h1>
        {result ? (
          <>
            <div className="alert alert-ok">{result.message}</div>
            {result.reset_url && (
              <div className="alert alert-info">
                <strong>Dev mode:</strong> email isn't configured, so use this link to set a new password:
                <br /><a href={result.reset_url} style={{ color: "var(--accent)", wordBreak: "break-all" }}>{result.reset_url}</a>
              </div>
            )}
            <div className="auth-foot"><Link to="/login">Back to sign in</Link></div>
          </>
        ) : (
          <>
            <p>Enter your account email and we'll send you a link to set a new password.</p>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={submit}>
              <label className="field"><span>Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus placeholder="you@zonaltech.co.ke" /></label>
              <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
                {busy ? <span className="spinner" /> : "Send reset link"}
              </button>
            </form>
            <div className="auth-foot">Remembered it? <Link to="/login">Sign in</Link></div>
          </>
        )}
      </div>
    </div>
  );
}
