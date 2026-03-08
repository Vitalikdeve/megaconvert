
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Zap, ShieldCheck, Globe2, ServerCog,
  Upload, Download, Settings, Search, Cloud, Layers,
  Image as ImageIcon, FileText, Music, Video,
  ChevronDown, Box, Mail, Github, Lock, X, Eye, Moon, Sun, UserCircle2
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  GithubAuthProvider,
  linkWithPopup,
  unlink,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously
} from 'firebase/auth';

import { translations, defaultLang } from './i18n';
import SeoPage from './SeoPage.jsx';
import { CONVERSIONS, getConversionBySlug } from './seo/conversions';
import { runConversion, decryptFileGcm } from './conversion';
import { extractLocalNameFromUrl } from './conversion/local/converter';
import { listProcessors } from './conversion/processors/registry';
import { uploadToStorage } from './conversion/adapters/storage';
import { createIntelligencePlan, registerAssistantFeedback } from './ai/intelligenceEngine';
import { withRetry } from './lib/retry';
import { emitSystemEvent } from './lib/events';
import { generateAutoConversionArticles, generateAutoUpdateArticles } from './lib/autoArticles';
import {
  updateAiSuggestions,
  updateJobState,
  updateUserPreferences,
  pushHistoryItem
} from './store/appStore';
import ShareButton from './features/sharing/ShareButton.jsx';
import HistoryList from './features/history/HistoryList.jsx';
import BatchUploader from './features/batch/BatchUploader.jsx';
import DynamicBatchStack from './features/batch/DynamicBatchStack.jsx';
import NextActions from './features/recommendations/NextActions.jsx';
import AiStudioPage from './features/ai/AiStudioPage.jsx';
import WorkspaceV3Page from './features/v3/WorkspaceV3Page.jsx';
import LocalMediaConverterTool from './features/tools/LocalMediaConverterTool.jsx';
import OcrRecognitionTool from './features/tools/OcrRecognitionTool.jsx';
import PdfEditorTool from './features/tools/PdfEditorTool.jsx';
import ImageCompressorTool from './features/tools/ImageCompressorTool.jsx';
import BatchWatermarkTool from './features/tools/BatchWatermarkTool.jsx';
import { getSmartTips } from './features/tips/TipsEngine.js';
import QuickLookModal from './features/preview/QuickLookModal.jsx';
import GlassToast from './components/GlassToast.jsx';
import SmoothScrollProvider from './components/SmoothScrollProvider.jsx';
import PageTransition from './components/PageTransition.jsx';
import { useTheme } from './theme/ThemeProvider.jsx';
import AdminApp from './admin/AdminApp.tsx';

// --- Firebase ---
const firebaseConfig = {
  apiKey: 'AIzaSyDT7-w-qd3c_MhmuxUjHigi9p1ZL8iMmII',
  authDomain: 'megaconvert2026.firebaseapp.com',
  projectId: 'megaconvert2026',
  storageBucket: 'megaconvert2026.firebasestorage.app',
  messagingSenderId: '135783756092',
  appId: '1:135783756092:web:4de3daada1bde5e5112e39',
  measurementId: 'G-356FHKB2V0'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
if (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1') {
  // Google OAuth in this Firebase project is allowed for localhost, not raw loopback IP.
  const nextUrl = new URL(window.location.href);
  nextUrl.hostname = 'localhost';
  window.location.replace(nextUrl.toString());
}

// --- Languages ---
const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'be', name: 'Беларуская', flag: '🇧🇾' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'zh-tw', name: '繁體中文', flag: '🇹🇼' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' }
];
const LANG_TO_LOCALE = {
  en: 'en-US',
  ru: 'ru-RU',
  be: 'be-BY',
  es: 'es-ES',
  pt: 'pt-PT',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  nl: 'nl-NL',
  pl: 'pl-PL',
  tr: 'tr-TR',
  zh: 'zh-CN',
  'zh-tw': 'zh-TW',
  ar: 'ar-SA',
  ja: 'ja-JP',
  hi: 'hi-IN',
  ko: 'ko-KR'
};

const toolIcon = (type) => {
  if (type === 'doc') return <FileText size={18} />;
  if (type === 'image') return <ImageIcon size={18} />;
  if (type === 'video') return <Video size={18} />;
  if (type === 'audio') return <Music size={18} />;
  return <Box size={18} />;
};

const TOP_TOOL_IDS = ['pdf-word', 'mp4-mp3', 'heic-jpg', 'jpg-pdf', 'pdf-png-hires'];
const TOOL_OPEN_COUNTS_STORAGE_KEY = 'tool_open_counts';
const CLIENT_SESSION_ID_STORAGE_KEY = 'mc_client_session_id';
const TEST_MODE_SESSION_STORAGE_KEY = 'mc_test_mode_session';
const MAX_BATCH_FILES_DEFAULT = 10;
const OAUTH_PROVIDER_IDS = {
  google: 'google.com',
  github: 'github.com'
};
const FULL_ACCESS_PLAN_TIERS = new Set(['pro', 'pro_trial', 'team', 'team_trial', 'individual', 'individual_trial']);
const ACCOUNT_WORKFLOW_NODE_TYPES = [
  { value: 'upload', label: 'Upload' },
  { value: 'analyze', label: 'Analyze' },
  { value: 'preprocess', label: 'Preprocess' },
  { value: 'convert', label: 'Convert' },
  { value: 'compress', label: 'Compress' },
  { value: 'postprocess', label: 'Postprocess' },
  { value: 'deliver', label: 'Deliver' }
];

const normalizePlanTier = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s-]+/g, '_');

const formatShortTimestamp = (value, locale = 'en-US') => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
};

const isLocalDownloadUrl = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized.startsWith('blob:') || normalized.startsWith('data:');
};

const revokeBlobObjectUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw || !raw.toLowerCase().startsWith('blob:')) return;
  const objectUrl = raw.split('#')[0];
  try {
    URL.revokeObjectURL(objectUrl);
  } catch {
    // ignore
  }
};

const getExtensionFromValue = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const localName = extractLocalNameFromUrl(raw);
  const source = localName || raw.split('#')[0];
  const normalized = source.split('?')[0];
  const lastSegment = normalized.split('/').pop() || normalized;
  const parts = lastSegment.split('.');
  if (parts.length < 2) return '';
  return parts.pop().toLowerCase();
};

const getPreviewType = (ext) => {
  if (!ext) return 'other';
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'image';
  if (['txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml', 'log'].includes(ext)) return 'text';
  if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'rtf'].includes(ext)) return 'doc';
  return 'other';
};

const isPreviewableType = (type) => ['pdf', 'image', 'doc', 'text'].includes(type);

const getDeviceBatchLimit = () => {
  return MAX_BATCH_FILES_DEFAULT;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value || 0)));

const clampProgress = (value) => Math.max(0, Math.min(100, Number(value || 0)));

const toFiniteNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const formatTimelineTime = (value) => {
  const total = Math.max(0, Math.floor(Number(value || 0)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  try {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('blob_to_data_url_failed'));
    reader.readAsDataURL(blob);
  } catch (error) {
    reject(error);
  }
});

const dataUrlToBlob = (dataUrl) => {
  const raw = String(dataUrl || '');
  const commaIndex = raw.indexOf(',');
  if (commaIndex === -1) return null;
  const header = raw.slice(0, commaIndex);
  const payload = raw.slice(commaIndex + 1);
  const mimeMatch = header.match(/^data:([^;]+);base64$/i);
  if (!mimeMatch) return null;
  const mime = String(mimeMatch[1] || 'application/octet-stream');
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
};

const deriveEmailSessionPassword = (emailValue) => {
  const input = String(emailValue || '').trim().toLowerCase();
  if (!input) return '';
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return `MCv2!${Math.abs(hash).toString(16)}@email`;
};

const SHARE_STORAGE_KEY = 'mc_share_links';

const readShareLinks = () => {
  try {
    const raw = localStorage.getItem(SHARE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const getFileExt = (value) => {
  const parts = String(value || '').trim().toLowerCase().split('.');
  if (parts.length < 2) return '';
  return parts.pop() || '';
};

const formatSizeMbLabel = (bytes) => `${(Math.max(0, Number(bytes || 0)) / (1024 * 1024)).toFixed(1)} MB`;

const buildSequentialWorkflowEdges = (nodes) => {
  if (!Array.isArray(nodes)) return [];
  const cleaned = nodes.filter((node) => String(node?.id || '').trim());
  const edges = [];
  for (let i = 0; i < cleaned.length - 1; i += 1) {
    edges.push({
      id: `edge_${i + 1}`,
      source: String(cleaned[i].id),
      target: String(cleaned[i + 1].id)
    });
  }
  return edges;
};

const statusLabelMap = (t) => ({
  idle: t.statusStateQueued || 'В очереди',
  processing: t.statusStateProcessing || 'В процессе',
  done: t.statusStateCompleted || 'Готово',
  error: t.statusStateFailed || 'Ошибка'
});

const hasFullAccessFromBilling = (billingPayload) => {
  const billing = billingPayload && typeof billingPayload === 'object' ? billingPayload : null;
  if (!billing) return false;

  const plan = billing.plan && typeof billing.plan === 'object' ? billing.plan : null;
  const planTier = normalizePlanTier(plan?.tier || '');
  if (FULL_ACCESS_PLAN_TIERS.has(planTier)) return true;

  const activeBenefits = Array.isArray(billing.active_benefits) ? billing.active_benefits : [];
  for (const benefit of activeBenefits) {
    const kind = String(benefit?.kind || '').trim().toLowerCase();
    if (kind !== 'lifetime' && kind !== 'trial') continue;
    const payload = benefit?.payload && typeof benefit.payload === 'object' ? benefit.payload : {};
    const payloadPlanTier = normalizePlanTier(payload.plan || 'pro');
    if (FULL_ACCESS_PLAN_TIERS.has(payloadPlanTier)) return true;
  }
  return false;
};

const createClientSessionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

const getClientSessionId = () => {
  if (typeof window === 'undefined') return '';
  try {
    const existing = String(localStorage.getItem(CLIENT_SESSION_ID_STORAGE_KEY) || '').trim();
    if (existing) return existing;
    const created = createClientSessionId();
    localStorage.setItem(CLIENT_SESSION_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return createClientSessionId();
  }
};

const readToolOpenCounts = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(TOOL_OPEN_COUNTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
};

const writeToolOpenCounts = (counts) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOOL_OPEN_COUNTS_STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // Ignore storage write failures in private mode or quota limits.
  }
};

const normalizeTestModeUser = (value) => {
  const user = value && typeof value === 'object' ? value : null;
  const uid = String(user?.uid || '').trim();
  if (!uid) return null;
  const email = String(user?.email || '').trim() || null;
  const name = String(user?.name || '').trim() || (email ? email.split('@')[0] : 'Test User');
  return {
    uid,
    name,
    email,
    photo: null,
    isAnon: false,
    isTestMode: true,
    provider_data: [
      {
        provider_id: 'test_mode',
        uid,
        email
      }
    ]
  };
};

const readStoredTestModeUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TEST_MODE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return normalizeTestModeUser(parsed);
  } catch {
    return null;
  }
};

const writeStoredTestModeUser = (user) => {
  if (typeof window === 'undefined') return null;
  const normalized = normalizeTestModeUser(user);
  if (!normalized) return null;
  try {
    localStorage.setItem(TEST_MODE_SESSION_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage write failures.
  }
  return normalized;
};

const clearStoredTestModeUser = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TEST_MODE_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
};

const TRUSTED_BY = ['Northwind', 'Helios Media', 'Solstice Bank', 'Atlas Health', 'Kinetic Labs', 'Cloudlane'];
const LEGAL_LAST_UPDATED = '2026-02-15';
const LEGAL_WEBSITE = 'https://megaconvert-web.vercel.app';
const LEGAL_CONTACT_EMAIL = 'vitalikbussines@gmail.com';
const TELEGRAM_BOT_URL = 'https://megaconvert-web.vercel.app';
const X_ACCOUNT_URL = 'https://x.com/vitalikzelenko?s=11';
const BLOG_ARTICLES = [
  {
    slug: 'pdf-to-word-layout-guide',
    title: 'How to Convert PDF to Word Without Breaking Layout',
    excerpt: 'A practical workflow to keep tables, fonts, spacing, and signatures stable after conversion.',
    date: 'February 12, 2026',
    readTime: '7 min read',
    category: 'Documents',
    toolId: 'pdf-word',
    sections: [
      {
        heading: '1. Start with a clean source file',
        paragraphs: [
          'Layout problems usually come from the source PDF, not the converter. If the PDF has missing fonts, low-resolution scans, or mixed page sizes, DOCX output becomes harder to edit.',
          'Before converting, quickly inspect 3 things: page orientation, embedded fonts, and whether text is selectable or image-only.'
        ],
        bullets: [
          'Use text-based PDFs for best editable output',
          'Keep one document orientation per file when possible',
          'Avoid heavily compressed scans if you need accurate text'
        ]
      },
      {
        heading: '2. Validate headers, tables, and page breaks first',
        paragraphs: [
          'After conversion, do not review line by line. Validate structure blocks first: title, section headers, table widths, and page break points. This catches 90% of formatting issues quickly.',
          'When a table shifts, set fixed column width in Word and disable auto-resize to content.'
        ],
        bullets: [
          'Check first page and one random middle page',
          'Lock table width before editing content',
          'Reapply only missing styles, not full reformatting'
        ]
      },
      {
        heading: '3. Build a reusable correction checklist',
        paragraphs: [
          'Teams lose time because every person checks different things. Create one short checklist and reuse it for invoices, contracts, and reports.',
          'A repeatable QA flow reduces manual editing time and improves consistency across exports.'
        ],
        bullets: [
          'Header/footer alignment',
          'Page numbers and section breaks',
          'Table borders and merged cells',
          'Special characters and currency symbols'
        ]
      }
    ]
  },
  {
    slug: 'scan-quality-for-ocr-results',
    title: 'Scan Quality Rules That Improve OCR Accuracy',
    excerpt: 'Simple preparation steps for cleaner text extraction from scanned pages and photos.',
    date: 'February 10, 2026',
    readTime: '6 min read',
    category: 'OCR',
    toolId: 'pdf-txt',
    sections: [
      {
        heading: '1. Resolution and contrast are non-negotiable',
        paragraphs: [
          'OCR engines perform best when character edges are clear. 300 DPI with strong contrast is the minimum baseline for documents with small fonts.',
          'Blur, shadows, and perspective distortion produce broken words and punctuation noise.'
        ],
        bullets: [
          'Target 300 DPI for documents, 400 DPI for tiny print',
          'Keep pages flat and evenly lit',
          'Avoid aggressive JPG compression before OCR'
        ]
      },
      {
        heading: '2. Language and encoding must match content',
        paragraphs: [
          'Mixed languages in one file are common in forms and visas. Make sure output is handled as UTF-8 so Cyrillic, accented Latin, and symbols remain readable.',
          'If your output looks like gibberish, this is usually an encoding mismatch after extraction, not a recognition failure.'
        ],
        bullets: [
          'Prefer UTF-8 output for multilingual text',
          'Keep one language block per page where possible',
          'Verify quotes, dashes, and currency symbols'
        ]
      },
      {
        heading: '3. Post-process with structure, not manual rewriting',
        paragraphs: [
          'After OCR, first normalize line breaks and remove duplicated spaces. Then fix names, numbers, and legal references.',
          'A two-pass cleanup process is faster and safer than rewriting text manually from scratch.'
        ],
        bullets: [
          'Normalize spacing and line endings',
          'Search for common OCR confusions (O/0, I/1)',
          'Run quick spell-check in the target language'
        ]
      }
    ]
  },
  {
    slug: 'image-to-pdf-for-visa-packs',
    title: 'Image to PDF for Visa Packages: A Reliable Checklist',
    excerpt: 'How to assemble multi-page PDF packs from phone scans without rejection risks.',
    date: 'February 8, 2026',
    readTime: '8 min read',
    category: 'Images',
    toolId: 'image-pdf',
    sections: [
      {
        heading: '1. Normalize page dimensions before merge',
        paragraphs: [
          'Consulates and offices often reject packs with inconsistent page sizes or rotated pages. Normalize all images to one orientation and paper ratio before converting to PDF.',
          'Do not mix landscape and portrait pages in a single official packet unless specifically requested.'
        ],
        bullets: [
          'Use consistent A4 or Letter ratio',
          'Rotate pages to upright orientation',
          'Keep margins visible for stamps and seals'
        ]
      },
      {
        heading: '2. Preserve readability over aggressive compression',
        paragraphs: [
          'File-size limits matter, but unreadable stamps or signatures are worse than a larger file. Keep text and seals sharp first, then optimize size.',
          'If a page includes fine print, export that page at higher quality.'
        ],
        bullets: [
          'Prioritize readability for signatures and numbers',
          'Compress in steps and verify after each step',
          'Avoid converting text-heavy pages to low-quality JPG twice'
        ]
      },
      {
        heading: '3. Final QA before upload',
        paragraphs: [
          'Open the final PDF on both desktop and mobile to confirm orientation, page order, and legibility. This prevents upload retries and deadline issues.',
          'Maintain a naming standard so support teams can identify each packet quickly.'
        ],
        bullets: [
          'Check page order and total page count',
          'Confirm all pages are searchable or readable',
          'Use clear filenames like passport-pack-v2.pdf'
        ]
      }
    ]
  },
  {
    slug: 'video-compression-without-quality-loss',
    title: 'Video Compression Without Visible Quality Loss',
    excerpt: 'A balanced method for reducing MP4 size while keeping text overlays and motion clean.',
    date: 'February 5, 2026',
    readTime: '7 min read',
    category: 'Video',
    toolId: 'mov-mp4',
    sections: [
      {
        heading: '1. Pick the target first: web, social, or archive',
        paragraphs: [
          'Compression settings depend on destination. A web preview and an archive master should not share the same bitrate target.',
          'Define platform and maximum upload size before conversion to avoid multiple re-encodes.'
        ],
        bullets: [
          'Social uploads: optimize for faster playback',
          'Internal review: medium bitrate with readable overlays',
          'Archive: higher bitrate and original frame rate'
        ]
      },
      {
        heading: '2. Control bitrate and frame rate deliberately',
        paragraphs: [
          'Most quality loss comes from unnecessary frame-rate changes or too low bitrate for motion-heavy scenes.',
          'For screen recordings, text clarity benefits from stable frame rate and moderate bitrate rather than extreme compression.'
        ],
        bullets: [
          'Keep native frame rate when possible',
          'Lower bitrate gradually, then compare output',
          'Review fast-motion segments, not only static shots'
        ]
      },
      {
        heading: '3. Use a two-file strategy',
        paragraphs: [
          'Keep a high-quality master and a distribution version. This saves time when a platform requests a new format later.',
          'Re-encoding from already compressed output compounds artifacts, so always re-export from source or master.'
        ],
        bullets: [
          'Master file for future edits',
          'Delivery file for upload limits',
          'Document conversion settings in project notes'
        ]
      }
    ]
  },
  {
    slug: 'secure-file-sharing-after-conversion',
    title: 'Secure File Sharing After Conversion: Team Playbook',
    excerpt: 'Operational rules for sharing converted files safely across teams and clients.',
    date: 'February 3, 2026',
    readTime: '6 min read',
    category: 'Security',
    toolId: 'pdf-word',
    sections: [
      {
        heading: '1. Share by sensitivity tier, not convenience',
        paragraphs: [
          'Do not treat all converted files equally. Contracts, IDs, and medical forms need stricter access windows and recipients.',
          'Define at least three tiers: public, internal, restricted.'
        ],
        bullets: [
          'Restricted files: shortest link validity',
          'Internal files: team-only channels',
          'Public files: sanitized and approved versions'
        ]
      },
      {
        heading: '2. Minimize file lifetime and duplication',
        paragraphs: [
          'Most leakage events happen through duplicates in chats, email threads, and local downloads. Limit copies and keep one canonical shared location.',
          'Expire download links and remove stale artifacts from collaboration threads.'
        ],
        bullets: [
          'Use temporary links for sensitive exports',
          'Avoid re-uploading the same document in multiple chats',
          'Schedule periodic cleanup of stale attachments'
        ]
      },
      {
        heading: '3. Keep an audit-friendly naming policy',
        paragraphs: [
          'A clear naming convention helps legal and operations teams trace which file version was sent and when.',
          'Include project code, date, and revision in filename metadata.'
        ],
        bullets: [
          'Example: contract-acme-2026-02-03-r2.pdf',
          'Track who approved final output',
          'Store final versions in one controlled folder'
        ]
      }
    ]
  },
  {
    slug: 'api-readiness-for-file-automation',
    title: 'API Readiness Checklist for File Conversion Automation',
    excerpt: 'How to prepare your workflow for future API integration with fewer production surprises.',
    date: 'February 1, 2026',
    readTime: '9 min read',
    category: 'API',
    toolId: 'png-jpg',
    sections: [
      {
        heading: '1. Define contract rules before coding',
        paragraphs: [
          'Teams often start integration before agreeing on accepted formats, max file size, and retry behavior. That creates fragile automation.',
          'Create a short conversion contract document first and align product + operations.'
        ],
        bullets: [
          'Allowed input formats and expected outputs',
          'Timeouts and retry limits',
          'Error classes and user-facing messages'
        ]
      },
      {
        heading: '2. Design idempotent job handling',
        paragraphs: [
          'Automations must survive duplicate callbacks and temporary network failures. Use job IDs and idempotency keys to avoid duplicated output or billing drift.',
          'Always separate upload, process, and delivery states in logs.'
        ],
        bullets: [
          'Unique request IDs for every job',
          'Safe retry strategy without duplicate effects',
          'Clear final states: completed, failed, expired'
        ]
      },
      {
        heading: '3. Add observability from day one',
        paragraphs: [
          'Track queue time, processing time, and failure reasons. Without these metrics, SLA conversations become guesswork.',
          'Start with basic dashboards and alerts, then tune thresholds based on real traffic.'
        ],
        bullets: [
          'Median and p95 processing duration',
          'Top 5 error categories by volume',
          'Storage, worker, and API health in one view'
        ]
      }
    ]
  }
];

const EXT_SUGGEST_MAP = {
  pdf: 'pdf-word',
  docx: 'word-pdf',
  png: 'png-jpg',
  jpg: 'jpg-png',
  jpeg: 'jpg-png',
  heic: 'heic-jpg',
  heif: 'heic-jpg',
  mp4: 'mp4-mp3',
  mov: 'mov-mp4',
  mp3: 'mp3-wav',
  wav: 'wav-mp3',
  m4a: 'm4a-mp3'
};

const inferToolFromName = (name) => {
  const ext = (name || '').toLowerCase().split('.').pop();
  if (!ext || ext === name.toLowerCase()) return null;
  return EXT_SUGGEST_MAP[ext] || null;
};

const SEARCH_STOP_WORDS = new Set(['convert', 'converter', 'to', 'into', 'from', 'file', 'files', 'format', 'formats']);
const FORMAT_TOKEN_ALIASES = {
  jpeg: 'jpg',
  tif: 'tiff',
  htm: 'html',
  ppt: 'pptx',
  powerpoint: 'pptx',
  word: 'docx',
  excel: 'xlsx'
};

const normalizeFormatToken = (value) => {
  const token = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/^[.]+/, '')
    .replace(/[^a-z0-9.+-]/g, '');
  if (!token) return '';
  return FORMAT_TOKEN_ALIASES[token] || token;
};

const extractFormatTokens = (value) => {
  const matches = String(value || '').toLowerCase().match(/[a-z0-9][a-z0-9.+-]*/g) || [];
  return matches
    .map(normalizeFormatToken)
    .filter((token) => token && !SEARCH_STOP_WORDS.has(token));
};

const parseFormatQuery = (query) => {
  const raw = String(query || '').trim().toLowerCase();
  if (!raw) return null;

  const normalized = raw
    .replace(/[→⇒➡]/g, ' to ')
    .replace(/\s*(?:->|=>)\s*/g, ' to ')
    .replace(/\s+/g, ' ')
    .trim();

  const toParts = normalized.split(/\bto\b/).map((part) => part.trim()).filter(Boolean);
  if (toParts.length >= 2) {
    const fromTokens = extractFormatTokens(toParts[0]);
    const toTokens = extractFormatTokens(toParts.slice(1).join(' '));
    const from = fromTokens[fromTokens.length - 1] || '';
    const to = toTokens[0] || '';
    if (from && to && from !== to) {
      return { from, to, mode: 'to', raw };
    }
    return null;
  }

  const tokens = extractFormatTokens(normalized);
  if (tokens.length >= 2 && tokens[0] !== tokens[1]) {
    return { from: tokens[0], to: tokens[1], mode: 'pair', raw };
  }
  return null;
};

const formatAuthError = (error) => {
  const code = String(error?.code || '').toLowerCase();
  if (code === 'auth/unauthorized-domain') {
    return `Google login is not enabled for "${window.location.hostname}". Add this domain in Firebase Authentication -> Settings -> Authorized domains.`;
  }
  if (code === 'auth/popup-blocked') {
    return 'Popup was blocked by the browser. Trying redirect sign-in instead.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Login popup was closed before completion.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is disabled in Firebase Authentication providers.';
  }
  return error?.message || 'Authentication failed.';
};

const stripMarkdownToText = (value) => String(value || '')
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/`[^`]*`/g, ' ')
  .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
  .replace(/\[[^\]]*]\([^)]+\)/g, ' ')
  .replace(/^#{1,6}\s+/gm, '')
  .replace(/[*_~>#-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const formatIsoDateForBlog = (value) => {
  const asDate = new Date(value || '');
  if (Number.isNaN(asDate.getTime())) return 'Update';
  return asDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const estimateBlogReadTime = (contentMd) => {
  const words = stripMarkdownToText(contentMd).split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 220));
  return `${minutes} min read`;
};

const markdownToBlogSections = (contentMd) => {
  const chunks = String(contentMd || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (!chunks.length) {
    return [{
      heading: 'Update',
      paragraphs: ['No details provided yet.'],
      bullets: []
    }];
  }

  const paragraphs = [];
  const bullets = [];
  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((line) => line.trim()).filter(Boolean);
    const bulletLines = lines.filter((line) => /^[-*]\s+/.test(line));
    if (bulletLines.length && bulletLines.length === lines.length) {
      bullets.push(...bulletLines.map((line) => line.replace(/^[-*]\s+/, '').trim()).filter(Boolean));
      continue;
    }
    paragraphs.push(chunk.replace(/\n+/g, ' ').trim());
  }

  if (!paragraphs.length && bullets.length) {
    paragraphs.push('Key points from this update:');
  }

  return [{
    heading: 'Update',
    paragraphs: paragraphs.length ? paragraphs : ['No details provided yet.'],
    bullets
  }];
};

const mapPublicPostToBlogPost = (post) => {
  const value = post && typeof post === 'object' ? post : {};
  const contentMd = String(value.content_md || '').trim();
  const fallbackExcerpt = stripMarkdownToText(contentMd).slice(0, 220);
  return {
    id: String(value.id || '').trim(),
    slug: String(value.slug || '').trim(),
    title: String(value.title || 'Update').trim() || 'Update',
    excerpt: String(value.excerpt || fallbackExcerpt || 'Product update').trim(),
    date: formatIsoDateForBlog(value.published_at || value.updated_at || value.created_at),
    readTime: estimateBlogReadTime(contentMd),
    category: 'Updates',
    toolId: '',
    sections: markdownToBlogSections(contentMd),
    content_md: contentMd,
    source: 'remote',
    likes_count: Math.max(0, Number(value.likes_count || 0)),
    liked: Boolean(value.liked)
  };
};

const GlassCard = ({ children, className = '' }) => (
  <div className={`glass-card mc-surface rounded-3xl shadow-[0_30px_80px_rgba(15,23,42,0.08)] p-6 md:p-8 text-slate-900 dark:text-slate-100 ${className}`}>
    {children}
  </div>
);

const Section = ({ children, id = "", className = "", ...rest }) => (
  <section id={id} className={`section-shell py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto ${className}`} {...rest}>
    {children}
  </section>
);

const Button = ({ children, onClick, variant = "primary", className = "", size = "normal", ...rest }) => {
  const sizes = { normal: "px-5 py-2.5 text-sm", large: "px-7 py-3.5 text-base w-full md:w-auto" };
  const variants = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    pro: "btn-pro",
    outline: "btn-outline",
    ghost: "btn-ghost"
  };
  const explicitType = String(rest.type || '').toLowerCase();
  const buttonType = explicitType || 'button';
  const hasAction = typeof onClick === 'function' || buttonType === 'submit' || buttonType === 'reset';
  const disabled = Boolean(rest.disabled) || !hasAction;
  if (import.meta.env.DEV && !hasAction) {
    console.warn('[Button] Rendered without action handler/type:', { variant, size, className });
  }
  return (
    <button
      {...rest}
      type={buttonType}
      onClick={onClick}
      disabled={disabled}
      className={`pressable touch-target font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Badge = ({ children, color = "blue", variant = "light" }) => (
  <span className={`badge badge-${variant}-${color}`}>{children}</span>
);

const Page = ({ title, subtitle, actions, children }) => (
  <div className="pt-28 pb-20 px-4 text-slate-900 dark:text-slate-100 page-enter">
    <div className="max-w-6xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-semibold font-display tracking-tight">{title}</h1>
        {subtitle && <p className="text-slate-500 dark:text-slate-400 text-lg mt-4 max-w-2xl">{subtitle}</p>}
        {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
      </div>
      {children}
    </div>
  </div>
);


const PageCard = ({ children, className = "" }) => (
  <div className={`panel-card mc-card p-6 text-slate-900 dark:text-slate-100 ${className}`}>{children}</div>
);

const LegalSectionCard = ({ title, children }) => (
  <PageCard className="space-y-3">
    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    {children}
  </PageCard>
);

const LegalList = ({ items }) => (
  <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600">
    {items.map((item, index) => (
      <li key={`${item}-${index}`}>{item}</li>
    ))}
  </ul>
);

const IconCard = ({ icon: Icon, title, desc, tone = "blue", children }) => {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    violet: "bg-indigo-50 text-indigo-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700"
  };
  return (
    <div className="panel-card mc-card p-6">
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${tones[tone]}`}>
        {React.createElement(Icon, { size: 18 })}
      </div>
      <div className="font-semibold mt-4">{title}</div>
      <div className="text-sm text-slate-600 mt-2">{desc}</div>
      {children}
    </div>
  );
};

const PreviewViewer = React.lazy(() => import('./components/PreviewViewer.jsx'));

const ToolCard = ({ tool, onOpen, labels, onHover, onLeave }) => (
  <div
    className="panel-card mc-card p-6 hover:shadow-md transition"
    onMouseEnter={() => onHover && onHover(tool.id)}
    onMouseLeave={() => onLeave && onLeave()}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2 text-slate-900 font-semibold">
        <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">{tool.icon}</span>
        <span>{tool.name}</span>
      </div>
      {tool.isPro && <Badge color="amber">{labels.pro}</Badge>}
    </div>
    <div className="text-sm text-slate-600 mt-3">{tool.description}</div>
    <div className="grid grid-cols-2 gap-3 text-xs text-slate-500 mt-4">
      <div>
        <div className="uppercase tracking-widest text-[10px]">{labels.speed}</div>
        <div className="text-slate-800 font-semibold mt-1">{tool.speed}</div>
      </div>
      <div>
        <div className="uppercase tracking-widest text-[10px]">{labels.formats}</div>
        <div className="text-slate-800 font-semibold mt-1">{tool.formats}</div>
      </div>
    </div>
    <Button variant="secondary" className="w-full mt-5" onClick={onOpen}>
      {labels.openConverter}
    </Button>
  </div>
);

const SharePage = ({ token, apiBase, lang, onNavigate }) => {
  const [shareRemote, setShareRemote] = useState(null);
  const [shareFetchDone, setShareFetchDone] = useState(false);
  const [shareError, setShareError] = useState(null);
  const storedLocal = token ? readShareLinks()[token] : null;

  useEffect(() => {
    if (!token) return;
    if (storedLocal) return;
    let active = true;
    fetch(`${apiBase}/share/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) {
          const payload = await res.json();
          return { ok: true, payload };
        }
        let details = null;
        try {
          details = await res.json();
        } catch {
          details = null;
        }
        return {
          ok: false,
          error: {
            status: res.status,
            code: String(details?.code || '').trim(),
            message: String(details?.message || '').trim()
          }
        };
      })
      .then((result) => {
        if (!active) return;
        if (result?.ok) {
          setShareRemote(result.payload);
          setShareError(null);
          return;
        }
        setShareError(result?.error || { status: 500, code: 'FETCH_FAILED', message: '' });
      })
      .catch(() => {
        if (!active) return;
        setShareError({ status: 500, code: 'FETCH_FAILED', message: '' });
      })
      .finally(() => {
        if (!active) return;
        setShareFetchDone(true);
      });
    return () => { active = false; };
  }, [apiBase, token, storedLocal]);

  const stored = storedLocal || shareRemote;
  const shareLoading = Boolean(token) && !storedLocal && !shareFetchDone && !stored;
  if (shareLoading && !stored) {
    return (
      <Page title="Публичный файл" subtitle="Загрузка данных…">
        <PageCard>
          <div className="text-sm text-slate-600">Ищем результат по ссылке.</div>
        </PageCard>
      </Page>
    );
  }
  if (!stored) {
    const isExpired = shareError?.code === 'SHARE_LINK_EXPIRED';
    return (
      <Page
        title={isExpired ? 'Срок действия ссылки истек' : 'Ссылка недействительна'}
        subtitle={isExpired ? 'Эта ссылка была активна 24 часа и автоматически удалена из системы.' : 'Похоже, ссылка была удалена или не существует.'}
      >
        <PageCard className={isExpired ? 'border border-red-200/60 bg-red-50/60 dark:bg-red-500/10 dark:border-red-400/20' : ''}>
          <div className={`text-sm ${isExpired ? 'text-red-700 dark:text-red-200' : 'text-slate-600'}`}>
            {isExpired ? 'Срок действия ссылки истек. Для безопасности файл удален с сервера.' : 'Попросите владельца создать новую публичную ссылку.'}
          </div>
          <div className="mt-4">
            <Button onClick={() => onNavigate('/')}>На главную</Button>
          </div>
        </PageCard>
      </Page>
    );
  }

  const previewType = getPreviewType(getExtensionFromValue(stored.url || '') || stored.ext || '');
  return (
    <Page title="Публичный файл" subtitle="Просмотрите результат без скачивания.">
      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <PageCard>
          <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">Загружаем превью…</div>}>
            <PreviewViewer fileUrl={stored.url} type={previewType} />
          </Suspense>
        </PageCard>
        <PageCard>
          <div className="text-xs uppercase tracking-widest text-slate-500">Детали</div>
          <div className="text-sm text-slate-600 mt-2">Тип: {(stored.ext || getExtensionFromValue(stored.url) || 'FILE').toUpperCase()}</div>
          <div className="text-sm text-slate-600 mt-1">Создано: {formatShortTimestamp(stored.createdAt || stored.created_at, LANG_TO_LOCALE[lang] || 'ru-RU')}</div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => window.open(stored.url, '_blank')}>Скачать</Button>
            <Button variant="secondary" onClick={() => onNavigate('/')}>Конвертировать ещё</Button>
          </div>
        </PageCard>
      </div>
    </Page>
  );
};


const SEO_ROUTE_ALIASES = {
  '/pdf-to-word': '/convert/pdf-to-word',
  '/pdf-to-docx': '/convert/pdf-to-word',
  '/pdf-to-excel': '/convert/pdf-to-xlsx',
  '/pdf-to-ppt': '/convert/pdf-to-pptx',
  '/word-to-pdf': '/convert/word-to-pdf',
  '/docx-to-pdf': '/convert/docx-to-pdf',
  '/png-to-jpg': '/convert/png-to-jpg',
  '/jpg-to-png': '/convert/jpg-to-png',
  '/heic-to-jpg': '/convert/heic-to-jpg',
  '/image-compressor': '/convert/jpg-to-webp',
  '/resize-image': '/convert/jpg-to-png',
  '/mp4-to-mp3': '/convert/mp4-to-mp3',
  '/video-compressor': '/convert/mp4-to-webm',
  '/mov-to-mp4': '/convert/mov-to-mp4',
  '/file-converter': '/tools',
  '/compress-file': '/tools',
  '/merge-pdf': '/convert/pdf-to-word',
  '/split-pdf': '/convert/pdf-to-word',
  '/team': '/developers',
  '/how-it-works': '/',
  '/api/docs': '/api'
};

const upsertSeoMeta = (name, content) => {
  if (!content) return;
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

const upsertSeoProperty = (property, content) => {
  if (!content) return;
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

const upsertSeoLink = (rel, href, hreflang = '') => {
  if (!href) return;
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', rel);
    if (hreflang) tag.setAttribute('hreflang', hreflang);
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
};

const upsertSeoJsonLd = (payload) => {
  const id = 'app-seo-jsonld';
  let tag = document.getElementById(id);
  if (!tag) {
    tag = document.createElement('script');
    tag.id = id;
    tag.type = 'application/ld+json';
    document.head.appendChild(tag);
  }
  tag.textContent = JSON.stringify(payload);
};

const LEGACY_TOOL_SLUG_BY_ID = {
  'image-pdf': 'jpg-to-pdf',
  'pdf-images': 'pdf-to-png-hi-res'
};
const LEGACY_TOOL_ID_TO_CANONICAL = {
  'image-pdf': 'jpg-pdf',
  'pdf-images': 'pdf-png-hires'
};
const TOOL_SLUG_BY_ID = {
  ...Object.fromEntries(CONVERSIONS.map((c) => [c.id, c.slug])),
  ...LEGACY_TOOL_SLUG_BY_ID
};
const LEGACY_SLUG_TO_TOOL_ID = {
  'image-to-pdf': 'jpg-pdf',
  'pdf-to-images': 'pdf-png-hires'
};
export default function App() {
  const [lang, setLang] = useState(defaultLang);
  const t = useMemo(() => ({ ...translations.en, ...(translations[lang] || {}) }), [lang]);
  const { resolvedTheme, toggleTheme } = useTheme();
  const locale = useMemo(() => LANG_TO_LOCALE[lang] || LANG_TO_LOCALE.en, [lang]);
  const defaultUserName = t.userDefaultName;
  const processorDefs = useMemo(() => listProcessors(), []);

  const tools = useMemo(() => {
    const speedByType = {
      doc: t.speedInstant,
      image: t.speedInstant,
      video: t.speedFast,
      audio: t.speedFast,
      archive: t.speedFast,
      data: t.speedInstant
    };
    const processorMap = new Map(processorDefs.map((processor) => [processor.id, processor]));
    return CONVERSIONS
      .filter((conversion) => processorMap.has(conversion.id))
      .map((conversion) => {
        const processor = processorMap.get(conversion.id);
        const accept = (processor.inputs || []).length
          ? [...new Set(processor.inputs.map((ext) => `.${ext}`))].join(',')
          : '*/*';
        const type = processor.category;
        const fromFormats = [
          ...new Set([
            ...(processor.inputs || []).map((ext) => normalizeFormatToken(ext)),
            ...extractFormatTokens(conversion.from)
          ])
        ].filter(Boolean);
        const toFormats = [
          ...new Set([
            normalizeFormatToken(processor.output || ''),
            ...extractFormatTokens(conversion.to)
          ])
        ].filter(Boolean);
        return {
          id: conversion.id,
          name: `${conversion.from} → ${conversion.to}`,
          type,
          accept,
          formats: `${conversion.from} → ${conversion.to}`,
          description: `Convert ${conversion.from} to ${conversion.to} online.`,
          icon: toolIcon(type),
          isPro: false,
          speed: speedByType[type] || t.speedFast,
          fromFormats,
          toFormats
        };
      });
  }, [processorDefs, t]);

  const categories = useMemo(() => ([
    { id: 'all', label: t.categoryAll },
    { id: 'doc', label: t.categoryDocuments },
    { id: 'image', label: t.categoryImages },
    { id: 'video', label: t.categoryVideo },
    { id: 'audio', label: t.categoryAudio },
    { id: 'other', label: t.categoryOtherTools || 'Other tools' }
  ]), [t]);

  const navItems = useMemo(() => ([
    { label: t.navTools, to: '/tools' },
    { label: 'Workspace 3.0', to: '/workspace' },
    { label: t.navAiAssistant || 'AI', to: '/ai' },
    { label: 'Guides', to: '/guides' },
    { label: t.navDevelopers || 'Developers', to: '/developers' },
    { label: t.navStatus || 'Status', to: '/status' },
    { label: t.navSecurity || 'Security', to: '/security' }
  ]), [t]);

  const securityBadges = useMemo(() => ([
    { title: t.securityBadgeEncryptTitle, desc: t.securityBadgeEncryptDesc },
    { title: t.securityBadgeDeleteTitle, desc: t.securityBadgeDeleteDesc },
    { title: t.securityBadgeIsolateTitle, desc: t.securityBadgeIsolateDesc },
    { title: t.securityBadgeComplianceTitle, desc: t.securityBadgeComplianceDesc }
  ]), [t]);

  const _HOW_STEPS = useMemo(() => ([
    { title: t.howStepUploadTitle, desc: t.howStepUploadDesc, icon: Upload },
    { title: t.howStepConvertTitle, desc: t.howStepConvertDesc, icon: Settings },
    { title: t.howStepDownloadTitle, desc: t.howStepDownloadDesc, icon: Download }
  ]), [t]);

  const featureList = useMemo(() => ([
    { title: t.featureInstantTitle, desc: t.featureInstantDesc, icon: Zap },
    { title: t.featureSecureTitle, desc: t.featureSecureDesc, icon: ShieldCheck },
    { title: t.featureBatchTitle, desc: t.featureBatchDesc, icon: Layers },
    { title: t.featureCloudTitle, desc: t.featureCloudDesc, icon: Cloud }
  ]), [t]);

  const pipelineSteps = useMemo(() => ([
    t.pipelineStep1,
    t.pipelineStep2,
    t.pipelineStep3,
    t.pipelineStep4,
    t.pipelineStep5,
    t.pipelineStep6,
    t.pipelineStep7
  ]), [t]);
  const stageLabels = useMemo(() => ({
    validate: t.pipelineStep1,
    detect: t.pipelineStep2,
    normalize: t.pipelineStep3,
    convert: t.pipelineStep4,
    verify: t.pipelineStep5,
    deliver: t.pipelineStep6,
    cleanup: t.pipelineStep7
  }), [t]);

  const statusMetrics = useMemo(() => ([
    { label: t.statusMetricProcessingLabel, value: t.statusMetricProcessingValue, desc: t.statusMetricProcessingDesc },
    { label: t.statusMetricQueueLabel, value: t.statusMetricQueueValue, desc: t.statusMetricQueueDesc },
    { label: t.statusMetricUptimeLabel, value: t.statusMetricUptimeValue, desc: t.statusMetricUptimeDesc },
    { label: t.statusMetricIncidentsLabel, value: t.statusMetricIncidentsValue, desc: t.statusMetricIncidentsDesc }
  ]), [t]);

  const staticBlogPosts = useMemo(() => BLOG_ARTICLES.map((post) => ({
    ...post,
    id: '',
    source: 'static',
    likes_count: 0,
    liked: false
  })), []);
  const autoGeneratedBlogPosts = useMemo(() => {
    const updates = generateAutoUpdateArticles(lang, 8);
    const conversions = generateAutoConversionArticles(lang, CONVERSIONS);
    return [...updates, ...conversions].map((post) => ({
      ...post,
      id: '',
      source: 'auto',
      likes_count: 0,
      liked: false
    }));
  }, [lang]);

  const faqItems = useMemo(() => ([
    { q: t.faq1Q, a: t.faq1A },
    { q: t.faq2Q, a: t.faq2A },
    { q: t.faq3Q, a: t.faq3A },
    { q: t.faq4Q, a: t.faq4A },
    { q: t.faq5Q, a: t.faq5A },
    { q: t.faq6Q, a: t.faq6A },
    { q: t.faq7Q, a: t.faq7A },
    { q: t.faq8Q, a: t.faq8A }
  ]), [t]);

  const [path, setPath] = useState(() => window.location.pathname);
  const [errorInfo, setErrorInfo] = useState(null);
  const [user, setUser] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [twofaCode, setTwofaCode] = useState('');
  const [twofaError, setTwofaError] = useState('');
  const [twofaStatus, setTwofaStatus] = useState('idle');
  const [showTwofaModal, setShowTwofaModal] = useState(false);

  const [filesConvertedCount, setFilesConvertedCount] = useState(1199823);
  const [showCookie, setShowCookie] = useState(true);
  const [etaSeconds, setEtaSeconds] = useState(null);
  const [smartSuggestion, setSmartSuggestion] = useState(null);
  const [_assistantState, setAssistantState] = useState('idle');
  const [_assistantInsights, setAssistantInsights] = useState([]);
  const [assistantActions, setAssistantActions] = useState([]);
  const [assistantEntry, setAssistantEntry] = useState('');
  const [assistantMeta, setAssistantMeta] = useState({ insight: '', structure: '', quality: '', sizeReduction: null });
  const [assistantSuggestions, setAssistantSuggestions] = useState({ edit: '', web: '', small: '' });
  const [_assistantLearningHint, setAssistantLearningHint] = useState('');
  const [assistantAutomationHint, setAssistantAutomationHint] = useState('');
  const [_assistantExplanations, setAssistantExplanations] = useState([]);
  const [assistantPredictiveActions, setAssistantPredictiveActions] = useState([]);
  const [_assistantWorkflow, setAssistantWorkflow] = useState([]);
  const [assistantContextSummary, setAssistantContextSummary] = useState(null);
  const [aiMode, setAiMode] = useState('balanced');
  const [aiPriority, setAiPriority] = useState('quality');
  const [aiTargetFormat, setAiTargetFormat] = useState('auto');
  const [aiAssistantPrompt, setAiAssistantPrompt] = useState('');
  const [aiAssistantStage, setAiAssistantStage] = useState('idle');
  const [aiAssistantError, setAiAssistantError] = useState('');
  const [aiAssistantIntent, setAiAssistantIntent] = useState(null);
  const [_assistantNotice, setAssistantNotice] = useState('');
  const [_assistantExecutionLog, setAssistantExecutionLog] = useState([]);
  const [shareLink, setShareLink] = useState('');
  const [isShareLinkCreating, setIsShareLinkCreating] = useState(false);
  const [privacyDeleteAfter, setPrivacyDeleteAfter] = useState(false);
  const assistantTimerRef = useRef(null);
  const [recentJobs, setRecentJobs] = useState(() => {
    try {
      const raw = localStorage.getItem('recent_jobs');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [historyFilter, setHistoryFilter] = useState('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [shareHint, setShareHint] = useState('');
  const [featureFlags, setFeatureFlags] = useState({
    smart_auto_convert: true,
    public_share_links: true,
    instant_preview: true,
    transparency_panel: true,
    one_click_best_convert: true
  });
  const [hoveredToolId, setHoveredToolId] = useState(null);
  const [accountNotice, setAccountNotice] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [pipelineStage, setPipelineStage] = useState(null);
  const [activeTab, setActiveTab] = useState('png-jpg');
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [downloadFileName, setDownloadFileName] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [settings, setSettings] = useState({
    image: { quality: 90, resize: "", crop: "", dpi: "", stripExif: false },
    video: { resolution: "1080p", fps: "", bitrate: "", codec: "h264", trimStart: "", trimEnd: "", startTime: "", endTime: "" },
    audio: { bitrate: "192k", normalize: false, trimStart: "", trimDuration: "", trimEnd: "", startTime: "", endTime: "", channels: "" },
    privacy: { deleteAfter: false }
  });
  const [mediaDurationSec, setMediaDurationSec] = useState(null);
  const [mediaDurationLoading, setMediaDurationLoading] = useState(false);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [testModeLoading, setTestModeLoading] = useState(false);
  const [testModeUnlockLoading, setTestModeUnlockLoading] = useState(false);
  const [testModeUnlockError, setTestModeUnlockError] = useState('');
  const encryptionContextRef = useRef(new Map());
  const [lastJobId, setLastJobId] = useState(null);
  const [batchLiveItems, setBatchLiveItems] = useState([]);
  const [toast, setToast] = useState(null);
  const [quickLookOpen, setQuickLookOpen] = useState(false);
  const [quickLookLoading, setQuickLookLoading] = useState(false);
  const [quickLookError, setQuickLookError] = useState('');
  const [quickLookType, setQuickLookType] = useState('other');
  const [quickLookText, setQuickLookText] = useState('');
  const toastTimerRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAllFormats, setShowAllFormats] = useState(false);
  const [toolOpenCounts, setToolOpenCounts] = useState(() => readToolOpenCounts());
  const [pendingOpenToolId, setPendingOpenToolId] = useState(null);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [remoteBlogPosts, setRemoteBlogPosts] = useState([]);
  const [remoteBlogLoading, setRemoteBlogLoading] = useState(false);
  const [remoteBlogError, setRemoteBlogError] = useState('');
  const [developersList, setDevelopersList] = useState([]);
  const [developersLoading, setDevelopersLoading] = useState(false);
  const [developersError, setDevelopersError] = useState('');
  const [blogLikeState, setBlogLikeState] = useState({});
  const [blogLikePending, setBlogLikePending] = useState({});
  const [accountBilling, setAccountBilling] = useState(null);
  const [accountBillingLoading, setAccountBillingLoading] = useState(false);
  const [accountBillingError, setAccountBillingError] = useState('');
  const [accountPromoCode, setAccountPromoCode] = useState('');
  const [accountRedeemStatus, setAccountRedeemStatus] = useState('idle');
  const [accountRedeemMessage, setAccountRedeemMessage] = useState('');
  const [accountRedeemSlow, setAccountRedeemSlow] = useState(false);
  const [accountRedeemVerySlow, setAccountRedeemVerySlow] = useState(false);
  const [accountInputShake, setAccountInputShake] = useState(false);
  const [accountBenefitsPulse, setAccountBenefitsPulse] = useState(false);
  const [accountSection, setAccountSection] = useState('billing');
  const [accountProfile, setAccountProfile] = useState(null);
  const [accountProfileDraft, setAccountProfileDraft] = useState({ display_name: '', timezone: '', avatar_url: '' });
  const [accountProfileLoading, setAccountProfileLoading] = useState(false);
  const [accountProfileSaving, setAccountProfileSaving] = useState(false);
  const [accountProfileError, setAccountProfileError] = useState('');
  const [accountConnections, setAccountConnections] = useState([]);
  const [accountConnectionsLoading, setAccountConnectionsLoading] = useState(false);
  const [accountConnectionsError, setAccountConnectionsError] = useState('');
  const [accountConnectionPending, setAccountConnectionPending] = useState('');
  const [accountSessions, setAccountSessions] = useState([]);
  const [accountSessionsLoading, setAccountSessionsLoading] = useState(false);
  const [accountSessionsError, setAccountSessionsError] = useState('');
  const [accountSessionPending, setAccountSessionPending] = useState('');
  const [accountLogoutAllPending, setAccountLogoutAllPending] = useState(false);
  const [accountActionNotice, setAccountActionNotice] = useState('');
  const [accountTelegramCode, setAccountTelegramCode] = useState(null);
  const [accountTelegramCodeLoading, setAccountTelegramCodeLoading] = useState(false);
  const [accountTelegramCodeError, setAccountTelegramCodeError] = useState('');
  const [accountTelegramCodeCopied, setAccountTelegramCodeCopied] = useState(false);
  const [accountApiKeys, setAccountApiKeys] = useState([]);
  const [accountApiUsageSummary, setAccountApiUsageSummary] = useState(null);
  const [accountApiKeysLoading, setAccountApiKeysLoading] = useState(false);
  const [accountApiKeysError, setAccountApiKeysError] = useState('');
  const [accountApiCreateName, setAccountApiCreateName] = useState('');
  const [accountApiCreatePlan, setAccountApiCreatePlan] = useState('free');
  const [accountApiActionPending, setAccountApiActionPending] = useState('');
  const [accountApiNewToken, setAccountApiNewToken] = useState('');
  const [accountApiAllowlistDrafts, setAccountApiAllowlistDrafts] = useState({});
  const [accountApiWebhooks, setAccountApiWebhooks] = useState([]);
  const [accountApiWebhookDeliveries, setAccountApiWebhookDeliveries] = useState([]);
  const [accountApiWebhooksLoading, setAccountApiWebhooksLoading] = useState(false);
  const [accountApiWebhookError, setAccountApiWebhookError] = useState('');
  const [accountApiWebhookUrl, setAccountApiWebhookUrl] = useState('');
  const [accountApiWebhookKeyId, setAccountApiWebhookKeyId] = useState('');
  const [accountApiWebhookEvents, setAccountApiWebhookEvents] = useState({
    completed: true,
    failed: false
  });
  const [accountApiWebhookSecret, setAccountApiWebhookSecret] = useState('');
  const [accountPipelines, setAccountPipelines] = useState([]);
  const [accountPipelinesLoading, setAccountPipelinesLoading] = useState(false);
  const [accountPipelinesError, setAccountPipelinesError] = useState('');
  const [accountPipelineActionPending, setAccountPipelineActionPending] = useState('');
  const [accountPipelineRunPending, setAccountPipelineRunPending] = useState('');
  const [accountWorkflowPrompt, setAccountWorkflowPrompt] = useState('');
  const [accountPipelineDraftId, setAccountPipelineDraftId] = useState('');
  const [accountPipelineDraftName, setAccountPipelineDraftName] = useState('');
  const [accountPipelineDraftSource, setAccountPipelineDraftSource] = useState('manual');
  const [accountPipelineDraftNodes, setAccountPipelineDraftNodes] = useState([]);
  const [accountSelectedPipelineId, setAccountSelectedPipelineId] = useState('');
  const accountTimersRef = useRef({
    slow: null,
    verySlow: null,
    notice: null,
    pulse: null
  });
  const persistedHistoryJobRef = useRef('');
  const analyticsBackoffUntilRef = useRef(0);
  const analyticsFailureCountRef = useRef(0);
  const downloadUrlRef = useRef(null);
  const isAccountPath = path === '/account' || path === '/settings/billing';

  const setDownloadUrlSafe = useCallback((nextValue) => {
    const normalizedNext = String(nextValue || '').trim() || null;
    const previous = downloadUrlRef.current;
    if (previous && previous !== normalizedNext) {
      revokeBlobObjectUrl(previous);
    }
    downloadUrlRef.current = normalizedNext;
    setDownloadUrl(normalizedNext);
  }, []);

  useEffect(() => () => {
    revokeBlobObjectUrl(downloadUrlRef.current);
    downloadUrlRef.current = null;
  }, []);

  const clearAccountTimer = useCallback((key) => {
    const timer = accountTimersRef.current[key];
    if (timer) {
      window.clearTimeout(timer);
      accountTimersRef.current[key] = null;
    }
  }, []);

  const clearAccountTimers = useCallback(() => {
    clearAccountTimer('slow');
    clearAccountTimer('verySlow');
    clearAccountTimer('notice');
    clearAccountTimer('pulse');
  }, [clearAccountTimer]);

  const scheduleAccountNoticeReset = useCallback(() => {
    clearAccountTimer('notice');
    accountTimersRef.current.notice = window.setTimeout(() => {
      setAccountRedeemStatus('idle');
      setAccountRedeemMessage('');
      accountTimersRef.current.notice = null;
    }, 5200);
  }, [clearAccountTimer]);

  const triggerAccountInputErrorShake = () => {
    setAccountInputShake(false);
    window.requestAnimationFrame(() => {
      setAccountInputShake(true);
      window.setTimeout(() => setAccountInputShake(false), 280);
    });
  };

  const pulseAccountBenefitsCard = useCallback(() => {
    setAccountBenefitsPulse(true);
    clearAccountTimer('pulse');
    accountTimersRef.current.pulse = window.setTimeout(() => {
      setAccountBenefitsPulse(false);
      accountTimersRef.current.pulse = null;
    }, 1100);
  }, [clearAccountTimer]);

  const formatUiDate = (value) => {
    const parsed = new Date(value || '');
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatUiDateTime = (value) => {
    const parsed = new Date(value || '');
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  const formatBenefitLabel = (benefit) => {
    const kind = String(benefit?.kind || '').trim();
    const payload = benefit?.payload && typeof benefit.payload === 'object' ? benefit.payload : {};
    if (kind === 'lifetime') {
      const plan = String(payload.plan || t.planProName || 'Pro').trim() || t.planProName || 'Pro';
      return t.accountBenefitLifetime
        .replace('{plan}', plan);
    }
    if (kind === 'trial') {
      const trialDays = Number(payload.trial_days || 0);
      const suffix = trialDays > 0
        ? t.accountBenefitTrialDays.replace('{days}', String(trialDays))
        : t.accountBenefitTrialAccess;
      if (benefit?.ends_at) {
        return t.accountBenefitTrialExpires
          .replace('{label}', suffix)
          .replace('{date}', formatUiDate(benefit.ends_at));
      }
      return suffix;
    }
    if (kind === 'credits') {
      const credits = Number(payload.credits || 0);
      return t.accountBenefitCreditsRemaining.replace('{count}', String(credits));
    }
    if (kind === 'discount') {
      const percent = Number(payload.percent || 0);
      return percent > 0
        ? t.accountBenefitDiscountPercent.replace('{percent}', String(percent))
        : t.accountBenefitDiscount;
    }
    if (kind === 'feature_access') {
      const features = Array.isArray(payload.features) ? payload.features.filter(Boolean) : [];
      if (features.length) {
        return t.accountBenefitFeatureAccessList.replace('{features}', features.join(', '));
      }
      return t.accountBenefitFeatureAccess;
    }
    return t.accountBenefitGeneric;
  };

  const formatHistoryBenefit = (entry) => {
    const entitlement = entry?.entitlement && typeof entry.entitlement === 'object' ? entry.entitlement : null;
    if (entitlement) return formatBenefitLabel(entitlement);
    const benefitType = String(entry?.benefit_type || '').trim();
    if (benefitType) return benefitType.replace(/_/g, ' ');
    return t.accountPromoLabel;
  };

  const buildRedeemSuccessMessage = (result) => {
    const entitlement = result?.entitlement && typeof result.entitlement === 'object' ? result.entitlement : null;
    const kind = String(entitlement?.kind || '').trim();
    if (kind === 'lifetime') return t.accountPromoSuccessLifetime;
    if (kind === 'trial') {
      const trialDays = Number(entitlement?.payload?.trial_days || 0);
      if (trialDays > 0) return t.accountPromoSuccessTrialDays.replace('{days}', String(trialDays));
      return t.accountPromoSuccessTrial;
    }
    if (kind === 'credits') {
      const credits = Number(entitlement?.payload?.credits || 0);
      return credits > 0
        ? t.accountPromoSuccessCreditsAdded.replace('{count}', String(credits))
        : t.accountPromoSuccessCredits;
    }
    if (result?.already_redeemed) return t.accountPromoSuccessAlready;
    return t.accountPromoSuccessGeneric;
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 250);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const normalizeApiBase = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized) return '/api';
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  };
  const isLoopbackHost = (host) => host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const resolveApiBase = () => {
    const fallback = '/api';
    const rawEnv = String(import.meta.env.VITE_API_BASE || '').trim();
    const fromEnv = normalizeApiBase(rawEnv || fallback);
    if (typeof window === 'undefined') return fromEnv;
    const currentHost = String(window.location.hostname || '').trim().toLowerCase();
    if (/^https?:\/\//i.test(rawEnv)) {
      try {
        const parsedEnv = new URL(rawEnv);
        if (!isLoopbackHost(currentHost) && isLoopbackHost(String(parsedEnv.hostname || '').toLowerCase())) {
          return fallback;
        }
      } catch (error) {
        void error;
      }
      return normalizeApiBase(rawEnv);
    }
    // In deployed environments always use same-origin /api to avoid stale cross-origin configs.
    if (!isLoopbackHost(currentHost)) return fallback;
    try {
      const parsed = new URL(fromEnv, window.location.origin);
      if (isLoopbackHost(parsed.hostname) && !isLoopbackHost(currentHost)) {
        return fallback;
      }
    } catch (error) {
      void error;
    }
    return fromEnv;
  };
  const API_BASE = resolveApiBase();
  const clientSessionId = useMemo(() => getClientSessionId(), []);
  const CLIENT_ENCRYPTION_ENABLED = String(import.meta.env.VITE_CLIENT_ENCRYPTION || '1') === '1';
  const fileInputRef = useRef(null);
  const langMenuRef = useRef(null);
  const userMenuRef = useRef(null);
  const jobStartRef = useRef(null);
  const trackedToolOpenPathRef = useRef('');
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    let aborted = false;
    fetch(`${API_BASE}/flags/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flags: [
          'smart_auto_convert',
          'public_share_links',
          'instant_preview',
          'transparency_panel',
          'one_click_best_convert'
        ]
      })
    })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (aborted || !payload?.flags || typeof payload.flags !== 'object') return;
        setFeatureFlags((prev) => ({ ...prev, ...payload.flags }));
      })
      .catch(() => {
        // keep defaults in offline mode
      });
    return () => {
      aborted = true;
    };
  }, [API_BASE]);

  const blogPosts = useMemo(() => {
    const merged = [...remoteBlogPosts];
    const slugs = new Set(merged.map((post) => post.slug));
    for (const post of autoGeneratedBlogPosts) {
      if (slugs.has(post.slug)) continue;
      merged.push(post);
      slugs.add(post.slug);
    }
    for (const post of staticBlogPosts) {
      if (slugs.has(post.slug)) continue;
      merged.push(post);
    }
    return merged;
  }, [autoGeneratedBlogPosts, remoteBlogPosts, staticBlogPosts]);

  const toolIds = useMemo(() => new Set(tools.map((t) => t.id)), [tools]);
  const currentTool = tools.find(t => t.id === activeTab) || tools[0];
  const topTools = useMemo(() => {
    const toolMap = new Map(tools.map((tool) => [tool.id, tool]));
    const fallbackRank = new Map(TOP_TOOL_IDS.map((id, index) => [id, index]));
    const ranked = [...tools].sort((left, right) => {
      const leftCount = Number(toolOpenCounts[left.id] || 0);
      const rightCount = Number(toolOpenCounts[right.id] || 0);
      if (leftCount !== rightCount) return rightCount - leftCount;

      const leftFallback = fallbackRank.has(left.id) ? fallbackRank.get(left.id) : Number.MAX_SAFE_INTEGER;
      const rightFallback = fallbackRank.has(right.id) ? fallbackRank.get(right.id) : Number.MAX_SAFE_INTEGER;
      if (leftFallback !== rightFallback) return leftFallback - rightFallback;

      return left.name.localeCompare(right.name);
    });

    const seeded = TOP_TOOL_IDS.map((id) => toolMap.get(id)).filter(Boolean);
    const merged = [];
    const seen = new Set();
    for (const tool of [...seeded, ...ranked]) {
      if (seen.has(tool.id)) continue;
      seen.add(tool.id);
      merged.push(tool);
      if (merged.length >= TOP_TOOL_IDS.length) break;
    }
    return merged;
  }, [tools, toolOpenCounts]);

  const isToolInCategory = (tool, categoryId) => {
    if (categoryId === 'all') return true;
    if (categoryId === 'other') return tool.type === 'archive' || tool.type === 'data';
    return tool.type === categoryId;
  };

  const normalizedQuery = debouncedSearchTerm.trim().toLowerCase();
  const parsedFormatQuery = useMemo(() => parseFormatQuery(debouncedSearchTerm), [debouncedSearchTerm]);
  const formatMatchedTools = useMemo(() => {
    if (!parsedFormatQuery) return [];
    return tools.filter((tool) => (
      tool.fromFormats.includes(parsedFormatQuery.from) &&
      tool.toFormats.includes(parsedFormatQuery.to)
    ));
  }, [tools, parsedFormatQuery]);
  const filteredTools = useMemo(() => {
    const source = parsedFormatQuery
      ? formatMatchedTools
      : tools.filter((tool) => {
          const queryMatch = !normalizedQuery || tool.name.toLowerCase().includes(normalizedQuery) || tool.id.includes(normalizedQuery);
          return queryMatch;
        });
    return source.filter((tool) => isToolInCategory(tool, activeCategory));
  }, [tools, activeCategory, normalizedQuery, parsedFormatQuery, formatMatchedTools]);
  const showAll = showAllFormats || normalizedQuery.length > 0;
  const showPopularTools = activeCategory === 'all' && normalizedQuery.length === 0 && topTools.length > 0;
  const visibleTools = showAll ? filteredTools : filteredTools.slice(0, 12);

  const navigate = useCallback((to) => {
    if (to === path) return;
    window.history.pushState({}, '', to);
    setPath(to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [path]);

  const scrollToConverter = () => {
    const el = document.getElementById('converter');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openFilePicker = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.click();
  };

  useEffect(() => {
    const toolType = String(currentTool?.type || '').trim().toLowerCase();
    const requiresTimeline = toolType === 'audio' || toolType === 'video';
    if (!requiresTimeline || !file) {
      setMediaDurationSec(null);
      setMediaDurationLoading(false);
      return;
    }

    let active = true;
    const objectUrl = URL.createObjectURL(file);
    const mediaElement = document.createElement(String(file.type || '').toLowerCase().startsWith('video/') ? 'video' : 'audio');
    mediaElement.preload = 'metadata';
    setMediaDurationLoading(true);

    mediaElement.onloadedmetadata = () => {
      if (!active) return;
      const durationRaw = Number(mediaElement.duration || 0);
      const duration = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.ceil(durationRaw) : 0;
      setMediaDurationSec(duration || null);
      setMediaDurationLoading(false);
      if (!duration) return;

      setSettings((prev) => {
        const bucketKey = toolType === 'video' ? 'video' : 'audio';
        const currentBucket = { ...(prev[bucketKey] || {}) };
        const currentStart = clamp(toFiniteNumber(currentBucket.trimStart, 0), 0, duration);
        let currentEnd = toFiniteNumber(currentBucket.trimEnd, duration);
        if (!Number.isFinite(currentEnd) || currentEnd <= 0) currentEnd = duration;
        currentEnd = clamp(currentEnd, currentStart, duration);
        currentBucket.trimStart = String(currentStart);
        currentBucket.trimEnd = String(currentEnd);
        currentBucket.startTime = String(currentStart);
        currentBucket.endTime = String(currentEnd);
        if (bucketKey === 'audio') {
          currentBucket.trimDuration = String(Math.max(0, currentEnd - currentStart));
        }
        return { ...prev, [bucketKey]: currentBucket };
      });
    };
    mediaElement.onerror = () => {
      if (!active) return;
      setMediaDurationSec(null);
      setMediaDurationLoading(false);
    };
    mediaElement.src = objectUrl;

    return () => {
      active = false;
      try {
        mediaElement.src = '';
      } catch {
        // ignore
      }
      URL.revokeObjectURL(objectUrl);
    };
  }, [currentTool?.type, file]);

  const trimTimelineState = useMemo(() => {
    const toolType = String(currentTool?.type || '').trim().toLowerCase();
    const isMediaTool = toolType === 'audio' || toolType === 'video';
    const duration = Math.max(1, Number(mediaDurationSec || 0));
    if (!isMediaTool || !mediaDurationSec) {
      return {
        enabled: false,
        max: 1,
        start: 0,
        end: 1,
        startLabel: '00:00',
        endLabel: '00:01',
        durationLabel: '00:01'
      };
    }
    const bucket = toolType === 'video' ? settings.video : settings.audio;
    const start = clamp(toFiniteNumber(bucket?.trimStart, 0), 0, duration);
    const end = clamp(toFiniteNumber(bucket?.trimEnd, duration), start, duration);
    return {
      enabled: true,
      max: duration,
      start,
      end,
      startLabel: formatTimelineTime(start),
      endLabel: formatTimelineTime(end),
      durationLabel: formatTimelineTime(Math.max(0, end - start))
    };
  }, [currentTool?.type, mediaDurationSec, settings.audio, settings.video]);

  const updateTrimTimeline = useCallback((kind, rawValue) => {
    const toolType = String(currentTool?.type || '').trim().toLowerCase();
    if (toolType !== 'audio' && toolType !== 'video') return;
    const max = Math.max(1, Number(mediaDurationSec || trimTimelineState.max || 1));
    const bucketKey = toolType === 'video' ? 'video' : 'audio';
    const nextValue = clamp(Math.round(Number(rawValue || 0)), 0, max);
    setSettings((prev) => {
      const bucket = { ...(prev[bucketKey] || {}) };
      let start = clamp(toFiniteNumber(bucket.trimStart, 0), 0, max);
      let end = clamp(toFiniteNumber(bucket.trimEnd, max), 0, max);
      if (kind === 'start') {
        start = Math.min(nextValue, end);
      } else {
        end = Math.max(nextValue, start);
      }
      bucket.trimStart = String(start);
      bucket.trimEnd = String(end);
      bucket.startTime = String(start);
      bucket.endTime = String(end);
      if (bucketKey === 'audio') {
        bucket.trimDuration = String(Math.max(0, end - start));
      }
      return { ...prev, [bucketKey]: bucket };
    });
  }, [currentTool?.type, mediaDurationSec, trimTimelineState.max]);

  const showToast = useCallback((message, type = 'info', ttlMs = 4800) => {
    const safeMessage = String(message || '').trim();
    if (!safeMessage) return;
    setToast({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, message: safeMessage, type });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, Math.max(1800, Number(ttlMs || 0)));
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const buildBatchLiveItems = useCallback((list) => {
    const source = Array.from(list || []);
    return source.map((item, index) => ({
      id: `${item.name}-${item.size}-${item.lastModified || 0}-${index}`,
      name: item.name,
      size: Number(item.size || 0),
      progress: 0,
      status: 'queued'
    }));
  }, []);

  const updateBatchLiveByOverallProgress = useCallback((items, overallValue, currentStatus = 'processing') => {
    const source = Array.isArray(items) ? items : [];
    const count = source.length;
    if (!count) return [];
    const total = clampProgress(overallValue);
    return source.map((item, index) => {
      const start = (index / count) * 100;
      const end = ((index + 1) / count) * 100;
      const local = ((total - start) / Math.max(1, end - start)) * 100;
      const progress = clampProgress(local);
      const status = currentStatus === 'done'
        ? 'done'
        : currentStatus === 'error'
          ? 'error'
          : progress >= 100
            ? 'done'
            : progress > 0
              ? 'processing'
              : 'queued';
      return {
        ...item,
        progress,
        status
      };
    });
  }, []);

  const updateBatchLiveBySsePayload = useCallback((items, jobPayload) => {
    const source = Array.isArray(items) ? items : [];
    if (!source.length) return source;
    const raw = Array.isArray(jobPayload?.itemProgress)
      ? jobPayload.itemProgress
      : (Array.isArray(jobPayload?.item_progress)
        ? jobPayload.item_progress
        : (Array.isArray(jobPayload?.items) ? jobPayload.items : null));
    if (!Array.isArray(raw) || !raw.length) return source;
    return source.map((item, index) => {
      const row = raw[index];
      const normalizedValue = typeof row === 'number'
        ? row
        : Number(row?.progress || row?.pct || row?.value || 0);
      const statusToken = String(row?.status || '').trim().toLowerCase();
      const progress = clampProgress(normalizedValue);
      const status = statusToken === 'done' || statusToken === 'completed'
        ? 'done'
        : statusToken === 'error' || statusToken === 'failed'
          ? 'error'
          : progress > 0
            ? 'processing'
            : item.status;
      return {
        ...item,
        progress,
        status
      };
    });
  }, []);

  const resolveQuickLookConfig = useCallback(() => {
    const ext = getExtensionFromValue(downloadFileName || downloadUrl);
    const type = getPreviewType(ext);
    if (!isPreviewableType(type)) {
      return { canOpen: false, type: 'other', previewUrl: '' };
    }
    if (!downloadUrl) {
      return { canOpen: false, type, previewUrl: '' };
    }
    if (type === 'doc') {
      if (isLocalDownloadUrl(downloadUrl)) {
        return { canOpen: false, type, previewUrl: '' };
      }
      const viewer = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(downloadUrl || '')}`;
      return { canOpen: true, type, previewUrl: viewer };
    }
    return { canOpen: true, type, previewUrl: downloadUrl || '' };
  }, [downloadFileName, downloadUrl]);

  const quickLookConfig = useMemo(() => resolveQuickLookConfig(), [resolveQuickLookConfig]);
  const canOpenQuickLook = quickLookConfig.canOpen;

  const clearAssistantTimer = useCallback(() => {
    if (assistantTimerRef.current) {
      window.clearTimeout(assistantTimerRef.current);
      assistantTimerRef.current = null;
    }
  }, []);

  const appendAssistantLog = useCallback((message) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: Date.now(),
      message
    };
    setAssistantExecutionLog((prev) => [entry, ...prev].slice(0, 12));
  }, []);

  const resolveToolByFormats = useCallback((from, to) => (
    tools.find((tool) => tool.fromFormats.includes(from) && tool.toFormats.includes(to)) || null
  ), [tools]);

  const buildAssistantPayload = useCallback((selectedFile) => {
    if (!selectedFile) {
      return {
        state: 'idle',
        entry: '',
        context: null,
        intent: null,
        decision: null,
        insights: [],
        actions: [],
        predictiveActions: [],
        workflow: [],
        explanations: [],
        meta: { insight: '', structure: '', quality: '', sizeReduction: null },
        learningHint: '',
        automationHint: '',
        targetFormat: 'auto'
      };
    }
    return createIntelligencePlan({
      file: selectedFile,
      tool: currentTool,
      aiMode,
      aiPriority,
      resolveToolByFormats
    });
  }, [aiMode, aiPriority, currentTool, resolveToolByFormats]);

  const hydrateAssistantFromApi = useCallback(async (selectedFile, localPayload) => {
    if (!selectedFile || !user?.uid) return;
    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-user-id': user.uid
      };
      if (clientSessionId) {
        headers['x-session-id'] = clientSessionId;
      }
      const response = await fetch(`${API_BASE}/account/assistant/respond`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          file_name: selectedFile.name,
          file_size: Number(selectedFile.size || 0),
          goal: localPayload?.intent?.intent || assistantContextSummary?.intent_prediction || 'convert',
          target_format: localPayload?.targetFormat && localPayload.targetFormat !== 'auto'
            ? localPayload.targetFormat
            : undefined,
          settings
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.assistant) return;

      const assistant = payload.assistant;
      const recommendation = assistant.recommendation && typeof assistant.recommendation === 'object'
        ? assistant.recommendation
        : {};
      const remoteActions = [];
      if (recommendation.tool) {
        remoteActions.push({
          id: `remote-convert-${recommendation.tool}`,
          kind: 'convert',
          title: `Конвертировать (${recommendation.tool})`,
          desc: `Формат: ${String(recommendation.target_format || '').toUpperCase()}`,
          tag: 'recommended',
          toolId: recommendation.tool
        });
      }
      remoteActions.push({
        id: 'remote-compress',
        kind: 'compress',
        title: 'Оптимизировать размер',
        desc: 'AI рассчитает параметры сжатия',
        tag: 'smallest',
        toolId: null
      });
      remoteActions.push({
        id: 'remote-automation',
        kind: 'automation',
        title: 'Сгенерировать workflow',
        desc: 'Создать node-based workflow в аккаунте',
        tag: 'recommended',
        toolId: null
      });
      if (downloadUrl) {
        remoteActions.push({
          id: 'remote-share',
          kind: 'share',
          title: 'Поделиться результатом',
          desc: 'Скопировать ссылку на результат',
          tag: 'fastest',
          toolId: null
        });
      }
      setAssistantActions((prev) => {
        const fallback = Array.isArray(prev) ? prev : [];
        return remoteActions.length ? remoteActions : fallback;
      });

      const workflowNodes = Array.isArray(assistant?.workflow?.nodes) ? assistant.workflow.nodes : [];
      if (workflowNodes.length) {
        setAssistantWorkflow(workflowNodes.map((node, index) => ({
          id: String(node.id || `wf_${index + 1}`),
          label: String(node.label || node.type || `Step ${index + 1}`)
        })));
      }
      if (Array.isArray(assistant.pipeline) && assistant.pipeline.length) {
        setAssistantExplanations(assistant.pipeline.map((step) => `${step.step}: ${step.status || 'planned'}`));
      }

      if (assistant?.message) setAssistantEntry(String(assistant.message));
      if (assistant?.intent) {
        setAssistantContextSummary((prev) => ({
          ...(prev || {}),
          intent_prediction: String(assistant.intent || prev?.intent_prediction || 'convert'),
          file_type: String(assistant?.file?.ext || prev?.file_type || ''),
            file_metadata: {
              ...(prev?.file_metadata || {}),
              size_bytes: Number(assistant?.file?.size_bytes || prev?.file_metadata?.size_bytes || 0),
              size_human: prev?.file_metadata?.size_human || formatSizeMbLabel(assistant?.file?.size_bytes || 0)
            }
          }));
      }
      if (recommendation.target_format) {
        setAiTargetFormat(String(recommendation.target_format));
      }
      appendAssistantLog(`AI API: intent=${assistant.intent || 'unknown'}, workflow_nodes=${workflowNodes.length}`);
    } catch (error) {
      void error;
    }
  }, [
    API_BASE,
    appendAssistantLog,
    assistantContextSummary?.intent_prediction,
    clientSessionId,
    downloadUrl,
    settings,
    user?.uid
  ]);

  const primeAssistant = useCallback((selectedFile, { immediate = false } = {}) => {
    clearAssistantTimer();
    if (!selectedFile) {
      setAssistantState('idle');
      setAssistantInsights([]);
      setAssistantActions([]);
      setAssistantEntry('');
      setAssistantMeta({ insight: '', structure: '', quality: '', sizeReduction: null });
      setAssistantSuggestions({ edit: '', web: '', small: '' });
      setAssistantLearningHint('');
      setAssistantAutomationHint('');
      setAssistantExplanations([]);
      setAssistantPredictiveActions([]);
      setAssistantWorkflow([]);
      setAssistantContextSummary(null);
      setAiTargetFormat('auto');
      setAssistantNotice('');
      setAssistantExecutionLog([]);
      return;
    }
    setAssistantState('loading');
    setAssistantNotice('');
    appendAssistantLog('AI: старт анализа файла');
    const payload = buildAssistantPayload(selectedFile);
    const applyPayload = () => {
      setAssistantInsights(payload.insights);
      setAssistantActions(payload.actions);
      setAssistantState(payload.state);
      setAssistantEntry(payload.entry);
      setAssistantMeta(payload.meta);
      setAssistantSuggestions(payload.suggestions || { edit: '', web: '', small: '' });
      setAssistantLearningHint(payload.learningHint);
      setAssistantAutomationHint(payload.automationHint);
      setAssistantExplanations(payload.explanations || []);
      setAssistantPredictiveActions(payload.predictiveActions || []);
      setAssistantWorkflow(payload.workflow || []);
      setAssistantContextSummary(payload.context || null);
      setAiTargetFormat(payload.targetFormat || 'auto');
      appendAssistantLog(`AI: intent=${payload.intent?.intent || 'unknown'}, strategy=${payload.decision?.strategy || 'default'}`);
      void hydrateAssistantFromApi(selectedFile, payload);
    };
    if (immediate) {
      applyPayload();
      return;
    }
    assistantTimerRef.current = window.setTimeout(applyPayload, 320);
  }, [appendAssistantLog, buildAssistantPayload, clearAssistantTimer, hydrateAssistantFromApi]);

  const handleFilesSelected = (list) => {
    const selectedRaw = Array.from(list || []);
    const limit = getDeviceBatchLimit();
    const selected = selectedRaw.slice(0, limit);
    const hasOverflow = selectedRaw.length > limit;
    const hasMultiple = selected.length > 1;
    emitSystemEvent('files_selected', {
      count: selected.length,
      limited: hasOverflow
    });
    if (hasOverflow) {
      setAssistantNotice(`Лимит для устройства: ${limit} файлов за раз.`);
      showToast(`Можно выбрать до ${limit} файлов за один раз.`, 'error');
    }
    if (hasMultiple && !batchMode) {
      setBatchMode(true);
      showToast('Пакетный режим активирован автоматически.', 'info', 2600);
    }
    if (path === '/ai' || path === '/ai/') {
      setBatchMode(hasMultiple);
    }
    setFiles(selected);
    setFile(selected[0] || null);
    setBatchLiveItems(buildBatchLiveItems(selected));
    setQuickLookOpen(false);
    setQuickLookError('');
    setQuickLookText('');
    setQuickLookType('other');
    setAiAssistantError('');
    setAiAssistantStage('idle');
    setAiAssistantIntent(null);
    if (selected[0]) {
      const suggested = inferToolFromName(selected[0].name);
      if (suggested) setSmartSuggestion(suggested);
      primeAssistant(selected[0]);
    } else {
      setSmartSuggestion(null);
      primeAssistant(null, { immediate: true });
    }
  };

  const track = useCallback((type, payload = {}) => {
    emitSystemEvent(type, payload);
    if (typeof navigator !== 'undefined' && navigator.webdriver) return;
    const now = Date.now();
    if (now < analyticsBackoffUntilRef.current) return;
    const registerFailure = () => {
      analyticsFailureCountRef.current += 1;
      const failures = analyticsFailureCountRef.current;
      const cooldownMs = Math.min(60_000, 1_000 * (2 ** Math.min(failures, 6)));
      analyticsBackoffUntilRef.current = Date.now() + cooldownMs;
    };
    const registerSuccess = () => {
      analyticsFailureCountRef.current = 0;
      analyticsBackoffUntilRef.current = 0;
    };
    try {
      const body = JSON.stringify({ type, payload, ts: Date.now() });
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        const ok = navigator.sendBeacon(`${API_BASE}/events`, blob);
        if (ok) registerSuccess();
        else registerFailure();
      } else {
        withRetry(() => fetch(`${API_BASE}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true
        }), { retries: 1, baseDelayMs: 180 })
          .then(() => registerSuccess())
          .catch(() => registerFailure());
      }
    } catch {
      registerFailure();
    }
  }, [API_BASE]);

  useEffect(() => {
    updateUserPreferences({
      locale: lang,
      aiMode,
      aiPriority
    });
  }, [aiMode, aiPriority, lang]);

  useEffect(() => {
    updateJobState({
      status,
      progress,
      lastJobId
    });
  }, [lastJobId, progress, status]);

  useEffect(() => {
    const suggestions = assistantActions.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      tag: item.tag
    }));
    updateAiSuggestions(suggestions);
  }, [assistantActions]);

  useEffect(() => {
    if (status !== 'done' || !lastJobId) return;
    if (persistedHistoryJobRef.current === lastJobId) return;
    persistedHistoryJobRef.current = lastJobId;
    pushHistoryItem({
      id: lastJobId,
      tool: activeTab,
      ts: Date.now(),
      status: 'done'
    });
  }, [activeTab, lastJobId, status]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const baseKeys = Object.keys(translations.en);
    Object.entries(translations).forEach(([code, dict]) => {
      const missing = baseKeys.filter((k) => !(k in dict));
      if (missing.length) {
        console.warn('i18n missing keys for ' + code + ': ' + missing.join(', '));
      }
    });
  }, [defaultUserName]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('lang');
      if (stored && translations[stored]) {
        setLang(stored);
        return;
      }
    } catch (error) {
      void error;
    }
    const browserFull = String(navigator.language || '').toLowerCase();
    const browserShort = browserFull.split('-')[0];
    const targetLang = translations[browserFull]
      ? browserFull
      : (translations[browserShort] ? browserShort : defaultLang);
    setLang(targetLang);
  }, [clearAssistantTimer]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const toolParam = params.get('tool');
    const autoPick = params.get('autopick') === '1';
    const canonicalToolId = toolParam && toolIds.has(toolParam)
      ? toolParam
      : (toolParam ? LEGACY_TOOL_ID_TO_CANONICAL[toolParam] : null);
    if (canonicalToolId && toolIds.has(canonicalToolId)) {
      setActiveTab(canonicalToolId);
      if (autoPick) setPendingOpenToolId(canonicalToolId);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toolIds]);

  useEffect(() => {
    if (!pendingOpenToolId) return;
    if (pendingOpenToolId !== activeTab) return;
    scrollToConverter();
    openFilePicker();
    setPendingOpenToolId(null);
  }, [pendingOpenToolId, activeTab]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        clearStoredTestModeUser();
        setUser({
          name: u.displayName || u.email?.split('@')[0] || defaultUserName,
          email: u.email,
          photo: u.photoURL,
          isAnon: u.isAnonymous,
          uid: u.uid,
          provider_data: Array.isArray(u.providerData)
            ? u.providerData.map((item) => ({
              provider_id: item?.providerId || '',
              uid: item?.uid || '',
              email: item?.email || null
            }))
            : []
        });
        setIsPro(false);

        if (u.isAnonymous) {
          setShowTwofaModal(false);
          return;
        }

        const token = localStorage.getItem('twofa_token');
        if (token) {
          try {
            const r = await fetch(`${API_BASE}/auth/2fa/verify-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: u.email, token })
            });
            const j = await r.json();
            if (r.ok && j.ok) {
              setShowTwofaModal(false);
              return;
            }
          } catch (error) {
            void error;
          }
        }
      } else {
        const testUser = readStoredTestModeUser();
        if (testUser) {
          setUser(testUser);
          setIsPro(true);
          setShowTwofaModal(false);
        } else {
          setUser(null);
          setIsPro(false);
        }
      }
    });
    return () => unsubscribe();
  }, [API_BASE, defaultUserName]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.webdriver) {
      setRemoteBlogLoading(false);
      setRemoteBlogError('');
      return undefined;
    }
    const isBlogPath = path === '/blog' || path === '/blog/' || (path.startsWith('/blog/') && path !== '/blog/');
    const isGuidesPath = path === '/guides' || path === '/guides/' || (path.startsWith('/guides/') && path !== '/guides/');
    if (!isBlogPath && !isGuidesPath) {
      setRemoteBlogLoading(false);
      setRemoteBlogError('');
      return undefined;
    }

    const controller = new AbortController();
    let cancelled = false;
    const loadPosts = async () => {
      setRemoteBlogLoading(true);
      try {
        const headers = {};
        if (user?.uid) headers['x-user-id'] = user.uid;
        const response = await fetch(`${API_BASE}/posts`, {
          headers,
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error(t.errorLoadUpdatesWithStatus.replace('{status}', String(response.status)));
        }
        const payload = await response.json().catch(() => []);
        const mapped = Array.isArray(payload)
          ? payload.map((post) => mapPublicPostToBlogPost(post)).filter((post) => post.id && post.slug)
          : [];
        if (cancelled) return;

        setRemoteBlogPosts(mapped);
        setRemoteBlogError('');
        setBlogLikeState((prev) => {
          const next = { ...prev };
          for (const post of mapped) {
            next[post.id] = {
              liked: Boolean(post.liked),
              likes_count: Math.max(0, Number(post.likes_count || 0))
            };
          }
          return next;
        });
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        setRemoteBlogError(error?.message || t.errorLoadUpdates);
      } finally {
        if (!cancelled) setRemoteBlogLoading(false);
      }
    };
    void loadPosts();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [API_BASE, path, t, user?.uid]);

  useEffect(() => {
    getRedirectResult(auth).catch((error) => {
      if (!error) return;
      setAuthError(formatAuthError(error));
      setShowAuthModal(true);
    });
  }, []);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('cookie_ok');
      setShowCookie(consent !== '1' && consent !== '0');
    } catch (error) {
      void error;
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setFilesConvertedCount((v) => v + Math.floor(Math.random() * 3));
    }, 1800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('recent_jobs', JSON.stringify(recentJobs.slice(0, 12)));
    } catch (error) {
      void error;
    }
  }, [recentJobs]);

  useEffect(() => {
    if (!lastJobId) return;
    if (status !== 'done' && status !== 'error') return;
    setRecentJobs((jobs) => jobs.map((job) => (job.id === lastJobId ? { ...job, status } : job)));
  }, [lastJobId, status]);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!elements.length) return undefined;

    elements.forEach((el) => el.classList.remove('is-visible'));

    let observer;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
      }, { threshold: 0.15 });
      elements.forEach((el) => observer.observe(el));
    } else {
      elements.forEach((el) => el.classList.add('is-visible'));
    }

    const fallbackTimer = window.setTimeout(() => {
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.9) el.classList.add('is-visible');
      });
    }, 80);

    return () => {
      if (observer) observer.disconnect();
      window.clearTimeout(fallbackTimer);
    };
  }, [path]);

  useEffect(() => {
    const memory = Number(navigator.deviceMemory || 4);
    const cores = Number(navigator.hardwareConcurrency || 6);
    const lowEnd = memory <= 2 || cores <= 4;
    document.documentElement.classList.toggle('reduce-motion', lowEnd);
  }, []);

  useEffect(() => {
    track('page_view', { path });
    if (path === '/login') setShowAuthModal(true);
    if (path === '/settings/billing') setAccountSection('billing');
    setIsMobileMenuOpen(false);
    setIsLangMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [path, track]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const targetNode = event.target;
      if (langMenuRef.current && !langMenuRef.current.contains(targetNode)) {
        setIsLangMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(targetNode)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (path !== '/developers') return;
    let cancelled = false;
    setDevelopersLoading(true);
    setDevelopersError('');
    fetch(`${API_BASE}/developers`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled) return;
        const items = Array.isArray(payload?.items) ? payload.items : [];
        setDevelopersList(items);
      })
      .catch((error) => {
        if (cancelled) return;
        setDevelopersError(String(error?.message || 'Failed to load developers'));
      })
      .finally(() => {
        if (cancelled) return;
        setDevelopersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [API_BASE, path]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const targetTag = event.target?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || event.target?.isContentEditable) return;
      if (event.key.toLowerCase() === 'u') {
        event.preventDefault();
        openFilePicker();
      }
      if (event.key === '/') {
        event.preventDefault();
        const input = document.querySelector('input[placeholder*="Поиск"], input[placeholder*="Search"]');
        if (input) input.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const changeLanguage = (code) => {
    setLang(code);
    setIsLangMenuOpen(false);
    updateUserPreferences({ locale: code });
    emitSystemEvent('locale_changed', { locale: code });
    try {
      localStorage.setItem('lang', code);
    } catch (error) {
      void error;
    }
  };

  const buildAuthHeaders = useCallback(() => {
    const headers = {};
    if (user?.uid) headers['x-user-id'] = user.uid;
    if (clientSessionId) headers['x-session-id'] = clientSessionId;
    return headers;
  }, [user?.uid, clientSessionId]);

  const parseApiPayload = useCallback(async (response) => {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }, []);

  const createPipelineDraftNode = useCallback((partial = {}, index = 0) => {
    const rawType = String(partial?.type || partial?.kind || 'convert').trim().toLowerCase();
    const type = ACCOUNT_WORKFLOW_NODE_TYPES.some((item) => item.value === rawType) ? rawType : 'convert';
    const id = String(partial?.id || `node_${Date.now()}_${index}`).trim() || `node_${Date.now()}_${index}`;
    const label = String(partial?.label || partial?.title || (type === 'convert' ? 'Convert' : type)).trim()
      || (type === 'convert' ? 'Convert' : type);
    const tool = String(partial?.tool || '').trim();
    return {
      id,
      type,
      label,
      tool: type === 'convert' ? (tool || activeTab) : '',
      settings: partial?.settings && typeof partial.settings === 'object' ? partial.settings : {}
    };
  }, [activeTab]);

  const normalizePipelineDraftNodes = useCallback((nodes) => {
    if (!Array.isArray(nodes) || !nodes.length) {
      return [createPipelineDraftNode({ type: 'convert', label: 'Convert', tool: activeTab }, 0)];
    }
    const list = nodes
      .map((item, index) => createPipelineDraftNode(item, index))
      .filter((item) => String(item.id || '').trim());
    if (!list.length) {
      return [createPipelineDraftNode({ type: 'convert', label: 'Convert', tool: activeTab }, 0)];
    }
    return list.slice(0, 20);
  }, [activeTab, createPipelineDraftNode]);

  const resetPipelineDraft = useCallback(() => {
    setAccountPipelineDraftId('');
    setAccountPipelineDraftName('');
    setAccountPipelineDraftSource('manual');
    setAccountPipelineDraftNodes(normalizePipelineDraftNodes([]));
  }, [normalizePipelineDraftNodes]);

  const logoutCurrentUser = useCallback(async () => {
    try {
      localStorage.removeItem('twofa_token');
    } catch (error) {
      void error;
    }
    clearStoredTestModeUser();
    setShowTwofaModal(false);
    setUser(null);
    setIsPro(false);
    try {
      await signOut(auth);
    } catch (error) {
      void error;
    }
  }, []);

  const loadAccountBilling = useCallback(async ({ signal, silent = false, suppressError = false } = {}) => {
    if (!user?.uid) {
      setAccountBilling(null);
      setAccountBillingLoading(false);
      setAccountBillingError('');
      setIsPro(false);
      return null;
    }
    if (!silent) setAccountBillingLoading(true);
    if (!suppressError) setAccountBillingError('');
    try {
      const response = await fetch(`${API_BASE}/account/billing`, {
        headers: buildAuthHeaders(),
        signal
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      const billing = payload && typeof payload === 'object' ? payload : null;
      setAccountBilling(billing);
      setIsPro(hasFullAccessFromBilling(billing));
      return billing;
    } catch (error) {
      if (signal?.aborted) return null;
      if (!suppressError) {
        setAccountBillingError(error?.message || t.errorAccountBillingLoad);
      }
      return null;
    } finally {
      if (!silent) setAccountBillingLoading(false);
    }
  }, [API_BASE, buildAuthHeaders, parseApiPayload, t, user?.uid]);

  const loadAccountProfile = useCallback(async ({ signal, silent = false } = {}) => {
    if (!user?.uid) {
      setAccountProfile(null);
      setAccountProfileDraft({ display_name: '', timezone: '', avatar_url: '' });
      setAccountProfileLoading(false);
      setAccountProfileError('');
      return null;
    }
    if (!silent) setAccountProfileLoading(true);
    setAccountProfileError('');
    try {
      const response = await fetch(`${API_BASE}/account/profile`, {
        headers: buildAuthHeaders(),
        signal
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      const profile = payload && typeof payload === 'object' ? payload : null;
      setAccountProfile(profile);
      setAccountProfileDraft({
        display_name: String(profile?.display_name || user?.name || '').trim(),
        timezone: String(profile?.timezone || '').trim(),
        avatar_url: String(profile?.avatar_url || '').trim()
      });
      return profile;
    } catch (error) {
      if (signal?.aborted) return null;
      setAccountProfileError(error?.message || t.errorProfileLoad);
      return null;
    } finally {
      if (!silent) setAccountProfileLoading(false);
    }
  }, [API_BASE, buildAuthHeaders, parseApiPayload, t, user?.name, user?.uid]);

  const saveAccountProfile = useCallback(async () => {
    if (!user?.uid) {
      setShowAuthModal(true);
      return;
    }
    setAccountProfileSaving(true);
    setAccountProfileError('');
    setAccountActionNotice('');
    try {
      const response = await fetch(`${API_BASE}/account/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders()
        },
        body: JSON.stringify({
          display_name: String(accountProfileDraft.display_name || '').trim() || null,
          timezone: String(accountProfileDraft.timezone || '').trim() || null,
          avatar_url: String(accountProfileDraft.avatar_url || '').trim() || null
        })
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      setAccountProfile(payload && typeof payload === 'object' ? payload : null);
      setAccountActionNotice(t.noticeProfileUpdated);
      track('account_profile_update', {});
    } catch (error) {
      setAccountProfileError(error?.message || t.errorProfileSave);
    } finally {
      setAccountProfileSaving(false);
    }
  }, [API_BASE, accountProfileDraft.avatar_url, accountProfileDraft.display_name, accountProfileDraft.timezone, buildAuthHeaders, parseApiPayload, t, track, user?.uid]);

  const loadAccountConnections = useCallback(async ({ signal, silent = false } = {}) => {
    if (!user?.uid) {
      setAccountConnections([]);
      setAccountConnectionsLoading(false);
      setAccountConnectionsError('');
      return [];
    }
    if (!silent) setAccountConnectionsLoading(true);
    setAccountConnectionsError('');
    try {
      const response = await fetch(`${API_BASE}/account/connections`, {
        headers: buildAuthHeaders(),
        signal
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      const rows = Array.isArray(payload) ? payload : [];
      setAccountConnections(rows);
      return rows;
    } catch (error) {
      if (signal?.aborted) return [];
      setAccountConnectionsError(error?.message || t.errorConnectionsLoad);
      return [];
    } finally {
      if (!silent) setAccountConnectionsLoading(false);
    }
  }, [API_BASE, buildAuthHeaders, parseApiPayload, t, user?.uid]);

  const connectAccountProvider = useCallback(async (provider) => {
    const normalizedProvider = String(provider || '').trim().toLowerCase();
    if (!normalizedProvider || !(normalizedProvider in OAUTH_PROVIDER_IDS)) return;
    if (!user?.uid) {
      setShowAuthModal(true);
      return;
    }
    if (user?.isAnon) {
      setAccountConnectionsError(t.errorConnectPermanentAccount);
      return;
    }
    if (accountConnectionPending) return;
    setAccountConnectionPending(normalizedProvider);
    setAccountConnectionsError('');
    setAccountActionNotice('');
    try {
      const firebaseProviderId = OAUTH_PROVIDER_IDS[normalizedProvider];
      const providerFactory = normalizedProvider === 'google'
        ? () => new GoogleAuthProvider()
        : () => new GithubAuthProvider();

      let currentFirebaseUser = auth.currentUser;
      if (!currentFirebaseUser) {
        throw new Error(t.errorNoActiveSession);
      }
      let providerRecord = Array.isArray(currentFirebaseUser.providerData)
        ? currentFirebaseUser.providerData.find((item) => item?.providerId === firebaseProviderId)
        : null;

      if (!providerRecord) {
        const linkResult = await linkWithPopup(currentFirebaseUser, providerFactory());
        currentFirebaseUser = linkResult?.user || currentFirebaseUser;
        providerRecord = Array.isArray(currentFirebaseUser.providerData)
          ? currentFirebaseUser.providerData.find((item) => item?.providerId === firebaseProviderId)
          : null;
      }

      const providerUserId = String(
        providerRecord?.uid
        || currentFirebaseUser.uid
        || user.uid
      ).trim();
      const providerEmail = String(
        providerRecord?.email
        || currentFirebaseUser.email
        || user.email
        || ''
      ).trim() || null;

      const response = await fetch(`${API_BASE}/account/connections/${encodeURIComponent(normalizedProvider)}/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders()
        },
        body: JSON.stringify({
          provider_user_id: providerUserId,
          email: providerEmail
        })
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      setAccountActionNotice(
        t.noticeProviderConnected.replace('{provider}', normalizedProvider === 'google' ? 'Google' : 'GitHub')
      );
      track('account_provider_link', { provider: normalizedProvider, status: payload?.status || 'linked' });
      await loadAccountConnections({ silent: true });
    } catch (error) {
      setAccountConnectionsError(error?.message || t.errorProviderConnect);
    } finally {
      setAccountConnectionPending('');
    }
  }, [API_BASE, accountConnectionPending, buildAuthHeaders, loadAccountConnections, parseApiPayload, t, track, user?.email, user?.isAnon, user?.uid]);

  const disconnectAccountProvider = useCallback(async (provider) => {
    const normalizedProvider = String(provider || '').trim().toLowerCase();
    if (!normalizedProvider || !(normalizedProvider in OAUTH_PROVIDER_IDS)) return;
    if (!user?.uid) {
      setShowAuthModal(true);
      return;
    }
    if (user?.isAnon) {
      setAccountConnectionsError(t.errorGuestDisconnectUnsupported);
      return;
    }
    if (accountConnectionPending) return;
    if (!window.confirm(t.confirmProviderDisconnect.replace('{provider}', normalizedProvider === 'google' ? 'Google' : 'GitHub'))) return;
    setAccountConnectionPending(normalizedProvider);
    setAccountConnectionsError('');
    setAccountActionNotice('');
    try {
      const response = await fetch(`${API_BASE}/account/connections/${encodeURIComponent(normalizedProvider)}`, {
        method: 'DELETE',
        headers: buildAuthHeaders()
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }

      const firebaseProviderId = OAUTH_PROVIDER_IDS[normalizedProvider];
      try {
        const currentFirebaseUser = auth.currentUser;
        if (
          currentFirebaseUser
          && Array.isArray(currentFirebaseUser.providerData)
          && currentFirebaseUser.providerData.some((item) => item?.providerId === firebaseProviderId)
        ) {
          await unlink(currentFirebaseUser, firebaseProviderId);
        }
      } catch (unlinkError) {
        void unlinkError;
      }

      setAccountActionNotice(
        t.noticeProviderDisconnected.replace('{provider}', normalizedProvider === 'google' ? 'Google' : 'GitHub')
      );
      track('account_provider_unlink', { provider: normalizedProvider });
      await loadAccountConnections({ silent: true });
    } catch (error) {
      setAccountConnectionsError(error?.message || t.errorProviderDisconnect);
    } finally {
      setAccountConnectionPending('');
    }
  }, [API_BASE, accountConnectionPending, buildAuthHeaders, loadAccountConnections, parseApiPayload, t, track, user?.isAnon, user?.uid]);

  const loadAccountSessions = useCallback(async ({ signal, silent = false } = {}) => {
    if (!user?.uid) {
      setAccountSessions([]);
      setAccountSessionsLoading(false);
      setAccountSessionsError('');
      return [];
    }
    if (!silent) setAccountSessionsLoading(true);
    setAccountSessionsError('');
    try {
      const response = await fetch(`${API_BASE}/account/sessions`, {
        headers: buildAuthHeaders(),
        signal
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      const rows = Array.isArray(payload) ? payload : [];
      setAccountSessions(rows);
      return rows;
    } catch (error) {
      if (signal?.aborted) return [];
      setAccountSessionsError(error?.message || t.errorSessionsLoad);
      return [];
    } finally {
      if (!silent) setAccountSessionsLoading(false);
    }
  }, [API_BASE, buildAuthHeaders, parseApiPayload, t, user?.uid]);

  const revokeAccountSession = useCallback(async (sessionId) => {
    const id = String(sessionId || '').trim();
    if (!id || !user?.uid || accountSessionPending) return;
    setAccountSessionPending(id);
    setAccountSessionsError('');
    try {
      const response = await fetch(`${API_BASE}/account/sessions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: buildAuthHeaders()
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      track('account_session_revoked', { session_id: id, current: Boolean(payload?.current) });
      if (payload?.current) {
        await logoutCurrentUser();
        setShowAuthModal(true);
      } else {
        setAccountActionNotice(t.noticeSessionRevoked);
        await loadAccountSessions({ silent: true });
      }
    } catch (error) {
      setAccountSessionsError(error?.message || t.errorSessionRevoke);
    } finally {
      setAccountSessionPending('');
    }
  }, [API_BASE, accountSessionPending, buildAuthHeaders, loadAccountSessions, logoutCurrentUser, parseApiPayload, t, track, user?.uid]);

  const logoutAllAccountSessions = useCallback(async () => {
    if (!user?.uid || accountLogoutAllPending) return;
    if (!window.confirm(t.confirmLogoutAllDevices)) return;
    setAccountLogoutAllPending(true);
    setAccountSessionsError('');
    try {
      const response = await fetch(`${API_BASE}/account/sessions/logout-all`, {
        method: 'POST',
        headers: buildAuthHeaders()
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      track('account_logout_all', { revoked_count: Number(payload?.revoked_count || 0) });
      await logoutCurrentUser();
      setShowAuthModal(true);
    } catch (error) {
      setAccountSessionsError(error?.message || t.errorLogoutAllSessions);
    } finally {
      setAccountLogoutAllPending(false);
    }
  }, [API_BASE, accountLogoutAllPending, buildAuthHeaders, logoutCurrentUser, parseApiPayload, t, track, user?.uid]);

  const generateTelegramLinkCode = useCallback(async () => {
    if (!user?.uid) {
      setShowAuthModal(true);
      return;
    }
    if (accountTelegramCodeLoading) return;

    setAccountTelegramCodeLoading(true);
    setAccountTelegramCodeError('');
    setAccountTelegramCodeCopied(false);
    setAccountActionNotice('');

    try {
      const response = await fetch(`${API_BASE}/account/telegram/link-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders()
        },
        body: JSON.stringify({
          email: String(user.email || '').trim() || null
        })
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok || !payload || typeof payload !== 'object') {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }

      const code = String(payload.code || '').trim().toUpperCase();
      if (!code) throw new Error(t.errorTelegramCodeEmpty);
      setAccountTelegramCode({
        code,
        expires_at: payload.expires_at || null,
        ttl_sec: Number(payload.ttl_sec || 0)
      });
      setAccountActionNotice(t.noticeTelegramCodeGenerated);
      track('account_telegram_link_code_generated', { has_email: Boolean(user?.email) });
    } catch (error) {
      setAccountTelegramCodeError(error?.message || t.errorTelegramCodeGenerate);
    } finally {
      setAccountTelegramCodeLoading(false);
    }
  }, [API_BASE, accountTelegramCodeLoading, buildAuthHeaders, parseApiPayload, t, track, user?.email, user?.uid]);

  const copyTelegramLinkCode = useCallback(async () => {
    const code = String(accountTelegramCode?.code || '').trim();
    if (!code) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setAccountTelegramCodeCopied(true);
      window.setTimeout(() => setAccountTelegramCodeCopied(false), 1800);
    } catch (error) {
      setAccountTelegramCodeError(error?.message || t.errorTelegramCodeCopy);
    }
  }, [accountTelegramCode?.code, t]);

  const loadAccountApiKeys = useCallback(async ({ signal, silent = false } = {}) => {
    if (!user?.uid) {
      setAccountApiKeys([]);
      setAccountApiUsageSummary(null);
      setAccountApiKeysLoading(false);
      setAccountApiKeysError('');
      return [];
    }
    if (!silent) setAccountApiKeysLoading(true);
    setAccountApiKeysError('');
    try {
      const response = await fetch(`${API_BASE}/account/api-keys`, {
        headers: buildAuthHeaders(),
        signal
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      const items = Array.isArray(payload?.items) ? payload.items : [];
      setAccountApiKeys(items);
      setAccountApiUsageSummary(payload?.usage_summary || null);
      const drafts = {};
      items.forEach((item) => {
        const id = String(item?.id || '');
        if (!id) return;
        const allowed = Array.isArray(item?.allowed_ips) ? item.allowed_ips : [];
        drafts[id] = allowed.join(', ');
      });
      setAccountApiAllowlistDrafts(drafts);
      if (!accountApiWebhookKeyId && items.length > 0) {
        setAccountApiWebhookKeyId(String(items[0]?.id || ''));
      }
      return items;
    } catch (error) {
      if (signal?.aborted) return [];
      setAccountApiKeysError(error?.message || 'Failed to load API keys');
      return [];
    } finally {
      if (!silent) setAccountApiKeysLoading(false);
    }
  }, [API_BASE, accountApiWebhookKeyId, buildAuthHeaders, parseApiPayload, t, user?.uid]);

  const createAccountApiKey = useCallback(async () => {
    if (!user?.uid || accountApiActionPending) return;
    setAccountApiActionPending('create');
    setAccountApiKeysError('');
    setAccountApiNewToken('');
    try {
      const response = await fetch(`${API_BASE}/account/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders()
        },
        body: JSON.stringify({
          name: String(accountApiCreateName || '').trim() || 'Default',
          plan: accountApiCreatePlan
        })
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      if (payload?.token) setAccountApiNewToken(payload.token);
      setAccountApiCreateName('');
      setAccountActionNotice('API key created. Save the token now; it will not be shown again.');
      await loadAccountApiKeys({ silent: true });
    } catch (error) {
      setAccountApiKeysError(error?.message || 'Failed to create API key');
    } finally {
      setAccountApiActionPending('');
    }
  }, [API_BASE, accountApiActionPending, accountApiCreateName, accountApiCreatePlan, buildAuthHeaders, loadAccountApiKeys, parseApiPayload, t, user?.uid]);

  const revokeAccountApiKey = useCallback(async (keyId) => {
    const id = String(keyId || '').trim();
    if (!id || accountApiActionPending) return;
    setAccountApiActionPending(`revoke:${id}`);
    setAccountApiKeysError('');
    try {
      const response = await fetch(`${API_BASE}/account/api-keys/${encodeURIComponent(id)}/revoke`, {
        method: 'POST',
        headers: buildAuthHeaders()
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      await loadAccountApiKeys({ silent: true });
    } catch (error) {
      setAccountApiKeysError(error?.message || 'Failed to revoke API key');
    } finally {
      setAccountApiActionPending('');
    }
  }, [API_BASE, accountApiActionPending, buildAuthHeaders, loadAccountApiKeys, parseApiPayload, t]);

  const regenerateAccountApiKey = useCallback(async (keyId) => {
    const id = String(keyId || '').trim();
    if (!id || accountApiActionPending) return;
    setAccountApiActionPending(`regenerate:${id}`);
    setAccountApiKeysError('');
    setAccountApiNewToken('');
    try {
      const response = await fetch(`${API_BASE}/account/api-keys/${encodeURIComponent(id)}/regenerate`, {
        method: 'POST',
        headers: buildAuthHeaders()
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      if (payload?.token) setAccountApiNewToken(payload.token);
      await loadAccountApiKeys({ silent: true });
    } catch (error) {
      setAccountApiKeysError(error?.message || 'Failed to regenerate API key');
    } finally {
      setAccountApiActionPending('');
    }
  }, [API_BASE, accountApiActionPending, buildAuthHeaders, loadAccountApiKeys, parseApiPayload, t]);

  const copyAccountApiToken = useCallback(async () => {
    const token = String(accountApiNewToken || '').trim();
    if (!token) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(token);
      }
      setAccountActionNotice('API token copied to clipboard.');
    } catch {
      setAccountActionNotice('Copy failed. Please copy token manually.');
    }
  }, [accountApiNewToken]);

  const parseAllowlistText = useCallback((value) => String(value || '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean), []);

  const saveAccountApiAllowlist = useCallback(async (keyId) => {
    const id = String(keyId || '').trim();
    if (!id || accountApiActionPending) return;
    const rawText = accountApiAllowlistDrafts[id] || '';
    const allowedIps = parseAllowlistText(rawText);
    setAccountApiActionPending(`allowlist:${id}`);
    setAccountApiKeysError('');
    try {
      const response = await fetch(`${API_BASE}/account/api-keys/${encodeURIComponent(id)}/allowlist`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders()
        },
        body: JSON.stringify({ allowed_ips: allowedIps })
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      setAccountActionNotice('API key allowlist updated.');
      await loadAccountApiKeys({ silent: true });
    } catch (error) {
      setAccountApiKeysError(error?.message || 'Failed to update allowlist');
    } finally {
      setAccountApiActionPending('');
    }
  }, [API_BASE, accountApiActionPending, accountApiAllowlistDrafts, buildAuthHeaders, loadAccountApiKeys, parseAllowlistText, parseApiPayload, t]);

  const loadAccountApiWebhooks = useCallback(async ({ signal, silent = false } = {}) => {
    if (!user?.uid) {
      setAccountApiWebhooks([]);
      setAccountApiWebhookDeliveries([]);
      setAccountApiWebhooksLoading(false);
      setAccountApiWebhookError('');
      return { items: [], deliveries: [] };
    }
    if (!silent) setAccountApiWebhooksLoading(true);
    setAccountApiWebhookError('');
    try {
      const [hooksResponse, deliveriesResponse] = await Promise.all([
        fetch(`${API_BASE}/account/api-webhooks`, {
          headers: buildAuthHeaders(),
          signal
        }),
        fetch(`${API_BASE}/account/api-webhooks/deliveries?limit=50`, {
          headers: buildAuthHeaders(),
          signal
        })
      ]);
      const hooksPayload = await parseApiPayload(hooksResponse);
      const deliveriesPayload = await parseApiPayload(deliveriesResponse);
      if (hooksResponse.status === 401 || deliveriesResponse.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!hooksResponse.ok) {
        throw new Error(hooksPayload?.message || t.errorRequestWithStatus.replace('{status}', String(hooksResponse.status)));
      }
      if (!deliveriesResponse.ok) {
        throw new Error(deliveriesPayload?.message || t.errorRequestWithStatus.replace('{status}', String(deliveriesResponse.status)));
      }
      const items = Array.isArray(hooksPayload?.items) ? hooksPayload.items : [];
      const deliveries = Array.isArray(deliveriesPayload?.items) ? deliveriesPayload.items : [];
      setAccountApiWebhooks(items);
      setAccountApiWebhookDeliveries(deliveries);
      if (!accountApiWebhookKeyId && items.length > 0) {
        const preferredKeyId = String(items[0]?.api_key_id || '');
        if (preferredKeyId) setAccountApiWebhookKeyId(preferredKeyId);
      }
      return { items, deliveries };
    } catch (error) {
      if (signal?.aborted) return { items: [], deliveries: [] };
      setAccountApiWebhookError(error?.message || 'Failed to load webhooks');
      return { items: [], deliveries: [] };
    } finally {
      if (!silent) setAccountApiWebhooksLoading(false);
    }
  }, [API_BASE, accountApiWebhookKeyId, buildAuthHeaders, parseApiPayload, t, user?.uid]);

  const createAccountApiWebhook = useCallback(async () => {
    if (!user?.uid || accountApiActionPending) return;
    const apiKeyId = String(accountApiWebhookKeyId || '').trim();
    if (!apiKeyId) {
      setAccountApiWebhookError('Select API key first.');
      return;
    }
    setAccountApiActionPending('webhook:create');
    setAccountApiWebhookError('');
    setAccountApiWebhookSecret('');
    try {
      const events = [
        accountApiWebhookEvents.completed ? 'job.completed' : '',
        accountApiWebhookEvents.failed ? 'job.failed' : ''
      ].filter(Boolean);
      const response = await fetch(`${API_BASE}/account/api-webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders()
        },
        body: JSON.stringify({
          api_key_id: apiKeyId,
          url: accountApiWebhookUrl,
          events
        })
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      setAccountApiWebhookUrl('');
      setAccountApiWebhookEvents({ completed: true, failed: false });
      setAccountApiWebhookSecret(String(payload?.secret || ''));
      setAccountActionNotice('Webhook created.');
      await loadAccountApiWebhooks({ silent: true });
    } catch (error) {
      setAccountApiWebhookError(error?.message || 'Failed to create webhook');
    } finally {
      setAccountApiActionPending('');
    }
  }, [API_BASE, accountApiActionPending, accountApiWebhookEvents, accountApiWebhookKeyId, accountApiWebhookUrl, buildAuthHeaders, loadAccountApiWebhooks, parseApiPayload, t, user?.uid]);

  const deleteAccountApiWebhook = useCallback(async (id) => {
    const webhookId = String(id || '').trim();
    if (!webhookId || accountApiActionPending) return;
    setAccountApiActionPending(`webhook:delete:${webhookId}`);
    setAccountApiWebhookError('');
    try {
      const response = await fetch(`${API_BASE}/account/api-webhooks/${encodeURIComponent(webhookId)}`, {
        method: 'DELETE',
        headers: buildAuthHeaders()
      });
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok && response.status !== 204) {
        const payload = await parseApiPayload(response);
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      await loadAccountApiWebhooks({ silent: true });
    } catch (error) {
      setAccountApiWebhookError(error?.message || 'Failed to delete webhook');
    } finally {
      setAccountApiActionPending('');
    }
  }, [API_BASE, accountApiActionPending, buildAuthHeaders, loadAccountApiWebhooks, parseApiPayload, t]);

  const testAccountApiWebhook = useCallback(async (id) => {
    const webhookId = String(id || '').trim();
    if (!webhookId || accountApiActionPending) return;
    setAccountApiActionPending(`webhook:test:${webhookId}`);
    setAccountApiWebhookError('');
    try {
      const response = await fetch(`${API_BASE}/account/api-webhooks/${encodeURIComponent(webhookId)}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders()
        },
        body: JSON.stringify({})
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      setAccountActionNotice('Webhook test sent.');
      await loadAccountApiWebhooks({ silent: true });
    } catch (error) {
      setAccountApiWebhookError(error?.message || 'Failed to test webhook');
    } finally {
      setAccountApiActionPending('');
    }
  }, [API_BASE, accountApiActionPending, buildAuthHeaders, loadAccountApiWebhooks, parseApiPayload, t]);

  const toggleAccountApiWebhook = useCallback(async (item) => {
    if (!item?.id || accountApiActionPending) return;
    const webhookId = String(item.id);
    setAccountApiActionPending(`webhook:toggle:${webhookId}`);
    setAccountApiWebhookError('');
    try {
      const response = await fetch(`${API_BASE}/account/api-webhooks/${encodeURIComponent(webhookId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders()
        },
        body: JSON.stringify({ is_active: item.is_active === false })
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      await loadAccountApiWebhooks({ silent: true });
    } catch (error) {
      setAccountApiWebhookError(error?.message || 'Failed to update webhook');
    } finally {
      setAccountApiActionPending('');
    }
  }, [API_BASE, accountApiActionPending, buildAuthHeaders, loadAccountApiWebhooks, parseApiPayload, t]);

  const loadAccountPipelines = useCallback(async ({ signal, silent = false, preferredId = '' } = {}) => {
    if (!user?.uid) {
      setAccountPipelines([]);
      setAccountPipelinesLoading(false);
      setAccountPipelinesError('');
      if (!silent) resetPipelineDraft();
      return [];
    }
    if (!silent) setAccountPipelinesLoading(true);
    setAccountPipelinesError('');
    try {
      const response = await fetch(`${API_BASE}/account/pipelines`, {
        headers: buildAuthHeaders(),
        signal
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      const items = Array.isArray(payload?.items) ? payload.items : [];
      setAccountPipelines(items);
      const preferred = String(preferredId || '').trim();
      const selected = (preferred
        ? items.find((item) => String(item?.id || '').trim() === preferred)
        : null) || items[0] || null;
      if (!selected) {
        if (!silent) resetPipelineDraft();
        setAccountSelectedPipelineId('');
        return items;
      }

      const selectedId = String(selected.id || '').trim();
      setAccountSelectedPipelineId(selectedId);
      const nodes = normalizePipelineDraftNodes(selected.nodes);
      setAccountPipelineDraftId(selectedId);
      setAccountPipelineDraftName(String(selected.name || '').trim());
      setAccountPipelineDraftSource(String(selected.source || 'manual').trim() || 'manual');
      setAccountPipelineDraftNodes(nodes);
      return items;
    } catch (error) {
      if (signal?.aborted) return [];
      setAccountPipelinesError(error?.message || 'Failed to load pipelines');
      return [];
    } finally {
      if (!silent) setAccountPipelinesLoading(false);
    }
  }, [
    API_BASE,
    buildAuthHeaders,
    normalizePipelineDraftNodes,
    parseApiPayload,
    resetPipelineDraft,
    t,
    user?.uid
  ]);

  const openAccountPipelineForEdit = useCallback((item) => {
    if (!item || typeof item !== 'object') return;
    const id = String(item.id || '').trim();
    const nodes = normalizePipelineDraftNodes(item.nodes);
    setAccountPipelineDraftId(id);
    setAccountSelectedPipelineId(id);
    setAccountPipelineDraftName(String(item.name || '').trim());
    setAccountPipelineDraftSource(String(item.source || 'manual').trim() || 'manual');
    setAccountPipelineDraftNodes(nodes);
    setAccountPipelinesError('');
  }, [normalizePipelineDraftNodes]);

  const updateAccountPipelineNode = useCallback((nodeId, field, value) => {
    const targetId = String(nodeId || '').trim();
    if (!targetId) return;
    setAccountPipelineDraftNodes((prev) => prev.map((node) => {
      if (String(node.id || '') !== targetId) return node;
      if (field === 'type') {
        const nextType = String(value || '').trim().toLowerCase();
        const typeAllowed = ACCOUNT_WORKFLOW_NODE_TYPES.some((item) => item.value === nextType);
        const finalType = typeAllowed ? nextType : 'convert';
        return {
          ...node,
          type: finalType,
          tool: finalType === 'convert' ? (node.tool || activeTab) : ''
        };
      }
      if (field === 'tool') {
        return {
          ...node,
          tool: String(value || '').trim()
        };
      }
      if (field === 'label') {
        return {
          ...node,
          label: String(value || '').trim()
        };
      }
      return node;
    }));
  }, [activeTab]);

  const addAccountPipelineNode = useCallback(() => {
    setAccountPipelineDraftNodes((prev) => {
      const next = [...prev];
      next.push(createPipelineDraftNode({ type: 'convert', label: 'Convert', tool: activeTab }, next.length));
      return normalizePipelineDraftNodes(next);
    });
  }, [activeTab, createPipelineDraftNode, normalizePipelineDraftNodes]);

  const removeAccountPipelineNode = useCallback((nodeId) => {
    const targetId = String(nodeId || '').trim();
    if (!targetId) return;
    setAccountPipelineDraftNodes((prev) => {
      const next = prev.filter((node) => String(node.id || '') !== targetId);
      return normalizePipelineDraftNodes(next);
    });
  }, [normalizePipelineDraftNodes]);

  const saveAccountPipelineDraft = useCallback(async () => {
    if (!user?.uid) {
      setShowAuthModal(true);
      return;
    }
    if (accountPipelineActionPending) return;
    const name = String(accountPipelineDraftName || '').trim();
    if (!name) {
      setAccountPipelinesError('Укажите название workflow.');
      return;
    }
    const nodes = normalizePipelineDraftNodes(accountPipelineDraftNodes);
    const edges = buildSequentialWorkflowEdges(nodes);
    const editingId = String(accountPipelineDraftId || '').trim();
    const isEdit = Boolean(editingId);
    setAccountPipelineActionPending(isEdit ? `save:${editingId}` : 'create');
    setAccountPipelinesError('');
    setAccountActionNotice('');
    try {
      const response = await fetch(
        isEdit
          ? `${API_BASE}/account/pipelines/${encodeURIComponent(editingId)}`
          : `${API_BASE}/account/pipelines`,
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...buildAuthHeaders()
          },
          body: JSON.stringify({
            name,
            source: accountPipelineDraftSource || 'manual',
            nodes,
            edges,
            enabled: true
          })
        }
      );
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      const item = payload?.item && typeof payload.item === 'object' ? payload.item : null;
      if (item?.id) {
        setAccountPipelineDraftId(String(item.id));
        setAccountSelectedPipelineId(String(item.id));
      }
      setAccountActionNotice(isEdit ? 'Workflow обновлен.' : 'Workflow создан.');
      await loadAccountPipelines({ silent: true, preferredId: String(item?.id || editingId || '') });
    } catch (error) {
      setAccountPipelinesError(error?.message || 'Failed to save workflow');
    } finally {
      setAccountPipelineActionPending('');
    }
  }, [
    API_BASE,
    accountPipelineActionPending,
    accountPipelineDraftId,
    accountPipelineDraftName,
    accountPipelineDraftNodes,
    accountPipelineDraftSource,
    buildAuthHeaders,
    loadAccountPipelines,
    normalizePipelineDraftNodes,
    parseApiPayload,
    t,
    user?.uid
  ]);

  const deleteAccountPipeline = useCallback(async (pipelineId) => {
    const id = String(pipelineId || '').trim();
    if (!id || accountPipelineActionPending) return;
    if (!window.confirm('Удалить workflow?')) return;
    setAccountPipelineActionPending(`delete:${id}`);
    setAccountPipelinesError('');
    try {
      const response = await fetch(`${API_BASE}/account/pipelines/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: buildAuthHeaders()
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      if (String(accountPipelineDraftId || '') === id || String(accountSelectedPipelineId || '') === id) {
        resetPipelineDraft();
        setAccountSelectedPipelineId('');
      }
      await loadAccountPipelines({ silent: true });
      setAccountActionNotice('Workflow удален.');
    } catch (error) {
      setAccountPipelinesError(error?.message || 'Failed to delete workflow');
    } finally {
      setAccountPipelineActionPending('');
    }
  }, [
    API_BASE,
    accountPipelineActionPending,
    accountPipelineDraftId,
    accountSelectedPipelineId,
    buildAuthHeaders,
    loadAccountPipelines,
    parseApiPayload,
    resetPipelineDraft,
    t
  ]);

  const generateWorkflowWithAi = useCallback(async ({ save = false } = {}) => {
    if (!user?.uid) {
      setShowAuthModal(true);
      return null;
    }
    const prompt = String(accountWorkflowPrompt || assistantEntry || '').trim();
    if (!prompt) {
      setAccountPipelinesError('Опиши цель: например "сделай видео для TikTok".');
      return null;
    }
    const selectedFile = file || files[0] || null;
    setAccountPipelineActionPending(save ? 'ai_generate_save' : 'ai_generate');
    setAccountPipelinesError('');
    try {
      const response = await fetch(`${API_BASE}/account/workflow/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders()
        },
        body: JSON.stringify({
          prompt,
          name: String(accountPipelineDraftName || '').trim() || undefined,
          save,
          auto_create_pipeline: save,
          file_name: selectedFile?.name || undefined,
          file_size: selectedFile?.size || undefined,
          goal: assistantContextSummary?.intent_prediction || undefined
        })
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      const workflow = payload?.workflow && typeof payload.workflow === 'object' ? payload.workflow : null;
      if (workflow) {
        const nodes = normalizePipelineDraftNodes(workflow.nodes);
        setAccountPipelineDraftNodes(nodes);
        setAccountPipelineDraftName(String(workflow.name || accountPipelineDraftName || 'AI workflow'));
        setAccountPipelineDraftSource('workflow_generator');
      }
      const created = payload?.pipeline && typeof payload.pipeline === 'object' ? payload.pipeline : null;
      if (created?.id) {
        const nextId = String(created.id);
        setAccountPipelineDraftId(nextId);
        setAccountSelectedPipelineId(nextId);
        await loadAccountPipelines({ silent: true, preferredId: nextId });
        setAccountActionNotice('AI workflow создан и сохранен.');
      } else {
        setAccountActionNotice('AI workflow сгенерирован. Проверь узлы и сохрани.');
      }
      return payload;
    } catch (error) {
      setAccountPipelinesError(error?.message || 'Failed to generate workflow');
      return null;
    } finally {
      setAccountPipelineActionPending('');
    }
  }, [
    API_BASE,
    accountPipelineDraftName,
    accountWorkflowPrompt,
    assistantContextSummary?.intent_prediction,
    assistantEntry,
    buildAuthHeaders,
    file,
    files,
    loadAccountPipelines,
    normalizePipelineDraftNodes,
    parseApiPayload,
    t,
    user?.uid
  ]);

  const runAccountPipeline = async (pipelineId) => {
    const id = String(pipelineId || accountSelectedPipelineId || '').trim();
    if (!id || accountPipelineRunPending) return;
    const selectedFile = file || files[0] || null;
    if (!selectedFile) {
      setAccountPipelinesError('Сначала выбери файл.');
      scrollToConverter();
      return;
    }
    setAccountPipelineRunPending(id);
    setAccountPipelinesError('');
    setAccountActionNotice('');
    setStatus('processing');
    setProgress(8);
    setPipelineStage('Pipeline: upload');
    try {
      const authHeaders = buildAuthHeaders();
      const upload = await uploadToStorage(
        API_BASE,
        authHeaders,
        selectedFile,
        selectedFile.name,
        20_000
      );
      const inputFormat = getFileExt(selectedFile.name);
      const response = await fetch(`${API_BASE}/account/pipelines/${encodeURIComponent(id)}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          inputKey: upload?.inputKey,
          originalName: selectedFile.name,
          inputSize: Number(selectedFile.size || 0),
          inputFormat
        })
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      const jobId = String(payload?.jobId || payload?.job_id || '').trim();
      if (!jobId) throw new Error('Pipeline run did not return job id');
      setLastJobId(jobId);
      setPipelineStage('Pipeline: processing');
      setProgress(45);
      const finalJob = await recoverCompletedJob(jobId, authHeaders, 180000);
      if (!finalJob) throw new Error('Pipeline run timed out');
      const finalStatus = String(finalJob.status || '').toLowerCase();
      if (finalStatus !== 'completed') {
        throw new Error(finalJob?.error?.message || 'Pipeline execution failed');
      }
      const resolvedDownloadUrl = finalJob.downloadUrl || finalJob.outputUrl || null;
      setDownloadUrlSafe(resolvedDownloadUrl);
      setDownloadFileName(
        String(finalJob?.outputMeta?.outputName || '').trim()
        || extractLocalNameFromUrl(resolvedDownloadUrl)
        || ''
      );
      setStatus('done');
      setProgress(100);
      setPipelineStage('Pipeline: completed');
      setAccountActionNotice('Workflow выполнен успешно.');
      track('pipeline_run_complete', { pipeline_id: id, job_id: jobId, success: true });
    } catch (error) {
      setStatus('error');
      setPipelineStage(null);
      setProgress(0);
      setErrorInfo(error?.message || 'Failed to run workflow');
      setAccountPipelinesError(error?.message || 'Failed to run workflow');
      track('pipeline_run_complete', { pipeline_id: id, success: false, error: error?.message || 'unknown' });
    } finally {
      setAccountPipelineRunPending('');
    }
  };

  const redeemAccountPromoCode = async () => {
    if (!user?.uid) {
      setShowAuthModal(true);
      return;
    }
    const code = String(accountPromoCode || '').trim().toUpperCase();
    if (!code) {
      setAccountRedeemStatus('error');
      setAccountRedeemMessage(t.errorPromoCodeRequired);
      triggerAccountInputErrorShake();
      scheduleAccountNoticeReset();
      return;
    }

    clearAccountTimer('slow');
    clearAccountTimer('verySlow');
    setAccountRedeemSlow(false);
    setAccountRedeemVerySlow(false);
    setAccountRedeemStatus('loading');
    setAccountRedeemMessage('');
    accountTimersRef.current.slow = window.setTimeout(() => {
      setAccountRedeemSlow(true);
      accountTimersRef.current.slow = null;
    }, 500);
    accountTimersRef.current.verySlow = window.setTimeout(() => {
      setAccountRedeemVerySlow(true);
      accountTimersRef.current.verySlow = null;
    }, 2000);

    try {
      const idempotencyKey = `acct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const response = await fetch(`${API_BASE}/promo/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders()
        },
        body: JSON.stringify({
          code,
          idempotency_key: idempotencyKey
        })
      });
      const payload = await parseApiPayload(response);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error(t.authSignInRequired);
      }
      if (!response.ok || !payload || typeof payload !== 'object') {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      setAccountPromoCode('');
      setAccountRedeemStatus('success');
      setAccountRedeemMessage(buildRedeemSuccessMessage(payload));
      scheduleAccountNoticeReset();
      pulseAccountBenefitsCard();
      await loadAccountBilling({ silent: true });
    } catch (error) {
      setAccountRedeemStatus('error');
      setAccountRedeemMessage(error?.message || t.errorPromoCodeApply);
      triggerAccountInputErrorShake();
      scheduleAccountNoticeReset();
    } finally {
      clearAccountTimer('slow');
      clearAccountTimer('verySlow');
      setAccountRedeemSlow(false);
      setAccountRedeemVerySlow(false);
    }
  };

  useEffect(() => {
    return () => {
      clearAccountTimers();
    };
  }, [clearAccountTimers]);

  useEffect(() => {
    if (isAccountPath || !user?.uid) return undefined;
    const controller = new AbortController();
    void loadAccountBilling({
      signal: controller.signal,
      silent: true,
      suppressError: true
    });
    return () => {
      controller.abort();
    };
  }, [isAccountPath, loadAccountBilling, user?.uid]);

  useEffect(() => {
    if (!isAccountPath) return undefined;
    if (!user?.uid) {
      setAccountBilling(null);
      setAccountBillingLoading(false);
      setAccountBillingError('');
      setIsPro(false);
      setAccountProfile(null);
      setAccountProfileDraft({ display_name: '', timezone: '', avatar_url: '' });
      setAccountProfileLoading(false);
      setAccountProfileError('');
      setAccountConnections([]);
      setAccountConnectionsLoading(false);
      setAccountConnectionsError('');
      setAccountSessions([]);
      setAccountSessionsLoading(false);
      setAccountSessionsError('');
      setAccountTelegramCode(null);
      setAccountTelegramCodeLoading(false);
      setAccountTelegramCodeError('');
      setAccountTelegramCodeCopied(false);
      setAccountApiKeys([]);
      setAccountApiUsageSummary(null);
      setAccountApiKeysLoading(false);
      setAccountApiKeysError('');
      setAccountApiCreateName('');
      setAccountApiCreatePlan('free');
      setAccountApiActionPending('');
      setAccountApiNewToken('');
      setAccountApiAllowlistDrafts({});
      setAccountApiWebhooks([]);
      setAccountApiWebhookDeliveries([]);
      setAccountApiWebhooksLoading(false);
      setAccountApiWebhookError('');
      setAccountApiWebhookUrl('');
      setAccountApiWebhookKeyId('');
      setAccountApiWebhookEvents({ completed: true, failed: false });
      setAccountApiWebhookSecret('');
      setAccountPipelines([]);
      setAccountPipelinesLoading(false);
      setAccountPipelinesError('');
      setAccountPipelineActionPending('');
      setAccountPipelineRunPending('');
      setAccountWorkflowPrompt('');
      setAccountPipelineDraftId('');
      setAccountPipelineDraftName('');
      setAccountPipelineDraftSource('manual');
      setAccountPipelineDraftNodes(normalizePipelineDraftNodes([]));
      setAccountSelectedPipelineId('');
      return undefined;
    }
    const controller = new AbortController();
    void Promise.all([
      loadAccountBilling({ signal: controller.signal }),
      loadAccountProfile({ signal: controller.signal }),
      loadAccountConnections({ signal: controller.signal }),
      loadAccountSessions({ signal: controller.signal }),
      loadAccountApiKeys({ signal: controller.signal }),
      loadAccountApiWebhooks({ signal: controller.signal }),
      loadAccountPipelines({ signal: controller.signal })
    ]);
    return () => {
      controller.abort();
    };
  }, [
    isAccountPath,
    loadAccountApiKeys,
    loadAccountApiWebhooks,
    loadAccountBilling,
    loadAccountConnections,
    loadAccountPipelines,
    loadAccountProfile,
    loadAccountSessions,
    normalizePipelineDraftNodes,
    user?.uid
  ]);

  useEffect(() => {
    if (accountSection !== 'pipelines') return;
    if (accountPipelineDraftNodes.length > 0) return;
    setAccountPipelineDraftNodes(normalizePipelineDraftNodes([]));
  }, [accountPipelineDraftNodes.length, accountSection, normalizePipelineDraftNodes]);

  const getBlogLikeView = (post) => {
    if (!post?.id) {
      return { enabled: false, liked: false, count: 0, pending: false };
    }
    const state = blogLikeState[post.id];
    const liked = state ? Boolean(state.liked) : Boolean(post.liked);
    const count = state ? Number(state.likes_count || 0) : Number(post.likes_count || 0);
    return {
      enabled: true,
      liked,
      count: Math.max(0, count),
      pending: Boolean(blogLikePending[post.id])
    };
  };

  const toggleBlogLike = async (post) => {
    if (!post?.id) return;
    if (!user?.uid) {
      setShowAuthModal(true);
      return;
    }

    const likeView = getBlogLikeView(post);
    if (likeView.pending) return;

    const previous = {
      liked: likeView.liked,
      likes_count: likeView.count
    };
    const optimisticLiked = !likeView.liked;
    const optimisticCount = Math.max(0, likeView.count + (optimisticLiked ? 1 : -1));

    setBlogLikePending((prev) => ({ ...prev, [post.id]: true }));
    setBlogLikeState((prev) => ({
      ...prev,
      [post.id]: {
        liked: optimisticLiked,
        likes_count: optimisticCount
      }
    }));

    try {
      const response = await fetch(`${API_BASE}/posts/${encodeURIComponent(post.id)}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders()
        },
        body: '{}'
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 401) {
        setShowAuthModal(true);
        throw new Error('Unauthorized');
      }
      if (!response.ok || !payload || typeof payload !== 'object') {
        throw new Error(payload?.message || `Like request failed (${response.status})`);
      }
      setBlogLikeState((prev) => ({
        ...prev,
        [post.id]: {
          liked: Boolean(payload.liked),
          likes_count: Math.max(0, Number(payload.likes_count || 0))
        }
      }));
    } catch {
      setBlogLikeState((prev) => ({
        ...prev,
        [post.id]: previous
      }));
    } finally {
      setBlogLikePending((prev) => ({ ...prev, [post.id]: false }));
    }
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const fetchJobSnapshot = async (base, jobId, headers, timeoutMs = 15000) => {
    if (!base || !jobId) return null;
    const normalizedBase = String(base || '').trim().replace(/\/+$/, '');
    if (!normalizedBase) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${normalizedBase}/jobs/${jobId}`, {
        cache: 'no-store',
        headers,
        signal: controller.signal
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      if (!data || typeof data !== 'object') return null;
      return data;
    } catch (error) {
      void error;
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const recoverCompletedJob = async (jobId, headers, maxWaitMs = 120000) => {
    if (!jobId) return null;
    const candidates = [];
    const primary = String(API_BASE || '').trim();
    if (primary) candidates.push(primary);
    const started = Date.now();
    while (Date.now() - started < maxWaitMs) {
      for (const base of candidates) {
        const job = await fetchJobSnapshot(base, jobId, headers);
        if (!job || !job.status) continue;
        const status = String(job.status).toLowerCase();
        if (status === 'completed' || status === 'failed' || status === 'expired') {
          return { ...job, status };
        }
      }
      await wait(1500);
    }
    return null;
  };

  const handleLogin = async (providerName) => {
    setAuthError('');
    const provider = providerName === 'google' ? new GoogleAuthProvider() : new GithubAuthProvider();
    if (providerName === 'google') {
      provider.setCustomParameters({ prompt: 'select_account' });
    }
    try {
      await signInWithPopup(auth, provider);
      setShowAuthModal(false);
    } catch (e) {
      const code = String(e?.code || '').toLowerCase();
      const shouldFallbackToRedirect = providerName === 'google'
        && ['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(code);
      if (shouldFallbackToRedirect) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError) {
          setAuthError(formatAuthError(redirectError));
          return;
        }
      }
      setAuthError(formatAuthError(e));
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      setAuthError('Введите email.');
      return;
    }
    const derivedPassword = deriveEmailSessionPassword(normalizedEmail);
    if (!derivedPassword) {
      setAuthError('Не удалось подготовить вход по email.');
      return;
    }
    try {
      try {
        await signInWithEmailAndPassword(auth, normalizedEmail, derivedPassword);
      } catch (loginError) {
        const loginCode = String(loginError?.code || '').toLowerCase();
        const canCreate = loginCode === 'auth/user-not-found'
          || loginCode === 'auth/invalid-credential'
          || loginCode === 'auth/wrong-password';
        if (!canCreate) throw loginError;
        await createUserWithEmailAndPassword(auth, normalizedEmail, derivedPassword);
      }
      setEmail(normalizedEmail);
      setPassword(derivedPassword);
      setShowAuthModal(false);
    } catch (e) {
      setAuthError(e.message);
    }
  };

  const handleTestModeLogin = async () => {
    if (testModeLoading) return;
    setAuthError('');
    const pass = String(password || '').trim();
    if (!pass) {
      setAuthError('Enter test mode password.');
      return;
    }
    setTestModeLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/test-mode/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: pass,
          login: String(email || '').trim() || 'tester'
        })
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      const userFromApi = normalizeTestModeUser(payload?.user);
      if (!userFromApi) {
        throw new Error('Test mode user data is invalid.');
      }
      const persisted = writeStoredTestModeUser(userFromApi) || userFromApi;
      setUser(persisted);
      setIsPro(true);
      setShowTwofaModal(false);
      setShowAuthModal(false);
      setPassword('');
    } catch (error) {
      setAuthError(error?.message || 'Failed to login in test mode.');
    } finally {
      setTestModeLoading(false);
    }
  };

  const handleTestModeUnlock = useCallback(async () => {
    if (testModeUnlockLoading) return;
    if (!user?.uid || !user?.isTestMode) return;
    setTestModeUnlockError('');
    setTestModeUnlockLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/test-mode/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders()
        },
        body: JSON.stringify({
          user_id: user.uid
        })
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(payload?.message || t.errorRequestWithStatus.replace('{status}', String(response.status)));
      }
      if (payload?.access && payload.access.blocked === false) {
        setAccountBilling((prev) => {
          const base = prev && typeof prev === 'object' ? prev : {};
          return {
            ...base,
            access: {
              blocked: false,
              reason: null,
              blocked_at: null
            }
          };
        });
      }
      await loadAccountBilling({ silent: true, suppressError: true });
    } catch (error) {
      setTestModeUnlockError(error?.message || 'Failed to unlock test mode account.');
    } finally {
      setTestModeUnlockLoading(false);
    }
  }, [API_BASE, buildAuthHeaders, loadAccountBilling, parseApiPayload, t, testModeUnlockLoading, user?.isTestMode, user?.uid]);

  const handleGuest = async () => {
    try {
      await signInAnonymously(auth);
      setShowAuthModal(false);
    } catch (e) {
      setAuthError(e.message);
    }
  };

  const handleExportData = () => {
    setAccountNotice(t.dashboardNoticeExport);
  };

  const handleDeleteAccount = () => {
    setAccountNotice(t.dashboardNoticeDelete);
  };

  const removeJob = (jobId) => {
    setRecentJobs((jobs) => jobs.filter((job) => job.id !== jobId));
  };

  const startTwoFA = async () => {
    if (!user?.email) return;
    setTwofaStatus('sending');
    setTwofaError('');
    try {
      const r = await fetch(`${API_BASE}/auth/2fa/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || t.errorTwofaStart);
      setTwofaStatus('sent');
    } catch (e) {
      setTwofaStatus('error');
      setTwofaError(e.message);
    }
  };

  const verifyTwoFA = async () => {
    if (!user?.email) return;
    setTwofaStatus('verifying');
    setTwofaError('');
    try {
      const r = await fetch(`${API_BASE}/auth/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, code: twofaCode })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || t.errorTwofaInvalid);
      localStorage.setItem('twofa_token', j.token);
      setShowTwofaModal(false);
      setTwofaStatus('done');
    } catch {
      setTwofaStatus('error');
      setTwofaError(t.twofaError);
    }
  };

  const reset = useCallback(() => {
    setFile(null);
    setFiles([]);
    setBatchLiveItems([]);
    setStatus('idle');
    setProgress(0);
    setPipelineStage(null);
    setDownloadUrlSafe(null);
    setDownloadFileName('');
    setEtaSeconds(null);
    setSmartSuggestion(null);
    setErrorInfo(null);
    setAssistantState('idle');
    setAssistantInsights([]);
    setAssistantActions([]);
    setAssistantNotice('');
    setAssistantEntry('');
    setAssistantMeta({ insight: '', structure: '', quality: '', sizeReduction: null });
    setAssistantSuggestions({ edit: '', web: '', small: '' });
    setAssistantLearningHint('');
    setAssistantAutomationHint('');
    setAssistantExplanations([]);
    setAssistantPredictiveActions([]);
    setAssistantWorkflow([]);
    setAssistantContextSummary(null);
    setAiMode('balanced');
    setAiPriority('quality');
    setAiTargetFormat('auto');
    setAiAssistantPrompt('');
    setAiAssistantStage('idle');
    setAiAssistantError('');
    setAiAssistantIntent(null);
    setQuickLookOpen(false);
    setQuickLookLoading(false);
    setQuickLookError('');
    setQuickLookType('other');
    setQuickLookText('');
    setShareHint('');
    setShareLink('');
    setIsShareLinkCreating(false);
    setMediaDurationSec(null);
    setMediaDurationLoading(false);
    setPrivacyDeleteAfter(false);
    setAssistantExecutionLog([]);
    clearAssistantTimer();
  }, [clearAssistantTimer, setDownloadUrlSafe]);


  const selectTool = useCallback((toolId) => {
    setActiveTab(toolId);
    reset();
  }, [reset]);

  const recordToolOpen = useCallback((toolId) => {
    setToolOpenCounts((prev) => {
      const next = {
        ...prev,
        [toolId]: Number(prev[toolId] || 0) + 1
      };
      writeToolOpenCounts(next);
      return next;
    });
  }, []);

  const openToolRoute = useCallback((toolId, { autoPick = false, source = 'browse' } = {}) => {
    const canonicalToolId = toolIds.has(toolId) ? toolId : (LEGACY_TOOL_ID_TO_CANONICAL[toolId] || toolId);
    const slug = TOOL_SLUG_BY_ID[toolId] || TOOL_SLUG_BY_ID[canonicalToolId] || canonicalToolId;
    const targetPath = `/convert/${slug}`;
    if (toolIds.has(canonicalToolId)) {
      recordToolOpen(canonicalToolId);
      track('tool_open', {
        tool_id: canonicalToolId,
        source: String(source || 'browse').trim().toLowerCase() || 'browse',
        auto_pick: Boolean(autoPick)
      });
    }
    trackedToolOpenPathRef.current = `${targetPath}|${canonicalToolId}`;
    selectTool(canonicalToolId);
    navigate(targetPath);
    if (autoPick) setPendingOpenToolId(canonicalToolId);
  }, [navigate, recordToolOpen, selectTool, toolIds, track]);

  const createAssistantAutomationWorkflow = useCallback(async () => {
    if (!user?.uid) {
      setShowAuthModal(true);
      setAssistantNotice('Войди в аккаунт, чтобы создать workflow.');
      return;
    }
    const prompt = String(
      assistantEntry
      || assistantAutomationHint
      || assistantContextSummary?.intent_prediction
      || `Convert ${file?.name || 'file'}`
    ).trim();
    if (!prompt) {
      setAssistantNotice('Не удалось определить цель workflow.');
      return;
    }
    setAccountWorkflowPrompt(prompt);
    const payload = await generateWorkflowWithAi({ save: true });
    if (!payload) {
      setAssistantNotice('AI не смог создать workflow.');
      return;
    }
    setAccountSection('pipelines');
    navigate('/account');
    setAssistantNotice('Workflow создан и сохранен в разделе Pipelines.');
    appendAssistantLog('AI: workflow создан через generator API');
  }, [
    assistantAutomationHint,
    assistantContextSummary?.intent_prediction,
    assistantEntry,
    appendAssistantLog,
    file?.name,
    generateWorkflowWithAi,
    navigate,
    user?.uid
  ]);

  const handleAssistantAction = useCallback((action) => {
    if (!action) return;
    const ext = normalizeFormatToken(String(file?.name || '').split('.').pop() || '');
    const register = (targetFormat = aiTargetFormat) => {
      registerAssistantFeedback({
        ext,
        intent: assistantContextSummary?.intent_prediction || 'convert',
        actionKind: action.kind,
        targetFormat
      });
    };
    if (action.kind === 'convert') {
      if (action.toolId) {
        openToolRoute(action.toolId, { autoPick: true, source: 'assistant' });
        setAssistantNotice('');
        register(aiTargetFormat);
        appendAssistantLog(`AI: выбран convert -> ${String(aiTargetFormat || 'auto').toUpperCase()}`);
      } else {
        setAssistantNotice(t.assistantNoticeUnavailable);
      }
      return;
    }

    if (action.kind === 'compress') {
      if (currentTool?.type === 'image') {
        setSettings((prev) => ({ ...prev, image: { ...prev.image, quality: 75 } }));
        setAssistantNotice(t.assistantNoticeApplied);
        register('jpg');
        appendAssistantLog('AI: применено сжатие изображения');
        return;
      }
      if (currentTool?.type === 'video') {
        setSettings((prev) => ({ ...prev, video: { ...prev.video, resolution: '720p', bitrate: '1200k' } }));
        setAssistantNotice(t.assistantNoticeApplied);
        register('mp4');
        appendAssistantLog('AI: применено сжатие видео');
        return;
      }
      if (currentTool?.type === 'audio') {
        setSettings((prev) => ({ ...prev, audio: { ...prev.audio, bitrate: '128k' } }));
        setAssistantNotice(t.assistantNoticeApplied);
        register('mp3');
        appendAssistantLog('AI: применено сжатие аудио');
        return;
      }
      setAssistantNotice(t.assistantNoticeUnavailable);
      return;
    }

    if (action.kind === 'optimize' || action.kind === 'prepare') {
      if (currentTool?.type === 'image') {
        setSettings((prev) => ({ ...prev, image: { ...prev.image, quality: 82 } }));
        setAssistantNotice(t.assistantNoticeApplied);
        appendAssistantLog('AI: применена web-оптимизация изображения');
        return;
      }
      if (currentTool?.type === 'video') {
        setSettings((prev) => ({ ...prev, video: { ...prev.video, resolution: '1080p' } }));
        setAssistantNotice(t.assistantNoticeApplied);
        appendAssistantLog('AI: применена web-оптимизация видео');
        return;
      }
      setAssistantNotice(t.assistantNoticeUnavailable);
      return;
    }

    if (action.kind === 'automation') {
      void createAssistantAutomationWorkflow();
      register(aiTargetFormat);
      appendAssistantLog('AI: инициирован automation pipeline');
      return;
    }

    if (action.kind === 'share') {
      if (!downloadUrl) {
        setAssistantNotice('Сначала запусти конвертацию и получи результат.');
        return;
      }
      const link = isLocalDownloadUrl(downloadUrl) ? window.location.href : downloadUrl;
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(link)
          .then(() => setAssistantNotice('Ссылка скопирована в буфер.'))
          .catch(() => setAssistantNotice('Не удалось скопировать ссылку.'));
      } else {
        setAssistantNotice('Копирование не поддерживается в этом браузере.');
      }
      appendAssistantLog('AI: выполнено действие share');
    }
  }, [
    aiTargetFormat,
    appendAssistantLog,
    assistantContextSummary?.intent_prediction,
    createAssistantAutomationWorkflow,
    currentTool?.type,
    downloadUrl,
    file?.name,
    openToolRoute,
    t
  ]);

  const submitFormatSearch = (source = 'enter') => {
    const query = searchTerm.trim();
    if (!query) return false;

    const parsed = parseFormatQuery(query);
    const matches = parsed
      ? tools.filter((tool) => (
          tool.fromFormats.includes(parsed.from) &&
          tool.toFormats.includes(parsed.to)
        ))
      : [];

    track('tool_search', {
      source,
      query,
      parsed: Boolean(parsed),
      from: parsed?.from || null,
      to: parsed?.to || null,
      matches: matches.length,
      redirectTool: matches.length === 1 ? matches[0].id : null
    });

    if (matches.length === 1) {
      openToolRoute(matches[0].id, { autoPick: true, source: 'search' });
      return true;
    }
    if (parsed) {
      setActiveCategory('all');
      setShowAllFormats(true);
    }
    return false;
  };

  const handleProcess = async ({ toolId: preferredToolId = '', initialStage = '' } = {}) => {
    if (!file && files.length === 0) {
      scrollToConverter();
      openFilePicker();
      return { ok: false, code: 'MISSING_FILE', message: t.labelDropHere };
    }
    if (status === 'processing') {
      return { ok: false, code: 'PROCESSING_IN_PROGRESS', message: t.processing };
    }
    const normalizedToolId = String(preferredToolId || '').trim();
    const targetToolId = toolIds.has(normalizedToolId) ? normalizedToolId : activeTab;
    if (!toolIds.has(targetToolId)) {
      return { ok: false, code: 'INVALID_TOOL', message: 'Selected conversion tool is unavailable.' };
    }

    setShareHint('');
    setShareLink('');
    setStatus('processing');
    setProgress(5);
    setPipelineStage(String(initialStage || '').trim() || stageLabels.validate);
    setErrorInfo(null);
    setDownloadUrlSafe(null);
    setDownloadFileName('');
    setEtaSeconds(null);
    appendAssistantLog('Pipeline: старт обработки');

    const selectedFiles = Array.isArray(files) && files.length
      ? files
      : (file ? [file] : []);
    const isBatchRun = batchMode || selectedFiles.length > 1;
    const uploadFiles = isBatchRun ? selectedFiles : (selectedFiles[0] ? [selectedFiles[0]] : []);
    const initialBatchItems = buildBatchLiveItems(uploadFiles);
    if (uploadFiles.length > 1) {
      setBatchLiveItems(updateBatchLiveByOverallProgress(initialBatchItems, 5, 'processing'));
    } else {
      setBatchLiveItems(initialBatchItems);
    }
    setQuickLookOpen(false);
    setQuickLookError('');
    setQuickLookText('');
    setQuickLookType('other');
    const authHeaders = buildAuthHeaders();
    let encryptionKey = null;
    let createdJobId = null;
    const emitJobEvent = async (stage, progressValue) => {
      if (!createdJobId) return;
      try {
        await fetch(`${API_BASE}/job-events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'job_stage',
            type: 'job_stage',
            job_id: createdJobId,
            stage,
            progress: progressValue
          })
        });
      } catch {
        // ignore
      }
    };

    jobStartRef.current = Date.now();
    track('job_start', { tool: targetToolId, batch: isBatchRun, count: uploadFiles.length });

    try {
      const settingsForRun = (() => {
        const next = {
          ...settings,
          image: { ...(settings.image || {}) },
          video: { ...(settings.video || {}) },
          audio: { ...(settings.audio || {}) },
          privacy: { ...(settings.privacy || {}) }
        };
        const mediaType = String(currentTool?.type || '').trim().toLowerCase();
        if (mediaType === 'audio' || mediaType === 'video') {
          const bucketKey = mediaType === 'video' ? 'video' : 'audio';
          const bucket = { ...(next[bucketKey] || {}) };
          const duration = Math.max(1, Number(mediaDurationSec || 0));
          const start = clamp(toFiniteNumber(bucket.trimStart, 0), 0, duration || 0);
          const fallbackEnd = duration || Math.max(start, toFiniteNumber(bucket.trimEnd, 0));
          const end = clamp(toFiniteNumber(bucket.trimEnd, fallbackEnd), start, fallbackEnd || start);
          bucket.trimStart = String(start);
          bucket.trimEnd = String(end);
          bucket.startTime = String(start);
          bucket.endTime = String(end);
          if (bucketKey === 'audio') {
            bucket.trimDuration = String(Math.max(0, end - start));
          }
          next[bucketKey] = bucket;
        }
        return next;
      })();

      const result = await runConversion({
        toolId: targetToolId,
        files: uploadFiles,
        batchMode: isBatchRun,
        settings: settingsForRun,
        apiBase: API_BASE,
        authHeaders,
        encryptionEnabled: CLIENT_ENCRYPTION_ENABLED,
        stageLabels,
        hooks: {
          onStage: (stage) => {
            setPipelineStage(stage.label);
            appendAssistantLog(`Pipeline: ${stage.label}`);
            void emitJobEvent(stage.name || stage.label, progress);
          },
          onProgress: (value) => {
            const nextValue = clampProgress(value);
            setProgress((prev) => {
              const next = Math.min(100, Math.max(prev, nextValue || 0));
              if (uploadFiles.length > 1) {
                setBatchLiveItems((items) => updateBatchLiveByOverallProgress(
                  items.length ? items : initialBatchItems,
                  next,
                  'processing'
                ));
              }
              return next;
            });
          },
          onEta: (value) => setEtaSeconds(value),
          onStatus: () => {},
          onJobCreated: ({ jobId, encryption }) => {
            createdJobId = jobId;
            appendAssistantLog(`Job created: ${jobId}`);
            setLastJobId(jobId);
            setRecentJobs((jobs) => [{ id: jobId, tool: targetToolId, ts: Date.now(), status: 'processing' }, ...jobs].slice(0, 12));
            encryptionKey = encryption?.key || null;
            if (encryptionKey) encryptionContextRef.current.set(jobId, { key: encryptionKey, meta: null });
          },
          onJobUpdate: (job) => {
            if (!createdJobId) return;
            if (job.status === 'verifying') setPipelineStage(stageLabels.verify);
            appendAssistantLog(`Job status: ${job.status}`);
            if (job.outputMeta && encryptionKey) {
              encryptionContextRef.current.set(createdJobId, { key: encryptionKey, meta: job.outputMeta });
            }
            if (uploadFiles.length > 1) {
              setBatchLiveItems((items) => {
                const seeded = items.length ? items : initialBatchItems;
                const withSse = updateBatchLiveBySsePayload(seeded, job);
                const state = String(job?.status || '').trim().toLowerCase();
                if (state === 'completed') {
                  return updateBatchLiveByOverallProgress(withSse, 100, 'done');
                }
                if (state === 'failed' || state === 'expired') {
                  return updateBatchLiveByOverallProgress(withSse, clampProgress(job?.progress || progress), 'error');
                }
                if (job?.progress !== undefined && job?.progress !== null) {
                  return updateBatchLiveByOverallProgress(withSse, clampProgress(job.progress), 'processing');
                }
                return withSse;
              });
            }
          },
          onComplete: () => {}
        },
        emitEvent: track
      });

      if (result?.jobId) {
        setLastJobId(result.jobId);
        if (result.encryption?.key) {
          encryptionContextRef.current.set(result.jobId, { key: result.encryption.key, meta: result.outputMeta || null });
        }
      }

      const resolvedDownloadUrl = result.downloadUrl || null;
      setDownloadUrlSafe(resolvedDownloadUrl);
      setDownloadFileName(
        String(result?.outputMeta?.outputName || '').trim() ||
        extractLocalNameFromUrl(resolvedDownloadUrl) ||
        ''
      );
      setStatus('done');
      setProgress(100);
      if (uploadFiles.length > 1) {
        setBatchLiveItems((items) => updateBatchLiveByOverallProgress(
          items.length ? items : initialBatchItems,
          100,
          'done'
        ));
      }
      setPipelineStage(stageLabels.cleanup);
      setEtaSeconds(null);
      appendAssistantLog('Pipeline: завершено успешно');
      track('job_complete', { tool: targetToolId, jobId: result.jobId, success: true });
      return { ok: true, jobId: result.jobId || createdJobId || null, toolId: targetToolId };
    } catch (e) {
      let errorObj = e;
      const recoverableCodes = new Set(['JOB_STATUS_FETCH', 'NETWORK_ERROR', 'TIMEOUT', 'QUEUE_UNAVAILABLE', 'VERIFY_FAILED']);
      if (createdJobId && recoverableCodes.has(errorObj?.code)) {
        const recovered = await recoverCompletedJob(createdJobId, authHeaders);
        if (recovered?.status === 'completed') {
          if (recovered.outputMeta && encryptionKey) {
            encryptionContextRef.current.set(createdJobId, { key: encryptionKey, meta: recovered.outputMeta });
          }
          const recoveredDownloadUrl = recovered.downloadUrl || recovered.outputUrl || null;
          setDownloadUrlSafe(recoveredDownloadUrl);
          setDownloadFileName(
            String(recovered?.outputMeta?.outputName || '').trim() ||
            extractLocalNameFromUrl(recoveredDownloadUrl) ||
            ''
          );
          setStatus('done');
          setProgress(100);
          if (uploadFiles.length > 1) {
            setBatchLiveItems((items) => updateBatchLiveByOverallProgress(
              items.length ? items : initialBatchItems,
              100,
              'done'
            ));
          }
          setPipelineStage(stageLabels.cleanup);
          setEtaSeconds(null);
          appendAssistantLog('Pipeline: восстановлено после сети, успешно завершено');
          track('job_complete', { tool: targetToolId, jobId: createdJobId, success: true, recovered: true });
          return { ok: true, jobId: createdJobId, toolId: targetToolId, recovered: true };
        }
        if (recovered?.status === 'failed') {
          errorObj = { ...errorObj, code: 'CONVERSION_FAILED', message: recovered.error?.message || errorObj?.message };
        } else if (recovered?.status === 'expired') {
          errorObj = { ...errorObj, code: 'CONVERSION_EXPIRED', message: 'Job expired.' };
        }
      }
      const errorMessages = {
        FILE_TOO_LARGE: t.errorFileTooLarge,
        UNSUPPORTED_FORMAT: t.errorUnsupportedFormat,
        BATCH_LIMIT: t.errorBatchLimit,
        SESSION_CREATE_FAILED: t.errorSessionCreate,
        WORKER_KEY_MISSING: t.errorWorkerKeyMissing,
        UPLOAD_SIGN_FAILED: t.errorUploadUrl,
        UPLOAD_FAILED: t.errorUploadFailed,
        UPLOAD_PROXY_FAILED: t.errorUploadFailed,
        JOB_CREATE_FAILED: t.errorStartJob,
        JOB_STATUS_FETCH: t.errorFetchStatus,
        QUEUE_UNAVAILABLE: null,
        RATE_LIMIT: 'Слишком много запросов. Попробуйте позже.',
        RATE_LIMIT_HOURLY: 'Достигнут лимит: максимум 10 конвертаций в час.',
        NETWORK_ERROR: t.errorFetchStatus,
        VERIFY_FAILED: t.errorVerificationFailed,
        CONVERSION_FAILED: t.errorConversionFailed,
        CONVERSION_EXPIRED: t.errorConversionFailed,
        TIMEOUT: t.errorTimeout
      };
      setStatus('error');
      if (uploadFiles.length > 1) {
        setBatchLiveItems((items) => updateBatchLiveByOverallProgress(
          items.length ? items : initialBatchItems,
          clampProgress(progress || 0),
          'error'
        ));
      }
      setPipelineStage(null);
      setEtaSeconds(null);
      appendAssistantLog(`Pipeline: ошибка (${errorObj?.code || 'unknown'})`);
      const queueUnavailableMessage = errorObj?.message || 'Queue is temporarily unavailable. Please try again in a few minutes.';
      const userMessage = errorObj?.code === 'CONVERSION_FAILED'
        ? (errorObj.message || t.errorConversionFailed)
        : errorObj?.code === 'QUEUE_UNAVAILABLE'
          ? queueUnavailableMessage
        : (errorMessages[errorObj?.code] || errorObj?.message || t.errorConversionFailedRetry);
      setErrorInfo(userMessage);
      if (errorObj?.code === 'FILE_TOO_LARGE') {
        showToast('Файл превышает лимит 50 MB. Загрузите более легкий файл.', 'error', 6200);
      } else if (errorObj?.code === 'RATE_LIMIT' || errorObj?.code === 'RATE_LIMIT_HOURLY') {
        showToast('Достигнут лимит конвертаций. Попробуйте позже.', 'error', 6200);
      } else if (errorObj?.code === 'BATCH_LIMIT') {
        showToast('Пакет превышает допустимые лимиты.', 'error', 6200);
      }
      track('job_complete', { tool: targetToolId, jobId: createdJobId, success: false, error: errorObj?.code || errorObj?.message });
      return { ok: false, code: errorObj?.code || 'CONVERSION_FAILED', message: userMessage, toolId: targetToolId };
    }
  };

  const resolveAiIntentRoute = useCallback((intentPayload, selectedFile, promptText) => {
    const intent = intentPayload && typeof intentPayload === 'object' ? intentPayload : {};
    const fileExt = normalizeFormatToken(String(selectedFile?.name || '').split('.').pop());
    const parsedFallback = parseFormatQuery(promptText);
    const fromCandidates = [
      normalizeFormatToken(intent.from),
      normalizeFormatToken(parsedFallback?.from),
      fileExt
    ].filter(Boolean);
    const toCandidates = [
      normalizeFormatToken(intent.to),
      normalizeFormatToken(parsedFallback?.to)
    ].filter(Boolean);

    for (const from of fromCandidates) {
      for (const to of toCandidates) {
        const resolvedTool = resolveToolByFormats(from, to);
        const resolvedToolId = typeof resolvedTool === 'string'
          ? resolvedTool
          : String(resolvedTool?.id || '').trim();
        if (resolvedToolId) {
          return { toolId: resolvedToolId, from, to };
        }
      }
    }

    const hintedTool = String(intent.tool || intent.toolId || intent.tool_id || '').trim();
    if (hintedTool && toolIds.has(hintedTool)) {
      const toolMeta = tools.find((tool) => tool.id === hintedTool) || null;
      return {
        toolId: hintedTool,
        from: normalizeFormatToken(intent.from) || toolMeta?.fromFormats?.[0] || fileExt || null,
        to: normalizeFormatToken(intent.to) || toolMeta?.toFormats?.[0] || null
      };
    }

    return null;
  }, [resolveToolByFormats, toolIds, tools]);

  const handleAiAssistantSubmit = async () => {
    const promptText = String(aiAssistantPrompt || '').trim();
    const selectedAiFile = files[0] || file || null;
    if (!promptText) {
      setAiAssistantError('Введите запрос для ассистента.');
      return;
    }
    if (!selectedAiFile) {
      setAiAssistantError('Сначала загрузите файл.');
      return;
    }

    setAiAssistantError('');
    setAiAssistantIntent(null);
    setAiAssistantStage('analyzing');
    appendAssistantLog('AI: ИИ анализирует запрос...');

    try {
      let parsedIntent = null;
      try {
        const response = await fetch(`${API_BASE}/ai/parse-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: promptText })
        });
        const payload = await response.json().catch(() => null);
        if (response.ok) {
          parsedIntent = payload?.intent || null;
          if (payload?.providerWarning) {
            appendAssistantLog(`AI: провайдер вернул предупреждение (${payload.providerWarning}), применяем fallback-роутинг`);
          }
        } else {
          appendAssistantLog(`AI: провайдер недоступен (${payload?.message || response.status}), применяем fallback-роутинг`);
        }
      } catch (providerError) {
        appendAssistantLog(`AI: провайдер недоступен (${String(providerError?.message || 'network_error')}), применяем fallback-роутинг`);
      }

      const route = resolveAiIntentRoute(parsedIntent, selectedAiFile, promptText);
      if (!route?.toolId) {
        throw new Error('Не удалось определить поддерживаемую пару форматов. Уточните запрос.');
      }

      setAiAssistantIntent({ from: route.from || null, to: route.to || null, toolId: route.toolId });
      setActiveTab(route.toolId);
      setAiAssistantStage('converting');
      appendAssistantLog(`AI: маршрут ${route.from || 'unknown'} -> ${route.to || 'unknown'}, tool=${route.toolId}`);

      const conversionResult = await handleProcess({
        toolId: route.toolId,
        initialStage: 'Конвертируем файл...'
      });
      if (!conversionResult?.ok) {
        throw new Error(conversionResult?.message || 'Конвертация не удалась.');
      }
    } catch (error) {
      setAiAssistantError(String(error?.message || 'Не удалось выполнить AI-конвертацию.'));
      appendAssistantLog(`AI: ошибка ${String(error?.message || 'unknown')}`);
    } finally {
      setAiAssistantStage('idle');
    }
  };

  const handleBestAutoConvert = () => {
    const preferred = assistantActions.find((action) => action.kind === 'convert' && action.toolId)
      || assistantActions.find((action) => action.toolId);
    if (preferred) {
      handleAssistantAction(preferred);
      return;
    }
    if (smartSuggestion && smartSuggestion !== activeTab) {
      openToolRoute(smartSuggestion, { autoPick: true, source: 'smart_recommendation' });
      return;
    }
    handleProcess();
  };

  const stripImageMetadata = useCallback(async (inputBlob, fileNameHint) => {
    const blob = inputBlob instanceof Blob ? inputBlob : null;
    if (!blob) return inputBlob;
    const ext = getExtensionFromValue(fileNameHint || '');
    const mime = String(blob.type || '').toLowerCase();
    const isJpeg = ext === 'jpg' || ext === 'jpeg' || mime.includes('jpeg');
    if (isJpeg) {
      try {
        const piexifModule = await import('piexifjs');
        const piexif = piexifModule?.default || piexifModule;
        if (typeof piexif?.remove === 'function') {
          const dataUrl = await blobToDataUrl(blob);
          const cleanedDataUrl = piexif.remove(dataUrl);
          const cleanedBlob = dataUrlToBlob(cleanedDataUrl);
          if (cleanedBlob) {
            return new Blob([await cleanedBlob.arrayBuffer()], { type: 'image/jpeg' });
          }
        }
      } catch {
        // fallback to canvas path below
      }
    }

    try {
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas_ctx_unavailable');
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      const targetType = mime.startsWith('image/') ? mime : 'image/png';
      const reEncoded = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (nextBlob) => (nextBlob ? resolve(nextBlob) : reject(new Error('canvas_to_blob_failed'))),
          targetType,
          isJpeg ? 0.95 : undefined
        );
      });
      return reEncoded instanceof Blob ? reEncoded : blob;
    } catch {
      return blob;
    }
  }, []);

  const download = async () => {
    if (!downloadUrl) return;
    const context = lastJobId ? encryptionContextRef.current.get(lastJobId) : null;
    const fileName = (() => {
      const explicit = String(downloadFileName || '').trim();
      if (explicit) return explicit;
      const localName = extractLocalNameFromUrl(downloadUrl);
      if (localName) return localName;
      try {
        const u = new URL(downloadUrl);
        const parts = u.pathname.split('/');
        const last = parts[parts.length - 1] || '';
        if (!last) return `converted_${Date.now()}`;
        try {
          return decodeURIComponent(last);
        } catch {
          return last;
        }
      } catch {
        return `converted_${Date.now()}`;
      }
    })();

    const isImageOutput = getPreviewType(getExtensionFromValue(fileName || downloadUrl)) === 'image';
    const shouldStripExif = Boolean(settings?.image?.stripExif) && isImageOutput;
    if ((!context || !context.meta) && !shouldStripExif) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      a.click();
      return;
    }

    try {
      let blob = null;
      if (context && context.meta) {
        const encryptedResponse = await fetch(downloadUrl);
        const encryptedBuffer = await encryptedResponse.arrayBuffer();
        blob = await decryptFileGcm(encryptedBuffer, context.meta, context.key);
      } else {
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error(`download_failed_${response.status}`);
        blob = await response.blob();
      }

      if (shouldStripExif) {
        blob = await stripImageMetadata(blob, fileName);
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName.replace(/\.enc$/, '');
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErrorInfo(t.errorDecryptionFailed);
    }
  };

  const openQuickLook = useCallback(async () => {
    if (!quickLookConfig.canOpen || !quickLookConfig.previewUrl) {
      showToast('Предпросмотр недоступен для этого формата.', 'info');
      return;
    }
    setQuickLookOpen(true);
    setQuickLookType(quickLookConfig.type || 'other');
    setQuickLookError('');
    setQuickLookText('');
    if (quickLookConfig.type !== 'text') {
      setQuickLookLoading(false);
      return;
    }

    setQuickLookLoading(true);
    try {
      const context = lastJobId ? encryptionContextRef.current.get(lastJobId) : null;
      if (context?.meta && context?.key) {
        const encryptedResponse = await fetch(quickLookConfig.previewUrl);
        if (!encryptedResponse.ok) {
          throw new Error(`preview_fetch_failed_${encryptedResponse.status}`);
        }
        const encryptedBuffer = await encryptedResponse.arrayBuffer();
        const decryptedBlob = await decryptFileGcm(encryptedBuffer, context.meta, context.key);
        const textValue = await decryptedBlob.text();
        setQuickLookText(textValue.slice(0, 250000));
      } else {
        const textResponse = await fetch(quickLookConfig.previewUrl);
        if (!textResponse.ok) {
          throw new Error(`preview_fetch_failed_${textResponse.status}`);
        }
        const textValue = await textResponse.text();
        setQuickLookText(textValue.slice(0, 250000));
      }
    } catch {
      setQuickLookError('Не удалось загрузить предпросмотр файла.');
    } finally {
      setQuickLookLoading(false);
    }
  }, [lastJobId, quickLookConfig, showToast]);
  const handleCreateShareLink = async () => {
    if (!downloadUrl) return;
    setShareHint('');
    setShareLink('');
    setIsShareLinkCreating(true);
    try {
      let res = null;
      if (isLocalDownloadUrl(downloadUrl)) {
        const blobResponse = await fetch(downloadUrl);
        if (!blobResponse.ok) {
          throw new Error(`local_blob_fetch_failed_${blobResponse.status}`);
        }
        const localBlob = await blobResponse.blob();
        const fallbackExt = getExtensionFromValue(downloadFileName || downloadUrl) || 'bin';
        const fallbackName = `megaconvert-result-${Date.now()}.${fallbackExt}`;
        const safeName = String(downloadFileName || fallbackName).trim() || fallbackName;
        const uploadFile = new File([localBlob], safeName, {
          type: localBlob.type || 'application/octet-stream'
        });
        const form = new FormData();
        form.append('file', uploadFile);
        form.append('expires_preset', 'one_day');
        res = await fetch(`${API_BASE}/share`, {
          method: 'POST',
          body: form
        });
      } else {
        res = await fetch(`${API_BASE}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_url: downloadUrl,
            expires_preset: 'one_day'
          })
        });
      }
      if (!res.ok) {
        let details = null;
        try {
          details = await res.json();
        } catch {
          details = null;
        }
        throw new Error(String(details?.message || `share_create_failed_${res.status}`));
      }
      const payload = await res.json();
      const token = String(payload?.token || '').trim();
      const link = String(payload?.share_url || (token ? `${window.location.origin}/s/${token}` : '')).trim();
      if (!link) {
        throw new Error('share_link_missing');
      }
      setShareLink(link);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        setShareHint('Публичная ссылка на 24 часа скопирована в буфер.');
        showToast('Ссылка на 24 часа скопирована в буфер.', 'success', 3600);
      } else {
        setShareHint('Публичная ссылка на 24 часа создана.');
        showToast('Ссылка на 24 часа создана.', 'success', 3600);
      }
    } catch {
      setShareHint('Не удалось создать ссылку. Попробуйте снова.');
      showToast('Не удалось создать ссылку.', 'error', 4000);
    } finally {
      setIsShareLinkCreating(false);
    }
  };
  const isHome = path === '/' || path === '';
  const isTools = path === '/tools';
  const isLocalConverterTool = path === '/tools/local-converter' || path === '/tools/local-converter/';
  const isOcrTool = path === '/tools/ocr' || path === '/tools/ocr/';
  const isPdfEditorTool = path === '/tools/pdf-editor' || path === '/tools/pdf-editor/';
  const isImageCompressorTool = path === '/tools/image-compressor' || path === '/tools/image-compressor/';
  const isBatchWatermarkTool = path === '/tools/batch-watermark' || path === '/tools/batch-watermark/';
  const isApi = path === '/api' || path === '/docs';
  const isPricing = path === '/pricing';
  const isSecurity = path === '/security';
  const isStatus = path === '/status';
  const isReliability = path === '/reliability' || path === '/sla';
  const isTeamDevelopers = path === '/developers';
  const isDevelopers = path === '/developer-portal';
  const isRoadmap = path === '/roadmap';
  const isChangelog = path === '/changelog';
  const isArchitecture = path === '/architecture';
  const isLogin = path === '/login';
  const isDashboard = path === '/dashboard';
  const isAccount = path === '/account' || path === '/settings/billing';
  const isBlog = path === '/blog' || path === '/blog/';
  const isBlogArticle = path.startsWith('/blog/') && path !== '/blog/';
  const isGuides = path === '/guides' || path === '/guides/';
  const isGuidesArticle = path.startsWith('/guides/') && path !== '/guides/';
  const blogSlug = isBlogArticle
    ? decodeURIComponent(path.replace('/blog/', '').replace(/\/+$/, ''))
    : '';
  const guideSlug = isGuidesArticle
    ? decodeURIComponent(path.replace('/guides/', '').replace(/\/+$/, ''))
    : '';
  const currentBlogPost = blogSlug
    ? blogPosts.find((post) => post.slug === blogSlug) || null
    : null;
  const currentGuidePost = guideSlug
    ? blogPosts.find((post) => post.slug === guideSlug) || null
    : null;
  const isFaq = path === '/faq';
  const isPrivacy = path === '/privacy';
  const isTerms = path === '/terms';
  const isLegal = path === '/legal';
  const isCookiePolicy = path === '/cookie-policy';
  const isDisclaimer = path === '/disclaimer';
  const isAbout = path === '/about';
  const isMission = path === '/mission';
  const isCareers = path === '/careers';
  const isPress = path === '/press' || path === '/press-kit';
  const isResources = path === '/resources';
  const isBugBounty = path === '/bug-bounty';
  const isSecurityWhitepaper = path === '/security-whitepaper';
  const isContact = path === '/contact';
  const isAdmin = path === '/admin' || path.startsWith('/admin/');
  const isWorkspaceV3 = path === '/workspace' || path.startsWith('/workspace/');
  const isAiPage = path === '/ai' || path === '/ai/';
  const isConvertRoot = path === '/convert' || path === '/convert/';
  const directConversionSlug = decodeURIComponent(path.replace(/^\/+|\/+$/g, ''));
  const isDirectConversionRoute = Boolean(
    directConversionSlug &&
    !directConversionSlug.includes('/') &&
    getConversionBySlug(directConversionSlug)
  );
  const isConvert = (path.startsWith('/convert/') && !isConvertRoot) || isDirectConversionRoute;
  const isShare = path.startsWith('/s/');
  const isNotFound = !isHome && !isTools && !isLocalConverterTool && !isOcrTool && !isPdfEditorTool && !isImageCompressorTool && !isBatchWatermarkTool && !isApi && !isPricing && !isSecurity && !isStatus && !isReliability && !isDevelopers && !isTeamDevelopers && !isRoadmap && !isChangelog && !isArchitecture && !isLogin && !isDashboard && !isAccount && !isBlog && !isGuides && !currentBlogPost && !currentGuidePost && !isFaq && !isPrivacy && !isTerms && !isLegal && !isCookiePolicy && !isDisclaimer && !isAbout && !isMission && !isCareers && !isPress && !isResources && !isBugBounty && !isSecurityWhitepaper && !isContact && !isAdmin && !isWorkspaceV3 && !isAiPage && !isConvert && !isConvertRoot && !isShare;
  const showMobileUploadBar = (isHome || isConvert || isConvertRoot) && !showAuthModal && !showTwofaModal;
  const saveDataMode = typeof navigator !== 'undefined' && navigator.connection?.saveData;

  const convertSlug = isConvert
    ? (path.startsWith('/convert/')
      ? path.replace('/convert/', '')
      : directConversionSlug)
    : '';
  const shareToken = isShare ? path.replace('/s/', '').replace(/\/+$/, '') : '';
  const conversionFromSlug = convertSlug ? getConversionBySlug(convertSlug) : null;
  const legacyToolIdFromSlug = convertSlug ? LEGACY_SLUG_TO_TOOL_ID[convertSlug] : null;
  const resolvedToolId = convertSlug && toolIds.has(convertSlug)
    ? convertSlug
    : (conversionFromSlug?.id || legacyToolIdFromSlug);
  const resolvedTool = tools.find((t) => t.id === resolvedToolId) || currentTool;
  const FREE_TIER_DAILY_LIMIT = 25;
  const todayDoneCount = recentJobs.filter((job) => {
    if (job.status !== 'done') return false;
    const ts = Number(job.ts || 0);
    if (!ts) return false;
    const d = new Date(ts);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }).length;
  const freeTierRemaining = Math.max(0, FREE_TIER_DAILY_LIMIT - todayDoneCount);
  const accountAccess = accountBilling?.access && typeof accountBilling.access === 'object'
    ? accountBilling.access
    : null;
  const isAccountBlocked = Boolean(user?.uid && accountAccess?.blocked);
  const blockedReason = String(accountAccess?.reason || '').trim();
  const blockedSince = accountAccess?.blocked_at || null;

  useEffect(() => {
    const aliasTarget = SEO_ROUTE_ALIASES[path];
    if (!aliasTarget || aliasTarget === path) return;
    window.history.replaceState({}, '', aliasTarget);
    setPath(aliasTarget);
  }, [path]);

  useEffect(() => {
    const localeAlternates = ['en', 'es', 'de'];
    const origin = window.location.origin;
    const defaultTitle = 'MegaConvert | Online File Converter';
    const defaultDescription = 'Convert files online with MegaConvert. Fast, secure, and reliable.';
    let title = defaultTitle;
    let description = defaultDescription;
    let canonicalPath = path || '/';

    if (isConvert && conversionFromSlug) {
      title = `${conversionFromSlug.from} to ${conversionFromSlug.to} Converter | MegaConvert`;
      description = `Convert ${conversionFromSlug.from} to ${conversionFromSlug.to} online in seconds. Fast, secure, and high-quality conversion.`;
      canonicalPath = `/convert/${conversionFromSlug.slug}`;
    } else if (isGuides) {
      title = 'Conversion Guides and Tutorials | MegaConvert';
      description = 'Practical guides for document, image, audio, and video conversion workflows.';
      canonicalPath = '/guides';
    } else if (isGuidesArticle && currentGuidePost) {
      title = `${currentGuidePost.title} | MegaConvert Guides`;
      description = currentGuidePost.excerpt || defaultDescription;
      canonicalPath = `/guides/${currentGuidePost.slug}`;
    } else if (isWorkspaceV3) {
      title = 'Workspace 3.0 | MegaConvert';
      description = 'Client-first workspace for local media conversion, OCR, PDF editing, and privacy tools.';
      canonicalPath = path;
    } else {
      const seoPageMap = {
        '/ai': ['AI Assistant | MegaConvert', 'Upload a file and describe the result you want in natural language.'],
        '/workspace': ['Workspace 3.0 | MegaConvert', 'Client-first modules for media, PDF, tools, and AI workflows.'],
        '/tools/local-converter': ['Локальная конвертация медиа | MegaConvert', 'Конвертируйте аудио и видео локально в браузере через FFmpeg WebAssembly без загрузки на сервер.'],
        '/tools/ocr': ['OCR распознавание текста | MegaConvert', 'Извлекайте текст из сканов и изображений прямо в браузере через Tesseract.js.'],
        '/tools/pdf-editor': ['PDF Editor | MegaConvert', 'Редактируйте порядок страниц, удаляйте лишнее и собирайте новый PDF прямо в браузере.'],
        '/tools/image-compressor': ['Image Compressor | MegaConvert', 'Интерактивно сжимайте изображения в браузере и сравнивайте качество на split-экране До/После.'],
        '/tools/batch-watermark': ['Batch Watermark | MegaConvert', 'Массовая обработка изображений: текстовый watermark, позиция и цвет с экспортом в ZIP архив.'],
        '/security': ['File Conversion Security | MegaConvert', 'Security architecture and data protection for conversion workflows.'],
        '/privacy': ['Privacy Policy | MegaConvert', 'How MegaConvert handles data, storage, and retention.'],
        '/about': ['About MegaConvert', 'Learn about MegaConvert and the platform mission.'],
        '/tools': ['Online File Converter Tools | MegaConvert', 'Browse document, image, video, audio, archive, and data conversion tools.'],
        '/developers': ['MegaConvert Team', 'Meet the MegaConvert engineering and product team.'],
        '/status': ['System Status | MegaConvert', 'Live operational status for API, worker, and storage services.'],
        '/reliability': ['Reliability and SLA | MegaConvert', 'Availability targets and reliability practices for MegaConvert.'],
        '/api': ['API Docs | MegaConvert', 'Developer API overview for automated file conversion workflows.']
      };
      if (seoPageMap[path]) {
        [title, description] = seoPageMap[path];
        canonicalPath = path;
      }
    }

    document.title = title;
    upsertSeoMeta('description', description);
    upsertSeoMeta('robots', 'index,follow,max-image-preview:large');
    upsertSeoProperty('og:title', title);
    upsertSeoProperty('og:description', description);
    upsertSeoProperty('og:type', 'website');
    upsertSeoProperty('og:url', `${origin}${canonicalPath}`);
    upsertSeoLink('canonical', `${origin}${canonicalPath}`);
    upsertSeoLink('alternate', `${origin}${canonicalPath}`, 'x-default');
    for (const locale of localeAlternates) {
      upsertSeoLink('alternate', `${origin}/${locale}${canonicalPath}`, locale);
    }
    upsertSeoJsonLd({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: title,
      applicationCategory: 'UtilityApplication',
      operatingSystem: 'Web',
      description
    });
  }, [conversionFromSlug, currentGuidePost, isConvert, isGuides, isGuidesArticle, isWorkspaceV3, path]);

  useEffect(() => {
    const activePost = isBlogArticle ? currentBlogPost : (isGuidesArticle ? currentGuidePost : null);
    if (!activePost?.slug) return;
    track('post_open', {
      tool_id: activePost.slug,
      post_id: activePost.id || null,
      source: isGuidesArticle ? 'guides' : 'blog'
    });
  }, [currentBlogPost, currentGuidePost, isBlogArticle, isGuidesArticle, track]);

  useEffect(() => {
    if (!isConvert || !resolvedToolId || !toolIds.has(resolvedToolId)) return;
    const key = `${path}|${resolvedToolId}`;
    if (trackedToolOpenPathRef.current !== key) {
      trackedToolOpenPathRef.current = key;
      track('tool_open', {
        tool_id: resolvedToolId,
        source: 'direct',
        auto_pick: false
      });
    }
    if (resolvedToolId !== activeTab) selectTool(resolvedToolId);
  }, [activeTab, isConvert, path, resolvedToolId, selectTool, toolIds, track]);



  const renderPricingPage = () => (
    <Page
      title={t.pagePricingTitle}
      subtitle={t.pagePricingSubtitle}
      actions={(
        <>
          <Button onClick={() => navigate('/')}>{t.btnStartConverting}</Button>
          <Button variant="secondary" onClick={() => navigate('/contact')}>{t.btnTalkToSales}</Button>
        </>
      )}
    >
      <div className="grid md:grid-cols-3 gap-6">
        <PageCard>
          <div className="text-sm uppercase tracking-widest text-slate-500">{t.planFreeName}</div>
          <div className="text-3xl font-bold mt-2">{t.planFreePrice}</div>
          <div className="text-slate-500 mt-2">{t.planFreeDesc}</div>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div>{t.planFreeFeature1}</div>
            <div>{t.planFreeFeature2}</div>
            <div>{t.planFreeFeature3}</div>
            <div>{t.planFreeFeature4}</div>
          </div>
          <Button className="mt-6 w-full" onClick={() => navigate('/')}>{t.btnGetStarted}</Button>
        </PageCard>
        <PageCard className="border-2 border-blue-500">
          <div className="text-sm uppercase tracking-widest text-blue-600">{t.planProName}</div>
          <div className="text-3xl font-bold mt-2">{t.planProPrice}</div>
          <div className="text-slate-500 mt-2">{t.planProDesc}</div>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div>{t.planProFeature1}</div>
            <div>{t.planProFeature2}</div>
            <div>{t.planProFeature3}</div>
            <div>{t.planProFeature4}</div>
          </div>
          <Button className="mt-6 w-full" variant="primary" onClick={() => navigate('/account')}>
            {t.btnUpgradePro}
          </Button>
        </PageCard>
        <PageCard>
          <div className="text-sm uppercase tracking-widest text-slate-500">{t.planTeamName}</div>
          <div className="text-3xl font-bold mt-2">{t.planTeamPrice}</div>
          <div className="text-slate-500 mt-2">{t.planTeamDesc}</div>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div>{t.planTeamFeature1}</div>
            <div>{t.planTeamFeature2}</div>
            <div>{t.planTeamFeature3}</div>
            <div>{t.planTeamFeature4}</div>
          </div>
          <Button className="mt-6 w-full" variant="secondary" onClick={() => navigate('/contact')}>{t.btnContactSales}</Button>
        </PageCard>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
        {t.pricingIndividualPromoOnlyNote}
      </div>

      <div className="mt-10 bg-white rounded-2xl border border-slate-200 overflow-hidden text-slate-900">
        <div className="grid grid-cols-4 gap-4 text-xs uppercase tracking-widest text-slate-500 px-6 py-3 border-b">
          <div>{t.pricingTableFeature}</div>
          <div>{t.planFreeName}</div>
          <div>{t.planProName}</div>
          <div>{t.planTeamName}</div>
        </div>
        <div className="divide-y text-sm">
          {[
            [t.pricingRowMaxFile, t.pricingValueFreeMax, t.pricingValueProMax, t.pricingValueTeamMax],
            [t.pricingRowSpeed, t.pricingValueStandard, t.pricingValuePriority, t.pricingValueDedicated],
            [t.pricingRowBatch, t.commonYes, t.commonYes, t.commonYes],
            [t.pricingRowApi, t.pricingValuePlanned, t.pricingValuePlanned, t.pricingValueIncluded],
            [t.pricingRowSupport, t.pricingValueCommunity, t.pricingValuePriority, t.pricingValueSla]
          ].map((row) => (
            <div key={row[0]} className="grid grid-cols-4 gap-4 px-6 py-4">
              <div className="font-medium text-slate-800">{row[0]}</div>
              <div className="text-slate-600">{row[1]}</div>
              <div className="text-slate-600">{row[2]}</div>
              <div className="text-slate-600">{row[3]}</div>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
  const renderConverterPanel = ({ compact = false } = {}) => {
    const steps = [t.stepUpload, t.stepSettings, t.stepConvert, t.stepProgress, t.stepResult];
    const stepIndex = status === 'processing' ? 3 : status === 'done' ? 4 : status === 'error' ? 3 : file ? 1 : 0;
    const dropzonePadding = compact ? 'p-8 md:p-10' : 'p-6';
    const smartTips = getSmartTips({
      fileType: currentTool?.type || 'other',
      status,
      queueDepth: status === 'processing' ? files.length : 0
    });

    if (compact) {
      return (
        <GlassCard className="p-6 md:p-8">
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-slate-500">Smart converter</div>
            <div className="text-2xl font-semibold mt-3 text-slate-100">{currentTool.name}</div>
            <div className="text-sm text-slate-400 mt-2">{currentTool.formats}</div>
          </div>

          <div className="flex flex-wrap gap-2 mt-5 justify-center">
            {[t.stepUpload, t.stepConvert, t.stepResult].map((step, index) => (
              <span
                key={step}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold ${index <= (status === 'done' ? 2 : status === 'processing' ? 1 : 0) ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
              >
                {step}
              </span>
            ))}
          </div>

          {status === 'idle' && (
            <div className="mt-6 space-y-4">
              <div
                className={`dropzone rounded-2xl border ${file ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300 bg-slate-50/80'} ${dropzonePadding} text-center ${isDragOver ? 'is-dragover' : ''}`}
                onDragEnter={() => setIsDragOver(true)}
                onDragLeave={() => setIsDragOver(false)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  handleFilesSelected(e.dataTransfer.files);
                }}
              >
                {file ? (
                  <div className="text-left">
                    <div className="text-xs uppercase tracking-widest text-slate-500">{t.labelSelected}</div>
                    <div className="text-lg font-semibold mt-2">{batchMode ? `${files.length} files` : file.name}</div>
                    <div className="text-sm text-slate-500 mt-1">
                      {(batchMode && files.length > 1
                        ? (files.reduce((sum, item) => sum + Number(item?.size || 0), 0) / (1024 * 1024))
                        : (Number(file?.size || 0) / (1024 * 1024))).toFixed(2)} MB
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={openFilePicker}>{t.btnReplaceFile}</Button>
                      <Button variant="outline" onClick={reset}>{t.btnClear}</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-700">
                      {currentTool.icon}
                    </div>
                    <div className="text-lg font-semibold mt-4">{t.labelDropHere}</div>
                    <div className="text-sm text-slate-500 mt-2">{t.labelDragDrop}</div>
                    <Button className="mt-4" variant="secondary" onClick={openFilePicker}>
                      {t.btnSelect}
                    </Button>
                  </>
                )}
              </div>
              {smartSuggestion && smartSuggestion !== activeTab && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs px-3 py-2 text-center">
                  {t.labelAutoDetected} {tools.find((item) => item.id === smartSuggestion)?.name || t.labelSuggested}
                </div>
              )}
              {file && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="large" onClick={handleProcess} data-testid="convert-button-compact">
                    {t.btnConvert}
                  </Button>
                  {featureFlags.one_click_best_convert && (
                    <Button variant="secondary" onClick={handleBestAutoConvert} data-testid="convert-best-button-compact">
                      Convert to best format
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {status === 'processing' && (
            <div className="text-center py-8">
              <div className="text-3xl font-semibold text-slate-900 mb-3">{Math.round(progress)}%</div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden progress-animated">
                <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="mt-3 text-sm text-slate-500">{pipelineStage || t.processing}</div>
              {etaSeconds !== null && <div className="mt-2 text-xs text-slate-500">{t.labelEtaPrefix} {etaSeconds}{t.labelSecondsShort}</div>}
              {files.length > 1 && (
                <div className="mt-5 text-left">
                  <DynamicBatchStack
                    items={batchLiveItems.length ? batchLiveItems : buildBatchLiveItems(files)}
                    overallProgress={progress}
                    status={status}
                  />
                </div>
              )}
            </div>
          )}

          {status === 'done' && (
            <div className="text-center py-8">
              <div className="success-pop w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">{t.done}</h3>
              <div className="text-sm text-slate-500 mb-6">{t.labelFileReady}</div>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button variant="secondary" onClick={reset}>{t.back}</Button>
                {canOpenQuickLook && (
                  <Button variant="outline" onClick={() => void openQuickLook()}>
                    <Eye size={16} /> Quick Look
                  </Button>
                )}
                <Button variant="primary" onClick={download}>{t.download}</Button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-8">
              <div className="error-pop w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                <X size={30} />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">{t.labelConversionFailed}</h3>
              <div className="text-sm text-slate-500 mb-6">{errorInfo || t.labelTryAgain}</div>
              <div className="flex gap-3 justify-center">
                <Button variant="secondary" onClick={reset}>{t.back}</Button>
                <Button variant="primary" onClick={handleProcess}>{t.btnRetry}</Button>
              </div>
            </div>
          )}
        </GlassCard>
      );
    }

    return (
      <GlassCard className={compact ? 'p-5 md:p-6' : ''}>
        <div className="tiny-only">
          <div className="text-xs uppercase tracking-widest text-slate-500">Минимальный режим</div>
          <div className="mt-2 text-sm text-slate-600">Загрузка, статус, скачивание.</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={openFilePicker}>{t.btnUploadFile}</Button>
            {status === 'processing' && <span className="text-xs text-slate-500">{t.processing}</span>}
            {status === 'done' && <Button variant="primary" onClick={download}>{t.download}</Button>}
          </div>
        </div>
        <div className="hide-on-tiny">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500">{t.labelConverter}</div>
            <div className="text-lg font-semibold mt-1">{currentTool.name}</div>
          </div>
          <Badge color="slate">{currentTool.formats}</Badge>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {steps.map((step, index) => (
            <span
              key={step}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold ${index <= stepIndex ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              {step}
            </span>
          ))}
        </div>

        <div className="mt-6">
          {status === 'idle' && (
            <div className="space-y-5">
              <div
                className={`dropzone rounded-2xl border ${file ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300 bg-slate-50/80'} ${dropzonePadding} text-center ${isDragOver ? 'is-dragover' : ''}`}
                onDragEnter={() => setIsDragOver(true)}
                onDragLeave={() => setIsDragOver(false)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  handleFilesSelected(e.dataTransfer.files);
                }}
              >
                {file ? (
                  <div className="text-left">
                    <div className="text-xs uppercase tracking-widest text-slate-500">{t.labelSelected}</div>
                    <div className="text-lg font-semibold mt-2" data-testid="selected-file-name">
                      {batchMode ? `${files.length} files` : file.name}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      {(batchMode && files.length > 1
                        ? (files.reduce((sum, item) => sum + Number(item?.size || 0), 0) / (1024 * 1024))
                        : (Number(file?.size || 0) / (1024 * 1024))).toFixed(2)} MB
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={openFilePicker}>{t.btnReplaceFile}</Button>
                      <Button variant="outline" onClick={reset}>{t.btnClear}</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-700">
                      {currentTool.icon}
                    </div>
                    <div className="text-lg font-semibold mt-4">{t.labelDropHere}</div>
                    <div className="text-sm text-slate-500 mt-2">{t.labelDragDrop}</div>
                    <Button className="mt-4" variant="secondary" onClick={openFilePicker}>
                      {t.btnSelect}
                    </Button>
                  </>
                )}
              </div>

              <label className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <input type="checkbox" checked={batchMode} onChange={(e) => setBatchMode(e.target.checked)} />
                <span>{t.batch}</span>
              </label>

              {batchMode && (
                <BatchUploader files={files} onFilesSelected={handleFilesSelected} />
              )}

              {(batchMode || files.length > 1) && files.length > 1 && (
                <DynamicBatchStack
                  items={batchLiveItems.length ? batchLiveItems : buildBatchLiveItems(files)}
                  overallProgress={progress}
                  status={status}
                />
              )}

              {smartSuggestion && smartSuggestion !== activeTab && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs px-3 py-2 flex flex-wrap items-center justify-center gap-2">
                  <span>{t.labelAutoDetected}</span>
                  <button
                    onClick={() => selectTool(smartSuggestion)}
                    className="px-3 py-1 rounded-full bg-white text-blue-700 border border-blue-200 font-semibold"
                  >
                    {tools.find((t) => t.id === smartSuggestion)?.name || t.labelSuggested}
                  </button>
                </div>
              )}

              {smartTips.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600 space-y-1">
                  {smartTips.map((tip) => (
                    <div key={tip}>• {tip}</div>
                  ))}
                </div>
              )}

              {file && featureFlags.smart_auto_convert && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-widest text-emerald-700">Smart Auto-Convert</div>
                  <div className="mt-1 text-sm font-semibold text-emerald-900">
                    Best format for your use case:
                    <span className="ml-1">
                      {assistantSuggestions.web || assistantSuggestions.edit || assistantSuggestions.small || 'Auto'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="small" onClick={handleBestAutoConvert} data-testid="convert-best-button">
                      Convert to best format
                    </Button>
                    <Button size="small" variant="secondary" onClick={() => navigate('/pricing')}>
                      Pro optimization
                    </Button>
                  </div>
                </div>
              )}

              {!isPro && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  Free tier limit: {todayDoneCount}/{FREE_TIER_DAILY_LIMIT} today.
                  <span className="ml-2 font-semibold">Remaining: {freeTierRemaining}</span>
                </div>
              )}

              {file && (
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="font-semibold mb-3">{t.labelSettings}</div>
                  {currentTool.type === 'image' && (
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-widest text-slate-500">{t.labelQuality}</span>
                        <input type="number" min="1" max="100" value={settings.image.quality} onChange={e => setSettings(s => ({ ...s, image: { ...s.image, quality: e.target.value } }))} className="border rounded-lg px-3 py-2" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-widest text-slate-500">{t.labelDpi}</span>
                        <input type="number" value={settings.image.dpi} onChange={e => setSettings(s => ({ ...s, image: { ...s.image, dpi: e.target.value } }))} className="border rounded-lg px-3 py-2" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-widest text-slate-500">{t.labelResize}</span>
                        <input type="text" value={settings.image.resize} onChange={e => setSettings(s => ({ ...s, image: { ...s.image, resize: e.target.value } }))} className="border rounded-lg px-3 py-2" placeholder="1200x1200" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-widest text-slate-500">{t.labelCrop}</span>
                        <input type="text" value={settings.image.crop} onChange={e => setSettings(s => ({ ...s, image: { ...s.image, crop: e.target.value } }))} className="border rounded-lg px-3 py-2" placeholder="800x800+0+0" />
                      </label>
                      <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <label className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Очистить EXIF (Privacy Mode)</div>
                            <div className="text-xs text-slate-500">Удаляет геолокацию и данные камеры перед скачиванием</div>
                          </div>
                          <span className="relative inline-flex h-7 w-12 shrink-0">
                            <input
                              type="checkbox"
                              className="peer sr-only"
                              checked={Boolean(settings.image.stripExif)}
                              onChange={(e) => setSettings((s) => ({ ...s, image: { ...s.image, stripExif: e.target.checked } }))}
                            />
                            <span className="absolute inset-0 rounded-full bg-slate-300 transition-all duration-300 peer-checked:bg-cyan-500" />
                            <span className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all duration-300 peer-checked:translate-x-5" />
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {currentTool.type === 'video' && (
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-widest text-slate-500">{t.labelResolution}</span>
                        <select value={settings.video.resolution} onChange={e => setSettings(s => ({ ...s, video: { ...s.video, resolution: e.target.value } }))} className="border rounded-lg px-3 py-2">
                          <option value="480p">480p</option>
                          <option value="720p">720p</option>
                          <option value="1080p">1080p</option>
                          <option value="4k">4K</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-widest text-slate-500">{t.labelFps}</span>
                        <input type="number" value={settings.video.fps} onChange={e => setSettings(s => ({ ...s, video: { ...s.video, fps: e.target.value } }))} className="border rounded-lg px-3 py-2" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-widest text-slate-500">{t.labelBitrate}</span>
                        <input type="text" value={settings.video.bitrate} onChange={e => setSettings(s => ({ ...s, video: { ...s.video, bitrate: e.target.value } }))} className="border rounded-lg px-3 py-2" placeholder="2M" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-widest text-slate-500">{t.labelCodec}</span>
                        <select value={settings.video.codec} onChange={e => setSettings(s => ({ ...s, video: { ...s.video, codec: e.target.value } }))} className="border rounded-lg px-3 py-2">
                          <option value="h264">H264</option>
                          <option value="h265">H265</option>
                          <option value="av1">AV1</option>
                        </select>
                      </label>
                      <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="text-xs uppercase tracking-widest text-slate-500">Таймлайн обрезки</div>
                        <div className="mt-1 text-sm text-slate-700">
                          Start: <span className="font-semibold">{trimTimelineState.startLabel}</span>
                          {' '}· End: <span className="font-semibold">{trimTimelineState.endLabel}</span>
                          {' '}· Длительность: <span className="font-semibold">{trimTimelineState.durationLabel}</span>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-slate-200 relative overflow-hidden">
                          <div
                            className="absolute top-0 h-full rounded-full bg-cyan-500/80"
                            style={{
                              left: `${(trimTimelineState.start / Math.max(1, trimTimelineState.max)) * 100}%`,
                              width: `${Math.max(0, ((trimTimelineState.end - trimTimelineState.start) / Math.max(1, trimTimelineState.max)) * 100)}%`
                            }}
                          />
                        </div>
                        <label className="mt-3 block">
                          <div className="text-xs text-slate-500 mb-1">Start Time</div>
                          <input
                            type="range"
                            min={0}
                            max={trimTimelineState.max}
                            step={1}
                            value={trimTimelineState.start}
                            disabled={!trimTimelineState.enabled || mediaDurationLoading}
                            onChange={(e) => updateTrimTimeline('start', e.target.value)}
                            className="w-full accent-cyan-600 disabled:opacity-50"
                          />
                        </label>
                        <label className="mt-2 block">
                          <div className="text-xs text-slate-500 mb-1">End Time</div>
                          <input
                            type="range"
                            min={0}
                            max={trimTimelineState.max}
                            step={1}
                            value={trimTimelineState.end}
                            disabled={!trimTimelineState.enabled || mediaDurationLoading}
                            onChange={(e) => updateTrimTimeline('end', e.target.value)}
                            className="w-full accent-cyan-600 disabled:opacity-50"
                          />
                        </label>
                        {mediaDurationLoading && (
                          <div className="mt-2 text-xs text-slate-500">Определяем длительность медиа...</div>
                        )}
                      </div>
                    </div>
                  )}

                  {currentTool.type === 'audio' && (
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-widest text-slate-500">{t.labelBitrate}</span>
                        <input type="text" value={settings.audio.bitrate} onChange={e => setSettings(s => ({ ...s, audio: { ...s.audio, bitrate: e.target.value } }))} className="border rounded-lg px-3 py-2" placeholder="192k" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-widest text-slate-500">{t.labelChannels}</span>
                        <input type="number" value={settings.audio.channels} onChange={e => setSettings(s => ({ ...s, audio: { ...s.audio, channels: e.target.value } }))} className="border rounded-lg px-3 py-2" />
                      </label>
                      <label className="flex items-center gap-2 sm:col-span-2">
                        <input type="checkbox" checked={settings.audio.normalize} onChange={e => setSettings(s => ({ ...s, audio: { ...s.audio, normalize: e.target.checked } }))} />
                        <span>{t.labelNormalizeAudio}</span>
                      </label>
                      <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="text-xs uppercase tracking-widest text-slate-500">Таймлайн обрезки</div>
                        <div className="mt-1 text-sm text-slate-700">
                          Start: <span className="font-semibold">{trimTimelineState.startLabel}</span>
                          {' '}· End: <span className="font-semibold">{trimTimelineState.endLabel}</span>
                          {' '}· Длительность: <span className="font-semibold">{trimTimelineState.durationLabel}</span>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-slate-200 relative overflow-hidden">
                          <div
                            className="absolute top-0 h-full rounded-full bg-cyan-500/80"
                            style={{
                              left: `${(trimTimelineState.start / Math.max(1, trimTimelineState.max)) * 100}%`,
                              width: `${Math.max(0, ((trimTimelineState.end - trimTimelineState.start) / Math.max(1, trimTimelineState.max)) * 100)}%`
                            }}
                          />
                        </div>
                        <label className="mt-3 block">
                          <div className="text-xs text-slate-500 mb-1">Start Time</div>
                          <input
                            type="range"
                            min={0}
                            max={trimTimelineState.max}
                            step={1}
                            value={trimTimelineState.start}
                            disabled={!trimTimelineState.enabled || mediaDurationLoading}
                            onChange={(e) => updateTrimTimeline('start', e.target.value)}
                            className="w-full accent-cyan-600 disabled:opacity-50"
                          />
                        </label>
                        <label className="mt-2 block">
                          <div className="text-xs text-slate-500 mb-1">End Time</div>
                          <input
                            type="range"
                            min={0}
                            max={trimTimelineState.max}
                            step={1}
                            value={trimTimelineState.end}
                            disabled={!trimTimelineState.enabled || mediaDurationLoading}
                            onChange={(e) => updateTrimTimeline('end', e.target.value)}
                            className="w-full accent-cyan-600 disabled:opacity-50"
                          />
                        </label>
                        {mediaDurationLoading && (
                          <div className="mt-2 text-xs text-slate-500">Определяем длительность медиа...</div>
                        )}
                      </div>
                    </div>
                  )}

                  {currentTool.type === 'doc' && (
                    <div className="text-sm text-slate-500">{t.labelDefaultSettingsNote}</div>
                  )}

                  <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={privacyDeleteAfter}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setPrivacyDeleteAfter(next);
                        setSettings((prev) => ({ ...prev, privacy: { ...prev.privacy, deleteAfter: next } }));
                      }}
                    />
                    <span>Удалять после скачивания (Privacy Mode)</span>
                  </label>
                  {featureFlags.transparency_panel && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700">
                      <div className="font-semibold text-slate-900">Live Security Status</div>
                      <div className="mt-1">Encryption: {CLIENT_ENCRYPTION_ENABLED ? 'Enabled' : 'Standard TLS'}</div>
                      <div>Deletion timer: {privacyDeleteAfter ? 'Delete after download' : 'Default retention policy'}</div>
                    </div>
                  )}
                </div>
              )}

              {!file ? (
                <Button size="large" onClick={openFilePicker}>
                  {t.btnStart}
                </Button>
              ) : (
                <Button size="large" onClick={handleProcess} data-testid="convert-button">
                  {t.btnConvert}
                </Button>
              )}
            </div>
          )}

          {status === 'processing' && (
            <div className="text-center py-8">
              <div className="text-3xl font-semibold text-slate-900 mb-3">{Math.round(progress)}%</div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden progress-animated">
                <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-slate-500">
                {['Анализ', 'Конвертация', 'Оптимизация'].map((step) => (
                  <span key={step} className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-slate-300">
                    {step}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-slate-500">
                {['Загрузка', 'Анализ', 'Конвертация', 'Финализация'].map((stage, index) => {
                  const active = progress < 20 ? index === 0 : progress < 45 ? index === 1 : progress < 85 ? index === 2 : index === 3;
                  return (
                    <span key={stage} className={`px-3 py-1 rounded-full border ${active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-white/10 bg-white/5 text-slate-300'}`}>
                      {stage}
                    </span>
                  );
                })}
              </div>
              <div className="mt-3 text-xs text-slate-500">AI управляет процессом и подбирает оптимальные настройки.</div>
              <div className="mt-3 text-slate-500 text-sm">{pipelineStage || t.processing}</div>
              {etaSeconds !== null && (
                <div className="mt-2 text-xs text-slate-500">{t.labelEtaPrefix} {etaSeconds}{t.labelSecondsShort}</div>
              )}
              <div className="mt-4 space-y-2">
                <div className="skeleton h-3 w-full"></div>
                <div className="skeleton h-3 w-5/6 mx-auto"></div>
              </div>
              {files.length > 1 && (
                <div className="mt-6 text-left">
                  <DynamicBatchStack
                    items={batchLiveItems.length ? batchLiveItems : buildBatchLiveItems(files)}
                    overallProgress={progress}
                    status={status}
                  />
                </div>
              )}
            </div>
          )}

          {status === 'done' && (
            <div className="text-center py-8">
              <div className="success-pop w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">{t.done}</h3>
              <div className="text-sm text-slate-500 mb-6">{t.labelFileReady}</div>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button variant="secondary" onClick={reset}>Повторить</Button>
                {featureFlags.public_share_links && (
                  <ShareButton
                    onCreateLink={handleCreateShareLink}
                    busy={isShareLinkCreating}
                    disabled={isShareLinkCreating || !downloadUrl}
                  />
                )}
                {canOpenQuickLook && (
                  <Button variant="outline" onClick={() => void openQuickLook()}>
                    <Eye size={16} /> Quick Look
                  </Button>
                )}
                <Button variant="primary" onClick={download}>{t.download}</Button>
              </div>
              {shareHint && <div className="mt-3 text-xs text-slate-500">{shareHint}</div>}
              {shareLink && (
                <div className="mt-2 text-xs text-slate-500">
                  Публичная ссылка (24 часа): {shareLink}
                </div>
              )}
              {!saveDataMode && featureFlags.instant_preview && (
                <div className="mt-6 text-left">
                  <div className="text-xs uppercase tracking-widest text-slate-500 mb-3">Instant Preview</div>
                  <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">Загружаем превью…</div>}>
                    <PreviewViewer
                      fileUrl={downloadUrl}
                      type={getPreviewType(getExtensionFromValue(downloadFileName || downloadUrl) || '')}
                    />
                  </Suspense>
                </div>
              )}
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
                <div className="text-xs uppercase tracking-widest text-slate-500">AI Result Summary</div>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" />Конвертация выполнена успешно</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" />Размер уменьшен на {assistantMeta.sizeReduction ? `${assistantMeta.sizeReduction}%` : '—'}</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" />Файл готов к редактированию</div>
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
                <div className="text-xs uppercase tracking-widest text-slate-500">Suggested Next Action</div>
                <div className="mt-3">
                  <NextActions
                    actions={assistantPredictiveActions}
                    onPick={(actionText) => setAssistantNotice(actionText)}
                  />
                </div>
                <div className="mt-3 grid md:grid-cols-2 gap-3 text-sm">
                  {assistantActions.slice(0, 2).map((action) => {
                    const isDisabled = action.kind === 'convert' && !action.toolId;
                    return (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => !isDisabled && handleAssistantAction(action)}
                        className={`rounded-xl border px-4 py-3 text-left transition ${action.tag === 'recommended' ? 'ai-action-recommended' : 'border-slate-200 bg-white'} ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        <div className="font-semibold text-slate-900">{action.title}</div>
                        <div className="text-xs text-slate-500 mt-1">{action.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-8">
              <div className="error-pop w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                <X size={30} />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">{t.labelConversionFailed}</h3>
              <div className="text-sm text-slate-500 mb-6">{errorInfo || t.labelTryAgain}</div>
              <div className="flex gap-3 justify-center">
                <Button variant="secondary" onClick={reset}>{t.back}</Button>
                <Button variant="primary" onClick={handleProcess}>{t.btnRetry}</Button>
              </div>
            </div>
          )}
        </div>
        </div>
      </GlassCard>
    );
  };
  const renderToolsPage = () => {
    const previewTool = tools.find((tool) => tool.id === hoveredToolId) || visibleTools[0] || tools[0];
    return (
      <Page title={t.pageToolsTitle} subtitle={t.pageToolsSubtitle}>
        <div className="grid lg:grid-cols-[1.6fr_0.8fr] gap-6">
          <div>
            <div className="mc-card rounded-2xl border border-white/40 dark:border-white/10 p-4 mb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">New in MegaConvert 3.0</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">Локальная конвертация медиа (WASM)</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Конвертируйте аудио и видео локально в браузере, без загрузки файла на сервер.</div>
                </div>
                <Button onClick={() => navigate('/tools/local-converter')}>
                  Открыть
                </Button>
              </div>
            </div>
            <div className="mc-card rounded-2xl border border-white/40 dark:border-white/10 p-4 mb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">AI Tool</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">Умный OCR (распознавание текста)</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Извлекайте текст из фото и сканов локально в браузере с выбором языка.</div>
                </div>
                <Button onClick={() => navigate('/tools/ocr')}>
                  Открыть
                </Button>
              </div>
            </div>
            <div className="mc-card rounded-2xl border border-white/40 dark:border-white/10 p-4 mb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">PDF Tool</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">Визуальный PDF-редактор</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Склейка, удаление и перестановка страниц PDF локально в браузере.</div>
                </div>
                <Button onClick={() => navigate('/tools/pdf-editor')}>
                  Открыть
                </Button>
              </div>
            </div>
            <div className="mc-card rounded-2xl border border-white/40 dark:border-white/10 p-4 mb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Image Tool</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">Интерактивное сжатие изображений</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Слайдер качества и живое сравнение До/После прямо на картинке.</div>
                </div>
                <Button onClick={() => navigate('/tools/image-compressor')}>
                  Открыть
                </Button>
              </div>
            </div>
            <div className="mc-card rounded-2xl border border-white/40 dark:border-white/10 p-4 mb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Batch Tool</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">Пакетный Watermark</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">До 50 изображений, настройка текста/цвета/позиции и скачивание готового ZIP.</div>
                </div>
                <Button onClick={() => navigate('/tools/batch-watermark')}>
                  Открыть
                </Button>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-slate-900">
              <div className="flex items-center gap-2">
                <Search size={16} className="text-slate-400" />
                <input
                  className="w-full text-sm outline-none bg-transparent text-slate-800 placeholder:text-slate-500"
                  placeholder={t.labelSearchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    submitFormatSearch('enter');
                  }}
                />
              </div>
              {parsedFormatQuery && (
                <div className="text-xs text-slate-500 mt-3">
                  {formatMatchedTools.length === 1
                    ? t.labelSearchSingleMatchHint
                    : (formatMatchedTools.length > 1
                      ? t.labelSearchMultipleMatchHint.replace('{count}', String(formatMatchedTools.length))
                      : t.labelSearchNoMatchHint)}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-4">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${activeCategory === cat.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {showPopularTools && (
              <div className="mt-8">
                <div className="flex items-center gap-3">
                  <Badge color="purple">{t.homePopularBadge}</Badge>
                  <div className="text-sm text-slate-500">Рекомендации на основе формата и частоты</div>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {topTools.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => openToolRoute(tool.id, { autoPick: true })}
                      className="text-left p-4 rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition"
                      data-testid={`tools-popular-${tool.id}`}
                    >
                      <div className="flex items-center gap-3 text-slate-900 font-semibold">
                        <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">{tool.icon}</span>
                        <span>{tool.name}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-2">{tool.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {visibleTools.length === 0 ? (
              <div className="text-center text-slate-500 mt-8">{t.labelNoFormatsFound}</div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                {visibleTools.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    onOpen={() => openToolRoute(tool.id, { autoPick: true })}
                    onHover={setHoveredToolId}
                    onLeave={() => setHoveredToolId(null)}
                    labels={{ pro: t.labelPro, speed: t.labelSpeed, formats: t.labelFormats, openConverter: t.btnOpenConverter }}
                  />
                ))}
              </div>
            )}

            {filteredTools.length > 12 && (
              <div className="text-center mt-10">
                <Button variant="secondary" onClick={() => setShowAllFormats((v) => !v)}>
                  {showAll ? t.labelShowFewerFormats : t.labelShowAllFormats}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <PageCard>
              <div className="text-xs uppercase tracking-widest text-slate-500">Превью</div>
              <div className="text-2xl font-semibold mt-3 text-slate-100">{previewTool?.name || 'Выберите формат'}</div>
              <div className="text-sm text-slate-500 mt-2">{previewTool?.description || 'Мгновенный результат без лишних настроек.'}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge color="blue" variant="dark">{previewTool?.formats || '—'}</Badge>
                <Badge color="slate" variant="dark">{previewTool?.speed || t.speedFast}</Badge>
              </div>
            </PageCard>
            <PageCard>
              <div className="text-xs uppercase tracking-widest text-slate-500">Живой пример</div>
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-slate-500">Файл</div>
                    <div className="text-lg font-semibold text-slate-100 mt-2">invoice-2026.pdf</div>
                    <div className="text-xs text-slate-500 mt-1">PDF · 2.4 MB</div>
                  </div>
                  <Badge color="green" variant="dark">Готово</Badge>
                </div>
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-widest text-slate-500">Пайплайн</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['Анализ', 'Конвертация', 'Оптимизация'].map((step) => (
                      <span key={step} className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-slate-200 border border-white/10">
                        {step}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <Button className="mt-4 w-full" onClick={() => previewTool && openToolRoute(previewTool.id, { autoPick: true })}>
                {t.btnOpenConverter}
              </Button>
            </PageCard>
          </div>
        </div>
      </Page>
    );
  };

  const renderConvertPage = () => {
    if (!resolvedToolId) {
      return (
        <Page title={t.pageNotFoundTitle} subtitle={t.pageNotFoundSubtitle}>
          <PageCard>
            <div className="text-sm text-slate-600">{t.notFoundBody}</div>
            <div className="mt-4 flex gap-3">
              <Button onClick={() => navigate('/')}>{t.btnGoHome}</Button>
              <Button variant="secondary" onClick={() => navigate('/convert/pdf-to-word')}>{t.btnOpenConverter}</Button>
            </div>
          </PageCard>
        </Page>
      );
    }
    const workspaceFiles = batchMode ? files : (file ? [file] : []);
    const statusLabels = statusLabelMap(t);
    const workspaceStatus = statusLabels[status] || statusLabels.idle;
    const locale = LANG_TO_LOCALE[lang] || 'ru-RU';
    const historyItems = recentJobs.slice(0, 3);

    return (
      <Page
        title={`${resolvedTool.name} ${t.pageConverterSuffix}`}
        subtitle={t.pageConvertSubtitle}
        actions={(
          <>
            <Button onClick={openFilePicker}>{t.btnUploadFile}</Button>
            <Button variant="secondary" onClick={() => navigate('/tools')}>{t.btnBrowseTools}</Button>
          </>
        )}
      >
        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <div id="converter">{renderConverterPanel()}</div>
          <div className="space-y-4">
            <PageCard>
              <div className="text-xs uppercase tracking-widest text-slate-500">{t.labelSupportedFormats}</div>
              <div className="text-lg font-semibold mt-2">{resolvedTool.formats}</div>
              <div className="text-sm text-slate-500 mt-2">{t.labelInputTypes} {resolvedTool.accept}</div>
            </PageCard>
            <PageCard>
              <div className="text-xs uppercase tracking-widest text-slate-500">{t.labelMaxFileSize}</div>
              <div className="text-lg font-semibold mt-2">{isPro ? t.valueMaxSizePro : t.valueMaxSizeFree}</div>
              <div className="text-sm text-slate-500 mt-2">{t.labelUpgradeNote}</div>
            </PageCard>
            <PageCard>
              <div className="text-xs uppercase tracking-widest text-slate-500">{t.labelSecurityNote}</div>
              <div className="text-sm text-slate-600 mt-2">{t.labelSecurityNoteBody}</div>
            </PageCard>
          </div>
        </div>

        <div className="mt-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500">Рабочее пространство</div>
              <div className="text-2xl font-semibold mt-2 text-slate-100">Умная среда обработки с мгновенной обратной связью</div>
            </div>
            <Badge color="slate" variant="dark">{t.securityBadgeDeleteTitle}</Badge>
          </div>

          <div className="workspace-grid mt-6">
            {workspaceFiles.length === 0 ? (
              <div className="workspace-empty mc-card p-6 text-sm text-slate-400">
                {t.labelDropHere} {t.labelDragDrop}
              </div>
            ) : (
              workspaceFiles.map((item, index) => (
                <div key={`${item.name}-${index}`} className="workspace-card mc-card p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-slate-500">{t.labelSelected}</div>
                      <div className="text-lg font-semibold mt-2 text-slate-100">{item.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {`${(item.name.split('.').pop() || '').toUpperCase() || 'FILE'} · ${(item.size / (1024 * 1024)).toFixed(2)} MB`}
                      </div>
                    </div>
                    <Badge color="blue" variant="dark">{workspaceStatus}</Badge>
                  </div>

                  <div className="mt-5 grid md:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-widest text-slate-500">{t.labelStatusSystem}</div>
                      <div className="mt-2 font-semibold text-slate-100">{workspaceStatus}</div>
                      <div className="text-xs text-slate-500 mt-1">{pipelineStage || t.processing}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-widest text-slate-500">Действия</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {status === 'done' && <Button variant="secondary" onClick={download}>{t.download}</Button>}
                        {status === 'done' && canOpenQuickLook && (
                          <Button variant="outline" onClick={() => void openQuickLook()}>
                            <Eye size={14} /> Quick Look
                          </Button>
                        )}
                        {status === 'error' && <Button variant="secondary" onClick={handleProcess}>{t.btnRetry}</Button>}
                        <Button variant="outline" onClick={reset}>{t.btnClear}</Button>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-widest text-slate-500">{t.dashboardHistoryTitle}</div>
                      <div className="mt-2">
                        <HistoryList
                          items={historyItems}
                          getLabel={(job) => `${tools.find((tool) => tool.id === job.tool)?.name || job.tool} · ${formatShortTimestamp(job.ts, locale)}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            <div className="workspace-panel mc-card p-6">
              <div className="text-xs uppercase tracking-widest text-slate-500">{t.labelProcessingPipeline}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {pipelineSteps.map((step) => (
                  <span key={step} className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-slate-200 border border-white/10">
                    {step}
                  </span>
                ))}
              </div>
              <div className="text-sm text-slate-400 mt-4">{t.labelPipelineNote}</div>
            </div>
          </div>
        </div>
      </Page>
    );
  };
  const renderSecurityPage = () => (
    <Page title={t.pageSecurityTitle} subtitle={t.pageSecuritySubtitle}>
      <div className="grid md:grid-cols-3 gap-6">
        <IconCard icon={ShieldCheck} title={t.securityCardEncryptTitle} desc={t.securityCardEncryptDesc} tone="green" />
        <IconCard icon={ServerCog} title={t.securityCardIsolateTitle} desc={t.securityCardIsolateDesc} tone="blue" />
        <IconCard icon={Lock} title={t.securityCardZeroTitle} desc={t.securityCardZeroDesc} tone="violet" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-8">
        <PageCard>
          <div className="font-semibold mb-3">{t.labelProcessingPipeline}</div>
          <div className="flex flex-wrap gap-2">
            {pipelineSteps.map((step) => (
              <span key={step} className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                {step}
              </span>
            ))}
          </div>
          <div className="text-sm text-slate-600 mt-4">{t.labelPipelineNote}</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-3">{t.labelStatusSystem}</div>
          <div className="flex flex-wrap gap-2">
              {[t.statusStateQueued, t.statusStateProcessing, t.statusStateVerifying, t.statusStateCompleted, t.statusStateFailed, t.statusStateExpired].map((state) => (
              <span key={state} className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                {state}
              </span>
            ))}
          </div>
          <div className="text-sm text-slate-600 mt-4">{t.labelStatusNote}</div>
        </PageCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-8">
        <PageCard>
          <div className="font-semibold mb-3">{t.labelBackendStructure}</div>
          <pre className="text-xs bg-slate-50 rounded-xl p-4 border border-slate-200">
{`backend/
  core/
    config/
    logger/
    errors/
  modules/
    jobs/
      controller/
      service/
      repository/
    conversion/
      processors/
        document/
        image/
        video/
        audio/
    storage/
    queue/
    users/
  infrastructure/
    database/
    cache/
    queue/
  app.ts`}
          </pre>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-3">{t.labelDataRetention}</div>
          <div className="text-sm text-slate-600">{t.labelRetentionNote1}</div>
          <div className="text-sm text-slate-600 mt-3">{t.labelRetentionNote2}</div>
        </PageCard>
      </div>
    </Page>
  );

  const renderStatusPage = () => (
    <Page title={t.pageStatusTitle} subtitle={t.pageStatusSubtitle}>
      <div className="grid md:grid-cols-4 gap-6">
        {statusMetrics.map((metric) => (
          <PageCard key={metric.label}>
            <div className="text-xs uppercase tracking-widest text-slate-500">{metric.label}</div>
            <div className="text-2xl font-semibold mt-3">{metric.value}</div>
            <div className="text-sm text-slate-500 mt-2">{metric.desc}</div>
          </PageCard>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6 text-slate-900">
        <div className="flex items-center justify-between">
          <div className="font-semibold">{t.statusCoreServicesTitle}</div>
          <div className="text-emerald-600 font-semibold">{t.statusOperationalLabel}</div>
        </div>
        <div className="grid md:grid-cols-3 gap-4 mt-4 text-sm">
          {[t.statusServiceApi, t.statusServiceWorkers, t.statusServiceStorage].map((service) => (
            <div key={service} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
              <span className="font-medium">{service}</span>
              <span className="text-emerald-600 font-semibold">{t.statusHealthyLabel}</span>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );

  const renderReliabilityPage = () => (
    <Page title={t.pageReliabilityTitle || 'SLA & Reliability'} subtitle={t.pageReliabilitySubtitle || 'Гарантии стабильности, приоритеты очереди и политика инцидентов.'}>
      <div className="grid md:grid-cols-3 gap-6">
        <PageCard>
          <div className="text-xs uppercase tracking-widest text-slate-500">Uptime SLA</div>
          <div className="text-3xl font-semibold mt-3">99.95%</div>
          <div className="text-sm text-slate-600 mt-2">Monthly target availability for enterprise workloads.</div>
        </PageCard>
        <PageCard>
          <div className="text-xs uppercase tracking-widest text-slate-500">RTO / RPO</div>
          <div className="text-3xl font-semibold mt-3">15m / 5m</div>
          <div className="text-sm text-slate-600 mt-2">Recovery objectives for core conversion pipeline.</div>
        </PageCard>
        <PageCard>
          <div className="text-xs uppercase tracking-widest text-slate-500">Queue Priority</div>
          <div className="text-3xl font-semibold mt-3">P1-P3</div>
          <div className="text-sm text-slate-600 mt-2">Enterprise plans receive priority processing lanes.</div>
        </PageCard>
      </div>
      <div className="grid lg:grid-cols-2 gap-6 mt-8">
        <PageCard>
          <div className="font-semibold mb-3">Incident Policy</div>
          <div className="space-y-2 text-sm text-slate-600">
            <div>P1: public status update in 15 minutes.</div>
            <div>P2: public status update in 60 minutes.</div>
            <div>Postmortem publication for every confirmed incident.</div>
          </div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-3">Data Retention</div>
          <div className="space-y-2 text-sm text-slate-600">
            <div>Default file TTL: 24 hours.</div>
            <div>Configurable retention for enterprise workspaces.</div>
            <div>Audit events preserved for observability and compliance.</div>
          </div>
        </PageCard>
      </div>
    </Page>
  );

  const renderDevelopersPage = () => (
    <Page title={t.pageDevelopersTitle || 'Developer Portal'} subtitle={t.pageDevelopersSubtitle || 'API, webhooks, SDK and integration patterns for platform usage.'}>
      <div className="grid md:grid-cols-2 gap-6">
        <PageCard>
          <div className="font-semibold mb-3">Core APIs</div>
          <div className="space-y-2 text-sm text-slate-600">
            <div>`POST /v1/jobs` - create conversion job</div>
            <div>`GET /v1/jobs/:id` - fetch job status</div>
            <div>`POST /v1/webhooks` - configure delivery events</div>
            <div>`GET /v1/usage` - platform usage and limits</div>
          </div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-3">Platform Signals</div>
          <div className="space-y-2 text-sm text-slate-600">
            <div>API status and incident feed</div>
            <div>Signed webhooks with retry policy</div>
            <div>Idempotency keys for safe automation</div>
            <div>Queue and processing latency metrics</div>
          </div>
        </PageCard>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => navigate('/api')}>Open API Docs</Button>
        <Button variant="secondary" onClick={() => navigate('/status')}>Status Page</Button>
        <Button variant="secondary" onClick={() => navigate('/contact')}>{t.btnRequestAccess}</Button>
      </div>
    </Page>
  );

  const renderTeamDevelopersPage = () => (
    <Page title="Meet the Team" subtitle="The people behind MegaConvert">
      {developersError && (
        <PageCard>
          <div className="text-sm text-red-600">{developersError}</div>
        </PageCard>
      )}
      {developersLoading ? (
        <div className="grid md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, idx) => (
            <PageCard key={idx}>
              <div className="skeleton h-40 w-full"></div>
              <div className="skeleton h-4 w-1/2 mt-3"></div>
              <div className="skeleton h-4 w-2/3 mt-2"></div>
            </PageCard>
          ))}
        </div>
      ) : developersList.length === 0 ? (
        <PageCard>
          <div className="text-sm text-slate-600">Developers will appear here soon.</div>
        </PageCard>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {developersList.map((dev) => (
            <PageCard key={dev.id} className="text-center">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 mx-auto">
                {dev.avatar_url ? (
                  <img src={dev.avatar_url} alt={dev.name || 'Developer'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl font-semibold text-slate-500">
                    {String(dev.name || '?').slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="mt-4 text-lg font-semibold text-slate-900">{dev.name || 'Unknown'}</div>
              <div className="text-sm text-slate-500 mt-1">{dev.role || 'Engineer'}</div>
              {dev.bio && <div className="text-sm text-slate-600 mt-3">{dev.bio}</div>}
              <div className="mt-4 flex justify-center gap-3 text-sm">
                {dev.github_url && <a href={dev.github_url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline" aria-label={`${dev.name} GitHub`}>GitHub</a>}
                {dev.linkedin_url && <a href={dev.linkedin_url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline" aria-label={`${dev.name} LinkedIn`}>LinkedIn</a>}
                {dev.twitter_url && <a href={dev.twitter_url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline" aria-label={`${dev.name} X`}>X</a>}
                {dev.website_url && <a href={dev.website_url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline" aria-label={`${dev.name} Website`}>Website</a>}
              </div>
            </PageCard>
          ))}
        </div>
      )}
    </Page>
  );

  const renderRoadmapPage = () => (
    <Page title={t.pageRoadmapTitle || 'Roadmap'} subtitle={t.pageRoadmapSubtitle || 'Этапы развития AI, платформы и enterprise-функций.'}>
      <div className="space-y-4">
        {[
          { phase: 'Q1 2026', title: 'AI Decision Engine', items: ['Context awareness', 'Intent detection', 'Explainable recommendations'] },
          { phase: 'Q2 2026', title: 'Automation Platform', items: ['Pipeline templates', 'Rule engine', 'Predictive actions'] },
          { phase: 'Q3 2026', title: 'Enterprise Readiness', items: ['SLA controls', 'Compliance center', 'Advanced observability'] },
          { phase: 'Q4 2026', title: 'Scale Layer', items: ['Integrations', 'Webhooks', 'Multi-workspace governance'] }
        ].map((item) => (
          <PageCard key={item.phase}>
            <div className="text-xs uppercase tracking-widest text-slate-500">{item.phase}</div>
            <div className="text-xl font-semibold mt-2">{item.title}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.items.map((point) => (
                <span key={point} className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{point}</span>
              ))}
            </div>
          </PageCard>
        ))}
      </div>
    </Page>
  );

  const renderChangelogPage = () => (
    <Page title={t.pageChangelogTitle || 'Changelog'} subtitle={t.pageChangelogSubtitle || 'Прозрачная история релизов и изменений платформы.'}>
      <div className="space-y-4">
        {[
          {
            date: '2026-02-27',
            version: 'v2.4.0',
            changes: ['Intelligence engine: context + intent + decision layers', 'Explainable AI hints and predictive actions', 'New enterprise pages: reliability, developer portal, roadmap']
          },
          {
            date: '2026-02-20',
            version: 'v2.3.0',
            changes: ['Workspace status panel upgrades', 'Improved queue observability and ETA reporting']
          },
          {
            date: '2026-02-15',
            version: 'v2.2.0',
            changes: ['Security and legal center refresh', 'Expanded API quickstart and account controls']
          }
        ].map((release) => (
          <PageCard key={release.version}>
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">{release.version}</div>
              <div className="text-xs text-slate-500">{release.date}</div>
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {release.changes.map((change) => (
                <div key={change}>• {change}</div>
              ))}
            </div>
          </PageCard>
        ))}
      </div>
    </Page>
  );

  const renderArchitecturePage = () => (
    <Page title={t.pageArchitectureTitle || 'Platform Architecture'} subtitle={t.pageArchitectureSubtitle || 'Слои системы MegaConvert для масштабирования и enterprise-качества.'}>
      <PageCard>
        <pre className="text-xs bg-slate-50 rounded-xl p-4 border border-slate-200 whitespace-pre-wrap">
{`Client -> Edge -> API -> Orchestration -> Processing -> AI -> Storage -> Observability`}
        </pre>
      </PageCard>
      <div className="grid md:grid-cols-2 gap-6 mt-6">
        {[
          'Frontend Architecture',
          'Edge / Delivery Architecture',
          'API Architecture',
          'Orchestration Architecture',
          'Processing Architecture',
          'Validation Architecture',
          'Storage Architecture',
          'Database Architecture',
          'AI Architecture',
          'Analytics Architecture',
          'Observability Architecture',
          'Security Architecture',
          'Performance Architecture',
          'Integration Architecture',
          'Automation Architecture',
          'Admin / Control Architecture',
          'Deployment Architecture',
          'Resilience Architecture'
        ].map((item) => (
          <PageCard key={item}>
            <div className="font-semibold">{item}</div>
          </PageCard>
        ))}
      </div>
    </Page>
  );

  const renderLoginPage = () => (
    <Page
      title={t.pageLoginTitle}
      subtitle={t.pageLoginSubtitle}
      actions={(
        <>
          <Button onClick={() => setShowAuthModal(true)}>{t.btnOpenSignIn}</Button>
          <Button variant="secondary" onClick={handleGuest}>{t.btnContinueGuest}</Button>
        </>
      )}
    >
      <div className="grid md:grid-cols-2 gap-6">
        <PageCard>
          <div className="font-semibold mb-2">{t.loginWhyTitle}</div>
          <div className="text-sm text-slate-600">{t.loginWhyDesc}</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-2">{t.loginSecurityTitle}</div>
          <div className="text-sm text-slate-600">{t.loginSecurityDesc}</div>
        </PageCard>
      </div>
    </Page>
  );

  const renderDashboardPage = () => {
    const historyStatusLabels = statusLabelMap(t);
    const historyStatusOptions = [
      { id: 'all', label: 'Все статусы' },
      { id: 'processing', label: historyStatusLabels.processing },
      { id: 'done', label: historyStatusLabels.done },
      { id: 'error', label: historyStatusLabels.error }
    ];
    const historyCategoryOptions = [
      { id: 'all', label: 'Все типы' },
      { id: 'doc', label: t.categoryDocuments },
      { id: 'image', label: t.categoryImages },
      { id: 'video', label: t.categoryVideo },
      { id: 'audio', label: t.categoryAudio },
      { id: 'other', label: t.categoryOtherTools || 'Другие' }
    ];
    const filteredHistory = recentJobs.filter((job) => {
      const tool = tools.find((item) => item.id === job.tool);
      const search = historySearchQuery.trim().toLowerCase();
      const label = String(tool?.name || job.tool || '').toLowerCase();
      const searchMatch = search ? (label.includes(search) || String(job.id || '').toLowerCase().includes(search)) : true;
      const typeMatch = historyFilter === 'all' ? true : (tool?.type === historyFilter);
      const statusMatch = historyStatusFilter === 'all' ? true : (job.status === historyStatusFilter);
      return searchMatch && typeMatch && statusMatch;
    });

    return (
      <Page
        title={t.pageDashboardTitle}
        subtitle={t.pageDashboardSubtitle}
        actions={user ? null : <Button onClick={() => navigate('/login')}>{t.btnSignInToContinue}</Button>}
      >
        {!user && (
          <PageCard>
            <div className="font-semibold mb-2">{t.dashboardAuthRequiredTitle}</div>
            <div className="text-sm text-slate-600">{t.dashboardAuthRequiredDesc}</div>
          </PageCard>
        )}
        {user && (
          <>
            <div className="grid md:grid-cols-3 gap-6">
              <PageCard>
                <div className="text-xs uppercase tracking-widest text-slate-600">{t.dashboardMetricConversions}</div>
                <div className="text-3xl font-semibold mt-3">{recentJobs.length}</div>
                <div className="text-sm text-slate-600 mt-2">{t.dashboardMetricLast30Days}</div>
              </PageCard>
              <PageCard>
                <div className="text-xs uppercase tracking-widest text-slate-600">{t.dashboardMetricPlan}</div>
                <div className="text-3xl font-semibold mt-3">
                  {String(accountBilling?.plan?.title || '').trim() || (isPro ? t.planProName : t.planFreeName)}
                </div>
                <div className="text-sm text-slate-600 mt-2">{t.dashboardMetricUpgrade}</div>
              </PageCard>
              <PageCard>
                <div className="text-xs uppercase tracking-widest text-slate-600">{t.dashboardMetricStorage}</div>
                <div className="text-3xl font-semibold mt-3">2.3 GB</div>
                <div className="text-sm text-slate-600 mt-2">{t.dashboardMetricStorageUsed}</div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-3">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: '12%' }} />
                </div>
              </PageCard>
            </div>

            <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6 text-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="font-semibold">{t.dashboardHistoryTitle}</div>
                <Button variant="secondary" onClick={handleExportData}>{t.btnExportData}</Button>
              </div>
              <div className="flex flex-wrap gap-2 mb-5">
                <input
                  type="text"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  placeholder="Поиск по истории"
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border bg-white border-slate-200 text-slate-700 min-w-[180px]"
                />
                {historyCategoryOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setHistoryFilter(option.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${historyFilter === option.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}
                  >
                    {option.label}
                  </button>
                ))}
                {historyStatusOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setHistoryStatusFilter(option.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${historyStatusFilter === option.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {filteredHistory.length === 0 ? (
                <div className="text-sm text-slate-600">{t.dashboardNoJobs}</div>
              ) : (
                <div className="space-y-3">
                  {filteredHistory.slice(0, 12).map((job) => {
                    const tool = tools.find((item) => item.id === job.tool);
                    const jobStatus = historyStatusLabels[job.status] || historyStatusLabels.done;
                    const statusTone = job.status === 'error' ? 'text-red-400' : (job.status === 'processing' ? 'text-blue-300' : 'text-emerald-400');
                    return (
                      <div key={job.id} className="grid md:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-center text-sm border-b border-slate-100 pb-3">
                        <div className="font-medium">{tool?.name || job.tool}</div>
                        <div className="text-slate-600">{new Date(job.ts).toLocaleString()}</div>
                        <div className={`${statusTone} font-semibold`}>{jobStatus}</div>
                        <div className="flex gap-2">
                          <Button variant="secondary" onClick={() => openToolRoute(job.tool)}>{t.btnOpen}</Button>
                          <Button variant="outline" onClick={() => removeJob(job.id)}>{t.btnDelete}</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {accountNotice && <div className="text-xs text-slate-600 mt-3">{accountNotice}</div>}
            </div>

            {isPro && (
              <>
                <div className="mt-8 grid md:grid-cols-3 gap-6">
                  <PageCard>
                    <div className="text-xs uppercase tracking-widest text-slate-600">AI рекомендации</div>
                    <div className="text-3xl font-semibold mt-3">PDF → DOCX</div>
                    <div className="text-sm text-slate-600 mt-2">Самый популярный сценарий</div>
                  </PageCard>
                  <PageCard>
                    <div className="text-xs uppercase tracking-widest text-slate-600">Успешные действия</div>
                    <div className="text-3xl font-semibold mt-3">92%</div>
                    <div className="text-sm text-slate-600 mt-2">Доля успешных AI‑решений</div>
                  </PageCard>
                  <PageCard>
                    <div className="text-xs uppercase tracking-widest text-slate-600">Оптимизации</div>
                    <div className="text-3xl font-semibold mt-3">38%</div>
                    <div className="text-sm text-slate-600 mt-2">Среднее снижение размера</div>
                  </PageCard>
                </div>
                <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-6 text-slate-900">
                  <div className="font-semibold">AI Insights Dashboard</div>
                  <div className="mt-4 grid md:grid-cols-3 gap-4 text-sm">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-widest text-slate-500">Популярные рекомендации</div>
                      <div className="mt-2 font-semibold">PDF → DOCX</div>
                      <div className="text-xs text-slate-500 mt-1">JPG → WEBP</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-widest text-slate-500">Успешные действия</div>
                      <div className="mt-2 font-semibold">1 240</div>
                      <div className="text-xs text-slate-500 mt-1">за 30 дней</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-widest text-slate-500">Оптимизации</div>
                      <div className="mt-2 font-semibold">-38% размер</div>
                      <div className="text-xs text-slate-500 mt-1">в среднем</div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <PageCard>
                <div className="font-semibold mb-2">{t.dashboardAccountActionsTitle}</div>
                <div className="text-sm text-slate-700 mb-4">{t.dashboardSignedInAs} {user.email || user.name}</div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={handleExportData}>{t.btnExportData}</Button>
                  <Button variant="outline" className="flex-1" onClick={handleDeleteAccount}>{t.btnDeleteAccount}</Button>
                </div>
              </PageCard>
              <PageCard>
                <div className="font-semibold mb-2">{t.dashboardTeamFeaturesTitle}</div>
                <div className="text-sm text-slate-700">{t.dashboardTeamFeaturesDesc}</div>
                <Button variant="secondary" className="mt-4 w-full" onClick={() => navigate('/contact')}>{t.btnRequestAccess}</Button>
              </PageCard>
            </div>
          </>
        )}
      </Page>
    );
  };

  const renderAccountPage = () => {
    const plan = accountBilling?.plan && typeof accountBilling.plan === 'object'
      ? accountBilling.plan
      : {
          tier: 'free',
          title: t.accountPlanFreeTitle,
          status: 'active',
          description: t.accountPlanUpgradeHint,
          renews_at: null,
          promo_only: false
        };
    const isPromoOnlyPlan = Boolean(plan?.promo_only);
    const activeBenefits = Array.isArray(accountBilling?.active_benefits) ? accountBilling.active_benefits : [];
    const promoHistory = Array.isArray(accountBilling?.promo_history) ? accountBilling.promo_history : [];
    const isRedeeming = accountRedeemStatus === 'loading';
    const hasSuccess = accountRedeemStatus === 'success' && Boolean(accountRedeemMessage);
    const hasError = accountRedeemStatus === 'error' && Boolean(accountRedeemMessage);
    const connectionByProvider = new Map(
      (Array.isArray(accountConnections) ? accountConnections : [])
        .map((item) => [String(item?.provider || '').trim(), item])
    );
    const providerRows = [
      { provider: 'google', label: 'Google' },
      { provider: 'github', label: 'GitHub' }
    ];

    return (
      <Page
        title={t.pageAccountTitle}
        subtitle={t.pageAccountSubtitle}
      >
        {!user && (
          <PageCard>
            <div className="font-semibold mb-2">{t.accountSignInTitle}</div>
            <div className="text-sm text-slate-600 mb-4">
              {t.accountSignInSubtitle}
            </div>
            <Button onClick={() => setShowAuthModal(true)}>{t.navLogin}</Button>
          </PageCard>
        )}

        {user && (
          <div className="account-page-enter grid lg:grid-cols-[220px_1fr] gap-6">
            <aside className="panel-card bg-white rounded-2xl border border-slate-200 p-4 h-fit text-slate-900">
              <div className="text-xs uppercase tracking-widest text-slate-500 px-2 mb-2">{t.navAccount}</div>
              <div className="space-y-1">
                {[
                  { id: 'profile', label: t.accountSectionProfile },
                  { id: 'billing', label: t.accountSectionBilling },
                  { id: 'connections', label: t.accountSectionConnections },
                  { id: 'security', label: t.accountSectionSecurity },
                  { id: 'telegram', label: t.accountSectionTelegram },
                  { id: 'pipelines', label: t.accountSectionPipelines || 'Pipelines' },
                  { id: 'api', label: t.accountSectionApi }
                ].map((item) => (
                  <button
                    key={item.id}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      item.id === accountSection
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                    onClick={() => {
                      setAccountSection(item.id);
                      if (item.id === 'pipelines') {
                        void loadAccountPipelines({ silent: true, preferredId: accountSelectedPipelineId });
                      }
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </aside>

            <div className="space-y-6">
              {user?.isAnon && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {t.accountGuestNotice}
                </div>
              )}
              {accountActionNotice && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {accountActionNotice}
                </div>
              )}

              {accountSection === 'profile' && (
                <PageCard className="account-card-enter">
                  <div className="text-xs uppercase tracking-widest text-slate-500">{t.accountSectionProfile}</div>
                  <h2 className="text-xl font-semibold mt-2">{t.accountProfileTitle}</h2>
                  <p className="text-sm text-slate-600 mt-2">
                    {t.accountProfileSubtitle}
                  </p>
                  <div className="grid md:grid-cols-3 gap-3 mt-4">
                    <label className="text-sm">
                      <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">{t.accountFieldName}</div>
                      <input
                        type="text"
                        value={accountProfileDraft.display_name}
                        onChange={(event) => setAccountProfileDraft((prev) => ({ ...prev, display_name: event.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        placeholder={user.name || t.accountNamePlaceholder}
                      />
                    </label>
                    <label className="text-sm">
                      <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">{t.accountFieldTimezone}</div>
                      <input
                        type="text"
                        value={accountProfileDraft.timezone}
                        onChange={(event) => setAccountProfileDraft((prev) => ({ ...prev, timezone: event.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        placeholder={t.accountTimezonePlaceholder}
                      />
                    </label>
                    <label className="text-sm">
                      <div className="text-xs uppercase tracking-widest text-slate-500 mb-1">{t.accountFieldAvatarUrl}</div>
                      <input
                        type="url"
                        value={accountProfileDraft.avatar_url}
                        onChange={(event) => setAccountProfileDraft((prev) => ({ ...prev, avatar_url: event.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        placeholder="https://..."
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <Button onClick={() => void saveAccountProfile()} disabled={accountProfileSaving}>
                      {accountProfileSaving ? t.accountSaving : t.accountSaveProfile}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setAccountProfileDraft({
                          display_name: String(accountProfile?.display_name || user?.name || '').trim(),
                          timezone: String(accountProfile?.timezone || '').trim(),
                          avatar_url: String(accountProfile?.avatar_url || '').trim()
                        });
                        setAccountProfileError('');
                      }}
                    >
                      {t.btnClear}
                    </Button>
                    {accountProfileLoading && <span className="text-xs text-slate-500">{t.accountLoadingProfile}</span>}
                  </div>
                  {accountProfileError && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {accountProfileError}
                    </div>
                  )}
                </PageCard>
              )}

              {accountSection === 'billing' && (
                <>
                  <PageCard className="account-card-enter">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-widest text-slate-500">{t.accountPlanLabel}</div>
                        <div className="text-2xl font-semibold mt-2">{plan.title || t.accountPlanFreeTitle}</div>
                        <div className="text-sm mt-2 text-emerald-600 font-medium">
                          {String(plan.status || 'active').toLowerCase() === 'active' ? t.accountStatusActive : plan.status}
                        </div>
                        {plan.renews_at ? (
                          <div className="text-sm text-slate-500 mt-2">{t.accountPlanRenewsOn.replace('{date}', formatUiDate(plan.renews_at))}</div>
                        ) : (
                          <div className="text-sm text-slate-500 mt-2">{plan.description || t.accountPlanNoRenewal}</div>
                        )}
                      </div>
                      {plan.tier === 'free' ? (
                        <Button variant="primary" onClick={() => navigate('/pricing')}>{t.accountPlanUpgrade}</Button>
                      ) : isPromoOnlyPlan ? (
                        <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          {t.accountPromoOnlyPlan}
                        </span>
                      ) : (
                        <Button variant="secondary" onClick={() => navigate('/contact')}>{t.accountManageSubscription}</Button>
                      )}
                    </div>
                  </PageCard>

                  <PageCard className="account-card-enter">
                    <div className="text-xs uppercase tracking-widest text-slate-500">{t.accountPromoCodeLabel}</div>
                    <h2 className="text-xl font-semibold mt-2">{t.accountPromoRedeemTitle}</h2>
                    <p className="text-sm text-slate-600 mt-2">
                      {t.accountPromoRedeemSubtitle}
                    </p>

                    <form
                      className="mt-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void redeemAccountPromoCode();
                      }}
                    >
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          value={accountPromoCode}
                          onChange={(event) => setAccountPromoCode(event.target.value.toUpperCase())}
                          placeholder="SAVE20"
                          className={`account-promo-input w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold tracking-wide uppercase ${
                            accountInputShake ? 'account-input-shake' : ''
                          }`}
                        />
                        <Button
                          type="submit"
                          className="sm:min-w-[128px]"
                          disabled={isRedeeming}
                        >
                          {isRedeeming ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="account-spinner" />
                              {t.accountApplying}
                            </span>
                          ) : (
                            t.accountApply
                          )}
                        </Button>
                      </div>
                    </form>

                    {isRedeeming && accountRedeemSlow && (
                      <div className="text-xs text-slate-500 mt-3 account-loading-note">
                        {accountRedeemVerySlow ? t.accountStillWorking : t.accountApplyingPromo}
                      </div>
                    )}

                    {hasSuccess && (
                      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3 text-sm account-banner-success">
                        <div className="font-semibold">{t.accountPromoApplied}</div>
                        <div>{accountRedeemMessage}</div>
                      </div>
                    )}

                    {hasError && (
                      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm account-banner-error">
                        {accountRedeemMessage}
                      </div>
                    )}

                    {accountBillingError && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 px-4 py-3 text-sm">
                        {accountBillingError}
                      </div>
                    )}
                  </PageCard>

                  <PageCard className={`account-card-enter ${accountBenefitsPulse ? 'account-benefits-pulse' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">{t.accountActiveBenefits}</h2>
                      <span className="text-xs uppercase tracking-widest text-slate-500">
                        {activeBenefits.length}
                      </span>
                    </div>
                    {accountBillingLoading && !accountBilling ? (
                      <div className="text-sm text-slate-500 mt-3">{t.accountLoadingBenefits}</div>
                    ) : activeBenefits.length === 0 ? (
                      <div className="text-sm text-slate-500 mt-3">{t.accountNoActiveBenefits}</div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {activeBenefits.map((benefit) => (
                          <div key={benefit.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="font-medium text-slate-800">{formatBenefitLabel(benefit)}</div>
                            <div className="text-xs text-slate-500 mt-1">
                              {t.accountBenefitStarted.replace('{date}', formatUiDate(benefit.starts_at))}
                              {benefit.ends_at ? ` · ${t.accountBenefitEnds.replace('{date}', formatUiDate(benefit.ends_at))}` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </PageCard>

                  <PageCard className="account-card-enter">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">{t.accountPromoHistory}</h2>
                      <span className="text-xs uppercase tracking-widest text-slate-500">
                        {promoHistory.length}
                      </span>
                    </div>
                    {accountBillingLoading && !accountBilling ? (
                      <div className="text-sm text-slate-500 mt-3">{t.accountLoadingHistory}</div>
                    ) : promoHistory.length === 0 ? (
                      <div className="text-sm text-slate-500 mt-3">{t.accountNoPromoHistory}</div>
                    ) : (
                      <div className="mt-3 overflow-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-slate-500">
                              <th className="py-2 pr-3">{t.accountTableCode}</th>
                              <th className="py-2 pr-3">{t.accountTableActivated}</th>
                              <th className="py-2 pr-3">{t.accountTableBenefit}</th>
                              <th className="py-2">{t.accountTableStatus}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {promoHistory.map((entry) => (
                              <tr key={entry.redemption_id} className="border-t border-slate-100 account-history-row">
                                <td className="py-2 pr-3 font-medium text-slate-800">{entry.code || '-'}</td>
                                <td className="py-2 pr-3 text-slate-600">{formatUiDate(entry.redeemed_at)}</td>
                                <td className="py-2 pr-3 text-slate-700">{formatHistoryBenefit(entry)}</td>
                                <td className="py-2">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                      entry.status === 'active'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                    }`}
                                  >
                                    {entry.status === 'active' ? t.accountStatusActive : entry.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </PageCard>
                </>
              )}

              {accountSection === 'connections' && (
                <PageCard className="account-card-enter">
                  <div className="text-xs uppercase tracking-widest text-slate-500">{t.accountSectionConnections}</div>
                  <h2 className="text-xl font-semibold mt-2">{t.accountProvidersTitle}</h2>
                  <p className="text-sm text-slate-600 mt-2">
                    {t.accountProvidersSubtitle}
                  </p>
                  <div className="mt-4 space-y-3">
                    {providerRows.map((item) => {
                      const row = connectionByProvider.get(item.provider) || null;
                      const connected = Boolean(row?.connected);
                      const pending = accountConnectionPending === item.provider;
                      return (
                        <div key={item.provider} className="rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-800">{item.label}</div>
                            <div className="text-xs text-slate-500 mt-1">
                              {connected
                                ? (row?.email
                                  ? t.accountProviderConnectedAs.replace('{email}', row.email)
                                  : t.accountProviderConnected)
                                : t.accountProviderNotConnected}
                            </div>
                          </div>
                          {connected ? (
                            <Button
                              variant="outline"
                              disabled={pending}
                              onClick={() => void disconnectAccountProvider(item.provider)}
                            >
                              {pending ? t.accountDisconnecting : t.accountDisconnect}
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              disabled={pending}
                              onClick={() => void connectAccountProvider(item.provider)}
                            >
                              {pending ? t.accountConnecting : t.accountConnect}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {accountConnectionsLoading && (
                    <div className="text-sm text-slate-500 mt-4">{t.accountLoadingConnections}</div>
                  )}
                  {accountConnectionsError && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {accountConnectionsError}
                    </div>
                  )}
                </PageCard>
              )}

              {accountSection === 'security' && (
                <PageCard className="account-card-enter">
                  <div className="text-xs uppercase tracking-widest text-slate-500">{t.accountSectionSecurity}</div>
                  <h2 className="text-xl font-semibold mt-2">{t.accountSessionsTitle}</h2>
                  <p className="text-sm text-slate-600 mt-2">
                    {t.accountSessionsSubtitle}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => void loadAccountSessions()}
                      disabled={accountSessionsLoading}
                    >
                      {accountSessionsLoading ? t.accountLoading : t.accountReload}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void logoutAllAccountSessions()}
                      disabled={accountLogoutAllPending}
                    >
                      {accountLogoutAllPending ? t.accountLoggingOut : t.accountLogoutAllDevices}
                    </Button>
                  </div>

                  {accountSessions.length === 0 ? (
                    <div className="text-sm text-slate-500 mt-4">{t.accountNoActiveSessions}</div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {accountSessions.map((session) => (
                        <div key={session.id} className="rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-800">{session.device || t.accountDeviceFallback}</div>
                            <div className="text-xs text-slate-500 mt-1">
                              {session.ip || '-'} · {t.accountSessionLastActive.replace('{date}', formatUiDate(session.last_active))}
                              {session.current ? ` · ${t.accountSessionCurrent}` : ''}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            disabled={accountSessionPending === session.id}
                            onClick={() => void revokeAccountSession(session.id)}
                          >
                            {accountSessionPending === session.id ? t.accountRevoking : t.accountLogout}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {accountSessionsError && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {accountSessionsError}
                    </div>
                  )}
                </PageCard>
              )}

              {accountSection === 'telegram' && (
                <PageCard className="account-card-enter">
                  <div className="text-xs uppercase tracking-widest text-slate-500">{t.accountSectionTelegram}</div>
                  <h2 className="text-xl font-semibold mt-2">{t.accountTelegramTitle}</h2>
                  <p className="text-sm text-slate-600 mt-2">
                    {t.accountTelegramSubtitle}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button onClick={() => void generateTelegramLinkCode()} disabled={accountTelegramCodeLoading}>
                      {accountTelegramCodeLoading ? t.accountGenerating : t.accountGenerateCode}
                    </Button>
                    {accountTelegramCode?.code && (
                      <Button variant="secondary" onClick={() => void copyTelegramLinkCode()}>
                        {accountTelegramCodeCopied ? t.accountCopied : t.accountCopyCode}
                      </Button>
                    )}
                    <a
                      href={TELEGRAM_BOT_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {t.accountOpenTelegramBot}
                    </a>
                  </div>

                  {accountTelegramCode?.code && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-widest text-slate-500">{t.accountOneTimeCode}</div>
                      <div className="mt-2 font-mono text-2xl tracking-widest text-slate-900">{accountTelegramCode.code}</div>
                      <div className="text-xs text-slate-500 mt-2">
                        {accountTelegramCode?.expires_at
                          ? t.accountTelegramExpiresAt.replace('{date}', formatUiDateTime(accountTelegramCode.expires_at))
                          : t.accountTelegramCodeExpiresSoon}
                      </div>
                    </div>
                  )}

                  {accountTelegramCodeError && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {accountTelegramCodeError}
                    </div>
                  )}
                </PageCard>
              )}
              {accountSection === 'pipelines' && (
                <PageCard className="account-card-enter">
                  <div className="text-xs uppercase tracking-widest text-slate-500">{t.accountSectionPipelines || 'Pipelines'}</div>
                  <h2 className="text-xl font-semibold mt-2">AI Workflow Builder</h2>
                  <p className="text-sm text-slate-600 mt-2">
                    Реальный node-based редактор: генерируй workflow через AI, редактируй узлы и запускай его на выбранном файле.
                  </p>

                  <div className="mt-4 grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-widest text-slate-500">AI Workflow Generator</div>
                      <textarea
                        value={accountWorkflowPrompt}
                        onChange={(event) => setAccountWorkflowPrompt(event.target.value)}
                        placeholder='Например: "сделай видео для TikTok и минимизируй размер"'
                        className="mt-3 w-full min-h-[96px] border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => { void generateWorkflowWithAi({ save: false }); }}
                          disabled={Boolean(accountPipelineActionPending)}
                        >
                          {accountPipelineActionPending === 'ai_generate' ? 'Generating...' : 'Generate'}
                        </Button>
                        <Button
                          onClick={() => { void generateWorkflowWithAi({ save: true }); }}
                          disabled={Boolean(accountPipelineActionPending)}
                        >
                          {accountPipelineActionPending === 'ai_generate_save' ? 'Saving...' : 'Generate + Save'}
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="text-xs uppercase tracking-widest text-slate-500">Runtime</div>
                      <div className="mt-2 text-sm text-slate-700">Pipelines: <strong>{accountPipelines.length}</strong></div>
                      <div className="mt-1 text-sm text-slate-700">Selected: <strong>{accountPipelineDraftName || '—'}</strong></div>
                      <div className="mt-1 text-sm text-slate-700">Nodes: <strong>{accountPipelineDraftNodes.length}</strong></div>
                      <div className="mt-1 text-sm text-slate-700">Source: <strong>{accountPipelineDraftSource || 'manual'}</strong></div>
                      <div className="mt-3 flex gap-2">
                        <Button variant="secondary" onClick={() => void loadAccountPipelines()} disabled={accountPipelinesLoading}>
                          {accountPipelinesLoading ? t.accountLoading : t.accountReload}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            resetPipelineDraft();
                            setAccountSelectedPipelineId('');
                          }}
                          disabled={Boolean(accountPipelineActionPending)}
                        >
                          New draft
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-widest text-slate-500">Node Graph</div>
                    <div className="mt-3">
                      <input
                        type="text"
                        value={accountPipelineDraftName}
                        onChange={(event) => setAccountPipelineDraftName(event.target.value)}
                        placeholder="Workflow name"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="mt-3 space-y-3">
                      {accountPipelineDraftNodes.map((node, index) => (
                        <div key={node.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-semibold flex items-center justify-center">
                              {index + 1}
                            </div>
                            <select
                              value={node.type}
                              onChange={(event) => updateAccountPipelineNode(node.id, 'type', event.target.value)}
                              className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white"
                            >
                              {ACCOUNT_WORKFLOW_NODE_TYPES.map((item) => (
                                <option key={item.value} value={item.value}>{item.label}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={node.label}
                              onChange={(event) => updateAccountPipelineNode(node.id, 'label', event.target.value)}
                              className="flex-1 min-w-[180px] border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white"
                              placeholder="Node label"
                            />
                            {node.type === 'convert' && (
                              <select
                                value={node.tool || ''}
                                onChange={(event) => updateAccountPipelineNode(node.id, 'tool', event.target.value)}
                                className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white min-w-[170px]"
                              >
                                <option value="">Select tool</option>
                                {tools.map((tool) => (
                                  <option key={tool.id} value={tool.id}>{tool.name}</option>
                                ))}
                              </select>
                            )}
                            <Button
                              variant="outline"
                              onClick={() => removeAccountPipelineNode(node.id)}
                              disabled={accountPipelineDraftNodes.length <= 1 || Boolean(accountPipelineActionPending)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={addAccountPipelineNode} disabled={Boolean(accountPipelineActionPending)}>
                        Add node
                      </Button>
                      <Button onClick={() => { void saveAccountPipelineDraft(); }} disabled={Boolean(accountPipelineActionPending)}>
                        {accountPipelineActionPending.startsWith('save:') || accountPipelineActionPending === 'create' ? 'Saving...' : 'Save workflow'}
                      </Button>
                      {accountSelectedPipelineId && (
                        <Button
                          variant="outline"
                          onClick={() => { void runAccountPipeline(accountSelectedPipelineId); }}
                          disabled={Boolean(accountPipelineRunPending)}
                        >
                          {accountPipelineRunPending === accountSelectedPipelineId ? 'Running...' : 'Run workflow'}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-widest text-slate-500">Saved Workflows</div>
                    {accountPipelines.length === 0 ? (
                      <div className="text-sm text-slate-500 mt-3">No workflows yet. Generate one with AI or create manually.</div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {accountPipelines.map((item) => {
                          const itemId = String(item?.id || '');
                          const summary = item?.summary && typeof item.summary === 'object' ? item.summary : {};
                          const selected = itemId && itemId === accountSelectedPipelineId;
                          return (
                            <div
                              key={itemId}
                              className={`rounded-xl border px-3 py-3 ${selected ? 'border-slate-900 bg-slate-50' : 'border-slate-200'}`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="font-semibold text-slate-900">{item.name || 'Workflow'}</div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    nodes: {Number(summary.nodes_total || 0)} · steps: {Number(summary.steps_total || 0)} · tool: {summary.primary_tool || '—'}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button variant="secondary" onClick={() => openAccountPipelineForEdit(item)}>
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => { void runAccountPipeline(itemId); }}
                                    disabled={Boolean(accountPipelineRunPending)}
                                  >
                                    {accountPipelineRunPending === itemId ? 'Running...' : 'Run'}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => { void deleteAccountPipeline(itemId); }}
                                    disabled={Boolean(accountPipelineActionPending)}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {accountPipelinesError && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {accountPipelinesError}
                    </div>
                  )}
                </PageCard>
              )}
              {accountSection === 'api' && (
                <PageCard className="account-card-enter">
                  <div className="text-xs uppercase tracking-widest text-slate-500">{t.accountSectionApi}</div>
                  <h2 className="text-xl font-semibold mt-2">API Key Management</h2>
                  <p className="text-sm text-slate-600 mt-2">
                    Create API keys, set plan limits, revoke/regenerate keys, and monitor usage.
                  </p>

                  <div className="mt-4 grid md:grid-cols-[1fr_180px_auto] gap-3">
                    <input
                      type="text"
                      value={accountApiCreateName}
                      onChange={(event) => setAccountApiCreateName(event.target.value)}
                      placeholder="Key name (e.g. Backend prod)"
                      className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
                    />
                    <select
                      value={accountApiCreatePlan}
                      onChange={(event) => setAccountApiCreatePlan(event.target.value)}
                      className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                    <Button onClick={() => void createAccountApiKey()} disabled={Boolean(accountApiActionPending)}>
                      {accountApiActionPending === 'create' ? 'Creating...' : 'Create key'}
                    </Button>
                  </div>

                  {accountApiNewToken && (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="text-xs uppercase tracking-widest text-emerald-700">Token (shown once)</div>
                      <div className="mt-2 font-mono text-sm break-all text-emerald-900">{accountApiNewToken}</div>
                      <div className="mt-3">
                        <Button variant="secondary" onClick={() => void copyAccountApiToken()}>Copy token</Button>
                      </div>
                    </div>
                  )}

                  {accountApiKeysError && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {accountApiKeysError}
                    </div>
                  )}

                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-widest text-slate-500">Usage summary</div>
                        <div className="text-sm text-slate-700 mt-1">
                          Month: {accountApiUsageSummary?.month || '-'} · Requests: {Number(accountApiUsageSummary?.requests || 0)} · Errors: {Number(accountApiUsageSummary?.errors || 0)}
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          void loadAccountApiKeys();
                          void loadAccountApiWebhooks({ silent: true });
                        }}
                      >
                        {accountApiKeysLoading ? 'Refreshing...' : 'Refresh'}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 overflow-auto">
                    {accountApiKeys.length === 0 ? (
                      <div className="text-sm text-slate-600">No API keys yet.</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-500">
                            <th className="py-2">Name</th>
                            <th className="py-2">Plan</th>
                            <th className="py-2">Rate/min</th>
                            <th className="py-2">Monthly quota</th>
                            <th className="py-2">Allowlist IPs</th>
                            <th className="py-2">Last used</th>
                            <th className="py-2">Status</th>
                            <th className="py-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accountApiKeys.map((key) => {
                            const revokePending = accountApiActionPending === `revoke:${key.id}`;
                            const regenPending = accountApiActionPending === `regenerate:${key.id}`;
                            return (
                              <tr key={key.id} className="border-t border-slate-100">
                                <td className="py-2">
                                  <div className="font-semibold text-slate-800">{key.name}</div>
                                  <div className="text-[11px] text-slate-500">{key.key_prefix}...</div>
                                </td>
                                <td className="py-2 text-slate-700">{String(key.plan || 'free').toUpperCase()}</td>
                                <td className="py-2 text-slate-700">{Number(key.rate_limit_per_min || 0)}</td>
                                <td className="py-2 text-slate-700">{Number(key.quota_monthly || 0)}</td>
                                <td className="py-2">
                                  <div className="flex flex-col gap-2">
                                    <input
                                      type="text"
                                      value={accountApiAllowlistDrafts[key.id] || ''}
                                      onChange={(event) => {
                                        const nextValue = event.target.value;
                                        setAccountApiAllowlistDrafts((prev) => ({ ...prev, [key.id]: nextValue }));
                                      }}
                                      placeholder="127.0.0.1, 10.0.0.5"
                                      className="border border-slate-300 rounded-lg px-2 py-1 text-xs min-w-[220px]"
                                    />
                                    <Button
                                      variant="outline"
                                      onClick={() => void saveAccountApiAllowlist(key.id)}
                                      disabled={Boolean(accountApiActionPending)}
                                    >
                                      {accountApiActionPending === `allowlist:${key.id}` ? 'Saving...' : 'Save IPs'}
                                    </Button>
                                  </div>
                                </td>
                                <td className="py-2 text-slate-600">{key.last_used_at ? formatUiDateTime(key.last_used_at) : '-'}</td>
                                <td className="py-2 text-slate-700">{key.revoked_at ? 'Revoked' : 'Active'}</td>
                                <td className="py-2">
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      variant="secondary"
                                      onClick={() => void regenerateAccountApiKey(key.id)}
                                      disabled={Boolean(accountApiActionPending)}
                                    >
                                      {regenPending ? 'Regenerating...' : 'Regenerate'}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => void revokeAccountApiKey(key.id)}
                                      disabled={Boolean(accountApiActionPending) || Boolean(key.revoked_at)}
                                    >
                                      {revokePending ? 'Revoking...' : 'Revoke'}
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-widest text-slate-500">Webhooks</div>
                        <div className="text-sm text-slate-700 mt-1">Subscribe to job events and receive signed callbacks.</div>
                      </div>
                      <Button variant="secondary" onClick={() => void loadAccountApiWebhooks()}>
                        {accountApiWebhooksLoading ? 'Refreshing...' : 'Refresh webhooks'}
                      </Button>
                    </div>

                    <div className="mt-4 grid md:grid-cols-[220px_1fr_auto] gap-3">
                      <select
                        value={accountApiWebhookKeyId}
                        onChange={(event) => setAccountApiWebhookKeyId(event.target.value)}
                        className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
                      >
                        <option value="">Select API key</option>
                        {accountApiKeys.map((key) => (
                          <option key={key.id} value={key.id}>{key.name} ({key.key_prefix}...)</option>
                        ))}
                      </select>
                      <input
                        type="url"
                        value={accountApiWebhookUrl}
                        onChange={(event) => setAccountApiWebhookUrl(event.target.value)}
                        placeholder="https://example.com/webhooks/megaconvert"
                        className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
                      />
                      <Button onClick={() => void createAccountApiWebhook()} disabled={Boolean(accountApiActionPending)}>
                        {accountApiActionPending === 'webhook:create' ? 'Creating...' : 'Create webhook'}
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-700">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(accountApiWebhookEvents.completed)}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setAccountApiWebhookEvents((prev) => ({ ...prev, completed: checked }));
                          }}
                        />
                        job.completed
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(accountApiWebhookEvents.failed)}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setAccountApiWebhookEvents((prev) => ({ ...prev, failed: checked }));
                          }}
                        />
                        job.failed
                      </label>
                    </div>

                    {accountApiWebhookSecret && (
                      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                        Webhook secret (shown once): <span className="font-mono break-all">{accountApiWebhookSecret}</span>
                      </div>
                    )}
                    {accountApiWebhookError && (
                      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {accountApiWebhookError}
                      </div>
                    )}

                    <div className="mt-4 space-y-3">
                      {accountApiWebhooks.length === 0 ? (
                        <div className="text-sm text-slate-600">No webhooks configured.</div>
                      ) : (
                        accountApiWebhooks.map((item) => (
                          <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="font-medium text-slate-900">{item.url}</div>
                                <div className="text-xs text-slate-500 mt-1">
                                  API key: {item.api_key_id} · events: {Array.isArray(item.events) ? item.events.join(', ') : '-'}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="secondary"
                                  onClick={() => void toggleAccountApiWebhook(item)}
                                  disabled={Boolean(accountApiActionPending)}
                                >
                                  {accountApiActionPending === `webhook:toggle:${item.id}`
                                    ? 'Saving...'
                                    : (item.is_active === false ? 'Activate' : 'Pause')}
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => void testAccountApiWebhook(item.id)}
                                  disabled={Boolean(accountApiActionPending)}
                                >
                                  {accountApiActionPending === `webhook:test:${item.id}` ? 'Sending...' : 'Send test'}
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => void deleteAccountApiWebhook(item.id)}
                                  disabled={Boolean(accountApiActionPending)}
                                >
                                  {accountApiActionPending === `webhook:delete:${item.id}` ? 'Deleting...' : 'Delete'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-4">
                      <div className="text-xs uppercase tracking-widest text-slate-500">Recent deliveries</div>
                      {accountApiWebhookDeliveries.length === 0 ? (
                        <div className="text-sm text-slate-600 mt-2">No deliveries yet.</div>
                      ) : (
                        <div className="mt-2 overflow-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-slate-500">
                                <th className="py-1">Event</th>
                                <th className="py-1">Status</th>
                                <th className="py-1">Webhook</th>
                                <th className="py-1">Time</th>
                                <th className="py-1">Error</th>
                              </tr>
                            </thead>
                            <tbody>
                              {accountApiWebhookDeliveries.map((row) => (
                                <tr key={row.id} className="border-t border-slate-100">
                                  <td className="py-1 text-slate-700">{row.event || '-'}</td>
                                  <td className="py-1 text-slate-700">{Number(row.status || 0)}</td>
                                  <td className="py-1 text-slate-500">{row.webhook_id || '-'}</td>
                                  <td className="py-1 text-slate-500">{row.created_at ? formatUiDateTime(row.created_at) : '-'}</td>
                                  <td className="py-1 text-slate-600">{row.error || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </PageCard>
              )}
            </div>
          </div>
        )}
      </Page>
    );
  };

  const renderBlogPage = () => (
    <Page title={t.pageBlogTitle} subtitle={t.pageBlogSubtitle}>
      {remoteBlogLoading && (
        <PageCard className="mb-6 text-sm text-slate-500">{t.blogLoadingUpdates}</PageCard>
      )}
      {remoteBlogError && (
        <PageCard className="mb-6 border-amber-200 bg-amber-50 text-sm text-amber-700">
          {remoteBlogError}
        </PageCard>
      )}
      <div className="grid md:grid-cols-2 gap-6">
        {blogPosts.map((post) => {
          const likeView = getBlogLikeView(post);
          return (
            <PageCard key={post.slug} className="flex flex-col">
              <div className="flex items-center gap-2 text-xs">
                <span className="uppercase tracking-widest text-slate-500">{post.date}</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500">{post.readTime}</span>
              </div>
              <div className="font-semibold text-lg mt-2">{post.title}</div>
              <div className="text-sm text-slate-600 mt-2">{post.excerpt}</div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <Badge color="slate">{post.category}</Badge>
                {likeView.enabled && (
                  <button
                    onClick={() => void toggleBlogLike(post)}
                    disabled={likeView.pending}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ${
                      likeView.liked
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                    } disabled:opacity-60`}
                  >
                    {likeView.liked ? '❤️' : '♡'} {likeView.count}
                  </button>
                )}
              </div>
              <Button
                variant="secondary"
                className="mt-6"
                onClick={() => navigate(`${isGuides ? '/guides' : '/blog'}/${post.slug}`)}
                data-testid={`${isGuides ? 'guides' : 'blog'}-read-${post.slug}`}
              >
                {t.btnReadMore}
              </Button>
            </PageCard>
          );
        })}
      </div>
    </Page>
  );

  const renderBlogArticlePage = (post) => (
    <Page
      title={post.title}
      subtitle={post.excerpt}
      actions={(
        <>
          <Button variant="secondary" onClick={() => navigate(isGuidesArticle ? '/guides' : '/blog')}>{t.back}</Button>
          {post.toolId ? (
            <Button onClick={() => openToolRoute(post.toolId, { autoPick: true })}>{t.btnOpenConverter}</Button>
          ) : null}
        </>
      )}
    >
      <div className="space-y-6">
        <PageCard className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <Badge color="blue">{post.category}</Badge>
            <span className="text-slate-500">{post.date}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">{post.readTime}</span>
          </div>
          {(() => {
            const likeView = getBlogLikeView(post);
            if (!likeView.enabled) return null;
            return (
              <button
                onClick={() => void toggleBlogLike(post)}
                disabled={likeView.pending}
                className={`px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ${
                  likeView.liked
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                } disabled:opacity-60`}
              >
                {likeView.liked ? '❤️' : '♡'} {likeView.count}
              </button>
            );
          })()}
        </PageCard>
        {post.sections.map((section) => (
          <PageCard key={section.heading} className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">{section.heading}</h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={`${section.heading}-${index}`} className="text-sm md:text-base leading-7 text-slate-700">
                {paragraph}
              </p>
            ))}
            {section.bullets && section.bullets.length > 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <LegalList items={section.bullets} />
              </div>
            ) : null}
          </PageCard>
        ))}
      </div>
    </Page>
  );

  const renderBlogArticleFallbackPage = () => (
    <Page
      title={remoteBlogLoading ? t.blogLoadingArticleTitle : t.blogArticleNotFoundTitle}
      subtitle={remoteBlogLoading ? t.blogLoadingArticleSubtitle : t.blogArticleNotFoundSubtitle}
      actions={<Button variant="secondary" onClick={() => navigate('/blog')}>{t.back}</Button>}
    >
      {remoteBlogError ? (
        <PageCard className="border-amber-200 bg-amber-50 text-amber-700 text-sm">
          {remoteBlogError}
        </PageCard>
      ) : null}
    </Page>
  );

  const renderFaqPage = () => (
    <Page title={t.pageFaqTitle} subtitle={t.pageFaqSubtitle}>
      <div className="grid md:grid-cols-2 gap-6">
        {faqItems.map((item) => (
          <PageCard key={item.q}>
            <div className="font-semibold">{item.q}</div>
            <div className="text-sm text-slate-600 mt-2">{item.a}</div>
          </PageCard>
        ))}
      </div>
    </Page>
  );

  const renderPrivacyPage = () => (
    <Page title={t.pagePrivacyTitle} subtitle={t.pagePrivacySubtitle}>
      <div className="space-y-6">
        <PageCard className="space-y-3">
          <div className="text-sm text-slate-500">
            <span className="font-semibold">{t.legalLastUpdatedLabel}</span> {formatUiDate(LEGAL_LAST_UPDATED)}
          </div>
          <p className="text-sm text-slate-600">{t.privacyIntroText}</p>
          <p className="text-sm text-slate-600">
            <span className="font-semibold">{t.legalWebsiteLabel}</span>{' '}
            <a href={LEGAL_WEBSITE} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
              {LEGAL_WEBSITE}
            </a>
          </p>
          <p className="text-sm text-slate-600">
            <span className="font-semibold">{t.legalContactLabel}</span>{' '}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-blue-700 hover:underline">
              {LEGAL_CONTACT_EMAIL}
            </a>
          </p>
        </PageCard>

        <LegalSectionCard title={t.privacySection1Title}>
          <p className="text-sm text-slate-600">{t.privacySection1Desc}</p>
        </LegalSectionCard>
        <LegalSectionCard title={t.privacySection2Title}>
          <p className="text-sm text-slate-600">{t.privacySection2Desc}</p>
        </LegalSectionCard>
        <LegalSectionCard title={t.privacySection3Title}>
          <p className="text-sm text-slate-600">{t.privacySection3Desc}</p>
        </LegalSectionCard>
        <LegalSectionCard title={t.privacySection4Title}>
          <p className="text-sm text-slate-600">{t.privacySection4Desc}</p>
        </LegalSectionCard>
      </div>
    </Page>
  );

  const renderTermsPage = () => (
    <Page title={t.pageTermsTitle} subtitle={t.pageTermsSubtitle}>
      <div className="space-y-6">
        <PageCard className="space-y-3">
          <div className="text-sm text-slate-500">
            <span className="font-semibold">{t.legalLastUpdatedLabel}</span> {formatUiDate(LEGAL_LAST_UPDATED)}
          </div>
          <p className="text-sm text-slate-600">{t.termsIntroText}</p>
        </PageCard>

        <LegalSectionCard title={t.termsSection1Title}>
          <p className="text-sm text-slate-600">{t.termsSection1Desc}</p>
        </LegalSectionCard>
        <LegalSectionCard title={t.termsSection2Title}>
          <p className="text-sm text-slate-600">{t.termsSection2Desc}</p>
        </LegalSectionCard>
        <LegalSectionCard title={t.termsSection3Title}>
          <p className="text-sm text-slate-600">{t.termsSection3Desc}</p>
        </LegalSectionCard>

        <LegalSectionCard title={t.contactGeneralTitle}>
          <p className="text-sm text-slate-600">
            <span className="font-semibold">{t.legalContactLabel}</span>{' '}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-blue-700 hover:underline">
              {LEGAL_CONTACT_EMAIL}
            </a>
          </p>
        </LegalSectionCard>
      </div>
    </Page>
  );

  const renderCookiePage = () => (
    <Page title={t.pageCookiesTitle} subtitle={t.pageCookiesSubtitle}>
      <div className="space-y-6">
        <PageCard className="space-y-3">
          <div className="text-sm text-slate-500">
            <span className="font-semibold">{t.legalLastUpdatedLabel}</span> {formatUiDate(LEGAL_LAST_UPDATED)}
          </div>
          <p className="text-sm text-slate-600">{t.legalSection4Desc}</p>
          <p className="text-sm text-slate-600">{t.cookieText}</p>
        </PageCard>
        <LegalSectionCard title={t.contactGeneralTitle}>
          <p className="text-sm text-slate-600">
            <span className="font-semibold">{t.legalContactLabel}</span>{' '}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-blue-700 hover:underline">
              {LEGAL_CONTACT_EMAIL}
            </a>
          </p>
        </LegalSectionCard>
      </div>
    </Page>
  );

  const renderDisclaimerPage = () => (
    <Page title={t.pageDisclaimerTitle} subtitle={t.pageDisclaimerSubtitle}>
      <div className="space-y-6">
        <LegalSectionCard title={t.pageDisclaimerTitle}>
          <p className="text-sm text-slate-600">{t.disclaimerBody}</p>
        </LegalSectionCard>
      </div>
    </Page>
  );

  const renderLegalPage = () => (
    <Page title={t.pageLegalTitle} subtitle={t.pageLegalSubtitle}>
      <div className="space-y-6">
        <PageCard className="space-y-3">
          <div className="text-sm text-slate-500">
            <span className="font-semibold">{t.legalLastUpdatedLabel}</span> {formatUiDate(LEGAL_LAST_UPDATED)}
          </div>
          <p className="text-sm text-slate-600">{t.legalResourcesIntro}</p>
        </PageCard>

        <div className="grid md:grid-cols-2 gap-6">
          <PageCard className="space-y-3">
            <h3 className="font-semibold text-slate-900">{t.privacySection1Title}</h3>
            <p className="text-sm text-slate-600">{t.privacySection1Desc}</p>
            <Button variant="secondary" onClick={() => navigate('/privacy')}>{t.navPrivacy}</Button>
          </PageCard>
          <PageCard className="space-y-3">
            <h3 className="font-semibold text-slate-900">{t.termsSection1Title}</h3>
            <p className="text-sm text-slate-600">{t.termsSection1Desc}</p>
            <Button variant="secondary" onClick={() => navigate('/terms')}>{t.navTerms}</Button>
          </PageCard>
          <PageCard className="space-y-3">
            <h3 className="font-semibold text-slate-900">{t.legalSection4Title}</h3>
            <p className="text-sm text-slate-600">{t.legalSection4Desc}</p>
            <Button variant="secondary" onClick={() => navigate('/cookie-policy')}>{t.navCookies}</Button>
          </PageCard>
          <PageCard className="space-y-3">
            <h3 className="font-semibold text-slate-900">{t.pageDisclaimerTitle}</h3>
            <p className="text-sm text-slate-600">{t.pageDisclaimerSubtitle}</p>
            <Button variant="secondary" onClick={() => navigate('/disclaimer')}>{t.navDisclaimer}</Button>
          </PageCard>
        </div>

        <LegalSectionCard title={t.legalDataDeletionTitle}>
          <p className="text-sm text-slate-600">
            {t.legalDataDeletionBody}{' '}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-blue-700 hover:underline">
              {LEGAL_CONTACT_EMAIL}
            </a>
          </p>
        </LegalSectionCard>
      </div>
    </Page>
  );

  const renderAboutPage = () => (
    <Page title={t.pageAboutTitle} subtitle={t.pageAboutSubtitle}>
      <div className="grid md:grid-cols-2 gap-6">
        <PageCard>
          <div className="font-semibold mb-2">{t.aboutSection1Title}</div>
          <div className="text-sm text-slate-600">{t.aboutSection1Desc}</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-2">{t.aboutSection2Title}</div>
          <div className="text-sm text-slate-600">{t.aboutSection2Desc}</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-2">{t.aboutSection3Title}</div>
          <div className="text-sm text-slate-600">{t.aboutSection3Desc}</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-2">{t.aboutSection4Title}</div>
          <div className="text-sm text-slate-600">{t.aboutSection4Desc}</div>
        </PageCard>
      </div>
    </Page>
  );

  const renderContactPage = () => (
    <Page title={t.pageContactTitle} subtitle={t.pageContactSubtitle}>
      <div className="grid md:grid-cols-2 gap-6">
        <LegalSectionCard title={t.contactGeneralTitle}>
          <p className="text-sm text-slate-600">
            {t.contactGeneralIntro}
          </p>
          <p className="text-sm text-slate-600">
            <span className="font-semibold">{t.legalContactLabel}</span>{' '}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-blue-700 hover:underline">
              {LEGAL_CONTACT_EMAIL}
            </a>
          </p>
          <p className="text-sm text-slate-600">{t.contactResponseTime}</p>
        </LegalSectionCard>

        <LegalSectionCard title={t.contactPrivacyChecklistTitle}>
          <p className="text-sm text-slate-600">{t.contactPrivacyChecklistIntro}</p>
          <LegalList
            items={[
              t.contactPrivacyChecklistItem1,
              t.contactPrivacyChecklistItem2,
              t.contactPrivacyChecklistItem3
            ]}
          />
          <p className="text-sm text-slate-600">{t.contactThanks}</p>
        </LegalSectionCard>
      </div>
    </Page>
  );

  const renderMissionPage = () => (
    <Page title="Mission" subtitle="Build the most secure and intelligent file workspace on the web.">
      <div className="grid md:grid-cols-2 gap-6">
        <PageCard>
          <div className="font-semibold mb-2">What we build</div>
          <div className="text-sm text-slate-600">Conversion, automation, observability and trust in one platform.</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-2">How we build</div>
          <div className="text-sm text-slate-600">Reliability-first architecture with transparent status and explainable AI.</div>
        </PageCard>
      </div>
    </Page>
  );

  const renderCareersPage = () => (
    <Page title="Careers" subtitle="Join the team building enterprise-grade file infrastructure.">
      <PageCard>
        <div className="text-sm text-slate-600">Open roles: Product Engineer, Platform Engineer, Security Engineer.</div>
        <div className="mt-3 text-sm text-slate-600">Send portfolio and CV to <a className="text-blue-700 hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.</div>
      </PageCard>
    </Page>
  );

  const renderPressPage = () => (
    <Page title="Press Kit" subtitle="Brand assets, product screenshots, and company facts for media.">
      <div className="grid md:grid-cols-2 gap-6">
        <PageCard>
          <div className="font-semibold mb-2">Assets</div>
          <div className="text-sm text-slate-600">Logos, screenshots, and product overview available on request.</div>
        </PageCard>
        <PageCard>
          <div className="font-semibold mb-2">Media Contact</div>
          <div className="text-sm text-slate-600"><a className="text-blue-700 hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a></div>
        </PageCard>
      </div>
    </Page>
  );

  const renderResourcesPage = () => (
    <Page title="Resources" subtitle="Documentation, guides, roadmap and security materials.">
      <div className="grid md:grid-cols-2 gap-6">
        {[
          { title: 'API Docs', path: '/api' },
          { title: 'Developer Portal', path: '/developer-portal' },
          { title: 'Roadmap', path: '/roadmap' },
          { title: 'Changelog', path: '/changelog' },
          { title: 'Status', path: '/status' },
          { title: 'Security Whitepaper', path: '/security-whitepaper' },
          { title: 'Bug Bounty', path: '/bug-bounty' },
          { title: 'Help Center', path: '/faq' }
        ].map((item) => (
          <PageCard key={item.title}>
            <div className="font-semibold">{item.title}</div>
            <Button className="mt-3" variant="secondary" onClick={() => navigate(item.path)}>Open</Button>
          </PageCard>
        ))}
      </div>
    </Page>
  );

  const renderBugBountyPage = () => (
    <Page title="Bug Bounty" subtitle="Responsible disclosure process for security researchers.">
      <PageCard>
        <div className="text-sm text-slate-600">Report vulnerabilities to <a className="text-blue-700 hover:underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. Include reproduction steps, impact and proof of concept.</div>
      </PageCard>
    </Page>
  );

  const renderSecurityWhitepaperPage = () => (
    <Page title="Security Whitepaper" subtitle="Processing model, encryption and retention controls.">
      <PageCard>
        <div className="text-sm text-slate-600">Request PDF whitepaper from security team. Includes architecture, controls, and incident process.</div>
        <Button className="mt-3" onClick={() => navigate('/contact')}>Request whitepaper</Button>
      </PageCard>
    </Page>
  );

  const renderApiPage = () => (
    <Page title="API" subtitle="Автоматизируйте конвертации в продуктах и пайплайнах.">
      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <PageCard>
          <div className="text-xs uppercase tracking-widest text-slate-500">{t.accountSectionApi}</div>
          <h2 className="text-2xl font-semibold mt-3 text-slate-100">Быстрый старт</h2>
          <p className="text-sm text-slate-500 mt-2">Стабильные эндпойнты, изоляция задач и прозрачные статусы.</p>
          <pre className="mt-4 text-xs bg-slate-50 rounded-xl p-4 border border-slate-200 whitespace-pre-wrap">
{`curl -X POST https://api.megaconvert.ai/v1/jobs \\
  -H "Authorization: Bearer MC_API_KEY" \\
  -F "tool=pdf-word" \\
  -F "file=@report.pdf"`}
          </pre>
          <pre className="mt-3 text-xs bg-slate-50 rounded-xl p-4 border border-slate-200 whitespace-pre-wrap">
{`import { createJob } from "@megaconvert/sdk"

const job = await createJob({
  tool: "pdf-word",
  file: "./report.pdf"
})

console.log(job.status, job.downloadUrl)`}
          </pre>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => navigate('/contact')}>{t.btnRequestAccess}</Button>
            <Button variant="secondary" onClick={() => navigate('/pricing')}>{t.btnViewPricing}</Button>
          </div>
        </PageCard>
        <div className="space-y-6">
          <PageCard>
            <div className="text-xs uppercase tracking-widest text-slate-500">API ключ</div>
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4 font-mono text-sm text-slate-100">
              MC_API_KEY_••••••••••••••••
            </div>
            <div className="text-xs text-slate-500 mt-2">Храните ключи в секретах CI/CD и менеджерах окружения.</div>
          </PageCard>
          <PageCard>
            <div className="text-xs uppercase tracking-widest text-slate-500">{t.labelStatusSystem}</div>
            <h2 className="text-2xl font-semibold mt-3 text-slate-100">{t.statusCoreServicesTitle}</h2>
            <p className="text-sm text-slate-500 mt-2">{t.labelStatusNote}</p>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>{t.statusServiceApi}</span>
                <span className="text-emerald-600 font-semibold">{t.statusOperationalLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t.statusServiceWorkers}</span>
                <span className="text-emerald-600 font-semibold">{t.statusOperationalLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t.statusServiceStorage}</span>
                <span className="text-emerald-600 font-semibold">{t.statusOperationalLabel}</span>
              </div>
            </div>
          </PageCard>
        </div>
      </div>
    </Page>
  );

  const renderSharePage = () => (
    <SharePage key={shareToken} token={shareToken} apiBase={API_BASE} lang={lang} onNavigate={navigate} />
  );

  const renderLocalConverterToolPage = () => (
    <Page
      title="Локальная конвертация медиа"
      subtitle="FFmpeg WebAssembly в браузере: без отправки файлов на сервер"
      actions={(
        <>
          <Button variant="secondary" onClick={() => navigate('/tools')}>{t.btnBrowseTools}</Button>
          <Button onClick={() => navigate('/workspace/local-convert')}>Workspace 3.0</Button>
        </>
      )}
    >
      <LocalMediaConverterTool onCloudFallback={() => navigate('/convert')} />
    </Page>
  );

  const renderOcrToolPage = () => (
    <Page
      title="OCR распознавание текста"
      subtitle="Tesseract.js в браузере: извлечение текста без отправки файлов на сервер"
      actions={(
        <>
          <Button variant="secondary" onClick={() => navigate('/tools')}>{t.btnBrowseTools}</Button>
          <Button onClick={() => navigate('/ai')}>AI</Button>
        </>
      )}
    >
      <OcrRecognitionTool />
    </Page>
  );

  const renderPdfEditorToolPage = () => (
    <Page
      title="Визуальный PDF-редактор"
      subtitle="pdf-lib в браузере: удаляйте страницы, меняйте порядок и сохраняйте новый PDF локально"
      actions={(
        <>
          <Button variant="secondary" onClick={() => navigate('/tools')}>{t.btnBrowseTools}</Button>
          <Button onClick={() => navigate('/workspace/pdf-editor')}>Workspace 3.0</Button>
        </>
      )}
    >
      <PdfEditorTool />
    </Page>
  );

  const renderImageCompressorToolPage = () => (
    <Page
      title="Интерактивное сжатие изображений"
      subtitle="browser-image-compression в браузере: управляйте качеством и сравнивайте До/После"
      actions={(
        <>
          <Button variant="secondary" onClick={() => navigate('/tools')}>{t.btnBrowseTools}</Button>
          <Button onClick={() => navigate('/workspace/image-optimizer')}>Workspace 3.0</Button>
        </>
      )}
    >
      <ImageCompressorTool />
    </Page>
  );

  const renderBatchWatermarkToolPage = () => (
    <Page
      title="Пакетный watermark"
      subtitle="Массовая обработка изображений в браузере: текст, цвет, позиция и ZIP-архив"
      actions={(
        <>
          <Button variant="secondary" onClick={() => navigate('/tools')}>{t.btnBrowseTools}</Button>
          <Button onClick={() => navigate('/workspace/watermark-batch')}>Workspace 3.0</Button>
        </>
      )}
    >
      <BatchWatermarkTool apiBase={API_BASE} />
    </Page>
  );

  const renderAiPage = () => (
    <AiStudioPage
      file={file}
      files={files}
      isDragOver={isDragOver}
      onDragEnter={() => setIsDragOver(true)}
      onDragLeave={() => setIsDragOver(false)}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        handleFilesSelected(event.dataTransfer.files);
      }}
      onBrowseClick={openFilePicker}
      onClear={reset}
      prompt={aiAssistantPrompt}
      onPromptChange={(value) => {
        setAiAssistantPrompt(value);
        if (aiAssistantError) setAiAssistantError('');
      }}
      onSubmit={() => {
        void handleAiAssistantSubmit();
      }}
      onSuggestionPick={(value) => {
        setAiAssistantPrompt(value);
        if (aiAssistantError) setAiAssistantError('');
      }}
      disabled={aiAssistantStage !== 'idle' || !(files[0] || file) || !String(aiAssistantPrompt || '').trim()}
      stage={aiAssistantStage}
      intent={aiAssistantIntent}
      error={aiAssistantError}
      status={status}
      progress={progress}
      pipelineStage={pipelineStage}
      downloadUrl={downloadUrl}
      conversionError={typeof errorInfo === 'string' ? errorInfo : (errorInfo?.message || '')}
      onDownload={download}
      onReset={reset}
      canQuickLook={canOpenQuickLook}
      onQuickLook={() => void openQuickLook()}
      batchStackNode={files.length > 1 ? (
        <DynamicBatchStack
          items={batchLiveItems.length ? batchLiveItems : buildBatchLiveItems(files)}
          overallProgress={progress}
          status={status}
        />
      ) : null}
    />
  );

  const renderWorkspaceV3Page = () => (
    <WorkspaceV3Page path={path} navigate={navigate} />
  );

  const renderNotFoundPage = () => (
    <Page title={t.pageNotFoundTitle} subtitle={t.pageNotFoundSubtitle}>
      <PageCard>
        <div className="text-sm text-slate-600">{t.notFoundBody}</div>
        <div className="mt-4 flex gap-3">
          <Button onClick={() => navigate('/')}>{t.btnGoHome}</Button>
          <Button variant="secondary" onClick={() => navigate('/convert/pdf-to-word')}>{t.btnOpenConverter}</Button>
        </div>
      </PageCard>
    </Page>
  );
  const renderHomePage = () => (
    <>
      <div className="pt-32 pb-24 px-4 relative overflow-hidden page-enter">
        <div className="ambient-orb orb-a absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-500/30 via-violet-500/20 to-slate-900/10 rounded-full blur-3xl opacity-70" />
        <div className="ambient-orb orb-b absolute -bottom-32 -left-24 w-[32rem] h-[32rem] bg-gradient-to-br from-slate-900/40 via-blue-500/20 to-violet-500/10 rounded-full blur-3xl opacity-70" />
        <div className="max-w-5xl mx-auto relative">
          <div className="hero-copy reveal relative z-10 text-slate-100 text-center" data-reveal>
            <Badge color="slate" variant="dark">{t.homeBadgePlatform}</Badge>
            <div className="mt-3 text-xs uppercase tracking-[0.4em] text-slate-400">Smart File Workspace</div>
            <div className="mt-2 text-sm text-blue-200">Secure, intelligent file workspace - faster than any converter.</div>
            <h1 className="text-5xl md:text-6xl font-semibold font-display mt-6 tracking-tight">
              {t.heroTitle}
            </h1>
            <p className="text-lg md:text-xl text-slate-300 mt-5 max-w-2xl mx-auto">
              {t.heroDesc}
            </p>
            <div className="flex flex-wrap gap-3 mt-8 justify-center">
              <Button size="large" onClick={() => { scrollToConverter(); openFilePicker(); }} data-testid="cta-upload">{t.btnUploadFile}</Button>
              <Button size="large" variant="secondary" onClick={() => navigate('/tools')}>{t.btnBrowseTools}</Button>
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-300 justify-center">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span>Без регистрации</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-blue-300" />
                <span>Безопасно</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-amber-300" />
                <span>Быстро</span>
              </div>
            </div>
            <div className="mt-8 grid sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                <div className="font-semibold text-slate-100">{filesConvertedCount.toLocaleString()}</div>
                <div className="text-xs text-slate-400 mt-1">{t.homeFilesConvertedLabel}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                <div className="font-semibold text-slate-100">{t.statusMetricUptimeValue}</div>
                <div className="text-xs text-slate-400 mt-1">{t.statusMetricUptimeLabel}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                <div className="font-semibold text-slate-100">{t.statusMetricProcessingValue}</div>
                <div className="text-xs text-slate-400 mt-1">{t.statusMetricProcessingDesc}</div>
              </div>
            </div>
          </div>

          <div className="hero-converter reveal relative z-10 mt-12 max-w-3xl mx-auto" id="converter" data-reveal>
            {renderConverterPanel({ compact: true })}
          </div>
        </div>
      </div>

      <Section id="preview" className="border-t border-white/10 reveal" data-reveal>
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
          <div>
            <Badge color="blue" variant="dark">{t.homeHowBadge}</Badge>
            <h2 className="text-3xl md:text-4xl font-semibold mt-4 text-slate-100">{t.homeHowTitle}</h2>
            <p className="text-slate-400 mt-3">{t.homeHowSubtitle}</p>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400" />{t.labelStatusNote}</div>
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400" />{t.labelPipelineNote}</div>
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-400" />{t.labelSecurityNoteBody}</div>
            </div>
          </div>
          <div className="mc-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-slate-500">{t.labelSelected}</div>
                <div className="text-lg font-semibold text-slate-900 mt-2">report-q4.pdf</div>
              </div>
              <Badge color="slate">PDF → DOCX</Badge>
            </div>
            <div className="mt-5 grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs uppercase tracking-widest text-slate-500">{t.labelSettings}</div>
                <div className="mt-2 text-sm text-slate-600">Макет: сохранить</div>
                <div className="text-sm text-slate-600">Шрифты: встроить</div>
                <div className="text-sm text-slate-600">Проверка: включена</div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs uppercase tracking-widest text-slate-500">{t.labelEtaPrefix}12s</div>
                <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full w-2/3 bg-gradient-to-r from-blue-600 to-indigo-500" />
                </div>
                <div className="mt-3 text-sm text-slate-600">{t.processing}</div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
              <span>{t.labelFileReady}</span>
              <span className="font-semibold text-slate-900">{t.done}</span>
            </div>
          </div>
        </div>
      </Section>

      <Section id="categories" className="border-t border-white/10 reveal" data-reveal>
        <div className="text-center mb-10">
          <Badge color="purple" variant="dark">{t.homePopularBadge}</Badge>
          <h2 className="text-3xl md:text-4xl font-semibold mt-4 text-slate-100">{t.homePopularTitle}</h2>
          <p className="text-slate-400 mt-3">{t.homePopularSubtitle}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { label: t.categoryDocuments, icon: FileText, desc: 'PDF, DOCX, PPTX, XLSX' },
            { label: t.categoryImages, icon: ImageIcon, desc: 'JPG, PNG, HEIC, SVG' },
            { label: t.categoryVideo, icon: Video, desc: 'MP4, MOV, WEBM, GIF' },
            { label: t.categoryAudio, icon: Music, desc: 'MP3, WAV, AAC, FLAC' },
            { label: t.categoryOtherTools || 'Archives', icon: Box, desc: 'ZIP, RAR, 7Z, TAR' },
            { label: t.navApi || 'Developer', icon: ServerCog, desc: 'API, webhooks, automation' }
          ].map((item) => (
            <div key={item.label} className="mc-card p-6">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
                {React.createElement(item.icon, { size: 18 })}
              </div>
              <div className="font-semibold text-slate-900 mt-4">{item.label}</div>
              <div className="text-sm text-slate-600 mt-2">{item.desc}</div>
              <Button variant="secondary" className="mt-4 w-full" onClick={() => navigate('/tools')}>
                {t.btnBrowseTools}
              </Button>
            </div>
          ))}
        </div>
      </Section>

      <Section id="value" className="border-t border-white/10 reveal" data-reveal>
        <div className="text-center mb-10">
          <Badge color="green" variant="dark">{t.homeFeaturesBadge}</Badge>
          <h2 className="text-3xl md:text-4xl font-semibold mt-4 text-slate-100">{t.homeFeaturesTitle}</h2>
          <p className="text-slate-400 mt-3">{t.homeFeaturesSubtitle}</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featureList.map((feature) => (
            <IconCard key={feature.title} icon={feature.icon} title={feature.title} desc={feature.desc} tone="blue" />
          ))}
        </div>
      </Section>

      <Section id="workflow" className="border-t border-white/10 reveal" data-reveal>
        <div className="text-center mb-10">
          <Badge color="slate" variant="dark">{t.homeHowBadge}</Badge>
          <h2 className="text-3xl md:text-4xl font-semibold mt-4 text-slate-100">{t.homeHowTitle}</h2>
          <p className="text-slate-400 mt-3">{t.homeHowSubtitle}</p>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {[t.stepUpload, t.stepSettings, t.stepConvert, t.stepResult].map((step, index) => (
            <div key={step} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm">
              <div className="text-xs uppercase tracking-widest text-slate-400">{index + 1}</div>
              <div className="mt-2 font-semibold text-slate-100">{step}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="social-proof" className="border-t border-white/10 reveal" data-reveal>
        <div className="text-center mb-10">
          <Badge color="blue" variant="dark">{t.homeTrustedBadge}</Badge>
          <h2 className="text-3xl md:text-4xl font-semibold mt-4 text-slate-100">{t.homeTrustedTitle}</h2>
          <p className="text-slate-400 mt-3">{t.homeTrustedSubtitle}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: t.homeFilesConvertedLabel, value: filesConvertedCount.toLocaleString() },
            { label: t.homeCountries, value: '120+' },
            { label: t.statusMetricUptimeLabel, value: t.statusMetricUptimeValue },
            { label: t.statusMetricProcessingLabel, value: t.statusMetricProcessingValue }
          ].map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
              <div className="text-xs uppercase tracking-widest text-slate-400">{metric.label}</div>
              <div className="text-2xl font-semibold mt-3 text-slate-100">{metric.value}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-4 mt-10">
          {TRUSTED_BY.map((name) => (
            <div key={name} className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-semibold text-slate-300">
              {name}
            </div>
          ))}
        </div>
      </Section>

      <Section id="trust" className="border-t border-white/10 reveal" data-reveal>
        <div className="grid lg:grid-cols-[1fr_1fr] gap-8 items-center">
          <div>
            <Badge color="slate" variant="dark">{t.safetyTitle}</Badge>
            <h2 className="text-3xl md:text-4xl font-semibold mt-4 text-slate-100">{t.securityCardEncryptTitle}</h2>
            <p className="text-slate-400 mt-3">{t.securityCardEncryptDesc}</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {securityBadges.map((badge) => (
              <div key={badge.title} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm">
                <div className="font-semibold text-slate-100">{badge.title}</div>
                <div className="text-xs text-slate-400 mt-1">{badge.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section id="cta" className="border-t border-white/10 reveal" data-reveal>
        <div className="rounded-3xl bg-gradient-to-r from-slate-950 via-blue-900 to-indigo-800 text-white p-10 md:p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-semibold">{t.homeCtaTitle}</h2>
          <p className="text-slate-200 mt-3 max-w-2xl mx-auto">{t.homeCtaSubtitle}</p>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <Button variant="secondary" className="bg-white text-slate-900" onClick={() => { scrollToConverter(); openFilePicker(); }}>
              {t.btnStartConverting}
            </Button>
            <Button variant="outline" className="border-white/40 text-white" onClick={() => navigate('/pricing')}>
              {t.btnViewPricing}
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
  if (isAccountBlocked) {
    return (
      <SmoothScrollProvider>
        <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 flex items-center justify-center">
          <div className="w-full max-w-2xl rounded-3xl border border-red-500/30 bg-red-950/30 backdrop-blur p-8 md:p-10 text-center shadow-[0_24px_80px_rgba(220,38,38,0.22)]">
            <div className="inline-flex items-center rounded-full border border-red-400/40 bg-red-500/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-red-200">
              Account blocked
            </div>
            <h1 className="mt-5 text-3xl md:text-4xl font-semibold text-red-100">
              Ваш аккаунт заблокирован
            </h1>
            <p className="mt-4 text-base md:text-lg text-red-50/90">
              Доступ к сайту полностью отключен. Вы больше не можете пользоваться функциями и переходить по разделам.
            </p>
            {blockedReason && (
              <p className="mt-4 text-sm text-red-200">
                Причина: <span className="font-semibold">{blockedReason.replace(/[_-]+/g, ' ')}</span>
              </p>
            )}
            {blockedSince && (
              <p className="mt-2 text-sm text-red-200">
                Дата блокировки: <span className="font-semibold">{formatUiDateTime(blockedSince)}</span>
              </p>
            )}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {user?.isTestMode && (
                <Button
                  variant="secondary"
                  onClick={() => void handleTestModeUnlock()}
                  disabled={testModeUnlockLoading}
                >
                  {testModeUnlockLoading ? 'Разблокировка...' : 'Разблокировать тестовый режим'}
                </Button>
              )}
              <Button onClick={() => void logoutCurrentUser()}>
                Выйти из аккаунта
              </Button>
            </div>
            {user?.isTestMode && testModeUnlockError && (
              <p className="mt-4 text-sm text-red-200">
                {testModeUnlockError}
              </p>
            )}
          </div>
        </div>
      </SmoothScrollProvider>
    );
  }
  if (isAdmin) {
    return (
      <SmoothScrollProvider>
        <AdminApp
          path={path}
          navigate={navigate}
          apiBase={API_BASE}
          lang={lang}
          t={t}
        />
      </SmoothScrollProvider>
    );
  }
  return (
    <SmoothScrollProvider>
      <div className="site-shell min-h-screen bg-slate-50 text-slate-900 dark:bg-[#09090b] dark:text-slate-100 font-sans transition-all duration-300 ease-out">
      <nav className="top-nav top-nav--minimal fixed w-full z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="nav-pill nav-pill--minimal mt-4 rounded-2xl h-16 px-4 flex items-center justify-between border border-white/40 dark:border-white/10 bg-white/70 dark:bg-[#09090b]/70 backdrop-blur-2xl shadow-[0_10px_40px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition-all duration-300 ease-out">
            <div className="flex items-center gap-2 font-semibold text-lg cursor-pointer text-slate-900 dark:text-slate-100" onClick={() => navigate('/')}>
              <span className="w-9 h-9 rounded-xl bg-slate-900 text-white dark:bg-white/10 dark:text-white flex items-center justify-center border border-slate-200 dark:border-white/10"><Zap size={16} /></span>
              MegaConvert
            </div>
            <div className="hidden lg:flex items-center gap-4 text-slate-600 dark:text-slate-300">
              {navItems.map((item) => (
                <button
                  key={item.to}
                  onClick={() => navigate(item.to)}
                  className={`font-medium transition-all duration-300 ease-out hover:text-slate-900 dark:hover:text-white ${
                    path === item.to
                    || (item.to === '/workspace' && path.startsWith('/workspace/'))
                    || (item.to === '/tools' && path.startsWith('/tools/'))
                      ? 'text-slate-900 dark:text-white'
                      : ''
                  }`}
                  data-testid={`nav-${item.to.replace(/\//g, '') || 'home'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="h-10 w-10 rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all duration-300 ease-out hover:scale-[1.03]"
                aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              >
                {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <div className="relative hidden lg:block" ref={langMenuRef}>
                <button onClick={() => setIsLangMenuOpen(!isLangMenuOpen)} className="h-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300 transition-all duration-300 ease-out hover:scale-[1.02]">
                  {LANGUAGES.find((l) => l.code === lang)?.flag} <ChevronDown size={14} />
                </button>
                {isLangMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-44 bg-white/90 dark:bg-slate-900/95 shadow-xl rounded-2xl border border-slate-200 dark:border-white/10 py-2 backdrop-blur-2xl">
                    {LANGUAGES.map((l) => (
                      <button key={l.code} onClick={() => changeLanguage(l.code)} className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-white/5 flex gap-2 text-slate-700 dark:text-slate-200 text-sm">
                        {l.flag} {l.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {!user ? (
                <Button onClick={() => navigate('/login')}>{t.navLogin}</Button>
              ) : (
                <div className="relative hidden lg:block" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen((value) => !value)}
                    className="h-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white/85 dark:bg-white/5 text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-all duration-300 ease-out hover:scale-[1.02] max-w-[220px]"
                  >
                    <UserCircle2 size={17} className="shrink-0" />
                    <span className="truncate text-sm">{String(user?.name || user?.email || t.navAccount || 'Account')}</span>
                    <ChevronDown size={14} className="shrink-0" />
                  </button>
                  {isUserMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-52 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl shadow-xl p-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          navigate('/account');
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-300 ease-out"
                      >
                        {t.navAccount}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          void logoutCurrentUser();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-sm text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-300 ease-out"
                      >
                        Выйти
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button className="lg:hidden px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-200" onClick={() => setIsMobileMenuOpen((v) => !v)}>
                {t.navMenu}
              </button>
            </div>
          </div>

          {isMobileMenuOpen && (
            <div className="mobile-drawer lg:hidden mt-3 rounded-2xl border border-slate-200 dark:border-white/10 p-4 shadow-lg text-slate-700 dark:text-slate-200 bg-white/90 dark:bg-[#09090b]/95 backdrop-blur-2xl">
              <div className="grid gap-2">
                {navItems.map((item) => (
                  <button
                    key={item.to}
                    onClick={() => navigate(item.to)}
                    className="text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 font-medium transition-all duration-300 ease-out"
                    data-testid={`mobile-nav-${item.to.replace(/\//g, '') || 'home'}`}
                  >
                    {item.label}
                  </button>
                ))}
                {user && (
                  <button onClick={() => navigate('/account')} className="text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 font-medium">{t.navAccount}</button>
                )}
                {!user && (
                  <button onClick={() => navigate('/login')} className="text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 font-medium">{t.navLogin}</button>
                )}
                {user && (
                  <button onClick={() => { void logoutCurrentUser(); }} className="text-left px-3 py-2 rounded-lg text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 font-medium">
                    Выйти
                  </button>
                )}
              </div>
              <div className="mt-4 border-t border-slate-200 dark:border-white/10 pt-4">
                <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t.navLanguage}</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {LANGUAGES.map((item) => (
                    <button key={item.code} onClick={() => changeLanguage(item.code)} className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10 text-xs font-semibold bg-white/90 dark:bg-white/5">
                      {item.flag} {item.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      <input
        type="file"
        ref={fileInputRef}
        data-testid="file-input"
        onChange={e => {
          handleFilesSelected(e.target.files);
        }}
        className="hidden"
        accept={isAiPage ? '*/*' : currentTool.accept}
        multiple
      />

      <main>
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition key={path} pageKey={path}>
            {isConvert ? (
          conversionFromSlug && !toolIds.has(conversionFromSlug.id) ? (
            <SeoPage
              slug={convertSlug}
              onSelectTool={(toolId) => {
                if (!toolIds.has(toolId)) return;
                selectTool(toolId);
              }}
              onNavigate={navigate}
              isToolAvailable={(toolId) => toolIds.has(toolId)}
            />
          ) : (
            renderConvertPage()
          )
        ) : isWorkspaceV3 ? (
          renderWorkspaceV3Page()
        ) : isLocalConverterTool ? (
          renderLocalConverterToolPage()
        ) : isOcrTool ? (
          renderOcrToolPage()
        ) : isPdfEditorTool ? (
          renderPdfEditorToolPage()
        ) : isImageCompressorTool ? (
          renderImageCompressorToolPage()
        ) : isBatchWatermarkTool ? (
          renderBatchWatermarkToolPage()
        ) : isAiPage ? (
          renderAiPage()
        ) : isConvertRoot || isTools ? (
          renderToolsPage()
        ) : isApi ? (
          renderApiPage()
        ) : isPricing ? (
          renderPricingPage()
        ) : isSecurity ? (
          renderSecurityPage()
        ) : isStatus ? (
          renderStatusPage()
        ) : isReliability ? (
          renderReliabilityPage()
        ) : isDevelopers ? (
          renderDevelopersPage()
        ) : isTeamDevelopers ? (
          renderTeamDevelopersPage()
        ) : isRoadmap ? (
          renderRoadmapPage()
        ) : isChangelog ? (
          renderChangelogPage()
        ) : isArchitecture ? (
          renderArchitecturePage()
        ) : isLogin ? (
          renderLoginPage()
        ) : isDashboard ? (
          renderDashboardPage()
        ) : isAccount ? (
          renderAccountPage()
        ) : isBlog || isGuides ? (
          renderBlogPage()
        ) : currentBlogPost ? (
          renderBlogArticlePage(currentBlogPost)
        ) : currentGuidePost ? (
          renderBlogArticlePage(currentGuidePost)
        ) : isBlogArticle ? (
          renderBlogArticleFallbackPage()
        ) : isGuidesArticle ? (
          renderBlogArticleFallbackPage()
        ) : isShare ? (
          renderSharePage()
        ) : isFaq ? (
          renderFaqPage()
        ) : isPrivacy ? (
          renderPrivacyPage()
        ) : isTerms ? (
          renderTermsPage()
        ) : isCookiePolicy ? (
          renderCookiePage()
        ) : isDisclaimer ? (
          renderDisclaimerPage()
        ) : isLegal ? (
          renderLegalPage()
        ) : isAbout ? (
          renderAboutPage()
        ) : isMission ? (
          renderMissionPage()
        ) : isCareers ? (
          renderCareersPage()
        ) : isPress ? (
          renderPressPage()
        ) : isResources ? (
          renderResourcesPage()
        ) : isBugBounty ? (
          renderBugBountyPage()
        ) : isSecurityWhitepaper ? (
          renderSecurityWhitepaperPage()
        ) : isContact ? (
          renderContactPage()
        ) : isNotFound ? (
          renderNotFoundPage()
        ) : (
          renderHomePage()
        )}
          </PageTransition>
        </AnimatePresence>
      </main>
      {showMobileUploadBar && (
        <div className="mobile-upload-bar md:hidden">
          <Button size="large" onClick={() => { scrollToConverter(); openFilePicker(); }}>
            {t.btnUploadFile}
          </Button>
        </div>
      )}
      {showAuthModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/35 backdrop-blur-2xl transition-all duration-300 ease-out">
          <div className="relative w-full max-w-md rounded-3xl border border-white/40 dark:border-white/10 bg-white/80 dark:bg-[#0f1117]/80 backdrop-blur-2xl shadow-[0_24px_70px_rgba(15,23,42,0.14)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.45)] p-7 md:p-8 transition-all duration-300 ease-out">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-slate-500 dark:text-slate-400 h-9 w-9 rounded-xl border border-slate-200 dark:border-white/10 bg-white/85 dark:bg-white/5 flex items-center justify-center transition-all duration-300 ease-out hover:scale-[1.03]"
            >
              <X size={16} />
            </button>
            <div className="text-center">
              <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Вход в MegaConvert</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Продолжите в пару кликов</p>
            </div>
            <div className="mt-6 space-y-3">
              <button onClick={() => handleLogin('google')} className="w-full py-2.5 border border-slate-200 dark:border-white/10 rounded-2xl flex justify-center items-center gap-2 bg-white/90 dark:bg-white/5 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-white/10 transition-all duration-300 ease-out font-medium">
                {t.authGoogle}
              </button>
              <button onClick={() => handleLogin('github')} className="w-full py-2.5 rounded-2xl flex justify-center items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-900 dark:border-white/10 transition-all duration-300 ease-out">
                <Github size={18} /> {t.authGithub}
              </button>
            </div>
            <div className="my-5 text-center text-xs uppercase tracking-[0.22em] text-slate-400">{t.authOr}</div>
            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-3 text-slate-400" />
                <input type="email" placeholder={t.authEmailPlaceholder} required className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-white/10 rounded-2xl bg-white/90 dark:bg-white/5 text-slate-800 dark:text-slate-100" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              {authError && <p className="text-xs text-red-600 dark:text-red-300 text-center">{authError}</p>}
              <Button type="submit" className="w-full justify-center">
                Продолжить по Email
              </Button>
            </form>
          </div>
        </div>
      )}

      {showTwofaModal && user && !user.isAnon && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative">
            <button onClick={() => setShowTwofaModal(false)} className="absolute top-4 right-4 text-slate-400"><X /></button>
            <h3 className="text-2xl font-bold text-center mb-3">{t.twofaTitle}</h3>
            <p className="text-sm text-slate-500 text-center mb-6">{t.twofaDesc}</p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="123456"
                className="w-full px-4 py-2 border rounded-xl"
                value={twofaCode}
                onChange={(e) => setTwofaCode(e.target.value)}
              />
              {twofaError && <p className="text-xs text-red-500 text-center">{twofaError}</p>}
              <Button className="w-full" onClick={verifyTwoFA}>{t.twofaVerify}</Button>
              <Button variant="secondary" className="w-full" onClick={startTwoFA}>
                {twofaStatus === 'sending' ? t.processing : t.twofaSend}
              </Button>
            </div>
          </div>
        </div>
      )}

      <QuickLookModal
        open={quickLookOpen}
        title={downloadFileName || file?.name || 'Результат конвертации'}
        type={quickLookType || quickLookConfig.type}
        previewUrl={quickLookConfig.previewUrl}
        textContent={quickLookText}
        loading={quickLookLoading}
        error={quickLookError}
        onClose={() => {
          setQuickLookOpen(false);
          setQuickLookLoading(false);
          setQuickLookError('');
        }}
      />

      <GlassToast
        toast={toast}
        onClose={() => {
          setToast(null);
          if (toastTimerRef.current) {
            window.clearTimeout(toastTimerRef.current);
            toastTimerRef.current = null;
          }
        }}
      />

      {!isAiPage && (
        <footer className="bg-slate-900 text-slate-300 py-14 mt-auto">
          <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-5 gap-8 text-sm">
            <div>
              <div className="font-bold text-white mb-3 flex items-center gap-2"><Zap size={16} /> MegaConvert</div>
              <div className="text-slate-400">{t.footerTagline}</div>
            </div>
            <div>
              <div className="font-semibold text-white mb-3">{t.navProduct}</div>
              <div className="space-y-2">
                <button onClick={() => navigate('/tools')} className="block hover:text-white">{t.navTools}</button>
                <button onClick={() => navigate('/developers')} className="block hover:text-white">{t.navDevelopers || 'Developers'}</button>
                <button onClick={() => navigate('/pricing')} className="block hover:text-white">{t.navPricing}</button>
                <button onClick={() => navigate('/security')} className="block hover:text-white">{t.navSecurity}</button>
              </div>
            </div>
            <div>
              <div className="font-semibold text-white mb-3">{t.navCompany}</div>
              <div className="space-y-2">
                <button onClick={() => navigate('/about')} className="block hover:text-white">{t.navAbout}</button>
                <button onClick={() => navigate('/mission')} className="block hover:text-white">Mission</button>
                <button onClick={() => navigate('/careers')} className="block hover:text-white">Careers</button>
                <button onClick={() => navigate('/press-kit')} className="block hover:text-white">Press Kit</button>
                <button onClick={() => navigate('/roadmap')} className="block hover:text-white">{t.navRoadmap || 'Roadmap'}</button>
                <button onClick={() => navigate('/changelog')} className="block hover:text-white">{t.navChangelog || 'Changelog'}</button>
                <button onClick={() => navigate('/guides')} className="block hover:text-white">Guides</button>
                <button onClick={() => navigate('/contact')} className="block hover:text-white">{t.navContact}</button>
                <button onClick={() => navigate('/blog')} className="block hover:text-white">{t.navBlog}</button>
                <a href={X_ACCOUNT_URL} target="_blank" rel="noreferrer" className="block hover:text-white">{t.socialX}</a>
              </div>
            </div>
            <div>
              <div className="font-semibold text-white mb-3">{t.navLegal}</div>
              <div className="space-y-2">
                <button onClick={() => navigate('/privacy')} className="block hover:text-white">{t.navPrivacy}</button>
                <button onClick={() => navigate('/terms')} className="block hover:text-white">{t.navTerms}</button>
                <button onClick={() => navigate('/cookie-policy')} className="block hover:text-white">{t.navCookies}</button>
                <button onClick={() => navigate('/disclaimer')} className="block hover:text-white">{t.navDisclaimer}</button>
                <button onClick={() => navigate('/legal')} className="block hover:text-white">{t.navLegalCenter}</button>
              </div>
            </div>
            <div>
              <div className="font-semibold text-white mb-3">{t.navSupport}</div>
              <div className="space-y-2">
                <button onClick={() => navigate('/resources')} className="block hover:text-white">Resources</button>
                <button onClick={() => navigate('/faq')} className="block hover:text-white">{t.navHelpCenter}</button>
                <button onClick={() => navigate('/contact')} className="block hover:text-white">{t.navContact}</button>
                <button onClick={() => navigate('/status')} className="block hover:text-white">{t.navStatus}</button>
                <button onClick={() => navigate('/reliability')} className="block hover:text-white">{t.navReliability || 'SLA / Reliability'}</button>
                <button onClick={() => navigate('/bug-bounty')} className="block hover:text-white">Bug Bounty</button>
                <button onClick={() => navigate('/security-whitepaper')} className="block hover:text-white">Security Whitepaper</button>
                <a href={TELEGRAM_BOT_URL} target="_blank" rel="noreferrer" className="block hover:text-white">{t.socialTelegramBot}</a>
              </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-4 pt-10 text-xs text-slate-500">
            {t.footerCopyright.replace('{year}', currentYear)}
          </div>
        </footer>
      )}

      {showCookie && (
        <div className="fixed bottom-4 left-4 right-4 z-[80] bg-white border border-slate-200 shadow-lg rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-slate-600">
            {t.cookieText}
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => navigate('/privacy')}>
              {t.btnCookiePrivacy}
            </Button>
            <Button variant="outline" onClick={() => {
              setShowCookie(false);
              try {
                localStorage.setItem('cookie_ok', '0');
              } catch (error) {
                void error;
              }
            }}
            >
              {t.btnDeclineCookies}
            </Button>
            <Button onClick={() => {
              setShowCookie(false);
              try {
                localStorage.setItem('cookie_ok', '1');
              } catch (error) {
                void error;
              }
            }}
            >
              {t.btnAcceptCookies}
            </Button>
          </div>
        </div>
      )}

      <span className="sr-only" data-testid="active-tool">{activeTab}</span>
      </div>
    </SmoothScrollProvider>
  );
}

