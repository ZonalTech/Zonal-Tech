// Tiny fetch wrapper. Adds the bearer token, parses JSON, throws on !ok with the
// backend's { error } message. All calls hit the Vite-proxied "/api/..." path.
const TOKEN_KEY = "zt.token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

export async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (auth && token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }

  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const fmtKES = (n) =>
  "KES " + Number(n || 0).toLocaleString("en-KE");

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" }) : "—";
