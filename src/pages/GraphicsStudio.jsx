import { useMemo, useState } from "react";
import { api } from "../api.js";
import {
  buildSVG, rasterize, download,
  PALETTES, SHAPES, LAYOUTS, FONT_STACKS, initialsFrom, DEFAULT_DESIGN,
} from "../lib/graphics.js";
import CopyButton from "../components/CopyButton.jsx";
import Icon from "../components/Icon.jsx";
import "./Generator.css";

/**
 * AI-orchestrated logo / graphics studio.
 *
 * The user types a brand name + brief; the server's AI design endpoint returns
 * one or more structured design specs. We render each to crisp vector SVG here
 * and let the user export SVG, PNG or JPEG (rasterized in the browser via
 * <canvas> — no server image deps). Editing controls let them tweak the AI's
 * choices by hand.
 */
const PALETTE_NAMES = Object.keys(PALETTES);

export default function GraphicsStudio() {
  const [brand, setBrand] = useState("");
  const [brief, setBrief] = useState("");
  const [count, setCount] = useState(2);

  const [designs, setDesigns] = useState([]);     // AI-returned specs
  const [selected, setSelected] = useState(0);
  const [design, setDesign] = useState(DEFAULT_DESIGN);  // the active, editable design
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);

  const initials = useMemo(() => initialsFrom(brand || "ZT"), [brand]);
  const { svg } = useMemo(
    () => buildSVG({ text: brand || initials, design, size: 512 }),
    [brand, initials, design]
  );

  // Live preview as an object URL (sharper than inlining for large SVGs).
  const previewUrl = useMemo(
    () => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    [svg]
  );

  async function generate() {
    if (!brand.trim()) { setError("Enter a brand name first."); return; }
    setLoading(true); setError(null); setNote(null);
    try {
      const briefText = `${brand.trim()}${brief.trim() ? ` — ${brief.trim()}` : ""}`;
      const { designs: out, note: n } = await api("/generate/design",
        { method: "POST", auth: false, body: { brief: briefText, n: count } });
      if (!out?.length) throw new Error("No design returned.");
      setDesigns(out);
      setSelected(0);
      setDesign(out[0]);
      if (n) setNote(n);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function pick(i) { setSelected(i); setDesign(designs[i]); }

  // ---- manual edits -------------------------------------------------------
  const patch = (p) => setDesign((d) => ({ ...d, ...p }));
  const patchPalette = (p) => setDesign((d) => ({ ...d, palette: { ...d.palette, ...p } }));

  // ---- exports ------------------------------------------------------------
  const [busyExport, setBusyExport] = useState(null);
  const safeName = (brand || "logo").replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  function exportSVG() {
    download(`${safeName}.svg`, svg, "image/svg+xml");
  }
  async function exportRaster(format, size) {
    setBusyExport(`${format}${size}`);
    try {
      const url = await rasterize(svg, { format, size, background: "#FFFFFF" });
      download(`${safeName}-${size}.${format === "jpeg" ? "jpg" : "png"}`, url);
    } catch (e) { setError(e.message); }
    finally { setBusyExport(null); }
  }

  return (
    <section className="section generator" style={{ paddingTop: "2.5rem" }}>
      <div className="container">
        <div className="page-head">
          <div>
            <h1>Graphics Studio</h1>
            <p style={{ margin: 0 }}>
              AI-designed logos from your initials — export SVG, PNG or JPEG. Built on Zonal Tech.
            </p>
          </div>
        </div>

        <div className="grid-2">
          {/* ---- Brief + AI ---- */}
          <section className="card card-pad-lg">
            <div className="card-head"><h2>Brand brief</h2></div>

            <label className="field">
              <span>Brand name *</span>
              <input value={brand} onChange={(e) => setBrand(e.target.value)}
                placeholder="Tinega Coffee House" autoFocus />
              <small className="hint">Initials used in the mark: <strong className="mono">{initials}</strong></small>
            </label>
            <label className="field">
              <span>Brief (optional)</span>
              <textarea rows={3} value={brief} onChange={(e) => setBrief(e.target.value)}
                placeholder="Warm, premium speciality coffee; earthy tones; modern but friendly." />
            </label>
            <label className="field">
              <span>Variations</span>
              <div className="row wrap quick">
                {[1, 2, 3, 4].map((n) => (
                  <button key={n} className={`btn btn-sm ${count === n ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setCount(n)}>{n}</button>
                ))}
              </div>
            </label>

            <button className="btn btn-primary btn-block" onClick={generate} disabled={loading}>
              {loading ? "Designing…" : "Generate with AI"}
            </button>
            {note && <div className="alert alert-info mt">{note}</div>}
            {error && <div className="alert alert-error mt">{error}</div>}

            {designs.length > 1 && (
              <div className="row wrap mt" style={{ gap: ".5rem" }}>
                {designs.map((d, i) => (
                  <button key={i} onClick={() => pick(i)}
                    title={d.rationale || `Variation ${i + 1}`}
                    style={{
                      width: 56, height: 56, borderRadius: 10, cursor: "pointer",
                      border: selected === i ? "2px solid var(--accent, #2DD4BF)" : "1px solid #ccc",
                      background: d.palette?.bg, color: d.palette?.fg,
                      fontWeight: 700, fontSize: 18,
                    }}>{initials}</button>
                ))}
              </div>
            )}

            {design?.rationale && (
              <p className="hint mt" style={{ fontStyle: "italic" }}>“{design.rationale}”</p>
            )}
          </section>

          {/* ---- Preview ---- */}
          <section className="card card-pad-lg">
            <div className="card-head"><h2>Preview</h2></div>
            <div style={{
              display: "grid", placeItems: "center", background:
                "repeating-conic-gradient(#f4f4f5 0% 25%, #fff 0% 50%) 50% / 24px 24px",
              borderRadius: 14, padding: 18, minHeight: 280,
            }}>
              <img src={previewUrl} alt="logo preview"
                style={{ width: 240, height: 240, filter: "drop-shadow(0 6px 18px rgba(0,0,0,.18))" }} />
            </div>

            <div className="row wrap mt">
              <button className="btn btn-primary btn-sm" onClick={exportSVG}>
                <Icon name="download" /> SVG
              </button>
              <button className="btn btn-sm" onClick={() => exportRaster("png", 512)} disabled={busyExport}>
                PNG 512
              </button>
              <button className="btn btn-sm" onClick={() => exportRaster("png", 1024)} disabled={busyExport}>
                PNG 1024
              </button>
              <button className="btn btn-sm" onClick={() => exportRaster("jpeg", 1024)} disabled={busyExport}>
                JPEG 1024
              </button>
              <CopyButton text={svg} label="Copy SVG" className="btn btn-ghost btn-sm" />
            </div>
          </section>

          {/* ---- Manual refine ---- */}
          <section className="card card-pad-lg" style={{ gridColumn: "1 / -1" }}>
            <div className="card-head"><h2>Refine</h2></div>
            <div className="field-grid">
              <label className="field">
                <span>Shape</span>
                <select value={design.shape} onChange={(e) => patch({ shape: e.target.value })}>
                  {SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Layout</span>
                <select value={design.layout} onChange={(e) => patch({ layout: e.target.value })}>
                  {LAYOUTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Font</span>
                <select value={design.font} onChange={(e) => patch({ font: e.target.value })}>
                  {Object.keys(FONT_STACKS).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Weight</span>
                <input type="range" min="400" max="900" step="100"
                  value={design.weight} onChange={(e) => patch({ weight: Number(e.target.value) })} />
              </label>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>Background</span>
                <input type="color" value={design.palette.bg} onChange={(e) => patchPalette({ bg: e.target.value })} />
              </label>
              <label className="field">
                <span>Text</span>
                <input type="color" value={design.palette.fg} onChange={(e) => patchPalette({ fg: e.target.value })} />
              </label>
              <label className="field">
                <span>Accent</span>
                <input type="color" value={design.palette.accent || design.palette.fg}
                  onChange={(e) => patchPalette({ accent: e.target.value })} />
              </label>
              <label className="check" style={{ alignSelf: "end" }}>
                <input type="checkbox" checked={design.gradient !== false}
                  onChange={(e) => patch({ gradient: e.target.checked })} />
                Gradient
              </label>
            </div>

            <div className="row wrap quick mt">
              <span className="hint">Quick palettes:</span>
              {PALETTE_NAMES.map((name) => (
                <button key={name} className="btn btn-ghost btn-sm"
                  onClick={() => patchPalette(PALETTES[name])}
                  style={{ background: PALETTES[name].bg, color: PALETTES[name].fg }}>
                  {name}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
