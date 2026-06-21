/**
 * JWT + bcrypt helpers and route guards.
 */
import jwt from "jsonwebtoken";
import { one } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "zonal-tech-dev-secret-change-me";
const JWT_TTL = process.env.JWT_TTL || "30d";

export function signToken(user) {
  return jwt.sign({ uid: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_TTL });
}

/** Shape a user row for the API (never leak password_hash / reset_token). */
export function publicUser(u, opts = {}) {
  if (!u) return null;
  const out = {
    id: u.id,
    name: u.name,
    email: u.email,
    company: u.company || null,
    phone: u.phone || null,
    role: u.role,
    is_active: u.is_active,
    created_at: u.created_at,
  };
  if (u.license_count != null) out.license_count = Number(u.license_count);
  if (opts.is_self != null) out.is_self = opts.is_self;
  return out;
}

async function userFromHeader(req) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    const payload = jwt.verify(m[1], JWT_SECRET);
    const u = await one("SELECT * FROM users WHERE id=$1", [payload.uid]);
    if (!u || !u.is_active) return null;
    return u;
  } catch {
    return null;
  }
}

/** Require a logged-in, active user. Attaches req.user. */
export async function requireAuth(req, res, next) {
  const u = await userFromHeader(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  req.user = u;
  next();
}

/** Require an admin. Attaches req.user. */
export async function requireAdmin(req, res, next) {
  const u = await userFromHeader(req);
  if (!u) return res.status(401).json({ error: "Not authenticated." });
  if (u.role !== "admin") return res.status(403).json({ error: "Admin access required." });
  req.user = u;
  next();
}
