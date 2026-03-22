import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

import {
  concatBytes,
  randomBytes,
  utf8ToBytes,
  bytesToBase64
} from "./encoding";
import {
  createCurve25519KeyPair,
  createIdentityKeyPair,
  deriveCurve25519SharedSecretBytes,
  signEnvelope,
  verifyEnvelopeSignature,
  type Curve25519KeyPair,
  type IdentityKeyPair
} from "./signing";

const x3dhInfo = utf8ToBytes("messenger:signal-inspired:x3dh:v1");

const randomId = () => bytesToBase64(randomBytes(12));

export interface LocalOneTimePreKey {
  keyId: string;
  keyPair: Curve25519KeyPair;
}

export interface LocalPreKeyMaterial {
  registrationId: string;
  identitySigningKeyPair: IdentityKeyPair;
  identityDhKeyPair: Curve25519KeyPair;
  signedPreKeyId: string;
  signedPreKeyKeyPair: Curve25519KeyPair;
  signedPreKeySignature: string;
  oneTimePreKeys: LocalOneTimePreKey[];
}

export interface OneTimePreKeyBundle {
  keyId: string;
  publicKey: string;
}

export interface PreKeyBundle {
  version: "signal-inspired-v1";
  registrationId: string;
  identitySigningPublicKey: string;
  identityDhPublicKey: string;
  signedPreKeyId: string;
  signedPreKeyPublicKey: string;
  signedPreKeySignature: string;
  oneTimePreKeys: OneTimePreKeyBundle[];
}

export interface X3dhInitiatorSession {
  sessionId: string;
  sharedSecret: string;
  localIdentityDhPublicKey: string;
  localEphemeralKeyPair: Curve25519KeyPair;
  remoteIdentityDhPublicKey: string;
  remoteSignedPreKeyId: string;
  remoteSignedPreKeyPublicKey: string;
  remoteOneTimePreKeyId?: string;
}

export interface X3dhResponderSession {
  sessionId: string;
  sharedSecret: string;
  remoteIdentityDhPublicKey: string;
  remoteEphemeralPublicKey: string;
  usedSignedPreKeyId: string;
  usedOneTimePreKeyId?: string;
}

export const createLocalPreKeyMaterial = async (
  options?: {
    registrationId?: string;
    oneTimePreKeyCount?: number;
  }
): Promise<LocalPreKeyMaterial> => {
  const identitySigningKeyPair = createIdentityKeyPair();
  const identityDhKeyPair = createCurve25519KeyPair();
  const signedPreKeyId = randomId();
  const signedPreKeyKeyPair = createCurve25519KeyPair();
  const signedPreKeySignature = (
    await signEnvelope(
      signedPreKeyKeyPair.publicKey,
      identitySigningKeyPair.privateKey
    )
  ).signature;

  const oneTimePreKeys = Array.from(
    { length: options?.oneTimePreKeyCount ?? 5 },
    () => ({
      keyId: randomId(),
      keyPair: createCurve25519KeyPair()
    })
  );

  return {
    registrationId: options?.registrationId ?? randomId(),
    identitySigningKeyPair,
    identityDhKeyPair,
    signedPreKeyId,
    signedPreKeyKeyPair,
    signedPreKeySignature,
    oneTimePreKeys
  };
};

export const createPreKeyBundle = (
  material: LocalPreKeyMaterial
): PreKeyBundle => ({
  version: "signal-inspired-v1",
  registrationId: material.registrationId,
  identitySigningPublicKey: material.identitySigningKeyPair.publicKey,
  identityDhPublicKey: material.identityDhKeyPair.publicKey,
  signedPreKeyId: material.signedPreKeyId,
  signedPreKeyPublicKey: material.signedPreKeyKeyPair.publicKey,
  signedPreKeySignature: material.signedPreKeySignature,
  oneTimePreKeys: material.oneTimePreKeys.map((key) => ({
    keyId: key.keyId,
    publicKey: key.keyPair.publicKey
  }))
});

export const verifyPreKeyBundle = async (
  bundle: PreKeyBundle
): Promise<boolean> =>
  verifyEnvelopeSignature(
    bundle.signedPreKeyPublicKey,
    bundle.signedPreKeySignature,
    bundle.identitySigningPublicKey
  );

