/**
 * LexGuard API Client
 * Thin fetch wrapper for all backend endpoints.
 */

const BASE = import.meta.env.VITE_API_URL || '/api';

let currentToken = localStorage.getItem('lexguard_token') || null;

export function setAuthToken(token) {
  currentToken = token;
  if (token) {
    localStorage.setItem('lexguard_token', token);
  } else {
    localStorage.removeItem('lexguard_token');
  }
}

async function request(url, options = {}) {
  const headers = options.headers || {};
  if (currentToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }
  
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE}${url}`, { ...options, headers });
  
  let body;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
    // Wrap plain text in a standard error format if it's an error status
    if (!res.ok) {
      body = { message: body };
    } else {
      body = { data: body };
    }
  }

  if (!res.ok) {
    const msg = body?.message || `Request failed with status ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return body.data !== undefined ? body.data : body;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export async function login(email, password) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  if (res.token) setAuthToken(res.token);
  return res;
}

export async function register(email, password) {
  const res = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  if (res.token) setAuthToken(res.token);
  return res;
}

export async function getProfile() {
  return request('/auth/me');
}

export function logout() {
  setAuthToken(null);
  window.location.href = '/login';
}

// ── Payments ────────────────────────────────────────────────────────────────

export async function createOrder(plan) {
  return request('/payments/create-order', {
    method: 'POST',
    body: JSON.stringify({ plan })
  });
}

export async function verifyPayment(paymentData) {
  return request('/payments/verify', {
    method: 'POST',
    body: JSON.stringify(paymentData)
  });
}

// ── Contracts ───────────────────────────────────────────────────────────────

/** GET /api/contracts */
export async function getContracts() {
  return request('/contracts');
}

/** POST /api/contracts (multipart upload) */
export async function uploadContract(file, contractCategory = 'other') {
  const form = new FormData();
  form.append('file', file);
  form.append('contractCategory', contractCategory);

  return request('/contracts', {
    method: 'POST',
    body: form,
  });
}

/** GET /api/contracts/:id */
export async function getContract(id) {
  return request(`/contracts/${id}`);
}

/** GET /api/contracts/:id/risk-summary */
export async function getRiskSummary(id) {
  return request(`/contracts/${id}/risk-summary`);
}

/** GET /api/contracts/:id/clauses-detailed?page=&limit= */
export async function getClausesDetailed(id, page = 1, limit = 20) {
  return request(`/contracts/${id}/clauses-detailed?page=${page}&limit=${limit}`);
}

/** POST /api/contracts/:id/chat */
export async function chatWithContract(id, message) {
  return request(`/contracts/${id}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message })
  });
}
