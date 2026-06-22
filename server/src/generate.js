/**
 * AI-orchestrated logo / graphics design.
 *
 * Reuses the configured AI provider (Mistral / Gemini / Claude — same settings
 * as the support assistant) but here the model's job is narrow and structured:
 * given a brand brief, return a JSON *design spec* (palette, shape, font,
 * layout, tagline). The deterministic SVG builder on the client turns that spec
 * into crisp vector art, so the model never has to draw pixels.
 *
 * When AI is disabled / unconfigured / errors, we fall back to a deterministic
 * design derived from the brief so the studio always produces something.
 */
import { aiSettings } from "./assistant.js";

const SHAPES = ["circle", "rounded", "square", "hexagon", "shield", "squircle"];
const LAYOUTS = ["badge", "wordmark", "stacked"];
const FONTS = ["geometric", "grotesk", "serif", "rounded", "mono"];

const FALLBACK_PALETTES = [
  { bg: "#0B1F3A", fg: "#FFFFFF", accent: "#2DD4BF" },
  { bg: "#064E3B", fg: "#ECFDF5", accent: "#34D399" },
  { bg: "#7C2D12", fg: "#FFF7ED", accent: "#FB923C" },
  { bg: "#3B0764", fg: "#FAF5FF", accent: "#C084FC" },
  { bg: "#0F172A", fg: "#F8FAFC", accent: "#38BDF8" },
  { bg: "#881337", fg: "#FFF1F2", accent: "#FB7185" },
];

const SYSTEM = `You are a senior brand designer. Given a short brief, design a logo
mark built from the brand's initials. Respond with ONLY a compact JSON object —
no prose, no markdown fences — with this exact shape:
{
  "shape": one of ${JSON.stringify(SHAPES)},
  "layout": one of ${JSON.stringify(LAYOUTS)},
  "font": one of ${JSON.stringify(FONTS)},
  "weight": integer 400-900,
  "gradient": boolean,
  "letterSpacing": number -2..8,
  "palette": { "bg": "#RRGGBB", "fg": "#RRGGBB", "accent": "#RRGGBB" },
  "tagline": short string or "",
  "rationale": one short sentence
}
Choose colours with strong contrast between bg and fg. Match the mood of the brief.`;

const HEX = /^#[0-9a-fA-F]{6}$/;

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** A deterministic, brief-seeded design used when AI is unavailable. */
export function fallbackDesign(brief = "") {
  const h = hashStr(String(brief) || "brand");
  return {
    shape: SHAPES[h % SHAPES.length],
    layout: "badge",
    font: FONTS[(h >> 3) % FONTS.length],
    weight: 700,
    gradient: (h & 1) === 0,
    letterSpacing: 0,
    palette: FALLBACK_PALETTES[(h >> 5) % FALLBACK_PALETTES.length],
    tagline: "",
    rationale: "Generated locally (AI design not configured).",
    source: "fallback",
  };
}

/** Pull a JSON object out of a model reply that may be wrapped in prose/fences. */
function extractJSON(text) {
  if (!text) return null;
  let t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/,"").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try { return JSON.parse(t.slice(start, end + 1)); }
  catch { return null; }
}

/** Coerce a raw model object into a safe, validated design spec. */
function sanitize(raw, brief) {
  if (!raw || typeof raw !== "object") return fallbackDesign(brief);
  const fb = fallbackDesign(brief);
  const p = raw.palette || {};
  const palette = {
    bg: HEX.test(p.bg) ? p.bg : fb.palette.bg,
    fg: HEX.test(p.fg) ? p.fg : fb.palette.fg,
    accent: HEX.test(p.accent) ? p.accent : (HEX.test(p.fg) ? p.fg : fb.palette.accent),
  };
  return {
    shape: SHAPES.includes(raw.shape) ? raw.shape : fb.shape,
    layout: LAYOUTS.includes(raw.layout) ? raw.layout : fb.layout,
    font: FONTS.includes(raw.font) ? raw.font : fb.font,
    weight: Math.min(900, Math.max(400, Number(raw.weight) || 700)),
    gradient: raw.gradient !== false,
    letterSpacing: Math.min(8, Math.max(-2, Number(raw.letterSpacing) || 0)),
    palette,
    tagline: typeof raw.tagline === "string" ? raw.tagline.slice(0, 48) : "",
    rationale: typeof raw.rationale === "string" ? raw.rationale.slice(0, 160) : "",
    source: "ai",
  };
}

/**
 * Orchestrate a design for a brand brief.
 * @returns {{ design: object, note?: string }}
 */
export async function designLogo(brief, { count = 1 } = {}) {
  const cfg = await aiSettings();
  const prompt =
    `Brief: ${String(brief || "").slice(0, 400)}\n` +
    `Return the JSON design spec now.`;

  if (!cfg.enabled || !cfg.api_key) {
    return { design: fallbackDesign(brief), note: "AI design not configured — used a local design." };
  }

  try {
    const reply = await callProvider(cfg, SYSTEM, prompt);
    const design = sanitize(extractJSON(reply), brief);
    return { design };
  } catch (e) {
    return { design: fallbackDesign(brief), note: `AI error — used a local design (${e.message}).` };
  }
}

// --- thin provider call (mirrors assistant.js, structured single-shot) -----
async function callProvider(cfg, system, user) {
  if (cfg.provider === "gemini") {
    const base = (cfg.base_url || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
    const url = `${base}/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.api_key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Provider ${res.status}`);
    return data?.candidates?.[0]?.content?.parts?.map((x) => x.text).join("");
  }
  if (cfg.provider === "claude") {
    const base = (cfg.base_url || "https://api.anthropic.com").replace(/\/$/, "");
    const res = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": cfg.api_key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: cfg.model, system, max_tokens: 512, messages: [{ role: "user", content: user }] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Provider ${res.status}`);
    return data?.content?.[0]?.text;
  }
  // OpenAI-compatible (Mistral et al.)
  const base = (cfg.base_url || "https://api.mistral.ai/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.api_key}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Provider ${res.status}`);
  return data?.choices?.[0]?.message?.content;
}
