import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", company: "", phone: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await register(form);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card card-pad-lg auth-card">
        <h1>Create your account</h1>
        <p>Free to join. You only pay when you buy a licence.</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <label className="field">
            <span>Full name *</span>
            <input value={form.name} onChange={set("name")} required autoFocus placeholder="Your full name" />
          </label>
          <label className="field">
            <span>Email *</span>
            <input type="email" value={form.email} onChange={set("email")} required placeholder="you@zonaltech.co.ke" />
          </label>
          <div className="grid-2" style={{ gap: ".75rem" }}>
            <label className="field">
              <span>Company</span>
              <input value={form.company} onChange={set("company")} placeholder="Zonal Tech Ltd" />
            </label>
            <label className="field">
              <span>M-Pesa phone</span>
              <input value={form.phone} onChange={set("phone")} placeholder="0712 345 678" />
            </label>
          </div>
          <label className="field">
            <span>Password * <small style={{ fontWeight: 400 }}>(min 8 characters)</small></span>
            <input type="password" value={form.password} onChange={set("password")} required minLength={8} placeholder="••••••••" />
          </label>
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? <span className="spinner" /> : "Create account"}
          </button>
        </form>
        <div className="auth-foot">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
