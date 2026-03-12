import {
  AudioLines,
  Clapperboard,
  EyeOff,
  FileStack,
  ImageIcon,
  Link2,
  Network,
  ScanText,
  Sparkles,
  Stamp
} from 'lucide-react';

export const WORKSPACE_V3_DEFAULT_PATH = '/workspace/local-convert';

const copy = (isRussian, ruText, enText) => (isRussian ? ruText : enText);

export const getWorkspaceRouteGroups = (isRussian = false) => ([
  {
    id: 'media',
    label: copy(isRussian, 'Медиа', 'Media'),
    items: [
      {
        id: 'local-convert',
        label: copy(isRussian, 'Локальная конвертация', 'Local Conversion'),
        subtitle: '@ffmpeg/ffmpeg (WASM)',
        path: '/workspace/local-convert',
        icon: Clapperboard
      },
      {
        id: 'media-trimmer',
        label: copy(isRussian, 'Медиа Триммер', 'Media Trimmer'),
        subtitle: copy(isRussian, 'Таймлайн до конвертации', 'Trim timeline before convert'),
        path: '/workspace/media-trimmer',
        icon: AudioLines
      },
      {
        id: 'megagrid',
        label: 'MegaGrid',
        subtitle: copy(isRussian, 'Распределенный браузерный кластер', 'Distributed browser cluster'),
        path: '/workspace/megagrid',
        icon: Network
      }
    ]
  },
  {
    id: 'pdf',
    label: 'PDF',
    items: [
      {
        id: 'pdf-editor',
        label: copy(isRussian, 'Визуальный PDF-редактор', 'Visual PDF Editor'),
        subtitle: 'pdf-lib + Drag & Drop',
        path: '/workspace/pdf-editor',
        icon: FileStack
      }
    ]
  },
  {
    id: 'tools',
    label: copy(isRussian, 'Инструменты', 'Tools'),
    items: [
      {
        id: 'image-optimizer',
        label: copy(isRussian, 'Оптимизатор изображений', 'Image Optimizer'),
        subtitle: copy(isRussian, 'Интерактивное сжатие', 'Interactive compression'),
        path: '/workspace/image-optimizer',
        icon: ImageIcon
      },
      {
        id: 'exif-scrubber',
        label: 'EXIF Scrubber',
        subtitle: copy(isRussian, 'Очистка метаданных', 'Privacy mode toggle'),
        path: '/workspace/exif-scrubber',
        icon: EyeOff
      },
      {
        id: 'watermark-batch',
        label: copy(isRussian, 'Пакетный Watermark', 'Batch Watermark'),
        subtitle: 'Resize + watermark + ZIP',
        path: '/workspace/watermark-batch',
        icon: Stamp
      },
      {
        id: 'secure-share',
        label: 'MegaDrop',
        subtitle: 'WebRTC P2P / QR Link',
        path: '/workspace/secure-share',
        icon: Link2
      }
    ]
  },
  {
    id: 'ai',
    label: 'AI',
    items: [
      {
        id: 'smart-ocr',
        label: copy(isRussian, 'Умный OCR', 'Smart OCR'),
        subtitle: 'tesseract.js in browser',
        path: '/workspace/smart-ocr',
        icon: ScanText
      }
    ]
  }
]);

export const normalizeWorkspacePath = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '/workspace';
  let normalized = raw.startsWith('/') ? raw : `/${raw}`;
  normalized = normalized.replace(/\/{2,}/g, '/');
  if (normalized.length > 1 && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return normalized || '/workspace';
};

export const flattenWorkspaceRoutes = (isRussian = false) => getWorkspaceRouteGroups(isRussian).flatMap((group) => group.items);

export const matchWorkspaceRoute = (path, routes = []) => {
  const normalized = normalizeWorkspacePath(path);
  return routes.find((item) => item.path === normalized) || null;
};

export const getWorkspaceHeroBadges = (isRussian = false) => ([
  { id: 'client-first', label: copy(isRussian, 'Обработка на устройстве', 'Client-first processing'), icon: Sparkles },
  { id: 'privacy', label: copy(isRussian, 'Приватность по умолчанию', 'Privacy by design'), icon: EyeOff },
  { id: 'wasm', label: copy(isRussian, 'Ускорение через WASM', 'WASM acceleration'), icon: Clapperboard }
]);
