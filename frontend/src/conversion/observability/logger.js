export const createLogger = (emit) => {
  const log = (level, event, payload = {}) => {
    emit?.('conversion_log', {
      level,
      event,
      ts: Date.now(),
      ...payload
    });
  };
  return {
    info: (event, payload) => log('info', event, payload),
    warn: (event, payload) => log('warn', event, payload),
    error: (event, payload) => log('error', event, payload),
    debug: (event, payload) => log('debug', event, payload)
  };
};
