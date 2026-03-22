import sodium from "libsodium-wrappers";

import { base64ToBytes, bytesToBase64, utf8ToBytes } from "./encoding";

await sodium.ready;

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
  const pair = sodium.crypto_sign_keypair();

  return {
    publicKey: bytesToBase64(pair.publicKey),
    privateKey: bytesToBase64(pair.privateKey)
  };
};

export const createSigningKeyPair = createIdentityKeyPair;

export const createCurve25519KeyPair = (): Curve25519KeyPair => {
  const pair = sodium.crypto_box_keypair();

  return {
    publicKey: bytesToBase64(pair.publicKey),
    privateKey: bytesToBase64(pair.privateKey)
  };
};

export const deriveCurve25519SharedSecretBytes = (
  privateKeyBase64: string,
  publicKeyBase64: string
): Uint8Array =>
  sodium.crypto_scalarmult(
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
  const signature = sodium.crypto_sign_detached(
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
  sodium.crypto_sign_verify_detached(
    base64ToBytes(signatureBase64),
    utf8ToBytes(payload),
    base64ToBytes(publicKeyBase64)
  );
