
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2, Zap, ShieldCheck, Globe2, ServerCog,
  Upload, Download, Settings, Search, Cloud, Layers,
  Image as ImageIcon, FileText, Music, Video,
  ChevronDown, Crown, Box, Mail, Github, Lock, X
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
import { listProcessors } from './conversion/processors/registry';
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

// --- Languages ---
const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'be', name: 'Беларуская', flag: '🇧🇾' }
];
const LANG_TO_LOCALE = {
  en: 'en-US',
  ru: 'ru-RU',
  es: 'es-ES',
  zh: 'zh-CN',
  fr: 'fr-FR',
  de: 'de-DE',
  ar: 'ar-SA',
  pt: 'pt-PT',
  ja: 'ja-JP',
  hi: 'hi-IN',
  ko: 'ko-KR',
  be: 'be-BY'
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
const OAUTH_PROVIDER_IDS = {
  google: 'google.com',
  github: 'github.com'
};
const FULL_ACCESS_PLAN_TIERS = new Set(['pro', 'pro_trial', 'team', 'team_trial', 'individual', 'individual_trial']);

const normalizePlanTier = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s-]+/g, '_');

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
  <div className={`glass-card mc-surface rounded-3xl shadow-[0_30px_80px_rgba(15,23,42,0.08)] p-6 md:p-8 ${className}`}>
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
  return (
    <button onClick={onClick} className={`touch-target font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.98] ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
};

const Badge = ({ children, color = "blue" }) => {
  const colors = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    purple: "bg-violet-50 text-violet-700 border-violet-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200"
  };
  return <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${colors[color]}`}>{children}</span>;
};

const Page = ({ title, subtitle, actions, children }) => (
  <div className="pt-28 pb-20 px-4">
    <div className="max-w-6xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-semibold font-display text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-slate-600 text-lg mt-4 max-w-2xl">{subtitle}</p>}
        {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
      </div>
      {children}
    </div>
  </div>
);

