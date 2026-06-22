/**
 * Server-side Ed25519 license signing.
 *
 * This is the authoritative, automated counterpart to the in-browser License
 * Generator (`src/lib/license.js`). It MUST produce byte-identical tokens for
 * the same payload so that licences issued by the portal and licences signed
 * manually in the browser both validate against the same public key — and
 * against the verifier shipped inside each product (e.g. zt-pos/license.py).
 *
 * Token format (JWT-style):
 *
 *     <payload_b64url>.<signature_b64url>
 *
 * The signature is computed over the ASCII bytes of `payload_b64url`; the
 * verifier never re-serialises the JSON.
 */
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";

// @noble/ed25519 v2 needs a SHA-512 implementation wired in once.
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

/**
 * The vendor's signing seed (32-byte Ed25519 private key, base64).
 *
 * Defaults to the SAME demo seed the browser tool ships with, so the whole
 * thing works out of the box and manual + automated licences interoperate.
 * In production set LICENSE_SEED_B64 to a fresh secret seed and paste the
 * matching public key into each product's LICENSE_PUBLIC_KEY.
 */
export const DEMO_SEED_B64 = "1ylkCxYTptRZv08TZAkUd8RD8QvxYigX9WNr9SrLYUE=";
const SEED_B64 = process.env.LICENSE_SEED_B64 || DEMO_SEED_B64;

// --- base64 helpers (raw bytes <-> string) --------------------------------
function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}
function base64ToBytes(b64) {
  const norm = b64.replace(/-/g, "+").replace(/_/g, "/").trim();
  return new Uint8Array(Buffer.from(norm, "base64"));
}
const toBase64Url = (b64) => b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const bytesToBase64Url = (bytes) => toBase64Url(bytesToBase64(bytes));

// --- key management --------------------------------------------------------
function seedBytes(seedB64) {
  const bytes = base64ToBytes(seedB64);
  if (bytes.length !== 32) throw new Error(`Seed must be 32 bytes (got ${bytes.length}).`);
  return bytes;
}

/** The public key (base64, 32 bytes) for the active seed — paste into apps. */
export function publicKeyB64() {
  return bytesToBase64(ed.getPublicKey(seedBytes(SEED_B64)));
}

export const usingDemoSeed = () => SEED_B64 === DEMO_SEED_B64;

// --- license building ------------------------------------------------------

/**
 * Build a signed license token.
 *
 * @param {object} fields  { app, customer, uid, edition, issued, expires }
 *                         `uid` is the account/user identifier the licence is
 *                         bound to (replaces the old per-device machine_id).
 *                         `expires` may be "" / null for a perpetual licence.
 * @param {string} wrapper label used in the BEGIN/END lines (cosmetic)
 * @returns {{ token: string, payload: object, payloadB64: string }}
 */
export function buildLicense(fields, wrapper = "ZT LICENSE") {
  // Accept `uid` (current) or `machineId` (legacy callers) interchangeably.
  const { app, customer, edition, issued, expires } = fields;
  const uid = fields.uid ?? fields.machineId;
  if (!uid || !String(uid).trim()) throw new Error("UID is required.");
  if (!customer || !String(customer).trim()) throw new Error("Customer is required.");

  const payload = { v: 1, uid: String(uid).trim() };
  if (app && String(app).trim()) payload.app = String(app).trim();
  payload.customer = String(customer).trim();
  payload.edition = String(edition || "standard").trim();
  payload.issued = issued;
  if (expires && String(expires).trim()) payload.expires = String(expires).trim();

  const payloadB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = ed.sign(new TextEncoder().encode(payloadB64), seedBytes(SEED_B64));
  const body = `${payloadB64}.${bytesToBase64Url(signature)}`;

  const label = (wrapper || "ZT LICENSE").trim().toUpperCase();
  const token = `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
  return { token, payload, payloadB64 };
}
