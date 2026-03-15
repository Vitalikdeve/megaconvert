const getSubtle = () => {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('WebCrypto is not available in this environment.');
  }
  return window.crypto.subtle;
};

const bufferToBase64 = (buffer) => {
  if (!buffer) return '';
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const base64ToBuffer = (b64) => {
  const normalized = String(b64 || '').trim();
  if (!normalized) return new ArrayBuffer(0);
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

export async function generateKeyPair() {
  const subtle = getSubtle();
  const keyPair = await subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits'],
  );
  return keyPair;
}

export async function exportPublicKey(publicKey) {
  const subtle = getSubtle();
  const jwk = await subtle.exportKey('jwk', publicKey);
  return jwk;
}

export async function importPublicKey(jwk) {
  const subtle = getSubtle();
  return subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    [],
  );
}

async function deriveAesKey(privateKey, publicKey) {
  const subtle = getSubtle();
  const rawBits = await subtle.deriveBits(
    {
      name: 'ECDH',
      public: publicKey,
    },
    privateKey,
    256,
  );
  return subtle.importKey(
    'raw',
    rawBits,
    {
      name: 'AES-GCM',
    },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function deriveSharedSecret(privateKey, publicKey) {
  return deriveAesKey(privateKey, publicKey);
}

export async function encryptMessage(text, sharedSecret) {
  if (!text || !text.length) {
    throw new Error('Message is empty.');
  }
  const subtle = getSubtle();
  const encoder = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    sharedSecret,
    encoder.encode(text),
  );
  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
  };
}

export async function decryptMessage(encrypted, sharedSecret) {
  if (!encrypted || typeof encrypted !== 'object') {
    throw new Error('Invalid encrypted payload.');
  }
  const { ciphertext, iv } = encrypted;
  if (!ciphertext || !iv) {
    throw new Error('Missing ciphertext or IV.');
  }

  const subtle = getSubtle();
  const decoder = new TextDecoder();
  const ivBytes = new Uint8Array(base64ToBuffer(iv));
  const cipherBuffer = base64ToBuffer(ciphertext);
  const plainBuffer = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
    },
    sharedSecret,
    cipherBuffer,
  );
  return decoder.decode(plainBuffer);
}

export const __debug = {
  bufferToBase64,
  base64ToBuffer,
};

