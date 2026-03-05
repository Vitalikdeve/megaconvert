const path = require('path');
const crypto = require('crypto');

const DEFAULT_TIMEOUT_MS = 8000;
const UPLOAD_TIMEOUT_MS = 120000;
const JOB_TIMEOUT_MS = 30000;
const PATH_FALLBACK_STATUSES = new Set([401, 403, 404, 405]);

function withTimeout(promise, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('API timeout')), timeoutMs);
    })
  ]);
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeBase(apiBaseUrl) {
  const base = String(apiBaseUrl || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('API base url is not configured');
  if (!/^https?:\/\//i.test(base)) {
    throw new Error('API base url must be absolute, e.g. http://localhost:3000');
  }
  return base;
}

function buildBaseCandidates(apiBaseUrl) {
  const base = normalizeBase(apiBaseUrl);
  const out = [base];
  if (/\/api$/i.test(base)) {
    const stripped = base.slice(0, -4);
    if (stripped && !out.includes(stripped)) out.push(stripped);
  }
  return out;
}

function buildUrlCandidates(apiBaseUrl, route) {
  const normalizedRoute = String(route || '').trim();
  if (!normalizedRoute.startsWith('/')) throw new Error(`Route must start with /: ${normalizedRoute}`);
  return buildBaseCandidates(apiBaseUrl).map((base) => `${base}${normalizedRoute}`);
}

function shouldTryFallback(index, total, status) {
  return index < total - 1 && PATH_FALLBACK_STATUSES.has(Number(status || 0));
}

async function fetchJsonFromCandidates({ urlCandidates, method, headers, body, timeoutMs, fallbackMessage }) {
  let lastError = null;
  for (let i = 0; i < urlCandidates.length; i += 1) {
    const url = urlCandidates[i];
    const response = await withTimeout(fetch(url, { method, headers, body }), timeoutMs);
    const payload = await parseJsonSafe(response);
    if (response.ok) {
      return { payload: payload && typeof payload === 'object' ? payload : {}, response, url };
    }

    const error = toApiError(response, payload, fallbackMessage || `API error (${response.status})`);
    if (!shouldTryFallback(i, urlCandidates.length, response.status)) {
      throw error;
    }
    lastError = error;
  }
  throw lastError || new Error('API request failed');
}

async function fetchAccountBilling({ apiBaseUrl, appUserId, sessionId }) {
  const userId = String(appUserId || '').trim();
  if (!userId) throw new Error('App user id is missing');

  const { payload } = await fetchJsonFromCandidates({
    urlCandidates: buildUrlCandidates(apiBaseUrl, '/account/billing'),
    method: 'GET',
    headers: {
      'x-user-id': userId,
      'x-session-id': String(sessionId || 'tg-session').trim() || 'tg-session'
    },
    timeoutMs: DEFAULT_TIMEOUT_MS,
    fallbackMessage: 'Billing API error'
  });
  return payload;
}

async function redeemPromoCode({ apiBaseUrl, appUserId, sessionId, code }) {
  const userId = String(appUserId || '').trim();
  if (!userId) throw new Error('App user id is missing');
  const promoCode = String(code || '').trim();
  if (!promoCode) throw new Error('Promo code is missing');

  const { payload } = await fetchJsonFromCandidates({
    urlCandidates: buildUrlCandidates(apiBaseUrl, '/promo/redeem'),
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-id': userId,
      'x-session-id': String(sessionId || 'tg-session').trim() || 'tg-session'
    },
    body: JSON.stringify({ code: promoCode }),
    timeoutMs: JOB_TIMEOUT_MS,
    fallbackMessage: 'Promo API error'
  });
  return payload;
}

function sanitizeFileName(fileName) {
  const raw = String(fileName || 'input.bin').trim() || 'input.bin';
  const parsed = path.parse(raw);
  const safeBase = String(parsed.name || 'input').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 90) || 'input';
  const safeExt = String(parsed.ext || '').replace(/[^a-zA-Z0-9.]/g, '').slice(0, 12);
  return `${safeBase}${safeExt || '.bin'}`;
}

function toApiError(response, payload, fallbackMessage) {
  const message = payload?.message || fallbackMessage || `API error (${response.status})`;
  const error = new Error(message);
  error.status = response.status;
  error.payload = payload;
  return error;
}

