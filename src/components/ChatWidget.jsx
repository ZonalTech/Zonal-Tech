import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import Markdown from "./Markdown.jsx";
import Icon from "./Icon.jsx";

const GREETING = {
  role: "assistant",
  content: "Hi! I'm the Zonal Tech assistant. Ask me about our software (POS, ERPNext, HR & payroll, time & attendance), web & hosting services, M-Pesa payments, or licence activation.",
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, open, busy]);

  async function send(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const history = messages.filter((m) => m !== GREETING).map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setBusy(true);
    try {
      const { reply } = await api("/assistant", { method: "POST", auth: false, body: { message: text, history } });
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Sorry — I couldn't reach the server. Please try again, or use the Contact page." }]);
    } finally { setBusy(false); }
  }

  const SUGGESTIONS = ["How much is ZT POS?", "How do I activate my licence?", "How do I pay?"];

  return (
    <>
      <button className="chat-fab" onClick={() => setOpen((o) => !o)} aria-label="Chat with us">
        <Icon name={open ? "x" : "chat"} size={24} />
      </button>

      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            <div className="row" style={{ gap: ".5rem" }}>
              <span className="chat-dot" /> <strong>Zonal Tech Assistant</strong>
            </div>
            <button className="chat-x" onClick={() => setOpen(false)} aria-label="Close"><Icon name="x" size={16} /></button>
          </div>

          <div className="chat-body" ref={bodyRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.role === "assistant" ? <Markdown text={m.content} /> : m.content}
              </div>
            ))}
            {busy && <div className="chat-msg assistant"><span className="spinner" /></div>}
            {messages.length === 1 && !busy && (
              <div className="chat-suggest">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => { setInput(s); setTimeout(() => send(), 0); }}>{s}</button>
                ))}
              </div>
            )}
          </div>

          <form className="chat-input" onSubmit={send}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" autoFocus />
            <button className="btn btn-primary btn-sm" disabled={!input.trim() || busy}>Send</button>
          </form>
          <div className="chat-foot">Answers are AI-generated. For account issues, <a href="/contact">contact us</a>.</div>
        </div>
      )}
    </>
  );
}
