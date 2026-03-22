"use client";

import {
  cloneDoubleRatchetSession,
  createLocalPreKeyMaterial,
  createPreKeyBundle,
  initializeDoubleRatchetSessionAsInitiator,
  initializeDoubleRatchetSessionAsResponder,
  initializeX3dhInitiatorSession,
  initializeX3dhResponderSession,
  ratchetDecryptText,
  ratchetEncryptText,
  serializeDoubleRatchetSession,
  deserializeDoubleRatchetSession,
  utf8ToBytes,
  type DoubleRatchetSession
} from "@messenger/crypto";
import type { MessageEnvelope, StoredMessage } from "@messenger/shared";

const protocolVersion = "signal-inspired-v1";
const protocolAlgorithm = "Curve25519/AES-256-CBC/HMAC-SHA256";

interface LocalE2EERecord {
  version: typeof protocolVersion;
  sessionId: string;
  senderSession: string;
  receiverInitialSession: string;
  plaintextCache: Record<string, string>;
}

const buildStorageKey = (
  conversationId: string,
  currentUserId: string,
  currentDeviceId: string
) =>
  `messenger:e2ee:${conversationId}:${currentUserId}:${currentDeviceId}`;

const buildAssociatedData = (options: {
  conversationId: string;
  senderUserId: string;
  senderDeviceId: string;
  sessionId: string;
  ratchetCounter: number;
  senderRatchetPublicKey?: string;
  previousChainLength?: number;
  contentType?: "text" | "file";
}) =>
  utf8ToBytes(
    JSON.stringify({
      version: protocolVersion,
      conversationId: options.conversationId,
      senderUserId: options.senderUserId,
      senderDeviceId: options.senderDeviceId,
      sessionId: options.sessionId,
      ratchetCounter: options.ratchetCounter,
      senderRatchetPublicKey: options.senderRatchetPublicKey ?? null,
      previousChainLength: options.previousChainLength ?? 0,
      contentType: options.contentType ?? "text"
    })
  );

const persistRecord = (storageKey: string, record: LocalE2EERecord) => {
  window.localStorage.setItem(storageKey, JSON.stringify(record));
};

const readCachedPlaintext = (
  record: LocalE2EERecord,
  message: Pick<StoredMessage, "id" | "clientMessageId">
) =>
  record.plaintextCache[message.id] ??
  (message.clientMessageId
    ? record.plaintextCache[message.clientMessageId]
    : undefined) ??
  null;

const isSignalEnvelope = (
  envelope: MessageEnvelope
): envelope is MessageEnvelope & {
  version: "signal-inspired-v1";
  algorithm: string;
  iv: string;
  senderRatchetPublicKey: string;
  previousChainLength: number;
} =>
  envelope.version === "signal-inspired-v1" &&
  Boolean(envelope.algorithm) &&
  Boolean(envelope.iv) &&
  Boolean(envelope.senderRatchetPublicKey) &&
  typeof envelope.previousChainLength === "number";

const decryptOwnConversationHistory = async (
  receiverInitialSession: DoubleRatchetSession,
  messages: StoredMessage[],
  conversationId: string,
  currentUserId: string
) => {
  const session = cloneDoubleRatchetSession(receiverInitialSession);
  const plaintextByMessageId = new Map<string, string>();

  const decryptableMessages = [...messages]
    .filter((message) => message.senderUserId === currentUserId)
    .sort((left, right) =>
      (left.editedAt ?? left.createdAt).localeCompare(
        right.editedAt ?? right.createdAt
      )
    );

  for (const message of decryptableMessages) {
    if (!isSignalEnvelope(message.envelope)) {
      continue;
    }

    const envelope = message.envelope;
    const plaintext = await ratchetDecryptText(
      session,
      {
        version: "signal-inspired-v1",
        algorithm: protocolAlgorithm,
        sessionId: envelope.sessionId,
        header: {
          dhPublicKey: envelope.senderRatchetPublicKey,
          previousChainLength: envelope.previousChainLength,
          messageNumber: envelope.ratchetCounter
        },
        ciphertextBase64: envelope.ciphertext,
        ivBase64: envelope.iv,
        macBase64: envelope.signature
      },
      {
        associatedData: buildAssociatedData({
          conversationId,
          senderUserId: message.senderUserId,
          senderDeviceId: message.senderDeviceId,
          sessionId: envelope.sessionId,
          ratchetCounter: envelope.ratchetCounter,
          senderRatchetPublicKey: envelope.senderRatchetPublicKey,
          previousChainLength: envelope.previousChainLength,
          contentType: envelope.contentType
        })
      }
    );

    plaintextByMessageId.set(message.id, plaintext);

    if (message.clientMessageId) {
      plaintextByMessageId.set(message.clientMessageId, plaintext);
    }
  }

  return plaintextByMessageId;
};

