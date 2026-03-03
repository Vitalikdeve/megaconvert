import { ConversionError } from '../core/errors';
import { fetchWithTimeout, sleep } from '../infra/timeouts';
import { retry } from '../infra/retries';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const DIRECT_API_FALLBACK = 'https://megaconvert-api.fly.dev';
const RETRYABLE_CREATE_CODES = new Set(['JOB_CREATE_FAILED', 'NETWORK_ERROR', 'TIMEOUT', 'QUEUE_UNAVAILABLE']);
const RETRYABLE_STATUS_CODES = new Set(['JOB_STATUS_FETCH', 'NETWORK_ERROR', 'TIMEOUT', 'QUEUE_UNAVAILABLE']);

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

const extractErrorMessage = (payload, fallback) => {
  if (isObject(payload) && typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim();
  }
  return fallback;
};

const shouldTryDirectFallback = (apiBase) => {
  const base = String(apiBase || '').trim().toLowerCase();
  if (!base) return false;
  if (base.startsWith('http://localhost') || base.startsWith('https://localhost')) return false;
  if (base.startsWith('http://127.0.0.1') || base.startsWith('https://127.0.0.1')) return false;
  if (base.startsWith(DIRECT_API_FALLBACK)) return false;
  return base.startsWith('/');
};

const isRetryableCreateError = (error) => {
  if (!error) return false;
  if (error?.name === 'AbortError') return true;
  if (error instanceof ConversionError) {
    return RETRYABLE_CREATE_CODES.has(error.code);
  }
  return true;
};

const isRetryableStatusError = (error) => {
  if (!error) return false;
  if (error?.name === 'AbortError') return true;
  if (error instanceof ConversionError) {
    return RETRYABLE_STATUS_CODES.has(error.code);
  }
  return true;
};

const fetchCreateJob = async (apiBase, authHeaders, payload, timeoutMs) => {
  const res = await fetchWithTimeout(`${apiBase}/jobs`, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(payload)
  }, timeoutMs);
  const body = await parseResponseBody(res);
  const data = body.json;
  if (!res.ok) {
    const code = isObject(data) && typeof data.code === 'string' ? data.code : 'JOB_CREATE_FAILED';
    const message = extractErrorMessage(data, `Failed to start job (${res.status}).`);
    throw new ConversionError(code, message);
  }
  if (!isObject(data)) {
    throw new ConversionError('JOB_CREATE_FAILED', `Invalid job create response (${res.status}).`);
  }
  return data;
};

const fetchJobStatus = async (apiBase, authHeaders, jobId, timeoutMs) => {
  const res = await fetchWithTimeout(`${apiBase}/jobs/${jobId}`, {
    cache: 'no-store',
    headers: { ...authHeaders }
  }, timeoutMs);
  const body = await parseResponseBody(res);
  const data = body.json;
  if (!res.ok) {
    const code = isObject(data) && typeof data.code === 'string' ? data.code : 'JOB_STATUS_FETCH';
    const message = extractErrorMessage(data, `Failed to fetch status (${res.status}).`);
    throw new ConversionError(code, message);
  }
  if (!isObject(data)) {
    const rawSnippet = typeof body.raw === 'string' ? body.raw.slice(0, 120) : '';
    const suffix = rawSnippet ? ` (${rawSnippet})` : '';
    throw new ConversionError('JOB_STATUS_FETCH', `Invalid status response.${suffix}`);
  }
  return data;
};

export const createJob = async (apiBase, authHeaders, payload, timeoutMs = 20_000) => {
  return retry(async () => {
    try {
      try {
        return await fetchCreateJob(apiBase, authHeaders, payload, timeoutMs);
      } catch (error) {
        if (!shouldTryDirectFallback(apiBase) || !isRetryableCreateError(error)) {
          throw error;
        }
        return await fetchCreateJob(DIRECT_API_FALLBACK, authHeaders, payload, timeoutMs);
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new ConversionError('TIMEOUT', 'Request timed out while creating job.');
      }
      if (error instanceof ConversionError) throw error;
      throw new ConversionError('NETWORK_ERROR', error?.message || 'Network request failed while creating job.');
    }
  }, {
    attempts: 4,
    shouldRetry: (error) => isRetryableCreateError(error)
  });
};

export const getJob = async (apiBase, authHeaders, jobId, timeoutMs = 15_000) => {
  try {
    try {
      return await fetchJobStatus(apiBase, authHeaders, jobId, timeoutMs);
    } catch (error) {
      if (!shouldTryDirectFallback(apiBase) || !isRetryableStatusError(error)) {
        throw error;
      }
      return await fetchJobStatus(DIRECT_API_FALLBACK, authHeaders, jobId, timeoutMs);
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ConversionError('TIMEOUT', 'Request timed out while fetching job status.');
    }
    if (error instanceof ConversionError) throw error;
    throw new ConversionError('NETWORK_ERROR', error?.message || 'Network request failed while polling job.');
  }
};

const normalizeStatus = (status) => {
  if (!status) return 'running';
  const normalized = status.toLowerCase();
  if (['queued', 'running', 'processing', 'verifying', 'completed', 'failed', 'expired'].includes(normalized)) {
    return normalized === 'processing' ? 'running' : normalized;
  }
  return 'running';
};

export const pollJob = async ({
  apiBase,
  authHeaders,
  jobId,
  limits,
  onUpdate,
  onProgress,
  onEta,
  logger,
  signal
}) => {
  const start = Date.now();
  const pollIntervalMs = limits?.pollIntervalMs || 1200;
  const timeoutMs = limits?.jobTimeoutMs || 300000;
  let transientFailures = 0;
  while (true) {
    if (Date.now() - start > timeoutMs) {
      throw new ConversionError('TIMEOUT', 'Job timed out.');
    }
    let job = null;
    try {
      job = await retry(
        () => getJob(apiBase, authHeaders, jobId, 25_000),
        {
          attempts: 5,
          shouldRetry: (error) => ['JOB_STATUS_FETCH', 'NETWORK_ERROR', 'TIMEOUT', 'QUEUE_UNAVAILABLE'].includes(error?.code)
            || error?.name === 'AbortError'
        }
      );
      transientFailures = 0;
    } catch (error) {
      if (!isRetryableStatusError(error)) {
        throw error;
      }
      transientFailures += 1;
      logger?.warn('job_status_poll_transient_error', {
        jobId,
        failures: transientFailures,
        code: error?.code || null,
        message: error?.message || String(error)
      });
      const backoffMs = Math.min(10_000, pollIntervalMs * Math.max(2, transientFailures));
      await sleep(backoffMs, signal);
      continue;
    }
    const status = normalizeStatus(job.status);
    const progress = Number(job.progress || 0);
    onUpdate?.({ ...job, status });
    onProgress?.(progress);
    if (job.etaSeconds !== undefined && job.etaSeconds !== null) {
      onEta?.(Number(job.etaSeconds));
    } else if (progress > 0) {
      const elapsed = Math.max(1, Math.floor((Date.now() - start) / 1000));
      const remaining = Math.max(1, Math.round((elapsed / progress) * (100 - progress)));
      onEta?.(remaining);
    }
    logger?.info('job_status', { jobId, status, progress });
    if (status === 'completed' || status === 'failed' || status === 'expired') {
      return { ...job, status };
    }
    await sleep(pollIntervalMs, signal);
  }
};
