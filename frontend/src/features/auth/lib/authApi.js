export const parsePayload = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export const resolveApiBase = (value) => {
  const normalized = String(value || '').trim().replace(/\/+$/g, '');
  if (!normalized || !/^https?:\/\//i.test(normalized)) return normalized;
  try {
    const parsed = new URL(normalized);
    const host = String(parsed.hostname || '').trim().toLowerCase();
    const loopbackHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (!loopbackHost && String(parsed.port || '').trim() === '5000') {
      parsed.port = '';
    }
    if (!loopbackHost && typeof window !== 'undefined' && window.location.protocol === 'https:' && parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/g, '');
    return parsed.toString().replace(/\/+$/g, '');
  } catch {
    return normalized;
  }
};

export const buildAuthEndpoint = (apiBase, route) => {
  const base = resolveApiBase(apiBase);
  const normalizedRoute = String(route || '').replace(/^\/+/g, '');
  return /\/api$/i.test(base)
    ? `${base}/auth/${normalizedRoute}`
    : `${base}/api/auth/${normalizedRoute}`;
};

export const buildSocialConnectUrl = (apiBase, provider) => (
  buildAuthEndpoint(apiBase || import.meta.env.VITE_API_BASE || '', `connect/${provider}`)
);
