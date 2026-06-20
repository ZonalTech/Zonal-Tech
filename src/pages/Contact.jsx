import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import Icon from "../components/Icon.jsx";

const CATEGORIES = [
  { v: "general", l: "General enquiry" },
  { v: "sales", l: "Sales & pricing" },
  { v: "support", l: "Technical support" },
  { v: "billing", l: "Billing & payments" },
];

export default function Contact() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || "", email: user?.email || "",
    category: "general", subject: "", message: "",
  });
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api("/contact", { method: "POST", auth: false, body: form });
      setDone(true);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: "60rem" }}>
        <div className="section-head">
          <span className="eyebrow">Contact us</span>
          <h2>We'd love to hear from you</h2>
          <p>Questions about pricing, a custom project, or your licence? Send us a message.</p>
        </div>

        <div className="checkout-grid">
          <div className="card card-pad-lg">
            {done ? (
              <div className="pay-status">
                <div className="big" style={{ color: "var(--ok)" }}><Icon name="check" size={44} /></div>
                <h3>Message sent</h3>
                <p>Thanks, {form.name.split(" ")[0] || "there"}! Our team will get back to you at {form.email} shortly.</p>
                <button className="btn" onClick={() => { setDone(false); setForm({ ...form, subject: "", message: "" }); }}>
                  Send another
                </button>
              </div>
            ) : (
              <form onSubmit={submit}>
                {error && <div className="alert alert-error">{error}</div>}
                <div className="grid-2" style={{ gap: ".75rem" }}>
                  <label className="field"><span>Name *</span>
                    <input value={form.name} onChange={set("name")} required placeholder="Your name" /></label>
                  <label className="field"><span>Email *</span>
                    <input type="email" value={form.email} onChange={set("email")} required placeholder="you@zonaltech.co.ke" /></label>
                </div>
                <div className="grid-2" style={{ gap: ".75rem" }}>
                  <label className="field"><span>Topic</span>
                    <select value={form.category} onChange={set("category")}>
                      {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
                    </select>
                  </label>
                  <label className="field"><span>Subject</span>
                    <input value={form.subject} onChange={set("subject")} placeholder="How can we help?" /></label>
                </div>
                <label className="field"><span>Message *</span>
                  <textarea rows={6} value={form.message} onChange={set("message")} required placeholder="Tell us what you need…" /></label>
                <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
                  {busy ? <span className="spinner" /> : "Send message"}
                </button>
              </form>
            )}
          </div>

          <aside className="stack">
            <div className="card">
              <h3 style={{ marginTop: 0 }}><Icon name="mail" size={18} /> Email</h3>
              <p style={{ margin: 0 }}><a href="mailto:support@zonaltech.co.ke" style={{ color: "var(--accent)" }}>support@zonaltech.co.ke</a></p>
            </div>
            <div className="card">
              <h3 style={{ marginTop: 0 }}><Icon name="chat" size={18} /> Instant answers</h3>
              <p style={{ margin: 0 }}>Use the chat assistant (bottom-right) for quick questions on pricing, payments and licensing.</p>
            </div>
            <div className="card">
              <h3 style={{ marginTop: 0 }}><Icon name="lifebuoy" size={18} /> Already a customer?</h3>
              <p style={{ margin: 0 }}>Sign in and head to your dashboard to manage licences, devices and renewals — or open the Support page for FAQs.</p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
