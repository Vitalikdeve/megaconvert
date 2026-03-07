const MB = 1024 * 1024;

export const LIMITS = {
  maxFileBytesByCategory: {
    doc: 50 * MB,
    image: 50 * MB,
    video: 50 * MB,
    audio: 50 * MB,
    archive: 50 * MB,
    data: 50 * MB
  },
  maxBatchFiles: 10,
  maxBatchBytes: 500 * MB,
  checksumMaxBytes: 10 * MB,
  maxFileNameLength: 80,
  uploadTimeoutMs: 120_000,
  jobTimeoutMs: 5 * 60_000,
  pollIntervalMs: 1_200
};
