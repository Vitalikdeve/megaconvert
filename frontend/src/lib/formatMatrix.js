import { TOOL_DEFS } from '../../../shared/tools.js';
import {
  buildFormatSearchValue,
  FORMAT_EXTENSION_ALIASES,
  FORMAT_FAMILY_ORDER,
  getFormatFamily,
  getFormatsForFamily,
  getRelevantTargetFamilies,
  getSupportedFormat,
} from './supportedFormats.js';

const MIME_CATEGORY_PREFIX = {
  'image/': 'images',
  'video/': 'video',
  'audio/': 'audio',
  'text/': 'documents',
};

const MIME_CATEGORY_EXACT = {
  'application/pdf': 'documents',
  'application/msword': 'documents',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'documents',
  'application/vnd.ms-excel': 'spreadsheets',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheets',
  'application/vnd.ms-powerpoint': 'presentations',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentations',
  'application/zip': 'archives',
  'application/x-rar-compressed': 'archives',
  'application/x-7z-compressed': 'archives',
  'application/gzip': 'archives',
};

export const FORMAT_GROUP_ORDER = [...FORMAT_FAMILY_ORDER];

const SOURCE_CATEGORY_BY_EXT = new Map();
const DIRECT_TARGET_OPTIONS_BY_INPUT = new Map();
const CATALOG_OPTIONS_BY_FAMILY = new Map();

const normalizeExtension = (value) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/^\./, '');
  return FORMAT_EXTENSION_ALIASES[normalized] || normalized;
};

const formatLabel = (ext) => getSupportedFormat(ext)?.label || String(ext || '').trim().toUpperCase();

const inferCategoryFromMime = (mimeType) => {
  const normalizedMime = String(mimeType || '').trim().toLowerCase();
  if (!normalizedMime) {
    return 'other';
  }

  if (MIME_CATEGORY_EXACT[normalizedMime]) {
    return MIME_CATEGORY_EXACT[normalizedMime];
  }

  const prefixMatch = Object.entries(MIME_CATEGORY_PREFIX)
    .find(([prefix]) => normalizedMime.startsWith(prefix));

  return prefixMatch?.[1] || 'other';
};

const inferCategoryFromExt = (ext, fallbackCategory = 'other') => (
  getFormatFamily(normalizeExtension(ext), fallbackCategory)
  || fallbackCategory
  || 'other'
);

const createTargetOption = (ext, toolId = '', category = '') => {
  const normalizedExt = normalizeExtension(ext);
  const supported = getSupportedFormat(normalizedExt);
  const resolvedCategory = category || supported?.family || inferCategoryFromExt(normalizedExt);

  return {
    ext: normalizedExt,
    label: supported?.label || formatLabel(normalizedExt),
    toolId,
    category: resolvedCategory,
    aliases: supported?.aliases || [],
    keywords: supported?.keywords || [],
    cloudOnly: !toolId,
    searchValue: buildFormatSearchValue({
      ext: normalizedExt,
      label: supported?.label || formatLabel(normalizedExt),
      aliases: supported?.aliases || [],
      keywords: supported?.keywords || [],
      family: resolvedCategory,
    }),
  };
};

for (const tool of TOOL_DEFS) {
  const outputExt = normalizeExtension(tool.outputExt);
  const outputCategory = inferCategoryFromExt(outputExt, tool.category);

  if (!CATALOG_OPTIONS_BY_FAMILY.has(outputCategory)) {
    CATALOG_OPTIONS_BY_FAMILY.set(outputCategory, new Map());
  }
  if (!CATALOG_OPTIONS_BY_FAMILY.get(outputCategory).has(outputExt)) {
    CATALOG_OPTIONS_BY_FAMILY.get(outputCategory).set(outputExt, createTargetOption(outputExt, '', outputCategory));
  }

  for (const sourceExtValue of tool.inputExts || []) {
    const inputExt = normalizeExtension(sourceExtValue);
    const inputCategory = inferCategoryFromExt(inputExt, tool.category);

    if (!SOURCE_CATEGORY_BY_EXT.has(inputExt)) {
      SOURCE_CATEGORY_BY_EXT.set(inputExt, inputCategory);
    }

    if (!inputExt || !outputExt || inputExt === outputExt) {
      continue;
    }

    if (!DIRECT_TARGET_OPTIONS_BY_INPUT.has(inputExt)) {
      DIRECT_TARGET_OPTIONS_BY_INPUT.set(inputExt, new Map());
    }

    const optionsByOutput = DIRECT_TARGET_OPTIONS_BY_INPUT.get(inputExt);
    if (!optionsByOutput.has(outputExt)) {
      optionsByOutput.set(outputExt, createTargetOption(outputExt, tool.id, outputCategory));
    }
  }
}

for (const family of FORMAT_FAMILY_ORDER) {
  const familyOptions = CATALOG_OPTIONS_BY_FAMILY.get(family) || new Map();
  for (const entry of getFormatsForFamily(family)) {
    if (!familyOptions.has(entry.ext)) {
      familyOptions.set(entry.ext, createTargetOption(entry.ext, '', family));
    }
  }
  CATALOG_OPTIONS_BY_FAMILY.set(family, familyOptions);
}

export const FORMAT_MATRIX = Object.fromEntries(
  Array.from(DIRECT_TARGET_OPTIONS_BY_INPUT.entries()).map(([inputExt, options]) => ([
    inputExt,
    Array.from(options.values()).sort((left, right) => left.label.localeCompare(right.label)),
  ])),
);

