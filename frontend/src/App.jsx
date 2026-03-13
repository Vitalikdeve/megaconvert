import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Archive,
  ArrowRight,
  FileText,
  Film,
  Image,
  Music,
  Network,
  Search,
  Sparkles,
  Stamp,
  Video,
} from 'lucide-react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import CommandPalette from './components/CommandPalette.jsx';
import MainLayout from './components/layout/MainLayout.jsx';
import GlassPanel from './components/ui/GlassPanel.jsx';
import AuthCallbackPage from './features/auth/pages/AuthCallbackPage.jsx';
import ForgotPasswordPage from './features/auth/pages/ForgotPasswordPage.jsx';
import LoginPage from './features/auth/pages/LoginPage.jsx';
import RegisterPage from './features/auth/pages/RegisterPage.jsx';
import ResetPasswordPage from './features/auth/pages/ResetPasswordPage.jsx';
import { LAST_TOOL_KEY, writeStoredJson } from './lib/osMemory.js';

const ZenPortal = lazy(() => import('./components/ZenPortal.jsx'));
const HomeDashboard = lazy(() => import('./components/home/HomeDashboard.jsx'));
const ImageOptimizer = lazy(() => import('./components/tools/ImageOptimizer.jsx'));
const PrivacyPage = lazy(() => import('./components/legal/PrivacyPage.jsx'));
const VideoCompressor = lazy(() => import('./components/tools/VideoCompressor.jsx'));
const AudioConverter = lazy(() => import('./components/tools/AudioConverter.jsx'));
const VideoToGif = lazy(() => import('./components/tools/VideoToGif.jsx'));
const ArchiveManager = lazy(() => import('./components/tools/ArchiveManager.jsx'));
const BatchWatermark = lazy(() => import('./components/tools/BatchWatermark.jsx'));
const TermsPage = lazy(() => import('./components/legal/TermsPage.jsx'));
const SmartOcr = lazy(() => import('./components/tools/SmartOcr.jsx'));
const PdfEditor = lazy(() => import('./components/tools/PdfEditor.jsx'));
const MegaGrid = lazy(() => import('./components/tools/MegaGrid.jsx'));

const TOOL_ITEMS = [
  {
    id: 'zen',
    path: '/',
    aliases: ['/receive'],
    group: 'Главная',
    label: 'Магический Портал',
    caption: 'Dashboard and smart portal',
    icon: Sparkles,
  },
  {
    id: 'image-optimizer',
    path: '/tools/image-optimizer',
    group: 'Медиа',
    label: 'Image Optimizer',
    caption: 'Frame refinement',
    icon: Image,
  },
  {
    id: 'video-compressor',
    path: '/tools/video-compressor',
    group: 'Медиа',
    label: 'Video Compressor',
    caption: 'Motion shaping',
    icon: Video,
  },
  {
    id: 'audio-converter',
    path: '/tools/audio-converter',
    group: 'Медиа',
    label: 'Audio Converter',
    caption: 'High-fidelity engine',
    icon: Music,
  },
  {
    id: 'video-to-gif',
    path: '/tools/video-to-gif',
    group: 'Медиа',
    label: 'Video to GIF',
    caption: 'Optimized animations',
    icon: Film,
  },
  {
    id: 'smart-ocr',
    path: '/tools/smart-ocr',
    group: 'Документы',
    label: 'Умный OCR',
    caption: 'Text extraction',
    icon: Search,
  },
  {
    id: 'pdf-editor',
    path: '/tools/pdf-editor',
    group: 'Документы',
    label: 'PDF Редактор',
    caption: 'Document assembly',
    icon: FileText,
  },
  {
    id: 'megagrid',
    path: '/tools/megagrid',
    group: 'Сеть',
    label: 'MegaGrid',
    caption: 'Distributed browser cluster',
    icon: Network,
  },
  {
    id: 'archive-manager',
    path: '/tools/archive-manager',
    group: 'Файлы',
    label: 'Archive Manager',
    caption: 'ZIP and RAR workflows',
    icon: Archive,
  },
  {
    id: 'batch-watermark',
    path: '/tools/batch-watermark',
    group: 'Медиа',
    label: 'Batch Watermark',
    caption: 'Bulk overlays',
    icon: Stamp,
  },
];

function RouteFallback() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center bg-[#030303] px-4 text-white">
      <GlassPanel className="flex h-[320px] w-[min(620px,calc(100vw-2rem))] flex-col items-center justify-center gap-5 px-8 text-center">
        <div className="h-16 w-16 animate-pulse rounded-full border border-white/[0.08] bg-white/[0.04]" />
        <div className="text-sm uppercase tracking-[0.28em] text-white/28">
          Loading Module
        </div>
      </GlassPanel>
    </div>
  );
}

