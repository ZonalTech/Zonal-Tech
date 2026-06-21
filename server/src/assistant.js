/**
 * The support assistant. Calls the configured provider (Mistral / Gemini /
 * Claude) with the OpenAI-style or provider-native chat API. When AI is
 * disabled or unconfigured, falls back to a canned, helpful reply so the chat
 * widget always works.
 */
import { getSetting, DEFAULT_AI_SETTINGS, DEFAULT_AI_INSTRUCTIONS } from "./db.js";

const FALLBACK =
  "Thanks for reaching out! I'm the Zonal Tech assistant. I can help with our " +
  "business software — POS, ERPNext, HR & payroll, time & attendance — plus web " +
  "development, e-commerce and hosting, paying by M-Pesa, and activating a licence " +
  "on a device. For anything I can't answer, email support@zonaltech.co.ke and our " +
  "team will help.";

/**
 * @param {object} cfg     resolved AI settings (provider, base_url, model, api_key, instructions, enabled)
 * @param {string} message latest user message
 * @param {Array}  history [{ role, content }]
 * @returns {{ ok: boolean, reply: string, mode: string, note?: string }}
 */
export async function chat(cfg, message, history = []) {
  const instructions = (cfg.instructions || "").trim() || DEFAULT_AI_INSTRUCTIONS;
  if (!cfg.enabled) return { ok: false, reply: FALLBACK, mode: "fallback", note: "AI assistant is disabled." };
  if (!cfg.api_key) return { ok: false, reply: FALLBACK, mode: "fallback", note: "No API key configured." };

  const msgs = [
    { role: "system", content: instructions },
    ...history.filter((h) => h && h.role && h.content).map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  try {
    if (cfg.provider === "gemini") return await callGemini(cfg, instructions, history, message);
    if (cfg.provider === "claude") return await callClaude(cfg, instructions, history, message);
    return await callOpenAICompatible(cfg, msgs); // mistral + any OpenAI-style
  } catch (e) {
    return { ok: false, reply: FALLBACK, mode: "error", note: e.message };
  }
}

async function callOpenAICompatible(cfg, messages) {
  const base = (cfg.base_url || "https://api.mistral.ai/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.api_key}` },
    body: JSON.stringify({ model: cfg.model, messages, temperature: 0.3 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Provider returned ${res.status}`);
  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("Empty response from provider.");
  return { ok: true, reply, mode: cfg.provider || "openai" };
}

async function callClaude(cfg, system, history, message) {
  const base = (cfg.base_url || "https://api.anthropic.com").replace(/\/$/, "");
  const messages = [
    ...history.filter((h) => h && h.role && h.content).map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.api_key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: cfg.model, system, max_tokens: 1024, messages }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Provider returned ${res.status}`);
  const reply = data?.content?.[0]?.text?.trim();
  if (!reply) throw new Error("Empty response from provider.");
  return { ok: true, reply, mode: "claude" };
}

async function callGemini(cfg, system, history, message) {
  const base = (cfg.base_url || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
  const contents = [
    ...history.filter((h) => h && h.role && h.content).map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];
  const url = `${base}/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.api_key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Provider returned ${res.status}`);
  const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("").trim();
  if (!reply) throw new Error("Empty response from provider.");
  return { ok: true, reply, mode: "gemini" };
}

/** Load saved AI settings merged over defaults. */
export async function aiSettings() {
  return { ...DEFAULT_AI_SETTINGS, ...(await getSetting("ai", {})) };
}
