const jitterDelay = (delay, jitter = 0.2) => {
  const span = delay * jitter;
  return delay - span + Math.random() * span * 2;
};

export const retry = async (fn, {
  attempts = 3,
  baseDelayMs = 300,
  maxDelayMs = 4_000,
  factor = 2,
  jitter = 0.2,
  shouldRetry = () => true
} = {}) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetry(error)) break;
      const delay = Math.min(maxDelayMs, baseDelayMs * (factor ** (attempt - 1)));
      await new Promise((resolve) => setTimeout(resolve, jitterDelay(delay, jitter)));
    }
  }
  throw lastError;
};
