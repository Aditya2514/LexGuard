/**
 * LexGuard API Client
 * Thin fetch wrapper for all backend endpoints.
 */

const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, options);
  const body = await res.json();

  if (!res.ok) {
    const msg = body?.message || `Request failed with status ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  return body.data !== undefined ? body.data : body;
}

/** GET /api/contracts */
export async function getContracts() {
  return request('/contracts');
}

/** POST /api/contracts (multipart upload) */
export async function uploadContract(file) {
  const form = new FormData();
  form.append('file', file);
  form.append('contractCategory', 'other');

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
