import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, setToken } from "../api";
import { useAuth } from "../auth.jsx";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setBusy(true); setError(null);
    try {
      const { token: authToken, user } = await api("/auth/reset", { method: "POST", auth: false, body: { token, password } });
      setToken(authToken); setUser(user);
      navigate(user.role === "admin" ? "/admin" : "/dashboard", { replace: true });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      <div className="card card-pad-lg auth-card">
        <h1>Set a new password</h1>
        {!token ? (
          <>
            <div className="alert alert-error">This reset link is missing its token. Request a new one.</div>
            <div className="auth-foot"><Link to="/forgot-password">Request a reset link</Link></div>
          </>
        ) : (
          <>
            <p>Choose a new password for your account.</p>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={submit}>
              <label className="field"><span>New password <small style={{ fontWeight: 400 }}>(min 8)</small></span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="••••••••" autoFocus /></label>
              <label className="field"><span>Confirm password</span>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="••••••••" /></label>
              <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
                {busy ? <span className="spinner" /> : "Update password"}
              </button>
            </form>
            <div className="auth-foot"><Link to="/login">Back to sign in</Link></div>
          </>
        )}
      </div>
    </div>
  );
}
