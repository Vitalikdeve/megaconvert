import { ConversionError } from '../core/errors';
import { fetchWithTimeout } from '../infra/timeouts';
import { retry } from '../infra/retries';

const DIRECT_API_FALLBACK = String(import.meta.env.VITE_DIRECT_API_FALLBACK || '')
  .trim()
  .replace(/\/+$/, '');
const COMPAT_FALLBACK_CODES = new Set([
  'UPLOAD_SIGN_FAILED',
  'UPLOAD_PROXY_FAILED',
  'NETWORK_ERROR',
  'TIMEOUT',
  'UNAUTHORIZED',
  'API_KEY_REQUIRED',
  'NOT_FOUND',
  'INTERNAL_ERROR'
]);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isLoopbackHost = (host) => host === 'localhost' || host === '127.0.0.1' || host === '::1';

const parseResponseBody = async (res) => {
  const contentType = String(res.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    try {
      return { json: await res.json(), raw: null };
    } catch (error) {
      return { json: null, raw: `invalid_json:${error?.message || 'parse_error'}` };
    }
  }
  const raw = await res.text().catch(() => '');
  if (!raw) return { json: null, raw: '' };
  try {
    return { json: JSON.parse(raw), raw };
  } catch {
    return { json: null, raw };
  }
};

const shouldTryDirectFallback = (apiBase) => {
  const base = String(apiBase || '').trim().toLowerCase();
  if (!base) return false;
  if (!DIRECT_API_FALLBACK) return false;
  if (typeof window !== 'undefined') {
    const currentHost = String(window.location.hostname || '').trim().toLowerCase();
    if (!isLoopbackHost(currentHost)) return false;
  }
  if (base.startsWith(DIRECT_API_FALLBACK.toLowerCase())) return false;
  if (base.startsWith('http://localhost') || base.startsWith('https://localhost')) return false;
  if (base.startsWith('http://127.0.0.1') || base.startsWith('https://127.0.0.1')) return false;
  return base.startsWith('/');
};

const getCompatApiBase = (apiBase) => {
  const normalized = String(apiBase || '').trim().replace(/\/+$/, '');
  if (!normalized) return '';
  if (/\/api$/i.test(normalized)) return normalized.slice(0, -4);
  return '';
};

const shouldPreferProxyUpload = () => {
  try {
    const mode = String(import.meta.env.VITE_UPLOAD_MODE || '').trim().toLowerCase();
    if (mode === 'direct') return false;
    if (mode === 'proxy') return true;
  } catch (error) {
    void error;
  }
  // Default to proxy-first for cross-device reliability.
  return true;
};

const isInsecureDirectUploadUrl = (url) => {
  try {
    if (typeof window === 'undefined') return false;
    if (String(window.location.protocol || '').toLowerCase() !== 'https:') return false;
    return String(url || '').trim().toLowerCase().startsWith('http://');
  } catch {
    return false;
  }
};

const isNetworkLikeError = (error) => {
  const msg = String(error?.message || '').toLowerCase();
  return error?.name === 'AbortError'
    || error instanceof TypeError
    || msg.includes('failed to fetch')
    || msg.includes('networkerror')
    || msg.includes('load failed');
};

const isRetryableSignError = (error) => {
  if (isNetworkLikeError(error)) return true;
  if (error instanceof ConversionError) {
    return COMPAT_FALLBACK_CODES.has(error.code);
  }
  return false;
};

const isRetryableProxyError = (error) => {
  if (isNetworkLikeError(error)) return true;
  if (error instanceof ConversionError) {
    return COMPAT_FALLBACK_CODES.has(error.code);
  }
  return false;
};

const extractErrorCode = (payload, fallback) => {
  if (isObject(payload) && typeof payload.code === 'string' && payload.code.trim()) {
    return payload.code.trim();
  }
  return fallback;
};

const extractErrorMessage = (payload, fallback) => {
  if (isObject(payload) && typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim();
  }
  return fallback;
};

const fetchSignedUpload = async (apiBase, authHeaders, file, nameOverride, timeoutMs) => {
  const res = await fetchWithTimeout(`${apiBase}/uploads/sign`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      filename: nameOverride || file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size
    })
  }, timeoutMs);
  const body = await parseResponseBody(res);
  const data = body.json;
  if (!res.ok) {
    throw new ConversionError(
      extractErrorCode(data, 'UPLOAD_SIGN_FAILED'),
      extractErrorMessage(data, `Failed to get upload URL (${res.status}).`)
    );
  }
  if (!isObject(data)) {
    throw new ConversionError('UPLOAD_SIGN_FAILED', `Invalid upload sign response (${res.status}).`);
  }
  const inputKey = String(data.inputKey || data.key || '').trim();
  const uploadUrl = String(data.uploadUrl || data.url || '').trim();
  if (!inputKey || !uploadUrl) {
    throw new ConversionError('UPLOAD_SIGN_FAILED', `Upload sign response is incomplete (${res.status}).`);
  }
  return {
    ...data,
    inputKey,
    uploadUrl
  };
};

