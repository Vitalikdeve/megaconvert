import { ConversionError } from '../core/errors';

export const validateFileSize = (file, maxBytes) => {
  if (!file) return;
  if (file.size === 0) {
    throw new ConversionError('VALIDATION_FAILED', 'Empty file.');
  }
  if (maxBytes && file.size > maxBytes) {
    throw new ConversionError('FILE_TOO_LARGE', 'File too large.', { size: file.size, maxBytes });
  }
};
