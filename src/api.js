async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    ...options,
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

const json = (method, body) => ({ method, body: JSON.stringify(body) });

export const api = {
  me: () => request('/api/auth/me'),
  login: (email, password) => request('/api/auth/login', json('POST', { email, password })),
  demo: () => request('/api/auth/demo', json('POST', {})),
  register: (values) => request('/api/auth/register', json('POST', values)),
  logout: () => request('/api/auth/logout', json('POST', {})),
  profile: (values) => request('/api/profile', json('PATCH', values)),
  dashboard: () => request('/api/dashboard'),
  products: () => request('/api/products'),
  createProduct: (values) => request('/api/products', json('POST', values)),
  updateProduct: (id, values) => request(`/api/products/${encodeURIComponent(id)}`, json('PUT', values)),
  deleteProduct: (id) => request(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  adjustStock: (id, values) => request(`/api/products/${encodeURIComponent(id)}/adjust`, json('POST', values)),
  restocks: () => request('/api/restocks'),
  createRestock: (values) => request('/api/restocks', json('POST', values)),
  updateRestock: (id, values) => request(`/api/restocks/${encodeURIComponent(id)}`, json('PUT', values)),
  deleteRestock: (id) => request(`/api/restocks/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  movements: () => request('/api/movements'),
  exportProducts: async () => {
    const response = await fetch('/api/products/export.csv', { credentials: 'same-origin' });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || 'Could not export your products.');
    }
    return response.blob();
  },
};
