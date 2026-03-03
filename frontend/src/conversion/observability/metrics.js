export const createMetrics = (emit) => ({
  increment: (name, value = 1, tags = {}) => {
    emit?.('conversion_metric', { name, value, tags, ts: Date.now() });
  },
  timing: (name, value, tags = {}) => {
    emit?.('conversion_metric', { name, value, tags, ts: Date.now(), type: 'timing' });
  }
});
