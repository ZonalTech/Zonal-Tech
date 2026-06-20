import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";

const FAQS = [
  { q: "How do I buy a licence?", a: "Create a free account, pick a service and plan, then pay with M-Pesa. Your signed licence is issued automatically the moment payment clears — copy it from the checkout screen or your dashboard." },
  { q: "How do I pay?", a: "All payments use M-Pesa (Safaricom STK Push). Enter your phone number at checkout and approve the prompt on your phone. No cards needed." },
  { q: "How do I activate ZT POS?", a: "Open the app's activation screen and note its Machine ID (e.g. 6DD4-DF54-3804-ADC6). Buy a licence for that Machine ID, then paste the licence token into the activation box. The app unlocks instantly — and works offline afterwards." },
  { q: "Can I use one licence on multiple devices?", a: "Device-locked products like ZT POS bind each licence to one Machine ID, so buy one per device (or an Enterprise plan). Subscription services such as hosting and ERPNext are account-bound, not device-bound." },
  { q: "How do renewals work?", a: "Renew anytime from your dashboard. Renew before expiry and the new term stacks on top of the time you have left — you're never penalised for paying early." },
  { q: "What support do I get?", a: "Every plan includes a Service Level Agreement matched to its edition — Standard, Professional or Enterprise — covering response times, support hours and uptime targets. You review and accept your SLA from the dashboard after purchase." },
  { q: "I need a refund or have a billing issue.", a: "Contact us with your order number via the Contact page or email support@zonaltech.co.ke and we'll sort it out." },
];

const TIERS = [
  { name: "Standard", uptime: "99.0%", response: "24 business hrs", channels: "Email", hours: "Mon–Fri, 8–5 EAT" },
  { name: "Professional", uptime: "99.5%", response: "8 business hrs", channels: "Email + Phone", hours: "Mon–Sat, 8–6 EAT" },
  { name: "Enterprise", uptime: "99.9%", response: "2 hours", channels: "Dedicated line", hours: "24 / 7" },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="faq-item">
      <button className="faq-q" onClick={() => setOpen((o) => !o)}>
        <span>{q}</span><span className="faq-ico">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="faq-a">{a}</div>}
    </div>
  );
}

export default function Support() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Customer support</span>
          <h2>How can we help?</h2>
          <p>Browse common questions, check support levels, or reach our team. The chat assistant (bottom-right) answers instantly.</p>
        </div>

        <div className="grid-3" style={{ marginBottom: "3rem" }}>
          <Link to="/contact" className="card service-card">
            <div className="ico"><Icon name="inbox" size={22} /></div><h3>Contact us</h3>
            <p>Send a message to our team for anything not covered here.</p>
          </Link>
          <a href="mailto:support@zonaltech.co.ke" className="card service-card">
            <div className="ico"><Icon name="mail" size={22} /></div><h3>Email support</h3>
            <p>support@zonaltech.co.ke — we reply within your plan's SLA.</p>
          </a>
          <Link to="/dashboard" className="card service-card">
            <div className="ico"><Icon name="dashboard" size={22} /></div><h3>Your dashboard</h3>
            <p>Manage licences, devices, renewals and agreements.</p>
          </Link>
        </div>

        <h2 style={{ marginBottom: "1.2rem" }}>Frequently asked questions</h2>
        <div className="card" style={{ padding: ".5rem 1.25rem", marginBottom: "3rem" }}>
          {FAQS.map((f) => <FaqItem key={f.q} {...f} />)}
        </div>

        <h2 style={{ marginBottom: "1.2rem" }}>Support levels</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Edition</th><th>Target uptime</th><th>First response</th><th>Channels</th><th>Hours</th></tr></thead>
            <tbody>
              {TIERS.map((t) => (
                <tr key={t.name}>
                  <td><strong>{t.name}</strong></td><td>{t.uptime}</td><td>{t.response}</td><td>{t.channels}</td><td>{t.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: ".8rem" }}>Support level is set by the plan edition you purchase. See your exact agreement in your dashboard after buying.</p>
      </div>
    </section>
  );
}
