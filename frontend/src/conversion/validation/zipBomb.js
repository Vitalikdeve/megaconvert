import { ConversionError } from '../core/errors';
import { getExtension } from './mime';

const ARCHIVE_EXTS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2']);

export const validateNoArchive = (file, allowedExts = []) => {
  if (!file) return;
  if (!allowedExts.length) return;
  const ext = getExtension(file.name);
  if (allowedExts.includes(ext)) return;
  if (ARCHIVE_EXTS.has(ext)) {
    throw new ConversionError('UNSUPPORTED_FORMAT', 'Archive uploads are not allowed.', { ext });
  }
};
