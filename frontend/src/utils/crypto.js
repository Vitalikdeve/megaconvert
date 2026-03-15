// Lightweight E2EE helpers powered by WebCrypto (browser only)
// Note: all functions assume a secure context (https) with window.crypto.subtle available.

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const toBase64 = (buffer) => {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
};

const fromBase64 = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export async function generateKeyPair() {
  const subtle = window.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto is not available.');

  return subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true, // extractable (private export to backup)
    ['deriveKey', 'deriveBits'],
  );
}

export async function exportPublicKey(key) {
  const subtle = window.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto is not available.');
  return subtle.exportKey('jwk', key);
}

export async function importPublicKey(jwk) {
  const subtle = window.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto is not available.');

  return subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  );
}

export async function deriveSharedSecret(privateKey, publicKey) {
  const subtle = window.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto is not available.');

  return subtle.deriveKey(
    {
      name: 'ECDH',
      public: publicKey,
    },
    privateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptMessage(text, sharedSecret) {
  const subtle = window.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto is not available.');

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = textEncoder.encode(text);

  const ciphertext = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    sharedSecret,
    encoded,
  );

  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv),
  };
}

export async function decryptMessage(encryptedObj, sharedSecret) {
  const subtle = window.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto is not available.');

  const payload = typeof encryptedObj === 'string' ? JSON.parse(encryptedObj) : encryptedObj;
  if (!payload?.ciphertext || !payload?.iv) {
    throw new Error('Invalid encrypted payload.');
  }

  const ivBytes = fromBase64(payload.iv);
  const cipherBytes = fromBase64(payload.ciphertext);

  const plaintext = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
    },
    sharedSecret,
    cipherBytes,
  );

  return textDecoder.decode(plaintext);
}

export default {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedSecret,
  encryptMessage,
  decryptMessage,
};
