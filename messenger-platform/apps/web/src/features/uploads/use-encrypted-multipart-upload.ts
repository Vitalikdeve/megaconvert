"use client";

import {
  createFileTransferKey,
  encryptFileChunk,
  toArrayBuffer
} from "@messenger/crypto";
import type { UploadChunkManifest } from "@messenger/shared";
import { useEffect, useRef, useState } from "react";

import { API_URL } from "@/config/api";

const DEFAULT_CHUNK_SIZE_BYTES = 16 * 1024 * 1024;
const MAX_PARALLEL_UPLOADS = 3;
const ENCRYPTION_VERSION = "signal-inspired-file-v1";
const ENCRYPTION_ALGORITHM = "AES-256-CBC-HMAC-SHA256";

type UploadTransferStatus =
  | "preparing"
  | "uploading"
  | "paused"
  | "completed"
  | "error"
  | "cancelled";

interface SignedPart {
  partNumber: number;
  url: string;
}

interface CompletedUploadPart extends UploadChunkManifest {
  eTag: string;
}

interface ActivePartProgress {
  plaintextSizeBytes: number;
  ciphertextSizeBytes: number;
  uploadedCiphertextBytes: number;
}

interface UploadRuntime {
  paused: boolean;
  processing: boolean;
  activeRequests: Map<number, XMLHttpRequest>;
  activePartProgress: Map<number, ActivePartProgress>;
  completedParts: Map<number, CompletedUploadPart>;
}

interface UploadTransfer {
  id: string;
  conversationId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: UploadTransferStatus;
  progress: number;
  bytesUploaded: number;
  chunkSizeBytes: number;
  requiredPartCount: number;
  completedPartCount: number;
  uploadId: string | null;
  objectKey: string | null;
  downloadUrl: string | null;
  downloadExpiresAt: string | null;
  error: string | null;
}