export const signUpload = async (apiBase, authHeaders, file, nameOverride, timeoutMs = 15_000) => {
  return retry(async () => {
    try {
      try {
        return await fetchSignedUpload(apiBase, authHeaders, file, nameOverride, timeoutMs);
      } catch (error) {
        const compatBase = getCompatApiBase(apiBase);
        let fallbackError = error;
        if (compatBase && compatBase !== apiBase && isRetryableSignError(error)) {
          try {
            return await fetchSignedUpload(compatBase, authHeaders, file, nameOverride, timeoutMs);
          } catch (compatError) {
            fallbackError = compatError;
          }
        }
        if (!shouldTryDirectFallback(apiBase) || !isRetryableSignError(fallbackError)) {
          throw fallbackError;
        }
        return await fetchSignedUpload(DIRECT_API_FALLBACK, authHeaders, file, nameOverride, timeoutMs);
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new ConversionError('TIMEOUT', 'Request timed out while requesting upload URL.');
      }
      if (error instanceof ConversionError) throw error;
      throw new ConversionError('NETWORK_ERROR', error?.message || 'Network request failed while requesting upload URL.');
    }
  }, {
    attempts: 4,
    shouldRetry: (error) => ['NETWORK_ERROR', 'TIMEOUT', 'UPLOAD_SIGN_FAILED'].includes(error?.code)
  });
};

const fetchProxyUpload = async (apiBase, authHeaders, file, signed, timeoutMs) => {
  const res = await fetchWithTimeout(`${apiBase}/uploads/proxy`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': file.type || 'application/octet-stream',
      'x-input-key': signed.inputKey,
      'x-file-size': String(file.size || 0),
      'x-file-name': String(file.name || 'upload.bin')
    },
    body: file
  }, timeoutMs);

  const body = await parseResponseBody(res);
  const data = body.json;
  if (!res.ok) {
    throw new ConversionError(
      extractErrorCode(data, 'UPLOAD_PROXY_FAILED'),
      extractErrorMessage(data, `Proxy upload failed (${res.status}).`)
    );
  }
};

const proxyUpload = async (apiBase, authHeaders, file, signed, timeoutMs) => {
  try {
    try {
      await fetchProxyUpload(apiBase, authHeaders, file, signed, timeoutMs);
    } catch (error) {
      const compatBase = getCompatApiBase(apiBase);
      let fallbackError = error;
      if (compatBase && compatBase !== apiBase && isRetryableProxyError(error)) {
        try {
          await fetchProxyUpload(compatBase, authHeaders, file, signed, timeoutMs);
          return;
        } catch (compatError) {
          fallbackError = compatError;
        }
      }
      if (!shouldTryDirectFallback(apiBase) || !isRetryableProxyError(fallbackError)) {
        throw fallbackError;
      }
      await fetchProxyUpload(DIRECT_API_FALLBACK, authHeaders, file, signed, timeoutMs);
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ConversionError('TIMEOUT', 'Request timed out while uploading file.');
    }
    if (error instanceof ConversionError) throw error;
    throw new ConversionError('UPLOAD_PROXY_FAILED', error?.message || 'Proxy upload failed.');
  }
};

const isDirectUploadNetworkFailure = (error) => {
  return isNetworkLikeError(error);
};

const isDirectUploadFallbackCandidate = (error) => {
  if (isDirectUploadNetworkFailure(error)) return true;
  if (error instanceof ConversionError && error.code === 'UPLOAD_FAILED') return true;
  return false;
};

export const uploadToStorage = async (apiBase, authHeaders, file, nameOverride, timeoutMs, logger) => {
  const signed = await signUpload(apiBase, authHeaders, file, nameOverride, timeoutMs);
  let uploadMode = 'direct';
  let proxyAttempted = false;
  if (shouldPreferProxyUpload()) {
    proxyAttempted = true;
    try {
      await proxyUpload(apiBase, authHeaders, file, signed, timeoutMs);
      uploadMode = 'proxy';
      logger?.info('upload_complete', { inputKey: signed.inputKey, mode: uploadMode, reason: 'proxy_first' });
      return { inputKey: signed.inputKey };
    } catch (error) {
      logger?.warn('upload_proxy_preferred_failed_fallback_direct', {
        inputKey: signed.inputKey,
        reason: error?.message || String(error)
      });
    }
  }
  if (isInsecureDirectUploadUrl(signed.uploadUrl)) {
    logger?.warn('upload_direct_disabled_mixed_content', { inputKey: signed.inputKey });
    if (!proxyAttempted) {
      uploadMode = 'proxy';
      await proxyUpload(apiBase, authHeaders, file, signed, timeoutMs);
      logger?.info('upload_complete', { inputKey: signed.inputKey, mode: uploadMode, reason: 'mixed_content_guard' });
      return { inputKey: signed.inputKey };
    }
    throw new ConversionError(
      'UPLOAD_PROXY_FAILED',
      'Proxy upload failed, and direct HTTP upload is blocked on HTTPS pages.'
    );
  }
  try {
    await retry(async () => {
      const putRes = await fetchWithTimeout(signed.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file
      }, timeoutMs);
      if (!putRes.ok) {
        const responseText = await putRes.text().catch(() => '');
        const details = responseText ? ` ${responseText.slice(0, 200)}` : '';
        throw new ConversionError('UPLOAD_FAILED', `Upload failed (${putRes.status}).${details}`);
      }
    }, {
      attempts: 3,
      shouldRetry: (error) => error?.code === 'UPLOAD_FAILED' || error?.name === 'AbortError'
    });
  } catch (error) {
    if (!isDirectUploadFallbackCandidate(error)) throw error;
    uploadMode = 'proxy';
    logger?.warn('upload_direct_failed_fallback_proxy', {
      inputKey: signed.inputKey,
      reason: error?.message || String(error)
    });
    await proxyUpload(apiBase, authHeaders, file, signed, timeoutMs);
  }
  logger?.info('upload_complete', { inputKey: signed.inputKey, mode: uploadMode });
  return { inputKey: signed.inputKey };
};
