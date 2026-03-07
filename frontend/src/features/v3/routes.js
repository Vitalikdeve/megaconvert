import {
  AudioLines,
  Clapperboard,
  EyeOff,
  FileStack,
  ImageIcon,
  Link2,
  ScanText,
  Sparkles,
  Stamp
} from 'lucide-react';

export const WORKSPACE_V3_DEFAULT_PATH = '/workspace/local-convert';

export const WORKSPACE_V3_GROUPS = [
  {
    id: 'media',
    label: 'Медиа',
    items: [
      {
        id: 'local-convert',
        label: 'Локальная конвертация',
        subtitle: '@ffmpeg/ffmpeg (WASM)',
        path: '/workspace/local-convert',
        icon: Clapperboard
      },
      {
        id: 'media-trimmer',
        label: 'Медиа Триммер',
        subtitle: 'Таймлайн до конвертации',
        path: '/workspace/media-trimmer',
        icon: AudioLines
      }
    ]
  },
  {
    id: 'pdf',
    label: 'PDF',
    items: [
      {
        id: 'pdf-editor',
        label: 'Визуальный PDF-редактор',
        subtitle: 'pdf-lib + Drag & Drop',
        path: '/workspace/pdf-editor',
        icon: FileStack
      }
    ]
  },
  {
    id: 'tools',
    label: 'Инструменты',
    items: [
      {
        id: 'image-optimizer',
        label: 'Image Optimizer',
        subtitle: 'Интерактивное сжатие',
        path: '/workspace/image-optimizer',
        icon: ImageIcon
      },
      {
        id: 'exif-scrubber',
        label: 'EXIF Scrubber',
        subtitle: 'Privacy Mode toggle',
        path: '/workspace/exif-scrubber',
        icon: EyeOff
      },
      {
        id: 'watermark-batch',
        label: 'Пакетный Watermark',
        subtitle: 'Resize + watermark + ZIP',
        path: '/workspace/watermark-batch',
        icon: Stamp
      },
      {
        id: 'secure-share',
        label: 'Secure Share',
        subtitle: 'Ссылки на 24 часа',
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
        label: 'Умный OCR',
        subtitle: 'tesseract.js в браузере',
        path: '/workspace/smart-ocr',
        icon: ScanText
      }
    ]
  }
];

export const normalizeWorkspacePath = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '/workspace';
  let normalized = raw.startsWith('/') ? raw : `/${raw}`;
  normalized = normalized.replace(/\/{2,}/g, '/');
  if (normalized.length > 1 && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return normalized || '/workspace';
};

export const flattenWorkspaceRoutes = () => WORKSPACE_V3_GROUPS.flatMap((group) => group.items);

export const matchWorkspaceRoute = (path) => {
  const normalized = normalizeWorkspacePath(path);
  return flattenWorkspaceRoutes().find((item) => item.path === normalized) || null;
};

export const getWorkspaceHeroBadges = () => ([
  { id: 'client-first', label: 'Client-first processing', icon: Sparkles },
  { id: 'privacy', label: 'Privacy by design', icon: EyeOff },
  { id: 'wasm', label: 'WASM acceleration', icon: Clapperboard }
]);

