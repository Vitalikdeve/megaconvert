import { ConversionError } from '../core/errors';

const EXT_TO_MIME = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  txt: ['text/plain'],
  png: ['image/png'],
  jpg: ['image/jpeg', 'image/jpg'],
  jpeg: ['image/jpeg', 'image/jpg'],
  webp: ['image/webp'],
  heic: ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'],
  heif: ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'],
  mp4: ['video/mp4'],
  mov: ['video/quicktime'],
  gif: ['image/gif'],
  mp3: ['audio/mpeg', 'audio/mp3'],
  wav: ['audio/wav', 'audio/x-wav', 'audio/wave'],
  m4a: ['audio/mp4', 'audio/x-m4a', 'audio/m4a']
};

const EXT_ALIASES = {
  heif: 'heic',
  jfif: 'jpg'
};

const GENERIC_MIMES = new Set([
  'application/octet-stream',
  'binary/octet-stream'
]);

export const getExtension = (name = '') => {
  const clean = name.toLowerCase();
  const idx = clean.lastIndexOf('.');
  return idx >= 0 ? clean.slice(idx + 1) : '';
};

const normalizeExtension = (ext = '') => EXT_ALIASES[ext] || ext;
const normalizeMime = (mime = '') => String(mime).toLowerCase().split(';')[0].trim();

export const validateMime = (file, allowedExts = []) => {
  if (!file) return;
  const ext = normalizeExtension(getExtension(file.name));
  const normalizedAllowedExts = allowedExts.map(normalizeExtension);
  if (normalizedAllowedExts.length && ext && !normalizedAllowedExts.includes(ext)) {
    throw new ConversionError('UNSUPPORTED_FORMAT', 'Unsupported file extension.', { ext, allowedExts });
  }
  const mime = normalizeMime(file.type);
  if (!mime || GENERIC_MIMES.has(mime)) return;

  const allowedMimes = normalizedAllowedExts.flatMap((allowed) => EXT_TO_MIME[allowed] || []);
  if (!allowedMimes.length) return;

  if (!allowedMimes.includes(mime)) {
    // Mobile browsers frequently report container/generic MIME values; signature checks run next.
    return;
  }
};