function normalizeCreatedJob(payload) {
  const normalized = payload && typeof payload === 'object' ? payload : {};
  const jobId = String(normalized.jobId || normalized.job_id || normalized.id || '').trim();
  return {
    ...normalized,
    jobId,
    id: String(normalized.id || jobId)
  };
}

function normalizeJobStatus(payload) {
  const normalized = payload && typeof payload === 'object' ? payload : {};
  const errorValue = normalized.error;
  return {
    ...normalized,
    jobId: String(normalized.jobId || normalized.job_id || '').trim(),
    downloadUrl: String(normalized.downloadUrl || normalized.download_url || '').trim(),
    error: typeof errorValue === 'string' && errorValue
      ? { message: errorValue }
      : (errorValue && typeof errorValue === 'object' ? errorValue : null)
  };
}

async function uploadInputViaProxy({ apiBaseUrl, fileName, contentType, fileBuffer }) {
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length <= 0) {
    throw new Error('Input file is empty');
  }

  const safeName = sanitizeFileName(fileName);
  const inputKey = `inputs/tg/${crypto.randomUUID()}/${safeName}`;
  const { payload } = await fetchJsonFromCandidates({
    urlCandidates: buildUrlCandidates(apiBaseUrl, '/uploads/proxy'),
    method: 'POST',
    headers: {
      'content-type': String(contentType || 'application/octet-stream'),
      'x-input-key': inputKey,
      'x-file-name': safeName,
      'x-file-size': String(fileBuffer.length)
    },
    body: fileBuffer,
    timeoutMs: UPLOAD_TIMEOUT_MS,
    fallbackMessage: 'Upload failed'
  });

  return {
    inputKey: String(payload?.inputKey || inputKey),
    requestId: String(payload?.requestId || '')
  };
}

async function createConversionJob({ apiBaseUrl, tool, inputKey, originalName, inputFormat, inputSize, settings = {} }) {
  const { payload } = await fetchJsonFromCandidates({
    urlCandidates: buildUrlCandidates(apiBaseUrl, '/jobs'),
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      tool,
      inputKey,
      originalName,
      inputFormat,
      inputSize,
      settings
    }),
    timeoutMs: JOB_TIMEOUT_MS,
    fallbackMessage: 'Job creation failed'
  });

  const normalized = normalizeCreatedJob(payload);
  if (!normalized.jobId) {
    throw new Error('Job creation succeeded but job id is missing');
  }
  return normalized;
}

async function fetchConversionJob({ apiBaseUrl, jobId }) {
  const safeJobId = String(jobId || '').trim();
  if (!safeJobId) throw new Error('Job id is required');

  const { payload } = await fetchJsonFromCandidates({
    urlCandidates: buildUrlCandidates(apiBaseUrl, `/jobs/${encodeURIComponent(safeJobId)}`),
    method: 'GET',
    timeoutMs: JOB_TIMEOUT_MS,
    fallbackMessage: 'Job fetch failed'
  });

  return normalizeJobStatus(payload);
}

async function downloadFileBuffer({ apiBaseUrl, downloadUrl }) {
  const rawUrl = String(downloadUrl || '').trim();
  if (!rawUrl) throw new Error('Download URL is missing');

  const candidates = rawUrl.startsWith('/')
    ? buildBaseCandidates(apiBaseUrl).map((base) => `${base}${rawUrl}`)
    : [rawUrl];

  let lastError = null;
  for (let i = 0; i < candidates.length; i += 1) {
    const response = await withTimeout(fetch(candidates[i], { method: 'GET' }), UPLOAD_TIMEOUT_MS);
    if (response.ok) {
      const arr = await response.arrayBuffer();
      return Buffer.from(arr);
    }
    const payload = await parseJsonSafe(response);
    const error = toApiError(response, payload, `Result download failed (${response.status})`);
    if (!shouldTryFallback(i, candidates.length, response.status)) {
      throw error;
    }
    lastError = error;
  }

  throw lastError || new Error('Result download failed');
}

module.exports = {
  fetchAccountBilling,
  redeemPromoCode,
  uploadInputViaProxy,
  createConversionJob,
  fetchConversionJob,
  downloadFileBuffer
};
