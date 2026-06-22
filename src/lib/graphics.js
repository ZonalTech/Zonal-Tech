/**
 * Deterministic logo / graphics builder.
 *
 * The AI orchestration layer (server `/api/generate/design`) chooses the design
 * *parameters* — palette, shape, font, layout — and returns them as structured
 * JSON. This module turns those parameters into a crisp, resolution-independent
 * SVG. Keeping rendering deterministic (vs. asking an image model for raw
 * pixels) means logos are sharp at any size, on-brand, and cheap to produce.
 *
 * PNG / JPEG are produced from this SVG in the browser via <canvas> — see
 * `rasterize()` below — so the whole pipeline needs no server image deps.
 */

// ---- palettes (fallbacks; the AI usually supplies its own) ----------------
export const PALETTES = {
  zonal:    { bg: "#0B1F3A", fg: "#FFFFFF", accent: "#2DD4BF" },
  emerald:  { bg: "#064E3B", fg: "#ECFDF5", accent: "#34D399" },
  sunset:   { bg: "#7C2D12", fg: "#FFF7ED", accent: "#FB923C" },
  grape:    { bg: "#3B0764", fg: "#FAF5FF", accent: "#C084FC" },
  slate:    { bg: "#0F172A", fg: "#F8FAFC", accent: "#38BDF8" },
  rose:     { bg: "#881337", fg: "#FFF1F2", accent: "#FB7185" },
  mono:     { bg: "#111111", fg: "#FFFFFF", accent: "#9CA3AF" },
};

export const SHAPES = ["circle", "rounded", "square", "hexagon", "shield", "squircle"];
export const LAYOUTS = ["badge", "wordmark", "stacked"];
export const FONT_STACKS = {
  geometric: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  grotesk:   "'Inter', 'Segoe UI', system-ui, sans-serif",
  serif:     "'Georgia', 'Times New Roman', serif",
  rounded:   "'Trebuchet MS', 'Segoe UI', sans-serif",
  mono:      "'SFMono-Regular', 'Consolas', monospace",
};

/** Default design used before the AI responds / as a hard fallback. */
export const DEFAULT_DESIGN = {
  shape: "rounded",
  layout: "badge",
  font: "geometric",
  weight: 700,
  palette: PALETTES.zonal,
  gradient: true,
  letterSpacing: 0,
};

// ---- helpers --------------------------------------------------------------

/** Derive up to 3 initials from a brand name or explicit initials string. */
export function initialsFrom(input, max = 3) {
  const s = String(input || "").trim();
  if (!s) return "ZT";
  // If the user typed something short with no spaces, treat it as initials.
  if (!/\s/.test(s) && s.length <= max) return s.toUpperCase();
  const words = s.split(/\s+/).filter(Boolean);
  return words.slice(0, max).map((w) => w[0]).join("").toUpperCase();
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function shapePath(shape, size) {
  const s = size, r = s / 2, c = s / 2;
  switch (shape) {
    case "circle":
      return `<circle cx="${c}" cy="${c}" r="${r}" fill="url(#bg)"/>`;
    case "square":
      return `<rect x="0" y="0" width="${s}" height="${s}" fill="url(#bg)"/>`;
    case "rounded":
      return `<rect x="0" y="0" width="${s}" height="${s}" rx="${s * 0.22}" fill="url(#bg)"/>`;
    case "squircle":
      return `<rect x="0" y="0" width="${s}" height="${s}" rx="${s * 0.38}" fill="url(#bg)"/>`;
    case "hexagon": {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        return `${(c + r * Math.cos(a)).toFixed(1)},${(c + r * Math.sin(a)).toFixed(1)}`;
      }).join(" ");
      return `<polygon points="${pts}" fill="url(#bg)"/>`;
    }
    case "shield":
      return `<path d="M${c} 4 L${s - 6} ${s * 0.22} L${s - 6} ${s * 0.6} `
           + `Q${s - 6} ${s - 8} ${c} ${s - 4} Q6 ${s - 8} 6 ${s * 0.6} `
           + `L6 ${s * 0.22} Z" fill="url(#bg)"/>`;
    default:
      return `<rect x="0" y="0" width="${s}" height="${s}" rx="${s * 0.22}" fill="url(#bg)"/>`;
  }
}

/** Normalise an AI / user design object over the defaults. */
export function normalizeDesign(d = {}) {
  const palette =
    d.palette && d.palette.bg && d.palette.fg
      ? { accent: d.palette.fg, ...d.palette }
      : PALETTES[d.paletteName] || DEFAULT_DESIGN.palette;
  return {
    shape: SHAPES.includes(d.shape) ? d.shape : DEFAULT_DESIGN.shape,
    layout: LAYOUTS.includes(d.layout) ? d.layout : DEFAULT_DESIGN.layout,
    font: FONT_STACKS[d.font] ? d.font : DEFAULT_DESIGN.font,
    weight: Number(d.weight) || DEFAULT_DESIGN.weight,
    palette,
    gradient: d.gradient !== false,
    letterSpacing: Number(d.letterSpacing) || 0,
    tagline: d.tagline ? String(d.tagline).slice(0, 48) : "",
  };
}

