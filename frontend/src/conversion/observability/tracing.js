export const createTracer = (emit) => ({
  startSpan: (name, data = {}) => {
    const start = Date.now();
    emit?.('conversion_trace', { event: 'start', name, ts: start, ...data });
    return {
      end: (info = {}) => {
        emit?.('conversion_trace', {
          event: 'end',
          name,
          ts: Date.now(),
          durationMs: Date.now() - start,
          ...info
        });
      }
    };
  }
});
