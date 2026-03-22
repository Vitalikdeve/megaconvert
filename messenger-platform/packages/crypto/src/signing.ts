import { ed25519, x25519 } from "@noble/curves/ed25519.js";

import { base64ToBytes, bytesToBase64, utf8ToBytes } from "./encoding";

export interface IdentityKeyPair {
  publicKey: string;
  privateKey: string;
}

export interface Curve25519KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface SignedEnvelope {
  payload: string;
  signature: string;
}

export const createIdentityKeyPair = (): IdentityKeyPair => {
  const privateKey = ed25519.utils.randomSecretKey();
  const publicKey = ed25519.getPublicKey(privateKey);

  return {
    publicKey: bytesToBase64(publicKey),
    privateKey: bytesToBase64(privateKey)
  };
};

export const createSigningKeyPair = createIdentityKeyPair;

export const createCurve25519KeyPair = (): Curve25519KeyPair => {
  const { secretKey, publicKey } = x25519.keygen();

  return {
    publicKey: bytesToBase64(publicKey),
    privateKey: bytesToBase64(secretKey)
  };
};

export const deriveCurve25519SharedSecretBytes = (
  privateKeyBase64: string,
  publicKeyBase64: string
): Uint8Array =>
  x25519.getSharedSecret(
    base64ToBytes(privateKeyBase64),
    base64ToBytes(publicKeyBase64)
  );

export const deriveCurve25519SharedSecret = (
  privateKeyBase64: string,
  publicKeyBase64: string
): string =>
  bytesToBase64(
    deriveCurve25519SharedSecretBytes(privateKeyBase64, publicKeyBase64)
  );

export const signEnvelope = async (
  payload: string,
  privateKeyBase64: string
): Promise<SignedEnvelope> => {
  const signature = ed25519.sign(
    utf8ToBytes(payload),
    base64ToBytes(privateKeyBase64)
  );

  return {
    payload,
    signature: bytesToBase64(signature)
  };
};

export const verifyEnvelopeSignature = async (
  payload: string,
  signatureBase64: string,
  publicKeyBase64: string
): Promise<boolean> =>
  ed25519.verify(
    base64ToBytes(signatureBase64),
    utf8ToBytes(payload),
    base64ToBytes(publicKeyBase64)
  );