const PageCard = ({ children, className = "" }) => (
  <div className={`panel-card mc-card p-6 ${className}`}>{children}</div>
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

const ToolCard = ({ tool, onOpen, labels }) => (
  <div className="panel-card mc-card p-6 hover:shadow-md transition">
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
    { label: t.navPricing, to: '/pricing' },
    { label: t.navSecurity, to: '/security' },
    { label: t.navStatus, to: '/status' },
    { label: t.navFaq, to: '/faq' },
    { label: t.navBlog, to: '/blog' },
    { label: t.navContact, to: '/contact' }
  ]), [t]);

  const securityBadges = useMemo(() => ([
    { title: t.securityBadgeEncryptTitle, desc: t.securityBadgeEncryptDesc },
    { title: t.securityBadgeDeleteTitle, desc: t.securityBadgeDeleteDesc },
    { title: t.securityBadgeIsolateTitle, desc: t.securityBadgeIsolateDesc },
    { title: t.securityBadgeComplianceTitle, desc: t.securityBadgeComplianceDesc }
  ]), [t]);

  const howSteps = useMemo(() => ([
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
  const [recentJobs, setRecentJobs] = useState(() => {
    try {
      const raw = localStorage.getItem('recent_jobs');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [accountNotice, setAccountNotice] = useState('');

  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [pipelineStage, setPipelineStage] = useState(null);
  const [activeTab, setActiveTab] = useState('png-jpg');
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [batchMode, setBatchMode] = useState(false);
  const [settings, setSettings] = useState({
    image: { quality: 90, resize: "", crop: "", dpi: "" },
    video: { resolution: "1080p", fps: "", bitrate: "", codec: "h264" },
    audio: { bitrate: "192k", normalize: false, trimStart: "", trimDuration: "", channels: "" }
  });

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const encryptionContextRef = useRef(new Map());
  const [lastJobId, setLastJobId] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAllFormats, setShowAllFormats] = useState(false);
  const [toolOpenCounts, setToolOpenCounts] = useState(() => readToolOpenCounts());
  const [pendingOpenToolId, setPendingOpenToolId] = useState(null);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [remoteBlogPosts, setRemoteBlogPosts] = useState([]);
  const [remoteBlogLoading, setRemoteBlogLoading] = useState(false);
  const [remoteBlogError, setRemoteBlogError] = useState('');
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
  const accountTimersRef = useRef({
    slow: null,
    verySlow: null,
    notice: null,
    pulse: null
  });
  const isAccountPath = path === '/account' || path === '/settings/billing';

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
    const fromEnv = normalizeApiBase(import.meta.env.VITE_API_BASE || fallback);
    if (typeof window === 'undefined') return fromEnv;
    try {
      const currentHost = window.location.hostname;
      // In deployed environments, prefer same-origin /api via Vercel rewrites.
      // This avoids cross-origin edge cases on mobile browsers.
      if (!isLoopbackHost(currentHost)) {
        return fallback;
      }
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
  const CLIENT_ENCRYPTION_ENABLED = String(import.meta.env.VITE_CLIENT_ENCRYPTION || '0') === '1';
  const fileInputRef = useRef(null);
  const langMenuRef = useRef(null);
  const jobStartRef = useRef(null);
  const trackedToolOpenPathRef = useRef('');
  const currentYear = new Date().getFullYear();
  const blogPosts = useMemo(() => {
    const merged = [...remoteBlogPosts];
    const slugs = new Set(merged.map((post) => post.slug));
    for (const post of staticBlogPosts) {
      if (slugs.has(post.slug)) continue;
      merged.push(post);
    }
    return merged;
  }, [remoteBlogPosts, staticBlogPosts]);

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

  const handleFilesSelected = (list) => {
    const selected = Array.from(list || []);
    setFiles(selected);
    setFile(selected[0] || null);
    if (selected[0]) {
      const suggested = inferToolFromName(selected[0].name);
      if (suggested) setSmartSuggestion(suggested);
    } else {
      setSmartSuggestion(null);
    }
  };

  const track = useCallback((type, payload = {}) => {
    try {
      const body = JSON.stringify({ type, payload, ts: Date.now() });
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(`${API_BASE}/events`, blob);
      } else {
        fetch(`${API_BASE}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true
        }).catch((error) => {
          void error;
        });
      }
    } catch (error) {
      void error;
    }
  }, [API_BASE]);
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
    const browserLang = navigator.language.split('-')[0];
    const targetLang = translations[browserLang] ? browserLang : defaultLang;
    setLang(targetLang);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const toolParam = params.get('tool');
    const autoPick = params.get('autopick') === '1';
    const canonicalToolId = toolParam && toolIds.has(toolParam)
      ? toolParam
      : (toolParam ? LEGACY_TOOL_ID_TO_CANONICAL[toolParam] : null);
    if (canonicalToolId && toolIds.has(canonicalToolId)) {
      selectTool(canonicalToolId);
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
        setUser(null);
        setIsPro(false);
      }
    });
    return () => unsubscribe();
  }, [API_BASE, defaultUserName]);

  useEffect(() => {
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
  }, [API_BASE, t, user?.uid]);

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
    const elements = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!elements.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { threshold: 0.15 });
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    track('page_view', { path });
    if (path === '/login') setShowAuthModal(true);
    if (path === '/account' || path === '/settings/billing') {
      setAccountSection('billing');
    }
    setIsMobileMenuOpen(false);
    setIsLangMenuOpen(false);
  }, [path, track]);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const changeLanguage = (code) => {
    setLang(code);
    setIsLangMenuOpen(false);
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
        await signOut(auth);
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
  }, [API_BASE, accountSessionPending, buildAuthHeaders, loadAccountSessions, parseApiPayload, t, track, user?.uid]);

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
      await signOut(auth);
      setShowAuthModal(true);
    } catch (error) {
      setAccountSessionsError(error?.message || t.errorLogoutAllSessions);
    } finally {
      setAccountLogoutAllPending(false);
    }
  }, [API_BASE, accountLogoutAllPending, buildAuthHeaders, parseApiPayload, t, track, user?.uid]);

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
      return undefined;
    }
    const controller = new AbortController();
    void Promise.all([
      loadAccountBilling({ signal: controller.signal }),
      loadAccountProfile({ signal: controller.signal }),
      loadAccountConnections({ signal: controller.signal }),
      loadAccountSessions({ signal: controller.signal })
    ]);
    return () => {
      controller.abort();
    };
  }, [isAccountPath, loadAccountBilling, loadAccountConnections, loadAccountProfile, loadAccountSessions, user?.uid]);

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
    if (!candidates.includes('https://megaconvert-api.fly.dev')) {
      candidates.push('https://megaconvert-api.fly.dev');
    }
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
    try {
      if (authMode === 'login') await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
      setShowAuthModal(false);
    } catch (e) {
      setAuthError(e.message);
    }
  };

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
    setStatus('idle');
    setProgress(0);
    setPipelineStage(null);
    setDownloadUrl(null);
    setEtaSeconds(null);
    setSmartSuggestion(null);
    setErrorInfo(null);
  }, []);


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

  const handleProcess = async () => {
    if (!file && files.length === 0) { scrollToConverter(); openFilePicker(); return; }
    if (status === 'processing') return;

    setStatus('processing');
    setProgress(5);
    setPipelineStage(stageLabels.validate);
    setErrorInfo(null);
    setEtaSeconds(null);

    const uploadFiles = batchMode ? files : (file ? [file] : []);
    const authHeaders = buildAuthHeaders();
    let encryptionKey = null;
    let createdJobId = null;

    jobStartRef.current = Date.now();
    track('job_start', { tool: activeTab, batch: batchMode, count: uploadFiles.length });

    try {
      const result = await runConversion({
        toolId: activeTab,
        files: uploadFiles,
        batchMode,
        settings,
        apiBase: API_BASE,
        authHeaders,
        encryptionEnabled: CLIENT_ENCRYPTION_ENABLED,
        stageLabels,
        hooks: {
          onStage: (stage) => setPipelineStage(stage.label),
          onProgress: (value) => setProgress((prev) => Math.min(100, Math.max(prev, value || 0))),
          onEta: (value) => setEtaSeconds(value),
          onStatus: () => {},
          onJobCreated: ({ jobId, encryption }) => {
            createdJobId = jobId;
            setLastJobId(jobId);
            setRecentJobs((jobs) => [{ id: jobId, tool: activeTab, ts: Date.now() }, ...jobs].slice(0, 12));
            encryptionKey = encryption?.key || null;
            if (encryptionKey) encryptionContextRef.current.set(jobId, { key: encryptionKey, meta: null });
          },
          onJobUpdate: (job) => {
            if (!createdJobId) return;
            if (job.status === 'verifying') setPipelineStage(stageLabels.verify);
            if (job.outputMeta && encryptionKey) {
              encryptionContextRef.current.set(createdJobId, { key: encryptionKey, meta: job.outputMeta });
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

      setDownloadUrl(result.downloadUrl || null);
      setStatus('done');
      setProgress(100);
      setPipelineStage(stageLabels.cleanup);
      setEtaSeconds(null);
      track('job_complete', { tool: activeTab, jobId: result.jobId, success: true });
    } catch (e) {
      let errorObj = e;
      const recoverableCodes = new Set(['JOB_STATUS_FETCH', 'NETWORK_ERROR', 'TIMEOUT', 'QUEUE_UNAVAILABLE']);
      if (createdJobId && recoverableCodes.has(errorObj?.code)) {
        const recovered = await recoverCompletedJob(createdJobId, authHeaders);
        if (recovered?.status === 'completed') {
          if (recovered.outputMeta && encryptionKey) {
            encryptionContextRef.current.set(createdJobId, { key: encryptionKey, meta: recovered.outputMeta });
          }
          setDownloadUrl(recovered.downloadUrl || recovered.outputUrl || null);
          setStatus('done');
          setProgress(100);
          setPipelineStage(stageLabels.cleanup);
          setEtaSeconds(null);
          track('job_complete', { tool: activeTab, jobId: createdJobId, success: true, recovered: true });
          return;
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
        QUEUE_UNAVAILABLE: t.errorFetchStatus,
        NETWORK_ERROR: t.errorFetchStatus,
        VERIFY_FAILED: t.errorVerificationFailed,
        CONVERSION_FAILED: t.errorConversionFailed,
        CONVERSION_EXPIRED: t.errorConversionFailed,
        TIMEOUT: t.errorTimeout
      };
      setStatus('error');
      setPipelineStage(null);
      setEtaSeconds(null);
      const userMessage = errorObj?.code === 'CONVERSION_FAILED'
        ? (errorObj.message || t.errorConversionFailed)
        : (errorMessages[errorObj?.code] || errorObj?.message || t.errorConversionFailedRetry);
      setErrorInfo(userMessage);
      track('job_complete', { tool: activeTab, jobId: createdJobId, success: false, error: errorObj?.code || errorObj?.message });
    }
  };

  const download = () => {
    if (!downloadUrl) return;
    const context = lastJobId ? encryptionContextRef.current.get(lastJobId) : null;
    const fileName = (() => {
      try {
        const u = new URL(downloadUrl);
        const parts = u.pathname.split('/');
        return parts[parts.length - 1] || `converted_${Date.now()}`;
      } catch {
        return `converted_${Date.now()}`;
      }
    })();
    if (!context || !context.meta) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      a.click();
      return;
    }
    fetch(downloadUrl)
      .then((r) => r.arrayBuffer())
      .then((buf) => decryptFileGcm(buf, context.meta, context.key))
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.replace(/\.enc$/, '');
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        setErrorInfo(t.errorDecryptionFailed);
      });
  };
  const isHome = path === '/' || path === '';
  const isTools = path === '/tools';
  const isPricing = path === '/pricing';
  const isSecurity = path === '/security';
  const isStatus = path === '/status';
  const isLogin = path === '/login';
  const isDashboard = path === '/dashboard';
  const isAccount = path === '/account' || path === '/settings/billing';
  const isBlog = path === '/blog' || path === '/blog/';
  const isBlogArticle = path.startsWith('/blog/') && path !== '/blog/';
  const blogSlug = isBlogArticle
    ? decodeURIComponent(path.replace('/blog/', '').replace(/\/+$/, ''))
    : '';
  const currentBlogPost = blogSlug
    ? blogPosts.find((post) => post.slug === blogSlug) || null
    : null;
  const isFaq = path === '/faq';
  const isPrivacy = path === '/privacy';
  const isTerms = path === '/terms';
  const isLegal = path === '/legal';
  const isCookiePolicy = path === '/cookie-policy';
  const isDisclaimer = path === '/disclaimer';
  const isAbout = path === '/about';
  const isContact = path === '/contact';
  const isAdmin = path === '/admin' || path.startsWith('/admin/');
  const isConvertRoot = path === '/convert' || path === '/convert/';
  const isConvert = path.startsWith('/convert/') && !isConvertRoot;
  const isNotFound = !isHome && !isTools && !isPricing && !isSecurity && !isStatus && !isLogin && !isDashboard && !isAccount && !isBlog && !currentBlogPost && !isFaq && !isPrivacy && !isTerms && !isLegal && !isCookiePolicy && !isDisclaimer && !isAbout && !isContact && !isAdmin && !isConvert && !isConvertRoot;

  const convertSlug = isConvert ? path.replace('/convert/', '') : '';
  const conversionFromSlug = convertSlug ? getConversionBySlug(convertSlug) : null;
  const legacyToolIdFromSlug = convertSlug ? LEGACY_SLUG_TO_TOOL_ID[convertSlug] : null;
  const resolvedToolId = convertSlug && toolIds.has(convertSlug)
    ? convertSlug
    : (conversionFromSlug?.id || legacyToolIdFromSlug);
  const resolvedTool = tools.find((t) => t.id === resolvedToolId) || currentTool;

  useEffect(() => {
    if (!isBlogArticle || !currentBlogPost?.slug) return;
    track('post_open', {
      tool_id: currentBlogPost.slug,
      post_id: currentBlogPost.id || null,
      source: 'blog'
    });
  }, [currentBlogPost?.id, currentBlogPost?.slug, isBlogArticle, track]);

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
          <Button className="mt-6 w-full" variant="primary">{t.btnUpgradePro}</Button>
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

      <div className="mt-10 bg-white rounded-2xl border border-slate-200 overflow-hidden">
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

    return (
      <GlassCard className={compact ? 'p-5 md:p-6' : ''}>
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
                className={`rounded-2xl border ${file ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300 bg-slate-50/80'} p-6 text-center`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
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
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
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
                      <label className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-widest text-slate-500">{t.labelTrimStart}</span>
                        <input type="number" value={settings.audio.trimStart} onChange={e => setSettings(s => ({ ...s, audio: { ...s.audio, trimStart: e.target.value } }))} className="border rounded-lg px-3 py-2" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-widest text-slate-500">{t.labelTrimDuration}</span>
                        <input type="number" value={settings.audio.trimDuration} onChange={e => setSettings(s => ({ ...s, audio: { ...s.audio, trimDuration: e.target.value } }))} className="border rounded-lg px-3 py-2" />
                      </label>
                      <label className="flex items-center gap-2 sm:col-span-2">
                        <input type="checkbox" checked={settings.audio.normalize} onChange={e => setSettings(s => ({ ...s, audio: { ...s.audio, normalize: e.target.checked } }))} />
                        <span>{t.labelNormalizeAudio}</span>
                      </label>
                    </div>
                  )}

                  {currentTool.type === 'doc' && (
                    <div className="text-sm text-slate-500">{t.labelDefaultSettingsNote}</div>
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
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all animate-pulse-soft" style={{ width: `${progress}%` }}></div>
              </div>
                <div className="mt-3 text-slate-500 text-sm">{pipelineStage || t.processing}</div>
              {etaSeconds !== null && (
                <div className="mt-2 text-xs text-slate-500">{t.labelEtaPrefix} {etaSeconds}{t.labelSecondsShort}</div>
              )}
            </div>
          )}

          {status === 'done' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">{t.done}</h3>
              <div className="text-sm text-slate-500 mb-6">{t.labelFileReady}</div>
              <div className="flex gap-3 justify-center">
                <Button variant="secondary" onClick={reset}>{t.back}</Button>
                <Button variant="primary" onClick={download}>{t.download}</Button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
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
      </GlassCard>
    );
  };
  const renderToolsPage = () => (
    <Page title={t.pageToolsTitle} subtitle={t.pageToolsSubtitle}>
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-slate-400" />
          <input
            className="w-full text-sm outline-none bg-transparent"
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
            <div className="text-sm text-slate-500">{t.homePopularSubtitle}</div>
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
    </Page>
  );

  const renderConvertPage = () => {
    if (!resolvedToolId) return renderNotFoundPage();
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

      <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6">
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

  const renderDashboardPage = () => (
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
              <div className="text-xs uppercase tracking-widest text-slate-500">{t.dashboardMetricConversions}</div>
              <div className="text-3xl font-semibold mt-3">{recentJobs.length}</div>
              <div className="text-sm text-slate-500 mt-2">{t.dashboardMetricLast30Days}</div>
            </PageCard>
            <PageCard>
              <div className="text-xs uppercase tracking-widest text-slate-500">{t.dashboardMetricPlan}</div>
              <div className="text-3xl font-semibold mt-3">
                {String(accountBilling?.plan?.title || '').trim() || (isPro ? t.planProName : t.planFreeName)}
              </div>
              <div className="text-sm text-slate-500 mt-2">{t.dashboardMetricUpgrade}</div>
            </PageCard>
            <PageCard>
              <div className="text-xs uppercase tracking-widest text-slate-500">{t.dashboardMetricStorage}</div>
              <div className="text-3xl font-semibold mt-3">2.3 GB</div>
              <div className="text-sm text-slate-500 mt-2">{t.dashboardMetricStorageUsed}</div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-3">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: '12%' }} />
              </div>
            </PageCard>
          </div>

          <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="font-semibold">{t.dashboardHistoryTitle}</div>
              <Button variant="secondary" onClick={handleExportData}>{t.btnExportData}</Button>
            </div>
            {recentJobs.length === 0 ? (
              <div className="text-sm text-slate-500">{t.dashboardNoJobs}</div>
            ) : (
              <div className="space-y-3">
                {recentJobs.slice(0, 10).map((job) => (
                  <div key={job.id} className="grid md:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-center text-sm border-b border-slate-100 pb-3">
                    <div className="font-medium">{tools.find((t) => t.id === job.tool)?.name || job.tool}</div>
                    <div className="text-slate-500">{new Date(job.ts).toLocaleString()}</div>
                    <div className="text-emerald-600 font-semibold">{t.dashboardStatusCompleted}</div>
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => openToolRoute(job.tool)}>{t.btnOpen}</Button>
                      <Button variant="outline" onClick={() => removeJob(job.id)}>{t.btnDelete}</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {accountNotice && <div className="text-xs text-slate-500 mt-3">{accountNotice}</div>}
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <PageCard>
              <div className="font-semibold mb-2">{t.dashboardAccountActionsTitle}</div>
              <div className="text-sm text-slate-600 mb-4">{t.dashboardSignedInAs} {user.email || user.name}</div>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={handleExportData}>{t.btnExportData}</Button>
                <Button variant="outline" className="flex-1" onClick={handleDeleteAccount}>{t.btnDeleteAccount}</Button>
              </div>
            </PageCard>
            <PageCard>
              <div className="font-semibold mb-2">{t.dashboardTeamFeaturesTitle}</div>
              <div className="text-sm text-slate-600">{t.dashboardTeamFeaturesDesc}</div>
              <Button variant="secondary" className="mt-4 w-full" onClick={() => navigate('/contact')}>{t.btnRequestAccess}</Button>
            </PageCard>
          </div>
        </>
      )}
    </Page>
  );

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
            <aside className="panel-card bg-white rounded-2xl border border-slate-200 p-4 h-fit">
              <div className="text-xs uppercase tracking-widest text-slate-500 px-2 mb-2">{t.navAccount}</div>
              <div className="space-y-1">
                {[
                  { id: 'profile', label: t.accountSectionProfile },
                  { id: 'billing', label: t.accountSectionBilling },
                  { id: 'connections', label: t.accountSectionConnections },
                  { id: 'security', label: t.accountSectionSecurity },
                  { id: 'telegram', label: t.accountSectionTelegram },
                  { id: 'api', label: t.accountSectionApi }
                ].map((item) => (
                  <button
                    key={item.id}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      item.id === accountSection
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                    onClick={() => setAccountSection(item.id)}
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
              {accountSection === 'api' && (
                <PageCard className="account-card-enter">
                  <div className="text-xs uppercase tracking-widest text-slate-500">{t.accountSectionApi}</div>
                  <h2 className="text-xl font-semibold mt-2">{t.accountApiComingSoonTitle}</h2>
                  <p className="text-sm text-slate-600 mt-2">
                    {t.accountApiComingSoonSubtitle}
                  </p>
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
              <Button variant="secondary" className="mt-6" onClick={() => navigate(`/blog/${post.slug}`)}>
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
          <Button variant="secondary" onClick={() => navigate('/blog')}>{t.back}</Button>
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
      <div className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="ambient-orb orb-a absolute -top-32 -right-32 w-80 h-80 bg-gradient-to-br from-blue-200 via-blue-100 to-indigo-200 rounded-full blur-3xl opacity-60" />
        <div className="ambient-orb orb-b absolute -bottom-28 -left-24 w-96 h-96 bg-gradient-to-br from-slate-100 via-blue-100 to-indigo-100 rounded-full blur-3xl opacity-60" />
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center relative">
          <div className="hero-copy reveal relative z-10" data-reveal>
            <Badge color="slate">{t.homeBadgePlatform}</Badge>
            <h1 className="text-5xl md:text-6xl font-semibold font-display mt-6 text-slate-900 tracking-tight">
              {t.heroTitle}
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mt-5 max-w-xl">
              {t.heroDesc}
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Button size="large" onClick={() => { scrollToConverter(); openFilePicker(); }} data-testid="cta-upload">{t.btnStart}</Button>
              <Button size="large" variant="secondary" onClick={() => navigate('/tools')}>{t.btnBrowseTools}</Button>
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span><span className="font-semibold">{filesConvertedCount.toLocaleString()}</span> {t.homeFilesConvertedLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe2 size={16} className="text-slate-500" />
                <span>{t.homeCountries}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-slate-500" />
                <span>{t.homePrivate}</span>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-8">
              {securityBadges.map((badge) => (
                <div key={badge.title} className="mc-surface rounded-2xl px-4 py-3 text-sm">
                  <div className="font-semibold text-slate-900">{badge.title}</div>
                  <div className="text-xs text-slate-500 mt-1">{badge.desc}</div>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <div className="text-xs uppercase tracking-widest text-slate-500">{t.homeQuickFormats}</div>
              <div className="flex flex-wrap gap-2 mt-3">
                {topTools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => openToolRoute(tool.id, { autoPick: true })}
                    data-testid={`top-tool-${tool.id}`}
                    className="px-3 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 hover:border-slate-300"
                  >
                    {tool.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="hero-converter reveal relative z-10" id="converter" data-reveal>
            {renderConverterPanel({ compact: true })}
          </div>
        </div>
      </div>

      <Section id="trusted" className="border-t border-slate-200 reveal" data-reveal>
        <div className="text-center mb-10">
          <Badge color="blue">{t.homeTrustedBadge}</Badge>
          <h2 className="text-3xl md:text-4xl font-semibold mt-4">{t.homeTrustedTitle}</h2>
          <p className="text-slate-500 mt-3">{t.homeTrustedSubtitle}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          {TRUSTED_BY.map((name) => (
            <div key={name} className="px-4 py-2 rounded-full bg-white border border-slate-200 text-sm font-semibold text-slate-600">
              {name}
            </div>
          ))}
        </div>
      </Section>

      <Section id="how" className="border-t border-slate-200 reveal" data-reveal>
        <div className="text-center mb-10">
          <Badge color="slate">{t.homeHowBadge}</Badge>
          <h2 className="text-3xl md:text-4xl font-semibold mt-4">{t.homeHowTitle}</h2>
          <p className="text-slate-500 mt-3">{t.homeHowSubtitle}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {howSteps.map((step, index) => (
            <IconCard
              key={step.title}
              icon={step.icon}
              title={`${index + 1}. ${step.title}`}
              desc={step.desc}
              tone={index === 0 ? 'blue' : index === 1 ? 'violet' : 'green'}
            />
          ))}
        </div>
      </Section>

      <Section id="popular" className="border-t border-slate-200 reveal" data-reveal>
        <div className="text-center mb-10">
          <Badge color="purple">{t.homePopularBadge}</Badge>
          <h2 className="text-3xl md:text-4xl font-semibold mt-4">{t.homePopularTitle}</h2>
          <p className="text-slate-500 mt-3">{t.homePopularSubtitle}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {topTools.map((tool) => (
            <div key={tool.id} className="mc-card p-6">
              <div className="flex items-center gap-2 font-semibold">
                <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">{tool.icon}</span>
                <span>{tool.name}</span>
              </div>
              <div className="text-sm text-slate-500 mt-2">{tool.description}</div>
              <Button variant="secondary" className="mt-4 w-full" onClick={() => openToolRoute(tool.id, { autoPick: true })}>
                {t.btnOpenConverter}
              </Button>
            </div>
          ))}
        </div>
      </Section>

      <Section id="features" className="border-t border-slate-200 reveal" data-reveal>
        <div className="text-center mb-10">
          <Badge color="green">{t.homeFeaturesBadge}</Badge>
          <h2 className="text-3xl md:text-4xl font-semibold mt-4">{t.homeFeaturesTitle}</h2>
          <p className="text-slate-500 mt-3">{t.homeFeaturesSubtitle}</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featureList.map((feature) => (
            <IconCard key={feature.title} icon={feature.icon} title={feature.title} desc={feature.desc} tone="blue" />
          ))}
        </div>
      </Section>

      <Section id="cta" className="border-t border-slate-200 reveal" data-reveal>
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
  if (isAdmin) {
    return (
      <AdminApp
        path={path}
        navigate={navigate}
        apiBase={API_BASE}
        lang={lang}
        t={t}
      />
    );
  }
  return (
    <div className="site-shell min-h-screen text-slate-900 font-sans">
      <nav className="top-nav fixed w-full z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="nav-pill mt-4 mc-surface rounded-2xl h-16 px-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2 font-semibold text-lg cursor-pointer" onClick={() => navigate('/') }>
              <span className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center"><Zap size={16} /></span>
              MegaConvert
            </div>
            <div className="hidden lg:flex items-center gap-4">
              {navItems.map((item) => (
                <button key={item.to} onClick={() => navigate(item.to)} className="font-medium text-slate-700 hover:text-slate-900">
                  {item.label}
                </button>
              ))}
              {user && (
                <>
                  <button onClick={() => navigate('/account')} className="font-medium text-slate-700 hover:text-slate-900">{t.navAccount}</button>
                  <button onClick={() => navigate('/dashboard')} className="font-medium text-slate-700 hover:text-slate-900">{t.navDashboard}</button>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="relative hidden md:block" ref={langMenuRef}>
                <button onClick={() => setIsLangMenuOpen(!isLangMenuOpen)} className="flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900">
                  {LANGUAGES.find(l => l.code === lang)?.flag} <ChevronDown size={14} />
                </button>
                {isLangMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-40 bg-white shadow-xl rounded-xl border py-2">
                    {LANGUAGES.map(l => (
                      <button key={l.code} onClick={() => changeLanguage(l.code)} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex gap-2">
                        {l.flag} {l.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {!user ? (
                <Button onClick={() => navigate('/login')}>{t.navLogin}</Button>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden md:block text-sm">
                    <div className="font-bold">{user.name}</div>
                    {isPro && <div className="text-amber-600 text-xs font-bold flex justify-end items-center gap-1"><Crown size={10}/> {t.labelPro}</div>}
                  </div>
                  <button onClick={() => { localStorage.removeItem('twofa_token'); signOut(auth); }} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
                </div>
              )}
              <button className="lg:hidden px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold" onClick={() => setIsMobileMenuOpen((v) => !v)}>
                {t.navMenu}
              </button>
            </div>
          </div>

          {isMobileMenuOpen && (
            <div className="mobile-drawer lg:hidden mt-3 bg-white rounded-2xl border border-slate-200 p-4 shadow-lg">
              <div className="grid gap-2">
                {navItems.map((item) => (
                  <button key={item.to} onClick={() => navigate(item.to)} className="text-left px-3 py-2 rounded-lg hover:bg-slate-50 font-medium text-slate-700">
                    {item.label}
                  </button>
                ))}
                {user && (
                  <>
                    <button onClick={() => navigate('/account')} className="text-left px-3 py-2 rounded-lg hover:bg-slate-50 font-medium text-slate-700">{t.navAccount}</button>
                    <button onClick={() => navigate('/dashboard')} className="text-left px-3 py-2 rounded-lg hover:bg-slate-50 font-medium text-slate-700">{t.navDashboard}</button>
                  </>
                )}
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="text-xs uppercase tracking-widest text-slate-500">{t.navLanguage}</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {LANGUAGES.map((item) => (
                    <button key={item.code} onClick={() => changeLanguage(item.code)} className="px-3 py-1.5 rounded-full border border-slate-200 text-xs font-semibold">
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
        accept={currentTool.accept}
        multiple={batchMode}
      />

      <main>
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
        ) : isConvertRoot || isTools ? (
          renderToolsPage()
        ) : isPricing ? (
          renderPricingPage()
        ) : isSecurity ? (
          renderSecurityPage()
        ) : isStatus ? (
          renderStatusPage()
        ) : isLogin ? (
          renderLoginPage()
        ) : isDashboard ? (
          renderDashboardPage()
        ) : isAccount ? (
          renderAccountPage()
        ) : isBlog ? (
          renderBlogPage()
        ) : currentBlogPost ? (
          renderBlogArticlePage(currentBlogPost)
        ) : isBlogArticle ? (
          renderBlogArticleFallbackPage()
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
        ) : isContact ? (
          renderContactPage()
        ) : isNotFound ? (
          renderNotFoundPage()
        ) : (
          renderHomePage()
        )}
      </main>
      {showAuthModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative">
            <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-slate-400"><X /></button>
            <h3 className="text-2xl font-bold text-center mb-6">{authMode === 'login' ? t.loginTitle : t.registerTitle}</h3>
            <div className="space-y-3">
              <button onClick={() => handleLogin('google')} className="w-full py-2.5 border rounded-xl flex justify-center items-center gap-2 hover:bg-slate-50 font-medium">
                {t.authGoogle}
              </button>
              <button onClick={() => handleLogin('github')} className="w-full py-2.5 bg-[#24292e] text-white rounded-xl flex justify-center items-center gap-2 hover:bg-[#2b3137]">
                <Github size={20} /> {t.authGithub}
              </button>
              <div className="text-center text-xs text-slate-400 my-2">{t.authOr}</div>

              <form onSubmit={handleEmailAuth} className="space-y-3">
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-3 text-slate-400" />
                  <input type="email" placeholder={t.authEmailPlaceholder} required className="w-full pl-10 pr-4 py-2 border rounded-xl" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-3 text-slate-400" />
                  <input type="password" placeholder={t.authPasswordPlaceholder} required className="w-full pl-10 pr-4 py-2 border rounded-xl" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                {authError && <p className="text-xs text-red-500 text-center">{authError}</p>}
                <Button className="w-full justify-center">{t.authEmail}</Button>
              </form>
              <button onClick={handleGuest} className="w-full text-sm text-slate-500 hover:text-slate-800">{t.authGuest}</button>
            </div>
            <div className="mt-4 pt-4 border-t text-center">
              <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-sm text-blue-600 font-medium">
                {authMode === 'login' ? t.authSwitchRegister : t.authSwitchLogin}
              </button>
            </div>
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
              <button onClick={() => navigate('/pricing')} className="block hover:text-white">{t.navPricing}</button>
              <button onClick={() => navigate('/security')} className="block hover:text-white">{t.navSecurity}</button>
            </div>
          </div>
          <div>
            <div className="font-semibold text-white mb-3">{t.navCompany}</div>
            <div className="space-y-2">
              <button onClick={() => navigate('/about')} className="block hover:text-white">{t.navAbout}</button>
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
              <button onClick={() => navigate('/faq')} className="block hover:text-white">{t.navHelpCenter}</button>
              <button onClick={() => navigate('/contact')} className="block hover:text-white">{t.navContact}</button>
              <button onClick={() => navigate('/status')} className="block hover:text-white">{t.navStatus}</button>
              <a href={TELEGRAM_BOT_URL} target="_blank" rel="noreferrer" className="block hover:text-white">{t.socialTelegramBot}</a>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pt-10 text-xs text-slate-500">
          {t.footerCopyright.replace('{year}', currentYear)}
        </div>
      </footer>

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
  );
}

