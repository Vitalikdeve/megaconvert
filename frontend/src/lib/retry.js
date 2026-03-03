const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const withRetry = async (fn, options = {}) => {
  const retries = Number(options.retries ?? 2);
  const baseDelayMs = Number(options.baseDelayMs ?? 200);
  const shouldRetry = typeof options.shouldRetry === 'function'
    ? options.shouldRetry
    : () => true;

  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !shouldRetry(error, attempt)) {
        throw error;
      }
      const nextDelay = baseDelayMs * (2 ** attempt);
      await delay(nextDelay);
      attempt += 1;
    }
  }

  throw lastError || new Error('Retry failed');
};

