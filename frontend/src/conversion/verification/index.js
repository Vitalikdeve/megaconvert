import { verifyDownloadMime } from './mimeCheck';
import { openTest } from './openTest';

const SOFT_HEAD_FAILURE_STATUSES = new Set([401, 403, 405, 501]);

const isSoftFailure = (check) => {
  if (!check) return true;
  if (check.ok) return false;
  if (check.reason === 'head_failed') {
    return SOFT_HEAD_FAILURE_STATUSES.has(Number(check.status || 0));
  }
  if (check.reason === 'range_failed') {
    return SOFT_HEAD_FAILURE_STATUSES.has(Number(check.status || 0));
  }
  return ['head_error', 'range_error'].includes(check.reason);
};

export const verifyOutput = async ({ url, expectedExt }) => {
  const normalizedUrl = String(url || '').trim().toLowerCase();
  if (normalizedUrl.startsWith('blob:') || normalizedUrl.startsWith('data:')) {
    return {
      ok: true,
      checks: {
        mime: { ok: true, reason: 'local_output' },
        open: { ok: true, reason: 'local_output' }
      }
    };
  }
  const mimeCheck = await verifyDownloadMime(url, expectedExt);
  const openCheck = await openTest(url);
  const hardFailures = [mimeCheck, openCheck].filter((check) => check && !check.ok && !isSoftFailure(check));
  const ok = hardFailures.length === 0;
  return {
    ok,
    checks: {
      mime: mimeCheck,
      open: openCheck
    }
  };
};
