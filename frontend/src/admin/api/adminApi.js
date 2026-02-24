const normalizeBaseUrl = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '/api';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

const parseErrorPayload = async (response) => {
  try {
    const data = await response.json();
    if (data && typeof data === 'object') return data;
  } catch {
    // Ignore non-JSON responses.
  }
  return null;
};

const request = async (url, { method = 'GET', body } = {}) => {
  const headers = {};
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers,
    body: payload
  });

  if (!response.ok) {
    const errorPayload = await parseErrorPayload(response);
    const error = new Error(
      errorPayload?.message || `Request failed with status ${response.status}`
    );
    error.status = response.status;
    error.code = errorPayload?.code || 'REQUEST_FAILED';
    error.payload = errorPayload;
    throw error;
  }

  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const createAdminApi = (apiBase = '/api') => {
  const base = `${normalizeBaseUrl(apiBase)}/admin`;

  return {
    login: (password) => request(`${base}/auth/login`, { method: 'POST', body: { password } }),
    logout: () => request(`${base}/auth/logout`, { method: 'POST' }),
    getMe: () => request(`${base}/auth/me`),
    getOverviewMetrics: () => request(`${base}/metrics/overview`),
    getSearchMetrics: (range = '7d') => request(`${base}/metrics/search?range=${encodeURIComponent(range)}`),
    getPostsMetrics: (range = '7d') => request(`${base}/metrics/posts?range=${encodeURIComponent(range)}`),
    getPromoMetrics: (range = '7d') => request(`${base}/metrics/promo?range=${encodeURIComponent(range)}`),
    getPosts: () => request(`${base}/posts`),
    createPost: (post) => request(`${base}/posts`, { method: 'POST', body: post }),
    updatePost: (postId, patch) => request(`${base}/posts/${encodeURIComponent(postId)}`, { method: 'PATCH', body: patch }),
    deletePost: (postId) => request(`${base}/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' }),
    getPromoCodes: () => request(`${base}/promo-codes`),
    createPromoCode: (payload) => request(`${base}/promo-codes`, { method: 'POST', body: payload }),
    updatePromoCode: (promoId, patch) => request(`${base}/promo-codes/${encodeURIComponent(promoId)}`, { method: 'PATCH', body: patch }),
    deletePromoCode: (promoId) => request(`${base}/promo-codes/${encodeURIComponent(promoId)}`, { method: 'DELETE' })
  };
};
