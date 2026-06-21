/**
 * Zonal Tech backend entrypoint.
 *
 * Runs as a single Zonal Cloud "fullstack" Node app:
 *   - serves the JSON API under /api/*
 *   - serves the built React SPA (../dist) for everything else
 *   - listens on $PORT (Zonal Cloud injects it; defaults to 8000 for local dev,
 *     matching the Vite proxy in vite.config.js)
 *
 * The database is reached via $DATABASE_URL (auto-provisioned by Zonal Cloud
 * for full-stack apps). Schema + demo seed are created on first boot.
 */
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { init, one } from "./db.js";
import authRoutes from "./routes/auth.js";
import publicRoutes from "./routes/public.js";
import meRoutes, { checkoutRouter, ordersRouter, paymentsRouter } from "./routes/me.js";
import adminRoutes from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "..", "..", "dist");
const PORT = Number(process.env.PORT) || 8000;

const app = express();
app.use(express.json({ limit: "1mb" }));

// --- API ---
// Order matters: unguarded routes first, then the auth-guarded routers mounted
// at explicit prefixes so their router-level guards never see unrelated paths.
const api = express.Router();
api.get("/health", (_req, res) => res.json({ ok: true }));

// Installer download. No artifact store in this build — redirect to the
// service's configured download_url, or 404 if none is set yet.
api.get("/download/:key", async (req, res) => {
  const s = await one("SELECT download_url, name FROM services WHERE key=$1", [req.params.key]);
  if (!s) return res.status(404).json({ error: "Service not found." });
  if (!s.download_url)
    return res.status(404).json({ error: `No installer is published for ${s.name} yet.` });
  res.redirect(s.download_url);
});

api.use("/auth", authRoutes);
api.use(publicRoutes);   // /services, /status, /contact, /assistant, /payment-methods

// Auth-guarded, each at its own prefix.
api.use("/checkout", checkoutRouter);
api.use("/orders", ordersRouter);
api.use("/payments", paymentsRouter);
api.use("/me", meRoutes);
api.use("/admin", adminRoutes);

// Unknown /api routes → JSON 404 (so the SPA fallback never swallows them).
api.use((_req, res) => res.status(404).json({ error: "Not found." }));

app.use("/api", api);

// --- static SPA ---
if (existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(DIST, "index.html")));
} else {
  app.get("/", (_req, res) =>
    res
      .status(200)
      .send("Zonal Tech API is running. Build the frontend (npm run build) to serve the app here."));
}

// --- error handler (last) ---
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
});

init()
  .then(() => {
    app.listen(PORT, () => console.log(`[zonal-tech] listening on :${PORT}`));
  })
  .catch((e) => {
    console.error("Failed to initialise database:", e);
    process.exit(1);
  });
