import AsyncStorage from '@react-native-async-storage/async-storage';

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
};

const SECRETS_STORAGE_KEY = 'megaconvert.e2ee.shared-secrets.v1';
const AES_GCM_UNAVAILABLE_ERROR = 'AES_GCM_UNAVAILABLE';
const AES_GCM_IV_BYTES = 12;
const AES_GCM_KEY_BYTES = 32;

function normalizePeerId(peerId: string): string {
  return String(peerId || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}

function getCryptoApi(): Crypto | null {
  if (typeof globalThis === 'undefined') {
    return null;
  }
  const value = globalThis.crypto;
  if (value && typeof value.getRandomValues === 'function') {
    return value;
  }
  return null;
}

function getSubtleApi(): SubtleCrypto | null {
  const cryptoApi = getCryptoApi();
  if (!cryptoApi || !cryptoApi.subtle) {
    return null;
  }
  return cryptoApi.subtle;
}

function secureRandomBytes(length: number): Uint8Array {
  const cryptoApi = getCryptoApi();
  if (!cryptoApi) {
    throw new Error(AES_GCM_UNAVAILABLE_ERROR);
  }

  const output = new Uint8Array(length);
  cryptoApi.getRandomValues(output);
  return output;
}

function randomHex(length: number): string {
  const bytes = secureRandomBytes(Math.ceil(length / 2));
  return toHex(bytes).slice(0, length);
}

async function loadSecretsMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(SECRETS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

async function saveSecretsMap(nextSecrets: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(SECRETS_STORAGE_KEY, JSON.stringify(nextSecrets));
}

function utf8ToBytes(value: string): number[] {
  const encoded = encodeURIComponent(value);
  const bytes: number[] = [];

  for (let index = 0; index < encoded.length; index += 1) {
    const char = encoded[index];
    if (char === '%') {
      const hex = encoded.slice(index + 1, index + 3);
      bytes.push(Number.parseInt(hex, 16));
      index += 2;
      continue;
    }
    bytes.push(char.charCodeAt(0));
  }

  return bytes;
}

function bytesToUtf8(bytes: number[]): string {
  const encoded = bytes
    .map((byte) => `%${byte.toString(16).padStart(2, '0')}`)
    .join('');
  try {
    return decodeURIComponent(encoded);
  } catch {
    return '';
  }
}

function toHex(bytes: ArrayLike<number>): string {
  let output = '';
  for (let index = 0; index < bytes.length; index += 1) {
    output += Number(bytes[index]).toString(16).padStart(2, '0');
  }
  return output;
}

function fromHex(hex: string): Uint8Array {
  const normalized = String(hex || '').trim();
  if (!normalized || normalized.length % 2 !== 0) {
    return new Uint8Array(0);
  }

  const bytes = new Uint8Array(normalized.length / 2);
  let outputIndex = 0;
  for (let index = 0; index < normalized.length; index += 2) {
    const pair = normalized.slice(index, index + 2);
    bytes[outputIndex] = Number.parseInt(pair, 16);
    outputIndex += 1;
  }
  return bytes;
}

function encodeUtf8(value: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value);
  }

  const fallbackBytes = utf8ToBytes(value);
  return Uint8Array.from(fallbackBytes);
}

function decodeUtf8(value: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(value);
  }

  return bytesToUtf8(Array.from(value));
}

function deriveAesKeyMaterial(sharedSecret: string): Uint8Array {
  const rawBytes = fromHex(sharedSecret);
  if (rawBytes.length === 0) {
    throw new Error('INVALID_SHARED_SECRET');
  }

  if (rawBytes.length >= AES_GCM_KEY_BYTES) {
    return rawBytes.slice(0, AES_GCM_KEY_BYTES);
  }

  const output = new Uint8Array(AES_GCM_KEY_BYTES);
  for (let index = 0; index < AES_GCM_KEY_BYTES; index += 1) {
    const sourceByte = rawBytes[index % rawBytes.length] || 0;
    output[index] = sourceByte ^ ((index * 31) % 251);
  }
  return output;
}

function toRawBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function getOrCreateSharedSecret(peerId: string): Promise<string> {
  const normalizedPeerId = normalizePeerId(peerId);
  if (!normalizedPeerId) {
    throw new Error('INVALID_PEER_ID');
  }

  const secrets = await loadSecretsMap();
  const existingSecret = secrets[normalizedPeerId];
  if (existingSecret) {
    return existingSecret;
  }

  const generatedSecret = randomHex(64);
  const nextSecrets = {
    ...secrets,
    [normalizedPeerId]: generatedSecret,
  };
  await saveSecretsMap(nextSecrets);
  return generatedSecret;
}

export async function encryptMessage(plainText: string, sharedSecret: string): Promise<EncryptedPayload> {
  const subtle = getSubtleApi();
  if (!subtle) {
    throw new Error(AES_GCM_UNAVAILABLE_ERROR);
  }

  const ivBytes = secureRandomBytes(AES_GCM_IV_BYTES);
  const keyBytes = deriveAesKeyMaterial(sharedSecret);
  const cryptoKey = await subtle.importKey('raw', toRawBuffer(keyBytes), { name: 'AES-GCM' }, false, ['encrypt']);
  const cipherBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: toRawBuffer(ivBytes) },
    cryptoKey,
    toRawBuffer(encodeUtf8(String(plainText || '')))
  );

  return {
    iv: toHex(ivBytes),
    ciphertext: toHex(new Uint8Array(cipherBuffer)),
  };
}

export async function decryptMessage(payload: EncryptedPayload, sharedSecret: string): Promise<string> {
  const subtle = getSubtleApi();
  if (!subtle) {
    throw new Error(AES_GCM_UNAVAILABLE_ERROR);
  }

  const cipherBytes = fromHex(payload.ciphertext);
  const ivBytes = fromHex(payload.iv);
  if (cipherBytes.length === 0 || ivBytes.length !== AES_GCM_IV_BYTES) {
    throw new Error('INVALID_ENCRYPTED_PAYLOAD');
  }

  const keyBytes = deriveAesKeyMaterial(sharedSecret);
  const cryptoKey = await subtle.importKey('raw', toRawBuffer(keyBytes), { name: 'AES-GCM' }, false, ['decrypt']);
  const plainBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv: toRawBuffer(ivBytes) },
    cryptoKey,
    toRawBuffer(cipherBytes)
  );
  return decodeUtf8(new Uint8Array(plainBuffer));
}
