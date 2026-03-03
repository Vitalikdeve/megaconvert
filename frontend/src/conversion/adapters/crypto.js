import nacl from 'tweetnacl';
import { ConversionError } from '../core/errors';
import { fetchWithTimeout } from '../infra/timeouts';
import { retry } from '../infra/retries';

const DIRECT_API_FALLBACK = String(import.meta.env.VITE_DIRECT_API_FALLBACK || 'https://34.122.218.135.nip.io')
  .trim()
  .replace(/\/+$/, '');

export const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
export const bytesToB64 = (bytes) => btoa(String.fromCharCode(...bytes));

const hasWebCrypto = () => {
  return typeof globalThis !== 'undefined'
    && !!globalThis.crypto
    && typeof globalThis.crypto.getRandomValues === 'function'
    && !!globalThis.crypto.subtle
    && typeof globalThis.crypto.subtle.importKey === 'function';
};

const cryptoUnsupportedMessage = () => {
  const insecure = typeof window !== 'undefined' && window.isSecureContext === false;
  if (insecure) {
    return 'Web Crypto is unavailable in insecure context. Use HTTPS (or localhost) to enable client encryption.';
  }
  return 'Required Web Crypto APIs are not supported by this browser.';
};

export const getCryptoSupport = () => ({
  webCrypto: hasWebCrypto(),
  secureContext: typeof window === 'undefined' ? true : Boolean(window.isSecureContext)
});

const ensureWebCrypto = () => {
  if (!hasWebCrypto()) {
    throw new ConversionError('CRYPTO_UNSUPPORTED', cryptoUnsupportedMessage());
  }
};

const shouldTryDirectFallback = (apiBase) => {
  const base = String(apiBase || '').trim().toLowerCase();
  if (!base) return false;
  if (!DIRECT_API_FALLBACK) return false;
  if (base.startsWith(DIRECT_API_FALLBACK.toLowerCase())) return false;
  if (base.startsWith('http://localhost') || base.startsWith('https://localhost')) return false;
  if (base.startsWith('http://127.0.0.1') || base.startsWith('https://127.0.0.1')) return false;
  return base.startsWith('/');
};

const counterToBytesBE = (counter) => {
  const view = new DataView(new ArrayBuffer(4));
  view.setUint32(0, counter, false);
  return new Uint8Array(view.buffer);
};

export const generateAesKey = () => {
  ensureWebCrypto();
  return crypto.getRandomValues(new Uint8Array(32));
};

export const createSession = async (apiBase, authHeaders, { timeoutMs = 15_000, logger } = {}) => {
  const fetchSession = async (base) => {
    const url = `${base}/crypto/session`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      cache: 'no-store',
      headers: { ...authHeaders }
    }, timeoutMs);
    const data = await res.json();
    if (!res.ok) {
      throw new ConversionError(data.code || 'SESSION_CREATE_FAILED', data.message || 'Failed to create session.');
    }
    logger?.info('session_created', { sessionId: data.sessionId });
    return { publicKey: data.publicKey, sessionId: data.sessionId };
  };

  return retry(async () => {
    try {
      try {
        return await fetchSession(apiBase);
      } catch (error) {
        if (!shouldTryDirectFallback(apiBase)) throw error;
        if (!(error instanceof ConversionError)) throw error;
        if (!['SESSION_CREATE_FAILED', 'NETWORK_ERROR', 'TIMEOUT', 'QUEUE_UNAVAILABLE'].includes(error.code)) {
          throw error;
        }
        return await fetchSession(DIRECT_API_FALLBACK);
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new ConversionError('TIMEOUT', 'Request timed out while creating crypto session.');
      }
      if (error instanceof ConversionError) throw error;
      throw new ConversionError('NETWORK_ERROR', error?.message || 'Network request failed while creating crypto session.');
    }
  }, {
    attempts: 4,
    shouldRetry: (error) => ['SESSION_CREATE_FAILED', 'NETWORK_ERROR', 'TIMEOUT', 'QUEUE_UNAVAILABLE'].includes(error?.code)
  });
};

export const wrapKeyForWorker = (keyBytes, publicKey) => {
  if (!publicKey) throw new ConversionError('WORKER_KEY_MISSING', 'Worker public key not available.');
  const clientKeypair = nacl.box.keyPair();
  const workerPub = b64ToBytes(publicKey);
  const shared = nacl.box.before(workerPub, clientKeypair.secretKey);
  const nonce = nacl.randomBytes(24);
  const wrapped = nacl.secretbox(keyBytes, nonce, shared);
  return {
    keyWrap: {
      wrappedKey: bytesToB64(wrapped),
      nonce: bytesToB64(nonce),
      clientPublicKey: bytesToB64(clientKeypair.publicKey)
    }
  };
};

export const encryptFileGcm = async (file, keyBytes, chunkSize = 4 * 1024 * 1024) => {
  ensureWebCrypto();
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const ivBase = crypto.getRandomValues(new Uint8Array(8));
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));
  const outChunks = [];
  for (let i = 0; i < totalChunks; i += 1) {
    const start = i * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    const chunk = await file.slice(start, end).arrayBuffer();
    const iv = new Uint8Array(12);
    iv.set(ivBase, 0);
    iv.set(counterToBytesBE(i), 8);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, chunk);
    outChunks.push(new Uint8Array(encrypted));
  }
  return {
    blob: new Blob(outChunks, { type: 'application/octet-stream' }),
    meta: {
      alg: 'AES-256-GCM',
      chunkSize,
      totalChunks,
      ivBase: bytesToB64(ivBase)
    }
  };
};

export const decryptFileGcm = async (encryptedBuffer, meta, keyBytes) => {
  ensureWebCrypto();
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const { chunkSize, totalChunks, ivBase } = meta;
  const ivBaseBytes = b64ToBytes(ivBase);
  const bytes = new Uint8Array(encryptedBuffer);
  const outChunks = [];
  let offset = 0;
  for (let i = 0; i < totalChunks; i += 1) {
    const cipherChunkSize = (i === totalChunks - 1)
      ? bytes.length - offset
      : chunkSize + 16;
    const cipherChunk = bytes.slice(offset, offset + cipherChunkSize);
    offset += cipherChunkSize;
    const iv = new Uint8Array(12);
    iv.set(ivBaseBytes, 0);
    iv.set(counterToBytesBE(i), 8);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherChunk);
    outChunks.push(new Uint8Array(decrypted));
  }
  return new Blob(outChunks);
};
