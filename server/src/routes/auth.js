/**
 * /api/auth/* — registration, login, session, password reset.
 */
import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { one, q } from "../db.js";
import { signToken, publicUser, requireAuth } from "../auth.js";

const router = Router();
const norm = (e) => String(e || "").trim().toLowerCase();

router.post("/register", async (req, res) => {
  const { name, email, company, phone, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: "Name, email and password are required." });
  if (String(password).length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters." });

  const e = norm(email);
  if (await one("SELECT 1 FROM users WHERE email=$1", [e]))
    return res.status(409).json({ error: "An account with that email already exists." });

  const hash = await bcrypt.hash(password, 10);
  const user = await one(
    `INSERT INTO users (name, email, company, phone, password_hash, role)
     VALUES ($1,$2,$3,$4,$5,'customer') RETURNING *`,
    [String(name).trim(), e, company || null, phone || null, hash]
  );
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = await one("SELECT * FROM users WHERE email=$1", [norm(email)]);
  if (!user || !(await bcrypt.compare(String(password || ""), user.password_hash)))
    return res.status(401).json({ error: "Wrong email or password." });
  if (!user.is_active) return res.status(403).json({ error: "This account is disabled." });
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post("/forgot", async (req, res) => {
  const e = norm(req.body?.email);
  const user = await one("SELECT * FROM users WHERE email=$1", [e]);
  // Always 200 so we don't leak which emails exist.
  if (!user) return res.json({ message: "If that email is registered, a reset link has been sent." });

  const token = crypto.randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h
  await q("UPDATE users SET reset_token=$1, reset_expires=$2 WHERE id=$3", [token, expires, user.id]);

  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
  const resetUrl = `${base}/reset-password?token=${token}`;

  // No SMTP wired in this build — return the URL in dev so the flow is testable.
  // (When you add email, send `resetUrl` and drop it from the response.)
  const devMode = !process.env.SMTP_HOST;
  console.log(`[auth] password reset for ${e}: ${resetUrl}`);
  res.json({
    message: "If that email is registered, a reset link has been sent.",
    ...(devMode ? { reset_url: resetUrl } : {}),
  });
});

router.post("/reset", async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: "Token and new password are required." });
  if (String(password).length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters." });

  const user = await one(
    "SELECT * FROM users WHERE reset_token=$1 AND reset_expires > now()",
    [token]
  );
  if (!user) return res.status(400).json({ error: "This reset link is invalid or has expired." });

  const hash = await bcrypt.hash(password, 10);
  const updated = await one(
    "UPDATE users SET password_hash=$1, reset_token=NULL, reset_expires=NULL, must_change_password=FALSE WHERE id=$2 RETURNING *",
    [hash, user.id]
  );
  res.json({ token: signToken(updated), user: publicUser(updated) });
});

// Logged-in password change. Used both for ordinary changes and to satisfy the
// "you must set a new password" gate after a first login on a temporary one.
router.post("/change-password", requireAuth, async (req, res) => {
  const { current_password, password } = req.body || {};
  if (!current_password || !password)
    return res.status(400).json({ error: "Your current and new passwords are required." });
  if (String(password).length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters." });

  const user = await one("SELECT * FROM users WHERE id=$1", [req.user.id]);
  if (!user || !(await bcrypt.compare(String(current_password), user.password_hash)))
    return res.status(401).json({ error: "Your current password is incorrect." });
  if (await bcrypt.compare(String(password), user.password_hash))
    return res.status(400).json({ error: "Please choose a password different from your current one." });

  const hash = await bcrypt.hash(password, 10);
  const updated = await one(
    "UPDATE users SET password_hash=$1, must_change_password=FALSE WHERE id=$2 RETURNING *",
    [hash, user.id]
  );
  res.json({ token: signToken(updated), user: publicUser(updated) });
});

export default router;
