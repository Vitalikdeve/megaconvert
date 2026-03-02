const listeners = new Map();

const getBucket = (eventName) => {
  if (!listeners.has(eventName)) listeners.set(eventName, new Set());
  return listeners.get(eventName);
};

export const onEvent = (eventName, handler) => {
  const bucket = getBucket(eventName);
  bucket.add(handler);
  return () => {
    bucket.delete(handler);
  };
};

export const emitEvent = (eventName, payload = {}) => {
  const bucket = listeners.get(eventName);
  if (!bucket || bucket.size === 0) return;
  for (const handler of bucket) {
    try {
      handler(payload);
    } catch (error) {
      console.error('[events] handler failed', eventName, error);
    }
  }
};

export const emitSystemEvent = (type, payload = {}) => {
  emitEvent(type, payload);
  emitEvent('*', { type, payload, ts: Date.now() });
};