function SpotlightPage({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  onNavigate,
}) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center bg-[#030303] px-4 text-white">
      <GlassPanel className="flex w-[min(780px,calc(100vw-2rem))] flex-col gap-8 px-8 py-10 text-center sm:px-10">
        <div className="mx-auto inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-white/42">
          {eyebrow}
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-medium tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-7 text-white/58 sm:text-base">
            {description}
          </p>
        </div>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          {primaryAction ? (
            <button
              type="button"
              onClick={() => onNavigate(primaryAction.to)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-transform hover:scale-[1.02] hover:bg-white/90"
            >
              {primaryAction.label}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </button>
          ) : null}

          {secondaryAction ? (
            <button
              type="button"
              onClick={() => onNavigate(secondaryAction.to)}
              className="inline-flex items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/72 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white"
            >
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      </GlassPanel>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const apiBase = useMemo(
    () => String(import.meta.env.VITE_API_BASE || '/api').trim() || '/api',
    [],
  );

  const activeToolMeta = useMemo(
    () => TOOL_ITEMS.find((item) => item.path === location.pathname || item.aliases?.includes(location.pathname)) || TOOL_ITEMS[0],
    [location.pathname],
  );

  useEffect(() => {
    writeStoredJson(LAST_TOOL_KEY, {
      id: activeToolMeta.id,
      path: activeToolMeta.path,
      label: activeToolMeta.label,
      updatedAt: Date.now(),
    });
  }, [activeToolMeta]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event);
    };

    const handleAppInstalled = () => {
      setDeferredInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleSelectTool = useCallback(async (item) => {
    if (!item) {
      return;
    }

    if (item.action === 'install-os') {
      if (!deferredInstallPrompt) {
        return;
      }

      await deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } catch {
        // Ignore choice resolution issues; the install sheet already handled the UX.
      }
      setDeferredInstallPrompt(null);
      return;
    }

    if (item.action === 'ocr-paste') {
      navigate('/tools/smart-ocr', {
        state: {
          clipboardRequestId: Date.now(),
        },
      });
      return;
    }

    if (!item.path) {
      return;
    }

    navigate(item.path, item.state ? { state: item.state } : undefined);
  }, [deferredInstallPrompt, navigate]);

  return (
    <>
      <MainLayout>
        <AnimatePresence mode="wait">
          <Suspense fallback={<RouteFallback />}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<HomeDashboard />} />
              <Route path="/receive" element={<ZenPortal />} />
              <Route path="/tools" element={<Navigate to="/tools/image-optimizer" replace />} />
              <Route path="/tools/image-optimizer" element={<ImageOptimizer />} />
              <Route path="/tools/video-compressor" element={<VideoCompressor />} />
              <Route path="/tools/audio-converter" element={<AudioConverter />} />
              <Route path="/tools/video-to-gif" element={<VideoToGif />} />
              <Route path="/tools/smart-ocr" element={<SmartOcr />} />
              <Route path="/tools/pdf-editor" element={<PdfEditor />} />
              <Route path="/tools/megagrid" element={<MegaGrid />} />
              <Route path="/tools/archive-manager" element={<ArchiveManager />} />
              <Route path="/tools/batch-watermark" element={<BatchWatermark />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route
                path="/api-overview"
                element={(
                  <SpotlightPage
                    eyebrow="Developer Surface"
                    title="API experience is being shaped into a premium control plane."
                    description="Upload signing, conversion jobs, auth and observability are already in the platform. This route becomes the polished developer surface while the product shell keeps the same Apple-tier visual system."
                    primaryAction={{ label: 'Войти', to: '/login' }}
                    secondaryAction={{ label: 'На главную', to: '/' }}
                    onNavigate={navigate}
                  />
                )}
              />
              <Route
                path="/pricing"
                element={(
                  <SpotlightPage
                    eyebrow="Commercial Layer"
                    title="Pricing is moving toward a clearer premium structure."
                    description="We are packaging personal workflows, professional conversion throughput and future API access into a cleaner pricing surface without compromising the local-first product feeling."
                    primaryAction={{ label: 'Создать аккаунт', to: '/register' }}
                    secondaryAction={{ label: 'Посмотреть инструменты', to: '/tools' }}
                    onNavigate={navigate}
                  />
                )}
              />
              <Route
                path="/login"
                element={<LoginPage apiBase={apiBase} onNavigate={navigate} />}
              />
              <Route
                path="/register"
                element={<RegisterPage apiBase={apiBase} onNavigate={navigate} />}
              />
              <Route
                path="/forgot-password"
                element={<ForgotPasswordPage apiBase={apiBase} onNavigate={navigate} />}
              />
              <Route
                path="/reset-password"
                element={<ResetPasswordPage apiBase={apiBase} onNavigate={navigate} />}
              />
              <Route
                path="/auth/callback"
                element={<AuthCallbackPage onNavigate={navigate} />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AnimatePresence>
      </MainLayout>

      <CommandPalette
        open={isPaletteOpen}
        onOpenChange={setIsPaletteOpen}
        items={TOOL_ITEMS}
        activeTool={activeToolMeta.id}
        installAvailable={Boolean(deferredInstallPrompt)}
        onSelect={handleSelectTool}
      />
    </>
  );
}
