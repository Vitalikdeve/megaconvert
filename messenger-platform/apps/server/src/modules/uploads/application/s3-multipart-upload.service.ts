import { randomUUID } from "node:crypto";

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  ListPartsCommand,
  S3Client,
  type CompletedPart,
  type ObjectCannedACL,
  UploadPartCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  AbortUploadInput,
  CompleteUploadInput,
  InitiateUploadInput,
  SignUploadPartsInput,
  UploadChunkManifest,
  UploadStatus,
  UploadedPart
} from "@messenger/shared";

import type { AppEnv } from "../../../config/env";

const DEFAULT_PART_SIZE_BYTES = 16 * 1024 * 1024;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 * 1024;

const sanitizeFileName = (fileName: string) =>
  fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-");

interface UploadSessionRecord {
  uploadId: string;
  objectKey: string;
  conversationId: string;
  messageId?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  chunkSizeBytes: number;
  requiredPartCount: number;
  encryption: InitiateUploadInput["encryption"];
  status: UploadStatus["status"];
  createdAt: string;
  completedAt?: string;
  downloadFileName?: string;
}

interface CompletedUploadRecord extends UploadSessionRecord {
  parts: Array<UploadChunkManifest & { eTag: string }>;
}

export class S3MultipartUploadService {
  private readonly client: S3Client;

  private readonly sessionsByUploadId = new Map<string, UploadSessionRecord>();

  private readonly completedUploadsByObjectKey = new Map<
    string,
    CompletedUploadRecord
  >();