export const initializeX3dhInitiatorSession = async (
  options: {
    sessionId?: string;
    localIdentityDhKeyPair: Curve25519KeyPair;
    remoteBundle: PreKeyBundle;
    localEphemeralKeyPair?: Curve25519KeyPair;
    remoteOneTimePreKeyId?: string;
  }
): Promise<X3dhInitiatorSession> => {
  const isBundleValid = await verifyPreKeyBundle(options.remoteBundle);

  if (!isBundleValid) {
    throw new Error("Remote pre-key bundle signature is invalid.");
  }

  const localEphemeralKeyPair =
    options.localEphemeralKeyPair ?? createCurve25519KeyPair();
  const selectedOneTimePreKey = options.remoteOneTimePreKeyId
    ? options.remoteBundle.oneTimePreKeys.find(
        (key) => key.keyId === options.remoteOneTimePreKeyId
      )
    : options.remoteBundle.oneTimePreKeys[0];

  const dh1 = deriveCurve25519SharedSecretBytes(
    options.localIdentityDhKeyPair.privateKey,
    options.remoteBundle.signedPreKeyPublicKey
  );
  const dh2 = deriveCurve25519SharedSecretBytes(
    localEphemeralKeyPair.privateKey,
    options.remoteBundle.identityDhPublicKey
  );
  const dh3 = deriveCurve25519SharedSecretBytes(
    localEphemeralKeyPair.privateKey,
    options.remoteBundle.signedPreKeyPublicKey
  );
  const dh4 = selectedOneTimePreKey
    ? deriveCurve25519SharedSecretBytes(
        localEphemeralKeyPair.privateKey,
        selectedOneTimePreKey.publicKey
      )
    : new Uint8Array();

  const sharedSecret = hkdf(
    sha256,
    concatBytes(dh1, dh2, dh3, dh4),
    undefined,
    x3dhInfo,
    32
  );

  return {
    sessionId: options.sessionId ?? randomId(),
    sharedSecret: bytesToBase64(sharedSecret),
    localIdentityDhPublicKey: options.localIdentityDhKeyPair.publicKey,
    localEphemeralKeyPair,
    remoteIdentityDhPublicKey: options.remoteBundle.identityDhPublicKey,
    remoteSignedPreKeyId: options.remoteBundle.signedPreKeyId,
    remoteSignedPreKeyPublicKey: options.remoteBundle.signedPreKeyPublicKey,
    remoteOneTimePreKeyId: selectedOneTimePreKey?.keyId
  };
};

export const initializeX3dhResponderSession = (
  options: {
    sessionId: string;
    localIdentityDhKeyPair: Curve25519KeyPair;
    localSignedPreKeyId: string;
    localSignedPreKeyKeyPair: Curve25519KeyPair;
    localOneTimePreKeyKeyPair?: Curve25519KeyPair;
    remoteIdentityDhPublicKey: string;
    remoteEphemeralPublicKey: string;
  }
): X3dhResponderSession => {
  const dh1 = deriveCurve25519SharedSecretBytes(
    options.localSignedPreKeyKeyPair.privateKey,
    options.remoteIdentityDhPublicKey
  );
  const dh2 = deriveCurve25519SharedSecretBytes(
    options.localIdentityDhKeyPair.privateKey,
    options.remoteEphemeralPublicKey
  );
  const dh3 = deriveCurve25519SharedSecretBytes(
    options.localSignedPreKeyKeyPair.privateKey,
    options.remoteEphemeralPublicKey
  );
  const dh4 = options.localOneTimePreKeyKeyPair
    ? deriveCurve25519SharedSecretBytes(
        options.localOneTimePreKeyKeyPair.privateKey,
        options.remoteEphemeralPublicKey
      )
    : new Uint8Array();

  const sharedSecret = hkdf(
    sha256,
    concatBytes(dh1, dh2, dh3, dh4),
    undefined,
    x3dhInfo,
    32
  );

  return {
    sessionId: options.sessionId,
    sharedSecret: bytesToBase64(sharedSecret),
    remoteIdentityDhPublicKey: options.remoteIdentityDhPublicKey,
    remoteEphemeralPublicKey: options.remoteEphemeralPublicKey,
    usedSignedPreKeyId: options.localSignedPreKeyId
  };
};
