import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtDate } from "../api";
import { useDialog } from "../components/Dialog.jsx";

export default function AdminUsers() {
  const { confirm, prompt } = useDialog();
  const [users, setUsers] = useState(null);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = () => api("/admin/users").then(({ users }) => setUsers(users));
  useEffect(() => { load(); }, []);

  function flash(setter, text) { setter(text); setTimeout(() => setter(null), 3500); }
  async function act(fn) {
    setErr(null); setMsg(null);
    try { await fn(); await load(); }
    catch (e) { flash(setErr, e.message); }
  }

  const setRole = (u, role) => act(async () => {
    await api(`/admin/users/${u.id}`, { method: "PUT", body: { role } });
    flash(setMsg, `${u.email} is now ${role}.`);
  });
  const toggleActive = (u) => act(async () => {
    await api(`/admin/users/${u.id}`, { method: "PUT", body: { is_active: !u.is_active } });
    flash(setMsg, `${u.email} ${u.is_active ? "deactivated" : "activated"}.`);
  });
  const resetPw = async (u) => {
    const pw = await prompt({
      title: "Reset password", message: `Set a new password for ${u.email} (min 8 characters).`,
      inputType: "password", placeholder: "New password", confirmText: "Set password",
    });
    if (pw == null) return;
    act(async () => {
      await api(`/admin/users/${u.id}/password`, { method: "POST", body: { password: pw } });
      flash(setMsg, `Password reset for ${u.email}.`);
    });
  };
  const del = async (u) => {
    const ok = await confirm({
      title: "Delete user", danger: true, confirmText: "Delete",
      message: `Delete ${u.email}? This removes their licences, devices and orders. This cannot be undone.`,
    });
    if (!ok) return;
    act(async () => {
      await api(`/admin/users/${u.id}`, { method: "DELETE" });
      flash(setMsg, `${u.email} deleted.`);
    });
  };

  return (
    <section className="section" style={{ paddingTop: "2.5rem" }}>
      <div className="container">
        <div className="page-head">
          <div>
            <h1>User management</h1>
            <p style={{ margin: 0 }}>Control every account — roles, access, passwords.</p>
          </div>
          <div className="row wrap">
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd((s) => !s)}>+ Add user</button>
            <Link to="/admin" className="btn btn-ghost btn-sm">← Back to admin</Link>
          </div>
        </div>

        {msg && <div className="alert alert-ok">{msg}</div>}
        {err && <div className="alert alert-error">{err}</div>}

        {showAdd && <AddUser onDone={() => { setShowAdd(false); load(); flash(setMsg, "User created."); }} onError={(e) => flash(setErr, e)} />}

        {users === null ? <div className="loading-page"><div className="spinner" /></div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>User</th><th>Company</th><th>Role</th><th>Status</th><th>Licences</th><th>Joined</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={u.is_active ? null : { opacity: .55 }}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.name}{u.is_self && <span className="badge badge-accent" style={{ marginLeft: ".4rem" }}>you</span>}</div>
                      <small>{u.email}</small>
                    </td>
                    <td>{u.company || "—"}</td>
                    <td>
                      <select value={u.role} disabled={u.is_self} onChange={(e) => setRole(u, e.target.value)}
                        style={{ width: "auto", padding: ".3rem .5rem", fontSize: ".85rem" }}>
                        <option value="customer">customer</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td><span className={`badge ${u.is_active ? "badge-ok" : "badge-danger"}`}>{u.is_active ? "active" : "disabled"}</span></td>
                    <td>{u.license_count}</td>
                    <td>{fmtDate(u.created_at)}</td>
                    <td>
                      <div className="row wrap" style={{ gap: ".4rem" }}>
                        <button className="btn btn-sm" onClick={() => resetPw(u)}>Reset PW</button>
                        {!u.is_self && (
                          <button className="btn btn-sm" onClick={() => toggleActive(u)}>{u.is_active ? "Disable" : "Enable"}</button>
                        )}
                        {!u.is_self && <button className="btn btn-danger btn-sm" onClick={() => del(u)}>Delete</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function AddUser({ onDone, onError }) {
  const [form, setForm] = useState({ name: "", email: "", company: "", phone: "", role: "customer", password: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setBusy(true);
    try { await api("/admin/users", { method: "POST", body: form }); onDone(); }
    catch (err) { onError(err.message); }
    finally { setBusy(false); }
  }
  return (
    <form className="card card-pad-lg" onSubmit={submit} style={{ marginBottom: "1.5rem" }}>
      <h3 style={{ marginTop: 0 }}>Add a user</h3>
      <div className="grid-2" style={{ gap: ".75rem" }}>
        <label className="field"><span>Name *</span><input value={form.name} onChange={set("name")} required placeholder="Your full name" /></label>
        <label className="field"><span>Email *</span><input type="email" value={form.email} onChange={set("email")} required placeholder="you@zonaltech.co.ke" /></label>
      </div>
      <div className="grid-2" style={{ gap: ".75rem" }}>
        <label className="field"><span>Company</span><input value={form.company} onChange={set("company")} placeholder="Zonal Tech Ltd" /></label>
        <label className="field"><span>Role</span>
          <select value={form.role} onChange={set("role")}><option value="customer">customer</option><option value="admin">admin</option></select>
        </label>
      </div>
      <label className="field"><span>Temporary password * <small style={{ fontWeight: 400 }}>(min 8)</small></span>
        <input type="text" value={form.password} onChange={set("password")} required minLength={8} placeholder="Share this with the user" /></label>
      <button className="btn btn-primary" disabled={busy}>{busy ? <span className="spinner" /> : "Create user"}</button>
    </form>
  );
}
