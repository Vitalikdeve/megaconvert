import { useCallback, useEffect, useRef, useState } from 'react';

const HEALTH_TIMEOUT_MS = 2500;
const REQUEST_TIMEOUT_MS = 45000;
const JOB_TIMEOUT_MS = 180000;
const POLL_INTERVAL_MS = 1000;

const createIdleState = () => ({
  phase: 'idle',
  progress: 0,
  error: '',
  jobId: '',
  downloadUrl: '',
});

const wait = (ms) => new Promise((resolve) => {
  window.setTimeout(resolve, ms);
});

const sanitizeFileName = (value) => {
  const withoutControlChars = Array.from(String(value || 'input.bin'))
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32;
    })
    .join('');

  const normalized = withoutControlChars
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ');

  return normalized || 'input.bin';
};

const parseJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const withTimeout = async (requestFactory, timeoutMs) => {
  const controller = new AbortController();
  const timerId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await requestFactory(controller.signal);
  } finally {
    window.clearTimeout(timerId);
  }
};

const resolveApiBase = (value) => {
  const normalized = String(value || '').trim().replace(/\/+$/g, '');
  if (!normalized || !/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);
    parsed.pathname = parsed.pathname.replace(/\/+$/g, '');
    return parsed.toString().replace(/\/+$/g, '');
  } catch {
    return normalized;
  }
};

const uniqueList = (values) => Array.from(new Set(values.filter(Boolean)));

const buildBaseVariants = (apiBase) => {
  const configured = resolveApiBase(apiBase || import.meta.env.VITE_API_BASE || '/api');
  const variants = [configured || '/api'];

  if (/\/api$/i.test(configured)) {
    variants.push(configured.replace(/\/api$/i, ''));
  }

  if (!configured) {
    variants.push('');
  }

  return uniqueList(variants);
};

const joinUrl = (base, path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!base) {
    return normalizedPath;
  }

  return `${String(base).replace(/\/+$/g, '')}${normalizedPath}`;
};

const buildApiCandidates = (apiBase, route) => {
  const normalizedRoute = String(route || '').replace(/^\/+/g, '');

  return uniqueList(
    buildBaseVariants(apiBase).map((base) => (
      /\/api$/i.test(base)
        ? joinUrl(base, normalizedRoute)
        : joinUrl(base, `api/${normalizedRoute}`)
    )),
  );
};

const buildRootCandidates = (apiBase, route) => {
  const normalizedRoute = String(route || '').replace(/^\/+/g, '');

  return uniqueList(
    buildBaseVariants(apiBase).map((base) => (
      /\/api$/i.test(base)
        ? joinUrl(base.replace(/\/api$/i, ''), normalizedRoute)
        : joinUrl(base, normalizedRoute)
    )),
  );
};

const buildHealthCandidates = (apiBase) => uniqueList([
  ...buildApiCandidates(apiBase, 'health'),
  ...buildRootCandidates(apiBase, 'health'),
]);

const buildUploadCandidates = (apiBase) => uniqueList([
  ...buildApiCandidates(apiBase, 'uploads/proxy'),
  ...buildRootCandidates(apiBase, 'uploads/proxy'),
]);

const buildConvertCandidates = (apiBase) => uniqueList([
  ...buildApiCandidates(apiBase, 'convert'),
  ...buildRootCandidates(apiBase, 'jobs'),
]);

const buildJobCandidates = (apiBase, jobId) => uniqueList([
  ...buildApiCandidates(apiBase, `jobs/${encodeURIComponent(jobId)}`),
  ...buildRootCandidates(apiBase, `jobs/${encodeURIComponent(jobId)}`),
]);

const shouldTryNextCandidate = (statusCode, index, total) => (
  index < total - 1 && [404, 405].includes(Number(statusCode))
);

const createApiError = (response, payload, fallbackMessage) => {
  const message = String(payload?.message || payload?.error?.message || fallbackMessage || `Request failed (${response.status})`).trim();
  const error = new Error(message);
  error.status = response.status;
  error.code = String(payload?.code || `HTTP_${response.status}`).trim();
  error.payload = payload;
  return error;
};

