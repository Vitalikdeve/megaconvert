import { fetchWithTimeout } from '../infra/timeouts';

const EXT_TO_MIME = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  txt: ['text/plain'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  webp: ['image/webp'],
  gif: ['image/gif'],
  mp3: ['audio/mpeg'],
  wav: ['audio/wav', 'audio/x-wav'],
  mp4: ['video/mp4'],
  mov: ['video/quicktime']
};

const GENERIC_MIME_PREFIXES = [
  'application/octet-stream',
  'binary/octet-stream',
  'application/download'
];

const isGenericMime = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  return GENERIC_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

export const verifyDownloadMime = async (url, expectedExt) => {
  if (!url) return { ok: false, reason: 'missing_url' };
  try {
    const res = await fetchWithTimeout(url, { method: 'HEAD' }, 10_000);
    if (!res.ok) return { ok: false, reason: 'head_failed', status: res.status };
    const type = res.headers.get('content-type') || '';
    const length = Number(res.headers.get('content-length') || 0);
    if (length === 0) return { ok: false, reason: 'empty_file' };
    if (expectedExt) {
      const allowed = EXT_TO_MIME[expectedExt] || [];
      if (allowed.length && !isGenericMime(type) && !allowed.some((mime) => type.includes(mime))) {
        return { ok: false, reason: 'mime_mismatch', type, expected: allowed };
      }
    }
    return { ok: true, type, length };
  } catch (error) {
    return { ok: false, reason: 'head_error', error };
  }
};