const createInitialRecord = async (): Promise<LocalE2EERecord> => {
  const senderMaterial = await createLocalPreKeyMaterial({
    oneTimePreKeyCount: 0
  });
  const receiverMaterial = await createLocalPreKeyMaterial({
    oneTimePreKeyCount: 1
  });
  const receiverBundle = createPreKeyBundle(receiverMaterial);
  const initiator = await initializeX3dhInitiatorSession({
    localIdentityDhKeyPair: senderMaterial.identityDhKeyPair,
    remoteBundle: receiverBundle
  });
  const responder = initializeX3dhResponderSession({
    sessionId: initiator.sessionId,
    localIdentityDhKeyPair: receiverMaterial.identityDhKeyPair,
    localSignedPreKeyId: receiverMaterial.signedPreKeyId,
    localSignedPreKeyKeyPair: receiverMaterial.signedPreKeyKeyPair,
    localOneTimePreKeyKeyPair: receiverMaterial.oneTimePreKeys[0]?.keyPair,
    remoteIdentityDhPublicKey: initiator.localIdentityDhPublicKey,
    remoteEphemeralPublicKey: initiator.localEphemeralKeyPair.publicKey
  });
  const senderSession = initializeDoubleRatchetSessionAsInitiator({
    sessionId: initiator.sessionId,
    sharedSecret: initiator.sharedSecret,
    remoteRatchetPublicKey: initiator.remoteSignedPreKeyPublicKey,
    localRatchetKeyPair: initiator.localEphemeralKeyPair
  });
  const receiverInitialSession =
    initializeDoubleRatchetSessionAsResponder({
      sessionId: responder.sessionId,
      sharedSecret: responder.sharedSecret,
      localRatchetKeyPair: receiverMaterial.signedPreKeyKeyPair
    });

  return {
    version: protocolVersion,
    sessionId: initiator.sessionId,
    senderSession: serializeDoubleRatchetSession(senderSession),
    receiverInitialSession: serializeDoubleRatchetSession(
      receiverInitialSession
    ),
    plaintextCache: {}
  };
};

const loadOrCreateRecord = async (
  storageKey: string
): Promise<LocalE2EERecord> => {
  const raw = window.localStorage.getItem(storageKey);

  if (raw) {
    return JSON.parse(raw) as LocalE2EERecord;
  }

  const record = await createInitialRecord();
  persistRecord(storageKey, record);
  return record;
};

export interface ConversationE2EEClient {
  encryptText(
    plaintext: string,
    options: {
      conversationId: string;
      senderUserId: string;
      senderDeviceId: string;
      cacheKeys: string[];
    }
  ): Promise<MessageEnvelope>;
  decryptOwnHistory(messages: StoredMessage[]): Promise<Map<string, string>>;
  getCachedPlaintext(
    message: Pick<StoredMessage, "id" | "clientMessageId">
  ): Promise<string | null>;
}

export const createConversationE2EEClient = (
  options: {
    conversationId: string;
    currentUserId: string;
    currentDeviceId: string;
  }
): ConversationE2EEClient => {
  const storageKey = buildStorageKey(
    options.conversationId,
    options.currentUserId,
    options.currentDeviceId
  );

  return {
    async encryptText(plaintext, encryptOptions) {
      const record = await loadOrCreateRecord(storageKey);
      const senderSession = deserializeDoubleRatchetSession(record.senderSession);
      const encrypted = await ratchetEncryptText(senderSession, plaintext, {
        associatedData: buildAssociatedData({
          conversationId: encryptOptions.conversationId,
          senderUserId: encryptOptions.senderUserId,
          senderDeviceId: encryptOptions.senderDeviceId,
          sessionId: record.sessionId,
          ratchetCounter: senderSession.sendMessageNumber,
          senderRatchetPublicKey: senderSession.localRatchetKeyPair.publicKey,
          previousChainLength: senderSession.previousChainLength,
          contentType: "text"
        })
      });

      for (const key of encryptOptions.cacheKeys) {
        record.plaintextCache[key] = plaintext;
      }

      record.senderSession = serializeDoubleRatchetSession(senderSession);
      persistRecord(storageKey, record);

      return {
        version: "signal-inspired-v1",
        algorithm: protocolAlgorithm,
        ciphertext: encrypted.ciphertextBase64,
        signature: encrypted.macBase64,
        sessionId: encrypted.sessionId,
        ratchetCounter: encrypted.header.messageNumber,
        iv: encrypted.ivBase64,
        senderRatchetPublicKey: encrypted.header.dhPublicKey,
        previousChainLength: encrypted.header.previousChainLength,
        contentType: "text"
      };
    },
    async decryptOwnHistory(messages) {
      const record = await loadOrCreateRecord(storageKey);
      const plaintextByMessageId = await decryptOwnConversationHistory(
        deserializeDoubleRatchetSession(record.receiverInitialSession),
        messages,
        options.conversationId,
        options.currentUserId
      );

      for (const [messageKey, plaintext] of plaintextByMessageId.entries()) {
        record.plaintextCache[messageKey] = plaintext;
      }

      persistRecord(storageKey, record);
      return plaintextByMessageId;
    },
    async getCachedPlaintext(message) {
      const record = await loadOrCreateRecord(storageKey);
      return readCachedPlaintext(record, message);
    }
  };
};

export const decodeLegacyEnvelope = (ciphertext: string) => {
  if (typeof window !== "undefined") {
    return decodeURIComponent(escape(window.atob(ciphertext)));
  }

  return Buffer.from(ciphertext, "base64").toString("utf8");
};
