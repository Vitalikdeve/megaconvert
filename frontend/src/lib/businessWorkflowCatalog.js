import {
  Captions,
  EyeOff,
  FileJson,
  Fingerprint,
  Landmark,
  Stamp,
} from 'lucide-react';

export const TOOLS_PORTAL_HANDOFF_KEY = 'megaconvert.handoff.tools-portal.v1';

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
  'tiff',
  'tif',
  'heic',
  'heif',
  'avif',
  'svg',
]);

const VIDEO_EXTENSIONS = new Set([
  'mp4',
  'mov',
  'avi',
  'mkv',
  'webm',
  'wmv',
  'flv',
  'm4v',
  'ts',
  'm2ts',
  'mts',
]);

const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'ogg',
  'aac',
  'm4a',
  'flac',
  'opus',
  'aiff',
  'wma',
]);

const DOCUMENT_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'odt',
  'rtf',
  'txt',
  'html',
  'htm',
  'xls',
  'xlsx',
  'csv',
  'ppt',
  'pptx',
]);

export const BUSINESS_WORKFLOW_CATALOG = [
  {
    id: 'invoiceScanner',
    route: '/tools/ai-invoice-scanner',
    icon: FileJson,
    translationBase: 'businessWorkflows.invoiceScanner',
    recommendedGroup: 'document',
    accentClassName: 'from-cyan-400/28 via-sky-400/14 to-transparent',
  },
  {
    id: 'strictPdfA',
    route: '/tools/strict-pdfa',
    icon: Landmark,
    translationBase: 'businessWorkflows.strictPdfA',
    recommendedGroup: 'document',
    accentClassName: 'from-violet-400/24 via-indigo-400/12 to-transparent',
  },
  {
    id: 'redactSensitiveData',
    route: '/tools/redact-sensitive-data',
    icon: EyeOff,
    translationBase: 'businessWorkflows.redactSensitiveData',
    recommendedGroup: 'document',
    accentClassName: 'from-rose-400/24 via-orange-300/10 to-transparent',
  },
  {
    id: 'autoSubtitleGenerator',
    route: '/tools/auto-subtitle-generator',
    icon: Captions,
    translationBase: 'businessWorkflows.autoSubtitleGenerator',
    recommendedGroup: 'media',
    accentClassName: 'from-emerald-400/24 via-teal-300/10 to-transparent',
  },
  {
    id: 'exifMetadataStripper',
    route: '/tools/exif-metadata-stripper',
    icon: Fingerprint,
    translationBase: 'businessWorkflows.exifMetadataStripper',
    recommendedGroup: 'media',
    accentClassName: 'from-amber-300/24 via-yellow-200/10 to-transparent',
  },
  {
    id: 'smartBrandWatermark',
    route: '/tools/smart-brand-watermark',
    icon: Stamp,
    translationBase: 'businessWorkflows.smartBrandWatermark',
    recommendedGroup: 'media',
    accentClassName: 'from-fuchsia-400/24 via-pink-300/10 to-transparent',
  },
];

export const BUSINESS_WORKFLOW_MAP = Object.fromEntries(
  BUSINESS_WORKFLOW_CATALOG.map((workflow) => [workflow.id, workflow]),
);

function getFileExtension(fileName = '') {
  const parts = String(fileName).trim().toLowerCase().split('.');
  return parts.length > 1 ? parts.at(-1) : '';
}

export function detectToolsPortalFileKind(file) {
  if (!file) {
    return 'file';
  }

  const mime = String(file.type || '').toLowerCase();
  const extension = getFileExtension(file.name);

  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) {
    return 'image';
  }

  if (mime.startsWith('video/') || VIDEO_EXTENSIONS.has(extension)) {
    return 'video';
  }

  if (mime.startsWith('audio/') || AUDIO_EXTENSIONS.has(extension)) {
    return 'audio';
  }

  if (
    mime === 'application/pdf'
    || mime.includes('officedocument')
    || mime.includes('word')
    || mime.includes('presentation')
    || mime.includes('spreadsheet')
    || mime.startsWith('text/')
    || DOCUMENT_EXTENSIONS.has(extension)
  ) {
    return 'document';
  }

  return 'file';
}

export function detectToolsPortalFileGroup(file) {
  const kind = detectToolsPortalFileKind(file);
  if (kind === 'document') {
    return 'document';
  }

  if (kind === 'image' || kind === 'video' || kind === 'audio') {
    return 'media';
  }

  return 'file';
}

export function formatToolsPortalBytes(bytes, locale = 'en') {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** exponent);

  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: value >= 100 ? 0 : value >= 10 ? 1 : 2,
  }).format(value)} ${units[exponent]}`;
}

export function isWorkflowRecommendedForGroup(workflow, fileGroup) {
  if (!workflow) {
    return false;
  }

  if (fileGroup !== 'document' && fileGroup !== 'media') {
    return false;
  }

  return workflow.recommendedGroup === fileGroup;
}