const normalizeCloudError = (error, fallbackMessage = 'Cloud conversion failed.') => {
  if (error?.status && error?.code) {
    return error;
  }

  const message = String(error?.message || fallbackMessage).trim() || fallbackMessage;
  const normalized = error instanceof Error ? error : new Error(message);

  if (!normalized.message) {
    normalized.message = message;
  }

  if (normalized.name === 'AbortError' || /timed?\s*out/i.test(message)) {
    normalized.code = normalized.code || 'CLOUD_TIMEOUT';
    normalized.status = normalized.status || 504;
    return normalized;
  }

  if (!normalized.code) {
    normalized.code = normalized.status ? `HTTP_${normalized.status}` : 'CLOUD_NETWORK';
  }

  return normalized;
};

const extractFileNameFromDisposition = (value) => {
  const header = String(value || '');
  if (!header) {
    return '';
  }

  const utfMatch = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim().replace(/^"(.*)"$/, '$1'));
    } catch {
      return utfMatch[1].trim().replace(/^"(.*)"$/, '$1');
    }
  }

  const asciiMatch = header.match(/filename\s*=\s*"([^"]+)"/i) || header.match(/filename\s*=\s*([^;]+)/i);
  return String(asciiMatch?.[1] || '').trim().replace(/^"(.*)"$/, '$1');
};

const inferExtensionFromMime = (mimeType, actionType, targetFormat = '') => {
  const normalizedMime = String(mimeType || '').toLowerCase();
  const normalizedTarget = String(targetFormat || '').trim().toLowerCase();

  if (normalizedTarget) return normalizedTarget;

  if (normalizedMime.includes('png') || actionType === 'remove_background_ai') return 'png';
  if (normalizedMime.includes('jpeg') || normalizedMime.includes('jpg') || ['image_to_jpg', 'compress_image'].includes(actionType)) return 'jpg';
  if (normalizedMime.includes('mp4') || actionType === 'compress_mp4') return 'mp4';
  if (normalizedMime.includes('mpeg') || normalizedMime.includes('mp3') || ['extract_audio', 'audio_to_mp3', 'compress_audio'].includes(actionType)) return 'mp3';
  if (normalizedMime.includes('webm')) return 'webm';
  if (normalizedMime.includes('gif')) return 'gif';

  return 'bin';
};

const buildFallbackResultName = (originalName, actionType, mimeType, targetFormat = '') => {
  const safeOriginalName = sanitizeFileName(originalName);
  const extension = inferExtensionFromMime(mimeType, actionType, targetFormat);
  const dotIndex = safeOriginalName.lastIndexOf('.');
  const baseName = dotIndex > 0 ? safeOriginalName.slice(0, dotIndex) : safeOriginalName;
  return `${baseName || 'result'}.${extension}`;
};

const extractJobStatus = (payload) => ({
  jobId: String(payload?.jobId || payload?.job_id || payload?.id || '').trim(),
  status: String(payload?.status || '').trim().toLowerCase(),
  progress: Math.max(0, Math.min(100, Number(payload?.progress || 0) || 0)),
  downloadUrl: String(payload?.downloadUrl || payload?.download_url || '').trim(),
  errorMessage: String(
    payload?.error?.message
      || payload?.error_detail?.message
      || payload?.error
      || payload?.message
      || '',
  ).trim(),
});

const buildInputKey = (fileName) => {
  const safeName = sanitizeFileName(fileName);
  const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `inputs/web/${randomId}/${safeName}`;
};

async function fetchJsonFromCandidates({ candidates, timeoutMs, ...requestInit }) {
  let lastError = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const url = candidates[index];

    try {
      const response = await withTimeout(
        (signal) => fetch(url, {
          ...requestInit,
          signal,
          credentials: 'include',
        }),
        timeoutMs,
      );
      const payload = await parseJsonSafe(response);

      if (response.ok) {
        return { response, payload, url };
      }

      const error = createApiError(response, payload, `Request failed (${response.status})`);
      if (shouldTryNextCandidate(response.status, index, candidates.length)) {
        lastError = error;
        continue;
      }

      throw error;
    } catch (error) {
      if (index < candidates.length - 1) {
        lastError = error;
        continue;
      }

      throw normalizeCloudError(lastError || error, 'Request failed');
    }
  }

  throw normalizeCloudError(lastError || new Error('Request failed'), 'Request failed');
}