// ---- the builder ----------------------------------------------------------

/**
 * Build an SVG string from initials/brand + a design object.
 *
 * @param {object} opts
 * @param {string} opts.text     brand name or initials
 * @param {object} opts.design   design params (see normalizeDesign)
 * @param {number} opts.size     canvas size in px (square); default 512
 * @returns {{ svg: string, initials: string, design: object }}
 */
export function buildSVG({ text, design, size = 512 } = {}) {
  const d = normalizeDesign(design);
  const initials = initialsFrom(text);
  const { bg, fg, accent } = d.palette;
  const fontStack = FONT_STACKS[d.font];
  const S = size;

  const grad = d.gradient
    ? `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
         <stop offset="0" stop-color="${esc(bg)}"/>
         <stop offset="1" stop-color="${esc(accent)}"/>
       </linearGradient>`
    : `<linearGradient id="bg"><stop offset="0" stop-color="${esc(bg)}"/>
         <stop offset="1" stop-color="${esc(bg)}"/></linearGradient>`;

  const isWordmark = d.layout === "wordmark";
  const isStacked = d.layout === "stacked";

  // Badge geometry — the mark fills the square; wordmark/stacked sit beside text.
  const markSize = isWordmark ? S * 0.42 : S;
  const fontSize = isWordmark ? markSize * 0.5 : S * 0.42;

  const markGroup = `
    <g>
      ${shapePath(d.shape, markSize)}
      <text x="${markSize / 2}" y="${markSize / 2}" fill="${esc(fg)}"
            font-family="${fontStack}" font-size="${fontSize}" font-weight="${d.weight}"
            text-anchor="middle" dominant-baseline="central"
            letter-spacing="${d.letterSpacing}">${esc(initials)}</text>
    </g>`;

  let body;
  if (isWordmark) {
    const word = esc((text || initials).trim());
    const wordSize = S * 0.16;
    body = `
      <g transform="translate(${S * 0.06}, ${(S - markSize) / 2})">${markGroup}</g>
      <text x="${S * 0.06 + markSize + S * 0.05}" y="${S / 2}" fill="${esc(bg)}"
            font-family="${fontStack}" font-size="${wordSize}" font-weight="${d.weight}"
            dominant-baseline="central">${word}</text>`;
  } else if (isStacked) {
    const word = esc((text || initials).trim());
    body = `
      <g transform="translate(${(S - S * 0.62) / 2}, ${S * 0.12})"><g transform="scale(${0.62})">${markGroup.replace(/markSize/g, "")}</g></g>
      <text x="${S / 2}" y="${S * 0.86}" fill="${esc(bg)}"
            font-family="${fontStack}" font-size="${S * 0.1}" font-weight="${d.weight}"
            text-anchor="middle">${word}</text>`;
  } else {
    body = markGroup;
  }

  const tagline = d.tagline && !isWordmark
    ? `<text x="${S / 2}" y="${S * 0.9}" fill="${esc(fg)}" opacity="0.85"
            font-family="${fontStack}" font-size="${S * 0.06}" text-anchor="middle">${esc(d.tagline)}</text>`
    : "";

  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" role="img" aria-label="${esc(initials)} logo">
  <defs>${grad}</defs>
  <rect width="${S}" height="${S}" fill="${isWordmark || isStacked ? "#FFFFFF" : "none"}"/>
  ${body}
  ${tagline}
</svg>`;

  return { svg, initials, design: d };
}

// ---- browser rasterization (PNG / JPEG) -----------------------------------

/**
 * Rasterize an SVG string to a PNG or JPEG data URL using <canvas>.
 * Browser-only (needs `document` / `Image`). Returns a Promise<dataURL>.
 *
 * @param {string} svg     the SVG markup
 * @param {object} opts    { format: 'png'|'jpeg', size, quality, background }
 */
export function rasterize(svg, { format = "png", size = 1024, quality = 0.92, background = "#FFFFFF" } = {}) {
  return new Promise((resolve, reject) => {
    const mime = format === "jpeg" || format === "jpg" ? "image/jpeg" : "image/png";
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      // JPEG has no alpha — paint a background so it isn't black.
      if (mime === "image/jpeg") {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, size, size);
      }
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      try { resolve(canvas.toDataURL(mime, quality)); }
      catch (e) { reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to render SVG.")); };
    img.src = url;
  });
}

/** Trigger a browser download of a data URL or text blob. */
export function download(filename, dataOrUrl, mime) {
  const a = document.createElement("a");
  if (mime) {
    const blob = new Blob([dataOrUrl], { type: mime });
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } else {
    a.href = dataOrUrl;
    a.download = filename;
    a.click();
  }
}
