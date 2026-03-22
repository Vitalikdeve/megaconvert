import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";

import {
  bytesToBase64,
  bytesToUtf8,
  concatBytes,
  utf8ToBytes,
  base64ToBytes
} from "./encoding";
import {
  createCurve25519KeyPair,
  deriveCurve25519SharedSecretBytes,
  type Curve25519KeyPair
} from "./signing";
import {
  decryptAuthenticated,
  encryptAuthenticated,
  type AuthenticatedCiphertext
} from "./symmetric";

const rootInfo = utf8ToBytes("messenger:double-ratchet:root:v1");
const chainMessageLabel = Uint8Array.of(1);
const chainStepLabel = Uint8Array.of(2);
const protocolVersion = "signal-inspired-v1";
const protocolAlgorithm = "Curve25519/AES-256-CBC/HMAC-SHA256";
const ratchetPurpose = "double-ratchet-message";

export interface DoubleRatchetHeader {
  dhPublicKey: string;
  previousChainLength: number;
  messageNumber: number;
}

export interface RatchetMessageEnvelope extends AuthenticatedCiphertext {
  version: typeof protocolVersion;
  algorithm: typeof protocolAlgorithm;
  sessionId: string;
  header: DoubleRatchetHeader;
}

export interface SkippedMessageKey {
  dhPublicKey: string;
  messageNumber: number;
  messageKeyBase64: string;
}

export interface DoubleRatchetSession {
  version: typeof protocolVersion;
  sessionId: string;
  role: "initiator" | "responder";
  rootKey: string;
  sendingChainKey: string | null;
  receivingChainKey: string | null;
  localRatchetKeyPair: Curve25519KeyPair;
  remoteRatchetPublicKey: string | null;
  previousChainLength: number;
  sendMessageNumber: number;
  receiveMessageNumber: number;
  maxSkippedMessageKeys: number;
  skippedMessageKeys: SkippedMessageKey[];
}

const deriveInitialRootKey = (sharedSecretBase64: string) =>
  hkdf(
    sha256,
    base64ToBytes(sharedSecretBase64),
    undefined,
    utf8ToBytes("messenger:double-ratchet:initial-root:v1"),
    32
  );

const kdfRoot = (
  rootKey: Uint8Array,
  dhOutput: Uint8Array
): {
  rootKey: Uint8Array;
  chainKey: Uint8Array;
} => {
  const material = hkdf(sha256, dhOutput, rootKey, rootInfo, 64);

  return {
    rootKey: material.slice(0, 32),
    chainKey: material.slice(32, 64)
  };
};

const kdfChain = (
  chainKey: Uint8Array
): {
  nextChainKey: Uint8Array;
  messageKey: Uint8Array;
} => ({
  nextChainKey: hmac(sha256, chainKey, chainStepLabel),
  messageKey: hmac(sha256, chainKey, chainMessageLabel)
});

const serializeHeader = (
  sessionId: string,
  header: DoubleRatchetHeader
): Uint8Array =>
  utf8ToBytes(
    JSON.stringify({
      sessionId,
      dhPublicKey: header.dhPublicKey,
      previousChainLength: header.previousChainLength,
      messageNumber: header.messageNumber
    })
  );

const messageAssociatedData = (
  envelope: {
    sessionId: string;
    header: DoubleRatchetHeader;
  },
  extraAssociatedData?: Uint8Array
) =>
  concatBytes(
    utf8ToBytes(protocolVersion),
    serializeHeader(envelope.sessionId, envelope.header),
    extraAssociatedData ?? new Uint8Array()
  );

const appendSkippedMessageKey = (
  session: DoubleRatchetSession,
  messageKey: Uint8Array
) => {
  if (!session.remoteRatchetPublicKey) {
    return;
  }

  session.skippedMessageKeys.push({
    dhPublicKey: session.remoteRatchetPublicKey,
    messageNumber: session.receiveMessageNumber,
    messageKeyBase64: bytesToBase64(messageKey)
  });

  if (session.skippedMessageKeys.length > session.maxSkippedMessageKeys) {
    session.skippedMessageKeys = session.skippedMessageKeys.slice(
      session.skippedMessageKeys.length - session.maxSkippedMessageKeys
    );
  }
};