const responseData = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}.`);
  }

  const json = (await response.json()) as { data: T };
  return json.data;
};

const formatErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const createRuntime = (): UploadRuntime => ({
  paused: false,
  processing: false,
  activeRequests: new Map(),
  activePartProgress: new Map(),
  completedParts: new Map()
});

class UploadPausedError extends Error {
  constructor() {
    super("Upload paused.");
  }
}

export type UploadTransferItem = UploadTransfer;

export interface UseEncryptedMultipartUploadOptions {
  conversationId: string;
  authToken?: string;
  deviceId?: string;
}

export const useEncryptedMultipartUpload = ({
  conversationId,
  authToken,
  deviceId
}: UseEncryptedMultipartUploadOptions) => {
  const [uploads, setUploads] = useState<UploadTransfer[]>([]);

  const uploadsRef = useRef<UploadTransfer[]>([]);
  const filesRef = useRef(new Map<string, File>());
  const fileKeysRef = useRef(new Map<string, string>());
  const runtimesRef = useRef(new Map<string, UploadRuntime>());

  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

  const getUpload = (uploadId: string) =>
    uploadsRef.current.find((item) => item.id === uploadId) ?? null;

  const updateUpload = (
    uploadId: string,
    updater: (current: UploadTransfer) => UploadTransfer
  ) => {
    setUploads((current) =>
      current.map((item) => (item.id === uploadId ? updater(item) : item))
    );
  };

  const getRuntime = (uploadId: string) => {
    const existing = runtimesRef.current.get(uploadId);

    if (existing) {
      return existing;
    }

    const nextRuntime = createRuntime();
    runtimesRef.current.set(uploadId, nextRuntime);
    return nextRuntime;
  };

  const computeUploadedBytes = (uploadId: string) => {
    const runtime = getRuntime(uploadId);
    const completedBytes = Array.from(runtime.completedParts.values()).reduce(
      (sum, part) => sum + part.plaintextSizeBytes,
      0
    );
    const activeBytes = Array.from(runtime.activePartProgress.values()).reduce(
      (sum, part) =>
        sum +
        Math.round(
          (part.uploadedCiphertextBytes / part.ciphertextSizeBytes) *
            part.plaintextSizeBytes
        ),
      0
    );
    const upload = getUpload(uploadId);

    return Math.min(upload?.sizeBytes ?? 0, completedBytes + activeBytes);
  };

  const syncProgress = (uploadId: string) => {
    const upload = getUpload(uploadId);

    if (!upload) {
      return;
    }

    const bytesUploaded = computeUploadedBytes(uploadId);
    const runtime = getRuntime(uploadId);

    updateUpload(uploadId, (current) => ({
      ...current,
      bytesUploaded,
      progress:
        current.sizeBytes > 0
          ? Math.min(100, Math.round((bytesUploaded / current.sizeBytes) * 100))
          : 0,
      completedPartCount: runtime.completedParts.size
    }));
  };

  const requestJson = async <T>(
    path: string,
    init?: RequestInit
  ): Promise<T> => {
    if (!authToken || !deviceId) {
      throw new Error("Login is required before uploading encrypted files.");
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        "x-device-id": deviceId,
        ...(init?.headers ?? {})
      }
    });

    return responseData<T>(response);
  };

  const fetchDownloadLink = async (uploadId: string) => {
    const upload = getUpload(uploadId);

    if (!upload?.objectKey) {
      return;
    }

    const data = await requestJson<{
      url: string;
      expiresAt: string;
    }>(`/v1/uploads/download-link?objectKey=${encodeURIComponent(upload.objectKey)}`);

    updateUpload(uploadId, (current) => ({
      ...current,
      downloadUrl: data.url,
      downloadExpiresAt: data.expiresAt
    }));
  };

  const ensureSession = async (uploadId: string) => {
    const file = filesRef.current.get(uploadId);
    const upload = getUpload(uploadId);

    if (!file || !upload) {
      throw new Error("Selected file is no longer available.");
    }

    if (upload.uploadId && upload.objectKey) {
      return upload;
    }

    updateUpload(uploadId, (current) => ({
      ...current,
      status: "preparing",
      error: null
    }));

    const session = await requestJson<{
      uploadId: string;
      objectKey: string;
      chunkSizeBytes: number;
      requiredPartCount: number;
      status: "uploading";
    }>("/upload/start", {
      method: "POST",
      body: JSON.stringify({
        conversationId,
        messageId: `draft-${uploadId}`,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        chunkSizeBytes: upload.chunkSizeBytes,
        encryption: {
          version: ENCRYPTION_VERSION,
          algorithm: ENCRYPTION_ALGORITHM,
          fileId: uploadId
        }
      })
    });

    const nextUpload = {
      ...upload,
      uploadId: session.uploadId,
      objectKey: session.objectKey,
      chunkSizeBytes: session.chunkSizeBytes,
      requiredPartCount: session.requiredPartCount,
      status: "uploading" as const
    };

    updateUpload(uploadId, () => nextUpload);
    return nextUpload;
  };

  const uploadCiphertextPart = async (options: {
    uploadId: string;
    partNumber: number;
    signedPart: SignedPart;
  }) => {
    const upload = getUpload(options.uploadId);
    const file = filesRef.current.get(options.uploadId);
    const fileKey = fileKeysRef.current.get(options.uploadId);
    const runtime = getRuntime(options.uploadId);

    if (!upload || !file || !fileKey || !upload.uploadId || !upload.objectKey) {
      throw new Error("Upload state is incomplete.");
    }

    const chunkStart = (options.partNumber - 1) * upload.chunkSizeBytes;
    const chunkEnd = Math.min(chunkStart + upload.chunkSizeBytes, file.size);
    const chunkBytes = new Uint8Array(
      await file.slice(chunkStart, chunkEnd).arrayBuffer()
    );
    const encryptedChunk = await encryptFileChunk(chunkBytes, {
      keyBase64: fileKey,
      chunkIndex: options.partNumber - 1,
      fileId: options.uploadId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream"
    });

    runtime.activePartProgress.set(options.partNumber, {
      plaintextSizeBytes: encryptedChunk.plaintextSizeBytes,
      ciphertextSizeBytes: encryptedChunk.ciphertextSizeBytes,
      uploadedCiphertextBytes: 0
    });
    syncProgress(options.uploadId);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      runtime.activeRequests.set(options.partNumber, xhr);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          return;
        }

        const active = runtime.activePartProgress.get(options.partNumber);

        if (!active) {
          return;
        }

        active.uploadedCiphertextBytes = Math.min(
          encryptedChunk.ciphertextSizeBytes,
          event.loaded
        );
        runtime.activePartProgress.set(options.partNumber, active);
        syncProgress(options.uploadId);
      };

      xhr.onerror = () => {
        runtime.activeRequests.delete(options.partNumber);
        runtime.activePartProgress.delete(options.partNumber);
        syncProgress(options.uploadId);
        reject(new Error(`Part ${options.partNumber} failed to upload.`));
      };

      xhr.onabort = () => {
        runtime.activeRequests.delete(options.partNumber);
        runtime.activePartProgress.delete(options.partNumber);
        syncProgress(options.uploadId);
        reject(runtime.paused ? new UploadPausedError() : new Error("Upload was aborted."));
      };

      xhr.onload = () => {
        runtime.activeRequests.delete(options.partNumber);
        runtime.activePartProgress.delete(options.partNumber);

        if (xhr.status < 200 || xhr.status >= 300) {
          syncProgress(options.uploadId);
          reject(
            new Error(
              `Part ${options.partNumber} upload returned status ${xhr.status}.`
            )
          );
          return;
        }

        const eTag = xhr.getResponseHeader("ETag");

        if (!eTag) {
          syncProgress(options.uploadId);
          reject(
            new Error(
              "S3-compatible storage did not expose an ETag header for the uploaded part."
            )
          );
          return;
        }

        runtime.completedParts.set(options.partNumber, {
          partNumber: options.partNumber,
          chunkIndex: encryptedChunk.chunkIndex,
          ciphertextSizeBytes: encryptedChunk.ciphertextSizeBytes,
          plaintextSizeBytes: encryptedChunk.plaintextSizeBytes,
          ivBase64: encryptedChunk.ivBase64,
          macBase64: encryptedChunk.macBase64,
          eTag
        });
        syncProgress(options.uploadId);
        resolve();
      };

      xhr.open("PUT", options.signedPart.url);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.send(toArrayBuffer(encryptedChunk.ciphertext));
    });
  };

  const processUpload = async (uploadId: string) => {
    const runtime = getRuntime(uploadId);

    if (runtime.processing) {
      return;
    }

    runtime.processing = true;
    runtime.paused = false;

    try {
      const ensuredUpload = await ensureSession(uploadId);

      if (!ensuredUpload.uploadId || !ensuredUpload.objectKey) {
        throw new Error("Upload session could not be initialized.");
      }

      const status = await requestJson<{
        uploadedParts: Array<{ partNumber: number }>;
      }>(`/v1/uploads/${ensuredUpload.uploadId}`);

      for (const part of status.uploadedParts) {
        if (!runtime.completedParts.has(part.partNumber)) {
          continue;
        }
      }

      while (!runtime.paused) {
        const currentUpload = getUpload(uploadId);

        if (!currentUpload?.uploadId || !currentUpload.objectKey) {
          throw new Error("Upload session is missing.");
        }

        const pendingPartNumbers: number[] = [];

        for (
          let partNumber = 1;
          partNumber <= currentUpload.requiredPartCount;
          partNumber += 1
        ) {
          if (!runtime.completedParts.has(partNumber)) {
            pendingPartNumbers.push(partNumber);
          }
        }

        if (pendingPartNumbers.length === 0) {
          break;
        }

        const currentBatch = pendingPartNumbers.slice(0, MAX_PARALLEL_UPLOADS);
        const signResponse = await requestJson<{
          signedParts: SignedPart[];
        }>(`/v1/uploads/${currentUpload.uploadId}/parts/sign`, {
          method: "POST",
          body: JSON.stringify({
            objectKey: currentUpload.objectKey,
            partNumbers: currentBatch
          })
        });

        const signedPartByNumber = new Map(
          signResponse.signedParts.map((part) => [part.partNumber, part])
        );

        await Promise.all(
          currentBatch.map(async (partNumber) => {
            const signedPart = signedPartByNumber.get(partNumber);

            if (!signedPart) {
              throw new Error(`Part ${partNumber} was not signed.`);
            }

            await uploadCiphertextPart({
              uploadId,
              partNumber,
              signedPart
            });
          })
        );
      }

      if (runtime.paused) {
        updateUpload(uploadId, (current) => ({
          ...current,
          status: "paused"
        }));
        return;
      }

      const upload = getUpload(uploadId);

      if (!upload?.uploadId || !upload.objectKey) {
        throw new Error("Upload session disappeared before completion.");
      }

      const completedParts = Array.from(runtime.completedParts.values()).sort(
        (left, right) => left.partNumber - right.partNumber
      );

      await requestJson(`/upload/complete`, {
        method: "POST",
        body: JSON.stringify({
          uploadId: upload.uploadId,
          objectKey: upload.objectKey,
          encryption: {
            version: ENCRYPTION_VERSION,
            algorithm: ENCRYPTION_ALGORITHM,
            fileId: upload.id
          },
          downloadFileName: upload.fileName,
          parts: completedParts
        })
      });

      updateUpload(uploadId, (current) => ({
        ...current,
        status: "completed",
        progress: 100,
        bytesUploaded: current.sizeBytes,
        completedPartCount: current.requiredPartCount,
        error: null
      }));

      await fetchDownloadLink(uploadId);
    } catch (error) {
      if (error instanceof UploadPausedError) {
        updateUpload(uploadId, (current) => ({
          ...current,
          status: "paused"
        }));
      } else {
        updateUpload(uploadId, (current) => ({
          ...current,
          status: "error",
          error: formatErrorMessage(error, "Encrypted upload failed.")
        }));
      }
    } finally {
      runtime.processing = false;
    }
  };

  const queueFiles = (files: FileList | File[]) => {
    const nextFiles = Array.from(files);

    if (nextFiles.length === 0) {
      return;
    }

    const nextTransfers = nextFiles.map((file) => {
      const id = crypto.randomUUID();
      filesRef.current.set(id, file);
      fileKeysRef.current.set(id, createFileTransferKey());
      runtimesRef.current.set(id, createRuntime());

      return {
        id,
        conversationId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        status: "preparing" as const,
        progress: 0,
        bytesUploaded: 0,
        chunkSizeBytes: DEFAULT_CHUNK_SIZE_BYTES,
        requiredPartCount: Math.ceil(file.size / DEFAULT_CHUNK_SIZE_BYTES),
        completedPartCount: 0,
        uploadId: null,
        objectKey: null,
        downloadUrl: null,
        downloadExpiresAt: null,
        error: null
      };
    });

    setUploads((current) => [...nextTransfers, ...current]);

    for (const transfer of nextTransfers) {
      void processUpload(transfer.id);
    }
  };

  const pauseUpload = (uploadId: string) => {
    const runtime = getRuntime(uploadId);
    runtime.paused = true;
    runtime.activeRequests.forEach((request) => request.abort());
    updateUpload(uploadId, (current) => ({
      ...current,
      status: "paused"
    }));
  };

  const resumeUpload = (uploadId: string) => {
    const upload = getUpload(uploadId);

    if (!upload || upload.status === "completed") {
      return;
    }

    updateUpload(uploadId, (current) => ({
      ...current,
      status: "uploading",
      error: null
    }));
    void processUpload(uploadId);
  };

  const cancelUpload = async (uploadId: string) => {
    const upload = getUpload(uploadId);
    const runtime = getRuntime(uploadId);

    runtime.paused = true;
    runtime.activeRequests.forEach((request) => request.abort());

    if (upload?.uploadId && upload.objectKey) {
      try {
        await requestJson(`/v1/uploads/${upload.uploadId}/abort`, {
          method: "POST",
          body: JSON.stringify({
            objectKey: upload.objectKey
          })
        });
      } catch {
        // Keep the UI responsive even if cleanup fails server-side.
      }
    }

    updateUpload(uploadId, (current) => ({
      ...current,
      status: "cancelled",
      error: null
    }));
  };

  const refreshDownloadLink = async (uploadId: string) => {
    try {
      await fetchDownloadLink(uploadId);
    } catch (error) {
      updateUpload(uploadId, (current) => ({
        ...current,
        error: formatErrorMessage(error, "Failed to refresh download link.")
      }));
    }
  };

  return {
    uploads: uploads as UploadTransferItem[],
    queueFiles,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    refreshDownloadLink
  };
};
