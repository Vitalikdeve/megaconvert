const bufferToHex = (buffer) => Array.from(new Uint8Array(buffer))
  .map((b) => b.toString(16).padStart(2, '0'))
  .join('');

const canDigest = () => {
  return typeof globalThis !== 'undefined'
    && !!globalThis.crypto
    && !!globalThis.crypto.subtle
    && typeof globalThis.crypto.subtle.digest === 'function';
};

export const computeChecksum = async (file, maxBytes) => {
  if (!file || (maxBytes && file.size > maxBytes)) return null;
  if (!canDigest()) return null;
  try {
    const buffer = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    return bufferToHex(hash);
  } catch (error) {
    void error;
    return null;
  }
};
