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
    getApiUsageMetrics: (range = '7d') => request(`${base}/api-usage?range=${encodeURIComponent(range)}`),
    getPosts: () => request(`${base}/posts`),
    createPost: (post) => request(`${base}/posts`, { method: 'POST', body: post }),
    updatePost: (postId, patch) => request(`${base}/posts/${encodeURIComponent(postId)}`, { method: 'PATCH', body: patch }),
    deletePost: (postId) => request(`${base}/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' }),
    getPromoCodes: () => request(`${base}/promo-codes`),
    createPromoCode: (payload) => request(`${base}/promo-codes`, { method: 'POST', body: payload }),
    updatePromoCode: (promoId, patch) => request(`${base}/promo-codes/${encodeURIComponent(promoId)}`, { method: 'PATCH', body: patch }),
    deletePromoCode: (promoId) => request(`${base}/promo-codes/${encodeURIComponent(promoId)}`, { method: 'DELETE' }),
    uploadAdminImage: (dataUrl) => request(`${base}/assets/image`, { method: 'POST', body: { data_url: dataUrl } }),
    getDevelopers: () => request(`${base}/developers`),
    createDeveloper: (payload) => request(`${base}/developers`, { method: 'POST', body: payload }),
    updateDeveloper: (id, patch) => request(`${base}/developers/${encodeURIComponent(id)}`, { method: 'PUT', body: patch }),
    deleteDeveloper: (id) => request(`${base}/developers/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    toggleDeveloper: (id) => request(`${base}/developers/${encodeURIComponent(id)}/toggle`, { method: 'PATCH' }),
    getContentPages: () => request(`${base}/content/pages`),
    createContentPage: (payload) => request(`${base}/content/pages`, { method: 'POST', body: payload }),
    updateContentPage: (id, patch) => request(`${base}/content/pages/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),
    deleteContentPage: (id) => request(`${base}/content/pages/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    getContentBlocks: (pageSlug = '') => request(`${base}/content/blocks${pageSlug ? `?page_slug=${encodeURIComponent(pageSlug)}` : ''}`),
    createContentBlock: (payload) => request(`${base}/content/blocks`, { method: 'POST', body: payload }),
    updateContentBlock: (id, patch) => request(`${base}/content/blocks/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),
    deleteContentBlock: (id) => request(`${base}/content/blocks/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    getPlatformSettings: () => request(`${base}/settings/platform`),
    savePlatformSettings: (payload) => request(`${base}/settings/platform`, { method: 'PUT', body: payload }),
    getApiKeys: (userId = '') => request(`${base}/api-keys${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`),
    updateApiKeyLimits: (id, payload) => request(`${base}/api-keys/${encodeURIComponent(id)}/limits`, { method: 'PATCH', body: payload }),
    revokeApiKey: (id) => request(`${base}/api-keys/${encodeURIComponent(id)}/revoke`, { method: 'POST' }),
    getApiWebhooks: (params = {}) => {
      const search = new URLSearchParams();
      if (params.user_id) search.set('user_id', params.user_id);
      if (params.api_key_id) search.set('api_key_id', params.api_key_id);
      const query = search.toString();
      return request(`${base}/api-webhooks${query ? `?${query}` : ''}`);
    },
    getApiWebhookDeliveries: (params = {}) => {
      const search = new URLSearchParams();
      if (params.api_key_id) search.set('api_key_id', params.api_key_id);
      if (params.limit) search.set('limit', String(params.limit));
      const query = search.toString();
      return request(`${base}/api-webhook-deliveries${query ? `?${query}` : ''}`);
    },
    updateApiWebhook: (id, payload) => request(`${base}/api-webhooks/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }),
    deleteApiWebhook: (id) => request(`${base}/api-webhooks/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    getWorkerHealthChecks: (limit = 50) => request(`${base}/worker/health-checks?limit=${encodeURIComponent(limit)}`),
    getWorkerSyntheticResults: ({ tool = '', limit = 200 } = {}) =>
      request(`${base}/worker/synthetic-results?limit=${encodeURIComponent(limit)}${tool ? `&tool=${encodeURIComponent(tool)}` : ''}`),
    getWorkerAlerts: (limit = 100) => request(`${base}/worker/alerts?limit=${encodeURIComponent(limit)}`),
    getWorkerFormats: () => request(`${base}/worker/formats`),
    updateWorkerFormat: (tool, payload) => request(`${base}/worker/formats/${encodeURIComponent(tool)}`, { method: 'PATCH', body: payload }),
    getLocalizationStatus: () => request(`${base}/localization/status`),
    getLocalizationCatalog: (lang = 'en') => request(`${base}/localization/catalog?lang=${encodeURIComponent(lang)}`),
    saveLocalizationCatalog: (lang, entries) => request(`${base}/localization/catalog/${encodeURIComponent(lang)}`, { method: 'PUT', body: { entries } })
  };
};
