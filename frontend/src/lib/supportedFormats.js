import { TOOL_DEFS } from '../../../shared/tools.js';

const format = (ext, family, options = {}) => ({
  ext,
  family,
  label: String(options.label || ext).toUpperCase(),
  aliases: Array.isArray(options.aliases) ? options.aliases : [],
  keywords: Array.isArray(options.keywords) ? options.keywords : [],
});

const defineFormats = (family, specs) => specs.map((spec) => (
  typeof spec === 'string'
    ? format(spec, family)
    : format(spec.ext, family, spec)
));

export const FORMAT_EXTENSION_ALIASES = {
  jpeg: 'jpg',
  tif: 'tiff',
  heif: 'heic',
  htm: 'html',
  markdown: 'md',
  yml: 'yaml',
};

export const FORMAT_FAMILY_ORDER = [
  'images',
  'design',
  'video',
  'audio',
  'documents',
  'spreadsheets',
  'presentations',
  'ebooks',
  'archives',
  'data',
  'other',
];

const CATALOG_GROUPS = {
  images: defineFormats('images', [
    { ext: 'jpg', aliases: ['jpeg'], keywords: ['photo', 'raster'] },
    'png',
    'webp',
    'gif',
    'bmp',
    { ext: 'tiff', aliases: ['tif'] },
    { ext: 'heic', aliases: ['heif'] },
    'avif',
    'ico',
    'raw',
    'cr2',
    'nef',
    'orf',
    'dng',
    'arw',
    'dds',
    'tga',
    'j2k',
    'jp2',
    'dpx',
    'exr',
    'pct',
    'pic',
    'pcd',
  ]),
  design: defineFormats('design', [
    'svg',
    'eps',
    'ps',
    'ai',
    'psd',
  ]),
  video: defineFormats('video', [
    'mp4',
    'webm',
    'mkv',
    'avi',
    'mov',
    'flv',
    'wmv',
    'm4v',
    'ts',
    '3gp',
    'ogv',
    'vob',
    'rm',
    'rmvb',
    'asf',
    'f4v',
    'm2ts',
    'mts',
    'mxf',
    'prores',
    'mpg',
    'mpeg',
  ]),
  audio: defineFormats('audio', [
    'mp3',
    'wav',
    'aac',
    'ogg',
    'flac',
    'm4a',
    'wma',
    'aiff',
    'alac',
    'opus',
    'ac3',
    'amr',
    'au',
    'voc',
    'ra',
    'm4r',
    'ape',
    'aif',
  ]),
  documents: defineFormats('documents', [
    'pdf',
    'docx',
    'doc',
    'odt',
    'rtf',
    'txt',
    'html',
    'wps',
    'wpd',
    'pages',
    'oxps',
    'md',
  ]),
  spreadsheets: defineFormats('spreadsheets', [
    'xlsx',
    'xls',
    'ods',
    'csv',
    'tsv',
    'numbers',
  ]),
  presentations: defineFormats('presentations', [
    'pptx',
    'ppt',
    'odp',
    'key',
  ]),
  ebooks: defineFormats('ebooks', [
    'epub',
    'mobi',
    'azw',
    'azw3',
    'fb2',
    'lit',
    'lrf',
    'tcr',
    'pdb',
    'pml',
    'snb',
    'cbc',
    'cbz',
    'cbr',
  ]),
  archives: defineFormats('archives', [
    'zip',
    '7z',
    'tar',
    'tar.gz',
    'tgz',
    'gz',
    'bz2',
    'xz',
    'rar',
    'cab',
    'iso',
    'arj',
    'lzh',
    'chm',
    'wim',
  ]),
  data: defineFormats('data', [
    'json',
    'xml',
    'yaml',
    'toml',
    'ini',
    'sql',
    'cfg',
    'log',
    'base64',
    'bin',
  ]),
};

const CATALOG_ENTRIES = Object.values(CATALOG_GROUPS).flat();