async function downloadBlob({ candidates, timeoutMs }) {
  let lastError = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const url = candidates[index];

    try {
      const response = await withTimeout(
        (signal) => fetch(url, {
          method: 'GET',
          signal,
          credentials: 'include',
        }),
        timeoutMs,
      );

      if (response.ok) {
        return {
          blob: await response.blob(),
          response,
          url,
        };
      }

      const payload = await parseJsonSafe(response);
      const error = createApiError(response, payload, `Download failed (${response.status})`);
      if (shouldTryNextCandidate(response.status, index, candidates.length)) {
        lastError = error;
        continue;
      }

      throw error;
    } catch (error) {
      if (index < candidates.length - 1) {
        lastError = error;
        continue;
      }

      throw normalizeCloudError(lastError || error, 'Download failed');
    }
  }

  throw normalizeCloudError(lastError || new Error('Download failed'), 'Download failed');
}

export default function useCloudConvert({ apiBase = import.meta.env.VITE_API_BASE || '/api' } = {}) {
  const [state, setState] = useState(createIdleState);
  const mountedRef = useRef(true);

  const updateState = useCallback((nextState) => {
    if (!mountedRef.current) {
      return;
    }

    setState((current) => ({
      ...current,
      ...(typeof nextState === 'function' ? nextState(current) : nextState),
    }));
  }, []);

  const resetSession = useCallback(() => {
    updateState(createIdleState());
  }, [updateState]);

  const pingServer = useCallback(async () => {
    updateState({
      phase: 'checking',
      progress: 6,
      error: '',
    });

    try {
      const candidates = buildHealthCandidates(apiBase);

      for (let index = 0; index < candidates.length; index += 1) {
        const url = candidates[index];

        try {
          const response = await withTimeout(
            (signal) => fetch(url, {
              method: 'GET',
              signal,
              credentials: 'include',
              cache: 'no-store',
            }),
            HEALTH_TIMEOUT_MS,
          );

          if (response.ok) {
            return true;
          }
        } catch {
          // Try the next available candidate.
        }
      }

      updateState({
        phase: 'idle',
        progress: 0,
      });
      return false;
    } catch {
      updateState({
        phase: 'idle',
        progress: 0,
      });
      return false;
    }
  }, [apiBase, updateState]);

  const uploadAndConvert = useCallback(async (file, actionType, requestOptions = {}) => {
    if (!(file instanceof File)) {
      throw new Error('File is required for cloud conversion.');
    }

    const safeFileName = sanitizeFileName(file.name);
    const inputKey = buildInputKey(safeFileName);
    const fileExtension = safeFileName.includes('.') ? safeFileName.split('.').pop() : '';
    const resolvedInputFormat = String(requestOptions.inputFormat || fileExtension || '').trim().toLowerCase();
    const resolvedTargetFormat = String(requestOptions.targetFormat || requestOptions.toFormat || '').trim().toLowerCase();
    const resolvedTool = String(requestOptions.tool || '').trim() || (actionType === 'convert' ? '' : String(actionType || '').trim());
    const resolvedSettings = requestOptions.settings && typeof requestOptions.settings === 'object'
      ? requestOptions.settings
      : {};

    try {
      updateState({
        phase: 'uploading',
        progress: 14,
        error: '',
        jobId: '',
        downloadUrl: '',
      });

      const { payload: uploadPayload } = await fetchJsonFromCandidates({
        candidates: buildUploadCandidates(apiBase),
        method: 'POST',
        headers: {
          'content-type': String(file.type || 'application/octet-stream'),
          'x-input-key': inputKey,
          'x-file-name': safeFileName,
          'x-file-size': String(file.size || 0),
        },
        body: file,
        timeoutMs: REQUEST_TIMEOUT_MS,
      });

      const resolvedInputKey = String(uploadPayload?.inputKey || inputKey).trim() || inputKey;

      updateState({
        phase: 'queued',
        progress: 22,
      });

      const { payload: convertPayload } = await fetchJsonFromCandidates({
        candidates: buildConvertCandidates(apiBase),
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          tool: resolvedTool || undefined,
          input_key: resolvedInputKey,
          inputKey: resolvedInputKey,
          original_name: safeFileName,
          originalName: safeFileName,
          inputFormat: resolvedInputFormat,
          input_format: resolvedInputFormat,
          inputSize: Number(file.size || 0),
          input_size: Number(file.size || 0),
          targetFormat: resolvedTargetFormat || undefined,
          target_format: resolvedTargetFormat || undefined,
          to_format: resolvedTargetFormat || undefined,
          settings: resolvedSettings,
        }),
        timeoutMs: REQUEST_TIMEOUT_MS,
      });

      const normalizedJob = extractJobStatus(convertPayload);
      const jobId = normalizedJob.jobId;

      if (!jobId) {
        throw new Error('Cloud conversion job id is missing.');
      }

      updateState({
        phase: normalizedJob.status === 'completed' ? 'downloading' : 'processing',
        progress: normalizedJob.status === 'completed'
          ? 96
          : Math.max(24, Math.min(92, 24 + (normalizedJob.progress * 0.68))),
        jobId,
      });

      const startedAt = Date.now();
      let latestJob = normalizedJob;

      while (latestJob.status !== 'completed') {
        if (latestJob.status === 'failed') {
          const error = new Error(latestJob.errorMessage || 'Cloud conversion failed');
          error.code = 'CLOUD_JOB_FAILED';
          throw error;
        }

        if (Date.now() - startedAt > JOB_TIMEOUT_MS) {
          const error = new Error('Cloud conversion timed out.');
          error.code = 'CLOUD_TIMEOUT';
          error.status = 504;
          throw error;
        }

        await wait(POLL_INTERVAL_MS);

        const { payload: jobPayload } = await fetchJsonFromCandidates({
          candidates: buildJobCandidates(apiBase, jobId),
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          timeoutMs: REQUEST_TIMEOUT_MS,
        });

        latestJob = extractJobStatus(jobPayload);

        if (latestJob.status === 'failed') {
          const error = new Error(latestJob.errorMessage || 'Cloud conversion failed');
          error.code = 'CLOUD_JOB_FAILED';
          throw error;
        }

        updateState({
          phase: latestJob.status === 'queued' ? 'queued' : 'processing',
          progress: latestJob.status === 'queued'
            ? 24
            : Math.max(26, Math.min(94, 26 + (latestJob.progress * 0.68))),
          jobId,
          downloadUrl: latestJob.downloadUrl || '',
        });
      }

      if (!latestJob.downloadUrl) {
        throw new Error('Cloud conversion completed without a download URL.');
      }

      updateState({
        phase: 'downloading',
        progress: 96,
        downloadUrl: latestJob.downloadUrl,
      });

      const downloadCandidates = latestJob.downloadUrl.startsWith('/')
        ? uniqueList([
          latestJob.downloadUrl,
          ...buildBaseVariants(apiBase)
            .filter((base) => /^https?:\/\//i.test(base))
            .map((base) => joinUrl(/\/api$/i.test(base) ? base.replace(/\/api$/i, '') : base, latestJob.downloadUrl)),
        ])
        : [latestJob.downloadUrl];

      const { blob, response } = await downloadBlob({
        candidates: downloadCandidates,
        timeoutMs: REQUEST_TIMEOUT_MS,
      });

      const responseMimeType = String(response.headers.get('content-type') || blob.type || 'application/octet-stream').split(';')[0];
      const fileNameFromHeader = extractFileNameFromDisposition(response.headers.get('content-disposition'));
      const resultFileName = sanitizeFileName(
        fileNameFromHeader || buildFallbackResultName(safeFileName, actionType, responseMimeType, resolvedTargetFormat),
      );

      updateState({
        phase: 'completed',
        progress: 100,
        error: '',
        jobId,
        downloadUrl: latestJob.downloadUrl,
      });

      return {
        blob,
        url: latestJob.downloadUrl,
        fileName: resultFileName,
        mimeType: responseMimeType,
        size: Number(blob.size || 0),
        jobId,
        downloadUrl: latestJob.downloadUrl,
      };
    } catch (error) {
      const normalizedError = normalizeCloudError(error);
      updateState({
        phase: 'failed',
        error: String(normalizedError?.message || 'Cloud conversion failed.'),
      });
      throw normalizedError;
    }
  }, [apiBase, updateState]);

  const uploadAndConvertToCloud = useCallback(async (file, targetFormat, settings = {}) => (
    uploadAndConvert(file, 'convert', {
      tool: 'convert',
      targetFormat,
      settings,
    })
  ), [uploadAndConvert]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    ...state,
    isCheckingServer: state.phase === 'checking',
    isUploading: state.phase === 'uploading',
    isPollingJob: state.phase === 'queued' || state.phase === 'processing' || state.phase === 'downloading',
    isBusy: ['checking', 'uploading', 'queued', 'processing', 'downloading'].includes(state.phase),
    pingServer,
    uploadAndConvert,
    uploadAndConvertToCloud,
    resetSession,
  };
}
