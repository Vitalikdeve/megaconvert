const MB = 1024 * 1024;

export const LIMITS = {
  maxFileBytesByCategory: {
    doc: 50 * MB,
    image: 25 * MB,
    video: 100 * MB,
    audio: 50 * MB,
    archive: 250 * MB,
    data: 25 * MB
  },
  maxBatchFiles: 50,
  maxBatchBytes: 250 * MB,
  checksumMaxBytes: 10 * MB,
  maxFileNameLength: 80,
  uploadTimeoutMs: 120_000,
  jobTimeoutMs: 5 * 60_000,
  pollIntervalMs: 1_200
};
