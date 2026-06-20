/**
 * License signing for Zone-framework apps.
 *
 * Mirrors the verifier in `apps/zt-pos/license.py`. A license token is:
 *
 *     <payload_b64url>.<signature_b64url>
 *
 * where `payload_b64url` is the URL-safe base64 (no padding) of the UTF-8 JSON
 * payload, and the Ed25519 signature is computed over the *ASCII bytes of
 * `payload_b64url`* (JWT-style — the verifier never re-serialises the JSON).
 *
 * The vendor holds the PRIVATE key here; the app ships only the matching PUBLIC
 * key and can verify but never forge. Keep the seed secret.
 */
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";

// @noble/ed25519 v2 needs a SHA-512 implementation wired in once.
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

// --- base64 helpers (raw bytes <-> string) --------------------------------
export function bytesToBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function base64ToBytes(b64) {
  const norm = b64.replace(/-/g, "+").replace(/_/g, "/").trim();
  const pad = norm + "=".repeat((4 - (norm.length % 4)) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const toBase64Url = (b64) => b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const bytesToBase64Url = (bytes) => toBase64Url(bytesToBase64(bytes));

// --- key management --------------------------------------------------------

/** Demo keypair, bundled so the tool works out of the box. The matching public
 * key is wired into each app's config. REPLACE before selling: generate a new
 * keypair here and paste the public key into the app's `LICENSE_PUBLIC_KEY`. */
export const DEMO_SEED_B64 = "1ylkCxYTptRZv08TZAkUd8RD8QvxYigX9WNr9SrLYUE=";

/** A fresh random 32-byte Ed25519 seed (the private key), base64-encoded. */
export function generateSeedB64() {
  const seed = ed.utils.randomSecretKey
    ? ed.utils.randomSecretKey()
    : ed.utils.randomPrivateKey();
  return bytesToBase64(seed);
}

/** Validate a base64 seed and return its 32 raw bytes, or throw. */
export function seedBytes(seedB64) {
  const bytes = base64ToBytes(seedB64);
  if (bytes.length !== 32) {
    throw new Error(`Seed must be 32 bytes (got ${bytes.length}).`);
  }
  return bytes;
}

/** The public key (base64, 32 bytes) matching a seed — paste into app config. */
export function publicKeyB64(seedB64) {
  return bytesToBase64(ed.getPublicKey(seedBytes(seedB64)));
}

// --- license building ------------------------------------------------------

/**
 * Build a signed license token.
 *
 * @param {string} seedB64  vendor private seed (base64, 32 bytes)
 * @param {object} fields   { app, customer, machineId, edition, issued, expires }
 *                          `expires` may be "" for a perpetual license.
 * @param {string} wrapper  label used in the BEGIN/END lines (cosmetic)
 * @returns {{ token: string, payload: object, payloadB64: string }}
 */
export function buildLicense(seedB64, fields, wrapper = "ZT LICENSE") {
  const { app, customer, machineId, edition, issued, expires } = fields;

  if (!machineId || !machineId.trim()) throw new Error("Machine ID is required.");
  if (!customer || !customer.trim()) throw new Error("Customer is required.");

  // Field order matches the POS example; order is irrelevant to verification
  // (the verifier re-parses the JSON) but keeps tokens tidy and diffable.
  const payload = { v: 1, machine_id: machineId.trim() };
  if (app && app.trim()) payload.app = app.trim();
  payload.customer = customer.trim();
  payload.edition = (edition || "standard").trim();
  payload.issued = issued;
  if (expires && expires.trim()) payload.expires = expires.trim();

  const payloadB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = ed.sign(new TextEncoder().encode(payloadB64), seedBytes(seedB64));
  const body = `${payloadB64}.${bytesToBase64Url(signature)}`;

  const label = (wrapper || "ZT LICENSE").trim().toUpperCase();
  const token = `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;

  return { token, payload, payloadB64 };
}

/** Verify a token against a seed's public key (used for the in-tool self-check). */
export function selfVerify(seedB64, token) {
  const body = token
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.includes("-----"))
    .join("");
  const dot = body.indexOf(".");
  if (dot < 0) return false;
  const payloadB64 = body.slice(0, dot);
  const sig = base64ToBytes(body.slice(dot + 1));
  const pub = ed.getPublicKey(seedBytes(seedB64));
  return ed.verify(sig, new TextEncoder().encode(payloadB64), pub);
}
