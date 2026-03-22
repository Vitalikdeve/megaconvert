import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";

import {
  base64ToBytes,
  bytesToBase64,
  concatBytes,
  constantTimeEqual,
  randomBytes,
  toArrayBuffer,
  utf8ToBytes
} from "./encoding";

const keyInfoPrefix = "messenger:aes256-cbc-hmac-sha256:";

export interface AuthenticatedCiphertext {
  ivBase64: string;
  ciphertextBase64: string;
  macBase64: string;
}

export interface RawAuthenticatedCiphertext {
  iv: Uint8Array;
  ciphertext: Uint8Array;
  mac: Uint8Array;
}

const importAesKey = async (keyBytes: Uint8Array) =>
  globalThis.crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    {
      name: "AES-CBC"
    },
    false,
    ["encrypt", "decrypt"]
  );

const deriveCipherKeys = (
  masterKey: Uint8Array,
  purpose: string
): {
  encryptionKey: Uint8Array;
  authenticationKey: Uint8Array;
} => {
  const material = hkdf(
    sha256,
    masterKey,
    undefined,
    utf8ToBytes(`${keyInfoPrefix}${purpose}`),
    64
  );

  return {
    encryptionKey: material.slice(0, 32),
    authenticationKey: material.slice(32, 64)
  };
};

const buildMacInput = (
  purpose: string,
  associatedData: Uint8Array | undefined,
  iv: Uint8Array,
  ciphertext: Uint8Array
) =>
  concatBytes(
    utf8ToBytes(keyInfoPrefix),
    utf8ToBytes(purpose),
    associatedData ?? new Uint8Array(),
    iv,
    ciphertext
  );

export const encryptAuthenticated = async (
  plaintext: Uint8Array,
  options: {
    masterKey: Uint8Array;
    purpose: string;
    associatedData?: Uint8Array;
  }
): Promise<AuthenticatedCiphertext> => {
  const iv = randomBytes(16);
  const keys = deriveCipherKeys(options.masterKey, options.purpose);
  const key = await importAesKey(keys.encryptionKey);
  const ciphertext = new Uint8Array(
    await globalThis.crypto.subtle.encrypt(
      {
        name: "AES-CBC",
        iv: toArrayBuffer(iv)
      },
      key,
      toArrayBuffer(plaintext)
    )
  );
  const mac = hmac(
    sha256,
    keys.authenticationKey,
    buildMacInput(options.purpose, options.associatedData, iv, ciphertext)
  );

  return {
    ivBase64: bytesToBase64(iv),
    ciphertextBase64: bytesToBase64(ciphertext),
    macBase64: bytesToBase64(mac)
  };
};

export const encryptAuthenticatedRaw = async (
  plaintext: Uint8Array,
  options: {
    masterKey: Uint8Array;
    purpose: string;
    associatedData?: Uint8Array;
  }
): Promise<RawAuthenticatedCiphertext> => {
  const iv = randomBytes(16);
  const keys = deriveCipherKeys(options.masterKey, options.purpose);
  const key = await importAesKey(keys.encryptionKey);
  const ciphertext = new Uint8Array(
    await globalThis.crypto.subtle.encrypt(
      {
        name: "AES-CBC",
        iv: toArrayBuffer(iv)
      },
      key,
      toArrayBuffer(plaintext)
    )
  );
  const mac = hmac(
    sha256,
    keys.authenticationKey,
    buildMacInput(options.purpose, options.associatedData, iv, ciphertext)
  );

  return {
    iv,
    ciphertext,
    mac
  };
};

export const decryptAuthenticated = async (
  payload: AuthenticatedCiphertext,
  options: {
    masterKey: Uint8Array;
    purpose: string;
    associatedData?: Uint8Array;
  }
): Promise<Uint8Array> => {
  const iv = base64ToBytes(payload.ivBase64);
  const ciphertext = base64ToBytes(payload.ciphertextBase64);
  const mac = base64ToBytes(payload.macBase64);
  const keys = deriveCipherKeys(options.masterKey, options.purpose);
  const expectedMac = hmac(
    sha256,
    keys.authenticationKey,
    buildMacInput(options.purpose, options.associatedData, iv, ciphertext)
  );

  if (!constantTimeEqual(mac, expectedMac)) {
    throw new Error("Ciphertext authentication failed.");
  }

  const key = await importAesKey(keys.encryptionKey);

  return new Uint8Array(
    await globalThis.crypto.subtle.decrypt(
      {
        name: "AES-CBC",
        iv: toArrayBuffer(iv)
      },
      key,
      toArrayBuffer(ciphertext)
    )
  );
};

export const decryptAuthenticatedRaw = async (
  payload: RawAuthenticatedCiphertext,
  options: {
    masterKey: Uint8Array;
    purpose: string;
    associatedData?: Uint8Array;
  }
): Promise<Uint8Array> => {
  const keys = deriveCipherKeys(options.masterKey, options.purpose);
  const expectedMac = hmac(
    sha256,
    keys.authenticationKey,
    buildMacInput(
      options.purpose,
      options.associatedData,
      payload.iv,
      payload.ciphertext
    )
  );

  if (!constantTimeEqual(payload.mac, expectedMac)) {
    throw new Error("Ciphertext authentication failed.");
  }

  const key = await importAesKey(keys.encryptionKey);

  return new Uint8Array(
    await globalThis.crypto.subtle.decrypt(
      {
        name: "AES-CBC",
        iv: toArrayBuffer(payload.iv)
      },
      key,
      toArrayBuffer(payload.ciphertext)
    )
  );
};
