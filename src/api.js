// All calls to the backend go through here.
// The login token is kept in localStorage and sent with every request.

const TOKEN_KEY = 'invoicedesk_token';

export const auth = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* private mode: stay logged in for this tab only */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth.get() ? { Authorization: `Bearer ${auth.get()}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Can’t reach the server. Check your internet connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Our backend always sends { error: '...' }. No message on a 5xx means the backend itself isn't answering
    // (locally: `npm run dev:api` isn't running or crashed; Vite's proxy then replies 500 on its behalf).
    if (!data.error && res.status >= 500) throw new ApiError(res.status, 'The server isn’t responding. On your computer, check that “npm run dev:api” is running.');
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body = {}) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
};
