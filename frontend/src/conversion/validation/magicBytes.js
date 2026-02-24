import { ConversionError } from '../core/errors';
import { detectFormatFromBytes, readMagicBytes } from '../detection/detector';

const MAGIC_COMPAT = {
  jpg: ['jpg', 'jpeg'],
  heic: ['heic', 'heif'],
  m4a: ['m4a', 'm4r'],
  m4r: ['m4a', 'm4r'],
  m4v: ['m4v', 'mp4'],
  mp4: ['mp4', 'm4v', '3gp']
};

const isCompatibleDetection = (detected, allowedExts = []) => {
  const normalizedDetected = String(detected || '').toLowerCase();
  if (!normalizedDetected) return true;
  const allowed = new Set(allowedExts.map((ext) => String(ext || '').toLowerCase()));
  if (!allowed.size) return true;
  if (allowed.has(normalizedDetected)) return true;
  const compatible = MAGIC_COMPAT[normalizedDetected] || [normalizedDetected];
  return compatible.some((ext) => allowed.has(ext));
};

export const validateMagicBytes = async (file, allowedExts = []) => {
  if (!file) return { detected: null };
  const bytes = await readMagicBytes(file, 32);
  const detected = detectFormatFromBytes(bytes);
  if (detected && allowedExts.length && !isCompatibleDetection(detected, allowedExts)) {
    throw new ConversionError('UNSUPPORTED_FORMAT', 'File signature does not match allowed formats.', { detected, allowedExts });
  }
  return { detected };
};
