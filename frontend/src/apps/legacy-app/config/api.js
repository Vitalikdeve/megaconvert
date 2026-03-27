const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/+$/g, '');

export const API_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE);