  constructor(private readonly env: AppEnv) {
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials:
        env.S3_ACCESS_KEY && env.S3_SECRET_KEY
          ? {
              accessKeyId: env.S3_ACCESS_KEY,
              secretAccessKey: env.S3_SECRET_KEY
            }
          : undefined
    });
  }

  private assertConfigured() {
    if (
      !this.env.S3_ENDPOINT ||
      !this.env.S3_ACCESS_KEY ||
      !this.env.S3_SECRET_KEY
    ) {
      throw new Error("S3-compatible object storage is not configured.");
    }
  }

  private getSessionOrThrow(uploadId: string) {
    const session = this.sessionsByUploadId.get(uploadId);

    if (!session) {
      throw new Error("Upload session was not found.");
    }

    return session;
  }

  private async listUploadedParts(
    uploadId: string,
    objectKey: string
  ): Promise<UploadedPart[]> {
    const uploadedParts: UploadedPart[] = [];
    let partNumberMarker: string | undefined;

    while (true) {
      const response = await this.client.send(
        new ListPartsCommand({
          Bucket: this.env.S3_BUCKET,
          Key: objectKey,
          UploadId: uploadId,
          PartNumberMarker: partNumberMarker
        })
      );

      for (const part of response.Parts ?? []) {
        if (!part.PartNumber || !part.ETag) {
          continue;
        }

        uploadedParts.push({
          partNumber: part.PartNumber,
          eTag: part.ETag,
          sizeBytes: Number(part.Size ?? 0)
        });
      }

      if (!response.IsTruncated || !response.NextPartNumberMarker) {
        break;
      }

      partNumberMarker = String(response.NextPartNumberMarker);
    }

    return uploadedParts.sort((left, right) => left.partNumber - right.partNumber);
  }

  private toStatusPayload(
    session: UploadSessionRecord,
    uploadedParts: UploadedPart[]
  ): UploadStatus {
    return {
      uploadId: session.uploadId,
      objectKey: session.objectKey,
      conversationId: session.conversationId,
      messageId: session.messageId,
      fileName: session.fileName,
      mimeType: session.mimeType,
      sizeBytes: session.sizeBytes,
      chunkSizeBytes: session.chunkSizeBytes,
      requiredPartCount: session.requiredPartCount,
      uploadedParts,
      status: session.status,
      encryption: session.encryption,
      completedAt: session.completedAt,
      downloadFileName: session.downloadFileName
    };
  }

  async initiate(input: InitiateUploadInput) {
    this.assertConfigured();

    if (input.sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error("File exceeds the 10 GB multipart upload limit.");
    }

    const conversationId = input.chatId ?? input.conversationId;

    if (!conversationId) {
      throw new Error("conversationId or chatId is required.");
    }

    const safeMessageId = sanitizeFileName(
      input.messageId ?? `pending-${Date.now()}`
    );
    const safeFileId = sanitizeFileName(
      input.encryption.fileId || randomUUID()
    );
    const objectKey = `${conversationId}/${safeMessageId}/${safeFileId}`;
    const chunkSizeBytes = input.chunkSizeBytes ?? DEFAULT_PART_SIZE_BYTES;

    const response = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.env.S3_BUCKET,
        Key: objectKey,
        ContentType: "application/octet-stream",
        ACL: "private" satisfies ObjectCannedACL,
        Metadata: {
          conversationId,
          messageId: input.messageId ?? "",
          originalFileName: input.fileName,
          originalMimeType: input.mimeType,
          fileId: input.encryption.fileId,
          encryptionVersion: input.encryption.version,
          encryptionAlgorithm: input.encryption.algorithm
        }
      })
    );

    if (!response.UploadId) {
      throw new Error("S3-compatible storage did not return an upload ID.");
    }

    const session: UploadSessionRecord = {
      uploadId: response.UploadId,
      objectKey,
      conversationId,
      messageId: input.messageId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      chunkSizeBytes,
      requiredPartCount: Math.ceil(input.sizeBytes / chunkSizeBytes),
      encryption: input.encryption,
      status: "uploading",
      createdAt: new Date().toISOString()
    };

    this.sessionsByUploadId.set(session.uploadId, session);

    return {
      uploadId: session.uploadId,
      objectKey,
      chunkSizeBytes,
      requiredPartCount: session.requiredPartCount,
      status: session.status
    };
  }

  async getStatus(uploadId: string): Promise<UploadStatus> {
    this.assertConfigured();

    const session = this.getSessionOrThrow(uploadId);
    const completed = this.completedUploadsByObjectKey.get(session.objectKey);

    if (completed) {
      return this.toStatusPayload(
        completed,
        completed.parts.map((part) => ({
          partNumber: part.partNumber,
          eTag: part.eTag,
          sizeBytes: part.ciphertextSizeBytes
        }))
      );
    }

    if (session.status === "aborted") {
      return this.toStatusPayload(session, []);
    }

    return this.toStatusPayload(
      session,
      await this.listUploadedParts(uploadId, session.objectKey)
    );
  }

  async signParts(uploadId: string, input: SignUploadPartsInput) {
    this.assertConfigured();

    const session = this.getSessionOrThrow(uploadId);

    if (session.objectKey !== input.objectKey) {
      throw new Error("Upload session does not match the requested object.");
    }

    if (session.status !== "uploading") {
      throw new Error("Upload session is no longer accepting parts.");
    }

    const signedParts = await Promise.all(
      input.partNumbers.map(async (partNumber) => ({
        partNumber,
        url: await getSignedUrl(
          this.client,
          new UploadPartCommand({
            Bucket: this.env.S3_BUCKET,
            Key: input.objectKey,
            UploadId: uploadId,
            PartNumber: partNumber
          }),
          {
            expiresIn: 60 * 15
          }
        )
      }))
    );

    return {
      uploadId,
      objectKey: input.objectKey,
      chunkSizeBytes: session.chunkSizeBytes,
      signedParts
    };
  }

  async complete(uploadId: string, input: CompleteUploadInput) {
    this.assertConfigured();

    const session = this.getSessionOrThrow(uploadId);

    if (session.objectKey !== input.objectKey) {
      throw new Error("Upload session does not match the requested object.");
    }

    const sortedParts = [...input.parts].sort(
      (left, right) => left.partNumber - right.partNumber
    );
    const parts: CompletedPart[] = sortedParts.map((part) => ({
      ETag: part.eTag,
      PartNumber: part.partNumber
    }));

    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.env.S3_BUCKET,
        Key: input.objectKey,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts
        }
      })
    );

    const completedAt = new Date().toISOString();
    const completed: CompletedUploadRecord = {
      ...session,
      status: "completed",
      completedAt,
      downloadFileName: input.downloadFileName ?? session.fileName,
      parts: sortedParts
    };

    this.sessionsByUploadId.set(uploadId, completed);
    this.completedUploadsByObjectKey.set(input.objectKey, completed);

    return {
      uploadId,
      objectKey: input.objectKey,
      completedAt,
      requiredPartCount: completed.requiredPartCount,
      ciphertextSizeBytes: sortedParts.reduce(
        (sum, part) => sum + part.ciphertextSizeBytes,
        0
      )
    };
  }

  async abort(uploadId: string, input: AbortUploadInput) {
    this.assertConfigured();

    const session = this.getSessionOrThrow(uploadId);

    if (session.objectKey !== input.objectKey) {
      throw new Error("Upload session does not match the requested object.");
    }

    if (session.status === "completed") {
      throw new Error("Completed uploads cannot be aborted.");
    }

    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.env.S3_BUCKET,
        Key: input.objectKey,
        UploadId: uploadId
      })
    );

    const abortedAt = new Date().toISOString();

    this.sessionsByUploadId.set(uploadId, {
      ...session,
      status: "aborted",
      completedAt: abortedAt
    });

    return {
      uploadId,
      objectKey: input.objectKey,
      abortedAt
    };
  }

  async createDownloadLink(objectKey: string) {
    this.assertConfigured();

    const completed = this.completedUploadsByObjectKey.get(objectKey);

    if (!completed) {
      throw new Error("Completed upload was not found.");
    }

    const fileName = sanitizeFileName(
      completed.downloadFileName ?? completed.fileName
    );
    const expiresInSeconds = 60 * 15;

    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.env.S3_BUCKET,
        Key: objectKey,
        ResponseContentDisposition: `attachment; filename="${fileName}"`
      }),
      {
        expiresIn: expiresInSeconds
      }
    );

    return {
      objectKey,
      url,
      expiresAt: new Date(
        Date.now() + expiresInSeconds * 1000
      ).toISOString(),
      fileName,
      mimeType: completed.mimeType,
      sizeBytes: completed.sizeBytes,
      chunkSizeBytes: completed.chunkSizeBytes,
      encryption: completed.encryption,
      parts: completed.parts.map((part) => ({
        partNumber: part.partNumber,
        chunkIndex: part.chunkIndex,
        ciphertextSizeBytes: part.ciphertextSizeBytes,
        plaintextSizeBytes: part.plaintextSizeBytes,
        ivBase64: part.ivBase64,
        macBase64: part.macBase64
      }))
    };
  }
}
