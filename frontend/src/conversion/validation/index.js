import { ConversionError } from '../core/errors';
import { validateFileSize } from './fileSize';
import { validateMime } from './mime';
import { validateNoArchive } from './zipBomb';

export const validateBatchLimits = (files, limits) => {
  if (!files?.length) return;
  if (limits?.maxBatchFiles && files.length > limits.maxBatchFiles) {
    throw new ConversionError('BATCH_LIMIT', 'Too many files.', { count: files.length, max: limits.maxBatchFiles });
  }
  if (limits?.maxBatchBytes) {
    const total = files.reduce((sum, file) => sum + (file?.size || 0), 0);
    if (total > limits.maxBatchBytes) {
      throw new ConversionError('BATCH_LIMIT', 'Batch size too large.', { total, max: limits.maxBatchBytes });
    }
  }
};

export const runValidation = async ({ files, allowedExts, maxFileBytes }) => {
  validateBatchLimits(files, maxFileBytes?.batchLimits || null);
  for (const file of files) {
    validateNoArchive(file, allowedExts);
    validateFileSize(file, maxFileBytes?.perFile || null);
    validateMime(file, allowedExts);
  }
};