const inferFamilyFromExt = (ext) => {
  const normalized = String(ext || '').trim().toLowerCase();
  if (!normalized) return 'other';

  for (const family of FORMAT_FAMILY_ORDER) {
    if ((CATALOG_GROUPS[family] || []).some((entry) => entry.ext === normalized)) {
      return family;
    }
  }

  if (normalized === 'yaml' || normalized === 'yml') return 'data';
  return 'other';
};

const normalizeExtension = (value) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/^\./, '');
  return FORMAT_EXTENSION_ALIASES[normalized] || normalized;
};

const dynamicExtensions = new Set();
for (const tool of TOOL_DEFS) {
  dynamicExtensions.add(normalizeExtension(tool.outputExt));
  for (const inputExt of tool.inputExts || []) {
    dynamicExtensions.add(normalizeExtension(inputExt));
  }
}

const catalogByExt = new Map();
for (const entry of CATALOG_ENTRIES) {
  catalogByExt.set(entry.ext, entry);
}

for (const ext of dynamicExtensions) {
  if (!catalogByExt.has(ext)) {
    catalogByExt.set(ext, format(ext, inferFamilyFromExt(ext)));
  }
}

export const SUPPORTED_FORMATS = Array.from(catalogByExt.values()).sort((left, right) => {
  const familyWeight = FORMAT_FAMILY_ORDER.indexOf(left.family) - FORMAT_FAMILY_ORDER.indexOf(right.family);
  if (familyWeight !== 0) return familyWeight;
  return left.label.localeCompare(right.label);
});

export const SUPPORTED_FORMATS_BY_EXT = Object.freeze(
  Object.fromEntries(SUPPORTED_FORMATS.map((entry) => [entry.ext, entry])),
);

export const SUPPORTED_FORMATS_BY_FAMILY = Object.freeze(
  FORMAT_FAMILY_ORDER.reduce((accumulator, family) => {
    accumulator[family] = SUPPORTED_FORMATS.filter((entry) => entry.family === family);
    return accumulator;
  }, {}),
);

export const SUPPORTED_FORMAT_COUNT = SUPPORTED_FORMATS.length;

export const TARGET_GROUPS_BY_SOURCE_CATEGORY = Object.freeze({
  images: ['images', 'design', 'documents'],
  design: ['design', 'images', 'documents'],
  video: ['video', 'audio', 'images'],
  audio: ['audio', 'video'],
  documents: ['documents', 'spreadsheets', 'presentations', 'ebooks', 'images'],
  spreadsheets: ['spreadsheets', 'documents', 'data', 'presentations'],
  presentations: ['presentations', 'documents', 'images'],
  ebooks: ['ebooks', 'documents', 'images'],
  archives: ['archives'],
  data: ['data', 'documents', 'spreadsheets'],
  other: ['images', 'video', 'audio', 'documents', 'ebooks', 'archives', 'data'],
});

export function getSupportedFormat(ext) {
  return SUPPORTED_FORMATS_BY_EXT[normalizeExtension(ext)] || null;
}

export function getFormatFamily(ext, fallback = 'other') {
  return getSupportedFormat(ext)?.family || fallback;
}

export function getRelevantTargetFamilies(category) {
  return TARGET_GROUPS_BY_SOURCE_CATEGORY[String(category || '').trim().toLowerCase()] || TARGET_GROUPS_BY_SOURCE_CATEGORY.other;
}

export function getFormatsForFamily(family) {
  return SUPPORTED_FORMATS_BY_FAMILY[String(family || '').trim().toLowerCase()] || [];
}

export function buildFormatSearchValue(formatEntry) {
  if (!formatEntry) {
    return '';
  }

  return [
    formatEntry.label,
    formatEntry.ext,
    ...(formatEntry.aliases || []),
    ...(formatEntry.keywords || []),
    formatEntry.family,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