const skipMessageKeys = (
  session: DoubleRatchetSession,
  untilMessageNumber: number
) => {
  if (!session.receivingChainKey) {
    if (untilMessageNumber === session.receiveMessageNumber) {
      return;
    }

    throw new Error("Receiving chain is not initialized.");
  }

  if (
    untilMessageNumber - session.receiveMessageNumber >
    session.maxSkippedMessageKeys
  ) {
    throw new Error("Too many skipped message keys requested.");
  }

  while (session.receiveMessageNumber < untilMessageNumber) {
    const step = kdfChain(base64ToBytes(session.receivingChainKey));
    session.receivingChainKey = bytesToBase64(step.nextChainKey);
    appendSkippedMessageKey(session, step.messageKey);
    session.receiveMessageNumber += 1;
  }
};

const popSkippedMessageKey = (
  session: DoubleRatchetSession,
  header: DoubleRatchetHeader
): Uint8Array | null => {
  const index = session.skippedMessageKeys.findIndex(
    (item) =>
      item.dhPublicKey === header.dhPublicKey &&
      item.messageNumber === header.messageNumber
  );

  if (index === -1) {
    return null;
  }

  const [key] = session.skippedMessageKeys.splice(index, 1);
  return base64ToBytes(key.messageKeyBase64);
};

const performDhRatchet = (session: DoubleRatchetSession, nextRemotePublicKey: string) => {
  const currentRootKey = base64ToBytes(session.rootKey);
  const receiveDhOutput = deriveCurve25519SharedSecretBytes(
    session.localRatchetKeyPair.privateKey,
    nextRemotePublicKey
  );
  const receiveStep = kdfRoot(currentRootKey, receiveDhOutput);
  const nextLocalRatchetKeyPair = createCurve25519KeyPair();
  const sendDhOutput = deriveCurve25519SharedSecretBytes(
    nextLocalRatchetKeyPair.privateKey,
    nextRemotePublicKey
  );
  const sendStep = kdfRoot(receiveStep.rootKey, sendDhOutput);
  const previousSendChainLength = session.sendMessageNumber;

  session.rootKey = bytesToBase64(sendStep.rootKey);
  session.receivingChainKey = bytesToBase64(receiveStep.chainKey);
  session.sendingChainKey = bytesToBase64(sendStep.chainKey);
  session.remoteRatchetPublicKey = nextRemotePublicKey;
  session.localRatchetKeyPair = nextLocalRatchetKeyPair;
  session.previousChainLength = previousSendChainLength;
  session.sendMessageNumber = 0;
  session.receiveMessageNumber = 0;
};

const decryptWithMessageKey = async (
  envelope: RatchetMessageEnvelope,
  messageKey: Uint8Array,
  extraAssociatedData?: Uint8Array
) =>
  decryptAuthenticated(
    {
      ciphertextBase64: envelope.ciphertextBase64,
      ivBase64: envelope.ivBase64,
      macBase64: envelope.macBase64
    },
    {
      masterKey: messageKey,
      purpose: ratchetPurpose,
      associatedData: messageAssociatedData(envelope, extraAssociatedData)
    }
  );

export const initializeDoubleRatchetSessionAsInitiator = (
  options: {
    sessionId: string;
    sharedSecret: string;
    remoteRatchetPublicKey: string;
    localRatchetKeyPair?: Curve25519KeyPair;
    maxSkippedMessageKeys?: number;
  }
): DoubleRatchetSession => {
  const localRatchetKeyPair =
    options.localRatchetKeyPair ?? createCurve25519KeyPair();
  const initialRootKey = deriveInitialRootKey(options.sharedSecret);
  const dhOutput = deriveCurve25519SharedSecretBytes(
    localRatchetKeyPair.privateKey,
    options.remoteRatchetPublicKey
  );
  const initialSendStep = kdfRoot(initialRootKey, dhOutput);

  return {
    version: protocolVersion,
    sessionId: options.sessionId,
    role: "initiator",
    rootKey: bytesToBase64(initialSendStep.rootKey),
    sendingChainKey: bytesToBase64(initialSendStep.chainKey),
    receivingChainKey: null,
    localRatchetKeyPair,
    remoteRatchetPublicKey: options.remoteRatchetPublicKey,
    previousChainLength: 0,
    sendMessageNumber: 0,
    receiveMessageNumber: 0,
    maxSkippedMessageKeys: options.maxSkippedMessageKeys ?? 64,
    skippedMessageKeys: []
  };
};

