export class ConversionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ConversionError';
    this.code = code;
    this.details = details;
  }
}

export const isRetryableError = (error) => {
  if (!error) return false;
  if (error.name === 'AbortError') return true;
  if (error.code && ['NETWORK_ERROR', 'TIMEOUT', 'UPLOAD_FAILED', 'JOB_STATUS_FETCH'].includes(error.code)) {
    return true;
  }
  return false;
};
