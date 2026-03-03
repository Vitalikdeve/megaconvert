const path = require('path');
const crypto = require('crypto');

const DEFAULT_TIMEOUT_MS = 8000;
const UPLOAD_TIMEOUT_MS = 120000;
const JOB_TIMEOUT_MS = 30000;

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

async function fetchAccountBilling({ apiBaseUrl, appUserId, sessionId }) {
  const base = String(apiBaseUrl || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('API base url is not configured');
  const userId = String(appUserId || '').trim();
  if (!userId) throw new Error('App user id is missing');

  const response = await withTimeout(fetch(`${base}/account/billing`, {
    method: 'GET',
    headers: {
      'x-user-id': userId,
      'x-session-id': String(sessionId || 'tg-session').trim() || 'tg-session'
    }
  }));

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    const message = payload?.message || `Billing API error (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload && typeof payload === 'object' ? payload : {};
}

async function redeemPromoCode({ apiBaseUrl, appUserId, sessionId, code }) {
  const base = String(apiBaseUrl || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('API base url is not configured');
  const userId = String(appUserId || '').trim();
  if (!userId) throw new Error('App user id is missing');
  const promoCode = String(code || '').trim();
  if (!promoCode) throw new Error('Promo code is missing');

  const response = await withTimeout(fetch(`${base}/promo/redeem`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-id': userId,
      'x-session-id': String(sessionId || 'tg-session').trim() || 'tg-session'
    },
    body: JSON.stringify({ code: promoCode })
  }), JOB_TIMEOUT_MS);

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    const message = payload?.message || `Promo API error (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload && typeof payload === 'object' ? payload : {};
}

function normalizeBase(apiBaseUrl) {
  const base = String(apiBaseUrl || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('API base url is not configured');
  return base;
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

async function uploadInputViaProxy({ apiBaseUrl, fileName, contentType, fileBuffer }) {
  const base = normalizeBase(apiBaseUrl);
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length <= 0) {
    throw new Error('Input file is empty');
  }

  const safeName = sanitizeFileName(fileName);
  const inputKey = `inputs/tg/${crypto.randomUUID()}/${safeName}`;
  const response = await withTimeout(fetch(`${base}/uploads/proxy`, {
    method: 'POST',
    headers: {
      'content-type': String(contentType || 'application/octet-stream'),
      'x-input-key': inputKey,
      'x-file-name': safeName,
      'x-file-size': String(fileBuffer.length)
    },
    body: fileBuffer
  }), UPLOAD_TIMEOUT_MS);

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw toApiError(response, payload, `Upload failed (${response.status})`);
  }

  return {
    inputKey: String(payload?.inputKey || inputKey),
    requestId: String(payload?.requestId || '')
  };
}

async function createConversionJob({ apiBaseUrl, tool, inputKey, originalName, inputFormat, inputSize, settings = {} }) {
  const base = normalizeBase(apiBaseUrl);
  const response = await withTimeout(fetch(`${base}/jobs`, {
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
    })
  }), JOB_TIMEOUT_MS);

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw toApiError(response, payload, `Job creation failed (${response.status})`);
  }
  return payload && typeof payload === 'object' ? payload : {};
}

async function fetchConversionJob({ apiBaseUrl, jobId }) {
  const base = normalizeBase(apiBaseUrl);
  const safeJobId = String(jobId || '').trim();
  if (!safeJobId) throw new Error('Job id is required');

  const response = await withTimeout(fetch(`${base}/jobs/${encodeURIComponent(safeJobId)}`, {
    method: 'GET'
  }), JOB_TIMEOUT_MS);

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw toApiError(response, payload, `Job fetch failed (${response.status})`);
  }
  return payload && typeof payload === 'object' ? payload : {};
}

async function downloadFileBuffer({ apiBaseUrl, downloadUrl }) {
  const base = normalizeBase(apiBaseUrl);
  const rawUrl = String(downloadUrl || '').trim();
  if (!rawUrl) throw new Error('Download URL is missing');
  const url = rawUrl.startsWith('/') ? `${base}${rawUrl}` : rawUrl;

  const response = await withTimeout(fetch(url, { method: 'GET' }), UPLOAD_TIMEOUT_MS);
  if (!response.ok) {
    const payload = await parseJsonSafe(response);
    throw toApiError(response, payload, `Result download failed (${response.status})`);
  }
  const arr = await response.arrayBuffer();
  return Buffer.from(arr);
}

module.exports = {
  fetchAccountBilling,
  redeemPromoCode,
  uploadInputViaProxy,
  createConversionJob,
  fetchConversionJob,
  downloadFileBuffer
};