export const initializeDoubleRatchetSessionAsResponder = (
  options: {
    sessionId: string;
    sharedSecret: string;
    localRatchetKeyPair: Curve25519KeyPair;
    maxSkippedMessageKeys?: number;
  }
): DoubleRatchetSession => ({
  version: protocolVersion,
  sessionId: options.sessionId,
  role: "responder",
  rootKey: bytesToBase64(deriveInitialRootKey(options.sharedSecret)),
  sendingChainKey: null,
  receivingChainKey: null,
  localRatchetKeyPair: options.localRatchetKeyPair,
  remoteRatchetPublicKey: null,
  previousChainLength: 0,
  sendMessageNumber: 0,
  receiveMessageNumber: 0,
  maxSkippedMessageKeys: options.maxSkippedMessageKeys ?? 64,
  skippedMessageKeys: []
});

export const serializeDoubleRatchetSession = (
  session: DoubleRatchetSession
): string => JSON.stringify(session);

export const deserializeDoubleRatchetSession = (
  value: string
): DoubleRatchetSession => JSON.parse(value) as DoubleRatchetSession;

export const cloneDoubleRatchetSession = (
  session: DoubleRatchetSession
): DoubleRatchetSession =>
  deserializeDoubleRatchetSession(serializeDoubleRatchetSession(session));

export const ratchetEncrypt = async (
  session: DoubleRatchetSession,
  plaintext: Uint8Array,
  options?: {
    associatedData?: Uint8Array;
  }
): Promise<RatchetMessageEnvelope> => {
  if (!session.sendingChainKey) {
    throw new Error("Sending chain is not initialized.");
  }

  const step = kdfChain(base64ToBytes(session.sendingChainKey));
  const header: DoubleRatchetHeader = {
    dhPublicKey: session.localRatchetKeyPair.publicKey,
    previousChainLength: session.previousChainLength,
    messageNumber: session.sendMessageNumber
  };
  const encrypted = await encryptAuthenticated(plaintext, {
    masterKey: step.messageKey,
    purpose: ratchetPurpose,
    associatedData: messageAssociatedData(
      {
        sessionId: session.sessionId,
        header
      },
      options?.associatedData
    )
  });

  session.sendingChainKey = bytesToBase64(step.nextChainKey);
  session.sendMessageNumber += 1;

  return {
    version: protocolVersion,
    algorithm: protocolAlgorithm,
    sessionId: session.sessionId,
    header,
    ...encrypted
  };
};

export const ratchetEncryptText = async (
  session: DoubleRatchetSession,
  plaintext: string,
  options?: {
    associatedData?: Uint8Array;
  }
): Promise<RatchetMessageEnvelope> =>
  ratchetEncrypt(session, utf8ToBytes(plaintext), options);

export const ratchetDecrypt = async (
  session: DoubleRatchetSession,
  envelope: RatchetMessageEnvelope,
  options?: {
    associatedData?: Uint8Array;
  }
): Promise<Uint8Array> => {
  const skippedKey = popSkippedMessageKey(session, envelope.header);

  if (skippedKey) {
    return decryptWithMessageKey(envelope, skippedKey, options?.associatedData);
  }

  if (session.remoteRatchetPublicKey !== envelope.header.dhPublicKey) {
    if (session.receivingChainKey) {
      skipMessageKeys(session, envelope.header.previousChainLength);
    }

    performDhRatchet(session, envelope.header.dhPublicKey);
  }

  skipMessageKeys(session, envelope.header.messageNumber);

  if (!session.receivingChainKey) {
    throw new Error("Receiving chain is not initialized.");
  }

  const step = kdfChain(base64ToBytes(session.receivingChainKey));
  session.receivingChainKey = bytesToBase64(step.nextChainKey);
  session.receiveMessageNumber += 1;

  return decryptWithMessageKey(envelope, step.messageKey, options?.associatedData);
};

export const ratchetDecryptText = async (
  session: DoubleRatchetSession,
  envelope: RatchetMessageEnvelope,
  options?: {
    associatedData?: Uint8Array;
  }
): Promise<string> =>
  bytesToUtf8(await ratchetDecrypt(session, envelope, options));
