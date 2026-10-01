export const session = {
  get: () => JSON.parse(localStorage.getItem('session') || 'null'),
  set: (s) => localStorage.setItem('session', JSON.stringify(s)),
  clear: () => localStorage.removeItem('session'),
};
export async function api(path, { method = 'GET', body, params } = {}) {
  const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v)) : '';
  const s = session.get();
  const res = await fetch(`/api${path}${qs}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(s ? { Authorization: `Bearer ${s.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || 'Request failed'), { errors: data.errors || {}, status: res.status });
  return data;
}
// Client-side rules mirror the server's
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const rules = {
  name: (v) => (v.trim().length < 20 || v.trim().length > 60 ? 'Name must be 20-60 characters' : ''),
  storeName: (v) => (!v.trim() ? 'Store name is required' : ''),
  email: (v) => (EMAIL.test(v.trim()) ? '' : 'Enter a valid email'),
  address: (v) => (!v.trim() || v.length > 400 ? 'Address is required (max 400 characters)' : ''),
  password: (v) => (/^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,16}$/.test(v) ? '' : 'Use 8-16 characters with one uppercase letter and one special character'),
};
