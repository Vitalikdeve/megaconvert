import {
  base64ToBytes,
  bytesToBase64,
  randomBytes,
  utf8ToBytes
} from "./encoding";
import {
  decryptAuthenticated,
  decryptAuthenticatedRaw,
  encryptAuthenticated,
  encryptAuthenticatedRaw
} from "./symmetric";

const fileVersion = "signal-inspired-file-v1";
const fileAlgorithm = "AES-256-CBC-HMAC-SHA256";
const filePurpose = "file-transfer";

const buildFileAssociatedData = (metadata?: {
  fileId?: string;
  fileName?: string;
  mimeType?: string;
  chunkIndex?: number;
  sizeBytes?: number;
}) =>
  utf8ToBytes(
    JSON.stringify({
      version: fileVersion,
      fileId: metadata?.fileId ?? null,
      fileName: metadata?.fileName ?? null,
      mimeType: metadata?.mimeType ?? null,
      chunkIndex: metadata?.chunkIndex ?? null,
      sizeBytes: metadata?.sizeBytes ?? null
    })
  );

export interface FileTransferEnvelope {
  version: typeof fileVersion;
  algorithm: typeof fileAlgorithm;
  ivBase64: string;
  ciphertextBase64: string;
  macBase64: string;
  sizeBytes: number;
  fileName?: string;
  mimeType?: string;
  fileId?: string;
  chunkIndex?: number;
}

export interface FileEncryptionResult {
  keyBase64: string;
  envelope: FileTransferEnvelope;
}

export interface AttachmentEncryptionResult extends FileTransferEnvelope {
  keyBase64: string;
}

export interface FileChunkEncryptionResult {
  version: typeof fileVersion;
  algorithm: typeof fileAlgorithm;
  ivBase64: string;
  macBase64: string;
  ciphertext: Uint8Array;
  ciphertextSizeBytes: number;
  plaintextSizeBytes: number;
  fileId?: string;
  fileName?: string;
  mimeType?: string;
  chunkIndex: number;
}

export interface FileChunkManifest {
  partNumber: number;
  chunkIndex: number;
  ciphertextSizeBytes: number;
  plaintextSizeBytes: number;
  ivBase64: string;
  macBase64: string;
}

export const createFileTransferKey = (): string =>
  bytesToBase64(randomBytes(32));

export const encryptFileBytes = async (
  plaintext: Uint8Array,
  options?: {
    keyBase64?: string;
    fileId?: string;
    fileName?: string;
    mimeType?: string;
    chunkIndex?: number;
  }
): Promise<FileEncryptionResult> => {
  const keyBase64 = options?.keyBase64 ?? createFileTransferKey();
  const associatedData = buildFileAssociatedData({
    fileId: options?.fileId,
    fileName: options?.fileName,
    mimeType: options?.mimeType,
    chunkIndex: options?.chunkIndex,
    sizeBytes: plaintext.byteLength
  });
  const encrypted = await encryptAuthenticated(plaintext, {
    masterKey: base64ToBytes(keyBase64),
    purpose: filePurpose,
    associatedData
  });

  return {
    keyBase64,
    envelope: {
      version: fileVersion,
      algorithm: fileAlgorithm,
      sizeBytes: plaintext.byteLength,
      fileId: options?.fileId,
      fileName: options?.fileName,
      mimeType: options?.mimeType,
      chunkIndex: options?.chunkIndex,
      ...encrypted
    }
  };
};

export const decryptFileBytes = async (
  encrypted: FileEncryptionResult | {
    keyBase64: string;
    envelope: FileTransferEnvelope;
  }
): Promise<Uint8Array> =>
  decryptAuthenticated(
    {
      ciphertextBase64: encrypted.envelope.ciphertextBase64,
      ivBase64: encrypted.envelope.ivBase64,
      macBase64: encrypted.envelope.macBase64
    },
    {
      masterKey: base64ToBytes(encrypted.keyBase64),
      purpose: filePurpose,
      associatedData: buildFileAssociatedData({
        fileId: encrypted.envelope.fileId,
        fileName: encrypted.envelope.fileName,
        mimeType: encrypted.envelope.mimeType,
        chunkIndex: encrypted.envelope.chunkIndex,
        sizeBytes: encrypted.envelope.sizeBytes
      })
    }
  );

export const encryptAttachment = async (
  plaintext: Uint8Array
): Promise<AttachmentEncryptionResult> => {
  const encrypted = await encryptFileBytes(plaintext);

  return {
    ...encrypted.envelope,
    keyBase64: encrypted.keyBase64
  };
};

export const decryptAttachment = async (
  encrypted: AttachmentEncryptionResult
): Promise<Uint8Array> =>
  decryptFileBytes({
    keyBase64: encrypted.keyBase64,
    envelope: encrypted
  });

export const encryptFileChunk = async (
  plaintext: Uint8Array,
  options: {
    keyBase64: string;
    chunkIndex: number;
    fileId?: string;
    fileName?: string;
    mimeType?: string;
  }
): Promise<FileChunkEncryptionResult> => {
  const raw = await encryptAuthenticatedRaw(plaintext, {
    masterKey: base64ToBytes(options.keyBase64),
    purpose: filePurpose,
    associatedData: buildFileAssociatedData({
      fileId: options.fileId,
      fileName: options.fileName,
      mimeType: options.mimeType,
      chunkIndex: options.chunkIndex,
      sizeBytes: plaintext.byteLength
    })
  });

  return {
    version: fileVersion,
    algorithm: fileAlgorithm,
    ivBase64: bytesToBase64(raw.iv),
    macBase64: bytesToBase64(raw.mac),
    ciphertext: raw.ciphertext,
    ciphertextSizeBytes: raw.ciphertext.byteLength,
    plaintextSizeBytes: plaintext.byteLength,
    fileId: options.fileId,
    fileName: options.fileName,
    mimeType: options.mimeType,
    chunkIndex: options.chunkIndex
  };
};

export const decryptFileChunk = async (
  encrypted: {
    keyBase64: string;
    ciphertext: Uint8Array;
    ivBase64: string;
    macBase64: string;
    plaintextSizeBytes: number;
    chunkIndex: number;
    fileId?: string;
    fileName?: string;
    mimeType?: string;
  }
): Promise<Uint8Array> =>
  decryptAuthenticatedRaw(
    {
      ciphertext: encrypted.ciphertext,
      iv: base64ToBytes(encrypted.ivBase64),
      mac: base64ToBytes(encrypted.macBase64)
    },
    {
      masterKey: base64ToBytes(encrypted.keyBase64),
      purpose: filePurpose,
      associatedData: buildFileAssociatedData({
        fileId: encrypted.fileId,
        fileName: encrypted.fileName,
        mimeType: encrypted.mimeType,
        chunkIndex: encrypted.chunkIndex,
        sizeBytes: encrypted.plaintextSizeBytes
      })
    }
  );
