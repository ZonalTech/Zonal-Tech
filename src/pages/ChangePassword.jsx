import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth.jsx";

/**
 * Logged-in password change. Doubles as the "you must set a new password" gate
 * shown to users who signed in with an admin-issued temporary password — when
 * `user.must_change_password` is set, App.jsx routes them here and they can't
 * reach the rest of the portal until they've chosen their own password.
 */
export default function ChangePassword() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const forced = !!user?.must_change_password;

  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password !== confirm) { setError("Your new passwords don't match."); return; }
    setBusy(true); setError(null);
    try {
      const updated = await changePassword(current, password);
      const dest = location.state?.from || (updated.role === "admin" ? "/admin" : "/dashboard");
      navigate(dest, { replace: true });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      <div className="card card-pad-lg auth-card">
        <h1>{forced ? "Set your password" : "Change your password"}</h1>
        {forced ? (
          <p>For your security, please replace the temporary password you were given with one only you know.</p>
        ) : (
          <p>Enter your current password and choose a new one.</p>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <label className="field"><span>{forced ? "Temporary password" : "Current password"}</span>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required placeholder="••••••••" autoFocus /></label>
          <label className="field"><span>New password <small style={{ fontWeight: 400 }}>(min 8)</small></span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="••••••••" /></label>
          <label className="field"><span>Confirm new password</span>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="••••••••" /></label>
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? <span className="spinner" /> : forced ? "Set password & continue" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