export const detectFileExtension = (file) => {
  const name = String(file?.name || '').trim().toLowerCase();
  const parts = name.split('.');
  if (parts.length > 1) {
    const joinedTail = parts.slice(-2).join('.');
    if (FORMAT_MATRIX[joinedTail] || getSupportedFormat(joinedTail)) {
      return normalizeExtension(joinedTail);
    }

    return normalizeExtension(parts[parts.length - 1]);
  }

  const mimeType = String(file?.type || '').trim().toLowerCase();
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/heic' || mimeType === 'image/heif') return 'heic';
  if (mimeType === 'video/mp4') return 'mp4';
  if (mimeType === 'audio/mpeg') return 'mp3';
  if (mimeType === 'application/pdf') return 'pdf';

  return '';
};

export const detectFileCategory = (file) => {
  const ext = detectFileExtension(file);
  return SOURCE_CATEGORY_BY_EXT.get(ext)
    || inferCategoryFromExt(ext)
    || inferCategoryFromMime(file?.type)
    || 'other';
};

export const getDetectedFormatMeta = (file) => {
  const ext = detectFileExtension(file);
  const category = detectFileCategory(file);

  return {
    ext,
    label: ext ? formatLabel(ext) : 'FILE',
    category,
  };
};

export const getAvailableTargetFormats = (file) => {
  const ext = detectFileExtension(file);
  const category = detectFileCategory(file);
  const merged = new Map();

  for (const option of FORMAT_MATRIX[ext] || []) {
    merged.set(option.ext, {
      ...option,
      cloudOnly: false,
    });
  }

  for (const family of getRelevantTargetFamilies(category)) {
    const familyOptions = Array.from((CATALOG_OPTIONS_BY_FAMILY.get(family) || new Map()).values());
    for (const option of familyOptions) {
      if (!option.ext || option.ext === ext) {
        continue;
      }

      if (!merged.has(option.ext)) {
        merged.set(option.ext, {
          ...option,
          toolId: '',
          cloudOnly: true,
        });
      }
    }
  }

  return Array.from(merged.values()).sort((left, right) => {
    const categoryWeight = FORMAT_GROUP_ORDER.indexOf(left.category) - FORMAT_GROUP_ORDER.indexOf(right.category);
    if (categoryWeight !== 0) return categoryWeight;
    if (left.cloudOnly !== right.cloudOnly) return left.cloudOnly ? 1 : -1;
    return left.label.localeCompare(right.label);
  });
};

export const groupTargetFormats = (formats) => {
  const grouped = new Map();

  for (const format of formats || []) {
    const category = inferCategoryFromExt(format?.ext, format?.category);
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category).push({
      ...format,
      category,
    });
  }

  return FORMAT_GROUP_ORDER
    .filter((category) => grouped.has(category))
    .map((category) => ({
      category,
      options: grouped.get(category).sort((left, right) => {
        if (left.cloudOnly !== right.cloudOnly) return left.cloudOnly ? 1 : -1;
        return left.label.localeCompare(right.label);
      }),
    }));
};

export const resolveConversionTool = (inputExt, targetExt) => {
  const normalizedInput = normalizeExtension(inputExt);
  const normalizedTarget = normalizeExtension(targetExt);
  return DIRECT_TARGET_OPTIONS_BY_INPUT.get(normalizedInput)?.get(normalizedTarget)?.toolId || '';
};

export const resolveLocalFallbackAction = (file, targetFormat) => {
  const category = detectFileCategory(file);
  const target = normalizeExtension(targetFormat);

  if (category === 'images' || category === 'design') {
    if (target === 'jpg') return 'image_to_jpg';
    return 'compress_image';
  }

  if (category === 'video') {
    if (['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'opus'].includes(target)) {
      return 'extract_audio';
    }
    return 'compress_mp4';
  }

  if (category === 'audio') {
    if (target === 'mp3') return 'audio_to_mp3';
    return 'compress_audio';
  }

  return 'generic_convert';
};

export const getFormatGroupLabelKey = (category) => {
  switch (category) {
    case 'images':
      return 'portalFormatGroupImages';
    case 'design':
      return 'portalFormatGroupDesign';
    case 'video':
      return 'portalFormatGroupVideo';
    case 'audio':
      return 'portalFormatGroupAudio';
    case 'documents':
      return 'portalFormatGroupDocuments';
    case 'spreadsheets':
      return 'portalFormatGroupSpreadsheets';
    case 'presentations':
      return 'portalFormatGroupPresentations';
    case 'archives':
      return 'portalFormatGroupArchives';
    case 'ebooks':
      return 'portalFormatGroupEbooks';
    case 'data':
      return 'portalFormatGroupData';
    default:
      return 'portalFormatGroupOther';
  }
};

export const getFormatCategoryLabelKey = (category) => {
  switch (category) {
    case 'images':
      return 'portalDetectedImages';
    case 'design':
      return 'portalDetectedDesign';
    case 'video':
      return 'portalDetectedVideo';
    case 'audio':
      return 'portalDetectedAudio';
    case 'documents':
      return 'portalDetectedDocuments';
    case 'spreadsheets':
      return 'portalDetectedSpreadsheets';
    case 'presentations':
      return 'portalDetectedPresentations';
    case 'archives':
      return 'portalDetectedArchives';
    case 'ebooks':
      return 'portalDetectedEbooks';
    case 'data':
      return 'portalDetectedData';
    default:
      return 'portalDetectedFile';
  }
};
