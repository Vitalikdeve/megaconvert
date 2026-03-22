import { z } from "zod";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 * 1024;
const MIN_PART_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_PART_SIZE_BYTES = 64 * 1024 * 1024;

export const uploadEncryptionSchema = z.object({
  version: z.string().min(1),
  algorithm: z.string().min(1),
  fileId: z.string().min(1)
});

export const initiateUploadSchema = z.object({
  conversationId: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  chunkSizeBytes: z
    .number()
    .int()
    .min(MIN_PART_SIZE_BYTES)
    .max(MAX_PART_SIZE_BYTES)
    .optional(),
  encryption: uploadEncryptionSchema
});

export const signUploadPartsSchema = z.object({
  objectKey: z.string().min(1),
  partNumbers: z.array(z.number().int().positive()).min(1)
});

export const uploadedPartSchema = z.object({
  partNumber: z.number().int().positive(),
  eTag: z.string().min(1),
  sizeBytes: z.number().int().nonnegative()
});

export const uploadChunkManifestSchema = z.object({
  partNumber: z.number().int().positive(),
  chunkIndex: z.number().int().nonnegative(),
  ciphertextSizeBytes: z.number().int().positive(),
  plaintextSizeBytes: z.number().int().nonnegative(),
  ivBase64: z.string().min(1),
  macBase64: z.string().min(1)
});

export const completeUploadSchema = z.object({
  objectKey: z.string().min(1),
  encryption: uploadEncryptionSchema,
  downloadFileName: z.string().min(1).optional(),
  parts: z
    .array(
      uploadChunkManifestSchema.extend({
        eTag: z.string().min(1),
      })
    )
    .min(1)
});

export const uploadStatusSchema = z.object({
  uploadId: z.string().min(1),
  objectKey: z.string().min(1),
  conversationId: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  chunkSizeBytes: z.number().int().min(MIN_PART_SIZE_BYTES),
  requiredPartCount: z.number().int().positive(),
  uploadedParts: z.array(uploadedPartSchema),
  status: z.enum(["uploading", "completed", "aborted"]),
  encryption: uploadEncryptionSchema,
  completedAt: z.string().datetime().optional(),
  downloadFileName: z.string().min(1).optional()
});

export const abortUploadSchema = z.object({
  objectKey: z.string().min(1)
});

export const downloadLinkQuerySchema = z.object({
  objectKey: z.string().min(1)
});

export type InitiateUploadInput = z.infer<typeof initiateUploadSchema>;
export type SignUploadPartsInput = z.infer<typeof signUploadPartsSchema>;
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;
export type UploadEncryption = z.infer<typeof uploadEncryptionSchema>;
export type UploadedPart = z.infer<typeof uploadedPartSchema>;
export type UploadChunkManifest = z.infer<typeof uploadChunkManifestSchema>;
export type UploadStatus = z.infer<typeof uploadStatusSchema>;
export type AbortUploadInput = z.infer<typeof abortUploadSchema>;
export type DownloadLinkQuery = z.infer<typeof downloadLinkQuerySchema>;
