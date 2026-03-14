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
  Code2,
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
import { useTranslation } from 'react-i18next';
import CommandPalette from './components/CommandPalette.jsx';
import MainLayout from './components/layout/MainLayout.jsx';
import GlassPanel from './components/ui/GlassPanel.jsx';
import AuthCallbackPage from './features/auth/pages/AuthCallbackPage.jsx';
import ForgotPasswordPage from './features/auth/pages/ForgotPasswordPage.jsx';
import LoginPage from './features/auth/pages/LoginPage.jsx';
import RegisterPage from './features/auth/pages/RegisterPage.jsx';
import ResetPasswordPage from './features/auth/pages/ResetPasswordPage.jsx';
import { BUSINESS_WORKFLOW_CATALOG } from './lib/businessWorkflowCatalog.js';
import { LAST_TOOL_KEY, writeStoredJson } from './lib/osMemory.js';

const ZenPortal = lazy(() => import('./components/ZenPortal.jsx'));
const HomeDashboard = lazy(() => import('./components/home/HomeDashboard.jsx'));
const ImageOptimizer = lazy(() => import('./components/tools/ImageOptimizer.jsx'));
const SecurityPage = lazy(() => import('./components/legal/SecurityPage.jsx'));
const PrivacyPage = lazy(() => import('./components/legal/PrivacyPage.jsx'));
const CookiesPage = lazy(() => import('./components/legal/CookiesPage.jsx'));
const VideoCompressor = lazy(() => import('./components/tools/VideoCompressor.jsx'));
const AudioConverter = lazy(() => import('./components/tools/AudioConverter.jsx'));
const VideoToGif = lazy(() => import('./components/tools/VideoToGif.jsx'));
const ArchiveManager = lazy(() => import('./components/tools/ArchiveManager.jsx'));
const BatchWatermark = lazy(() => import('./components/tools/BatchWatermark.jsx'));
const TermsPage = lazy(() => import('./components/legal/TermsPage.jsx'));
const SmartOcr = lazy(() => import('./components/tools/SmartOcr.jsx'));
const PdfEditor = lazy(() => import('./components/tools/PdfEditor.jsx'));
const MegaGrid = lazy(() => import('./components/tools/MegaGrid.jsx'));
const ToolsPortalPage = lazy(() => import('./pages/ToolsPortalPage.jsx'));
const BusinessWorkflowPage = lazy(() => import('./pages/BusinessWorkflowPage.jsx'));
const ApiDashboard = lazy(() => import('./pages/ApiDashboard.jsx'));

function RouteFallback() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center bg-[#030303] px-4 text-white">
      <GlassPanel className="flex h-[320px] w-[min(620px,calc(100vw-2rem))] flex-col items-center justify-center gap-5 px-8 text-center">
        <div className="h-16 w-16 animate-pulse rounded-full border border-white/[0.08] bg-white/[0.04]" />
        <div className="text-sm uppercase tracking-[0.28em] text-white/28">
          {t('appShell.loadingModule')}
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
  const { t } = useTranslation();
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const apiBase = useMemo(
    () => String(import.meta.env.VITE_API_BASE || '/api').trim() || '/api',
    [],
  );
  const toolItems = useMemo(() => [
    {
      id: 'zen',
      path: '/',
      aliases: ['/receive'],
      group: t('appShell.toolGroups.home'),
      label: t('appShell.tools.zen.label'),
      caption: t('appShell.tools.zen.caption'),
      icon: Sparkles,
    },
    {
      id: 'image-optimizer',
      path: '/tools/image-optimizer',
      group: t('appShell.toolGroups.media'),
      label: t('appShell.tools.imageOptimizer.label'),
      caption: t('appShell.tools.imageOptimizer.caption'),
      icon: Image,
    },
    {
      id: 'video-compressor',
      path: '/tools/video-compressor',
      group: t('appShell.toolGroups.media'),
      label: t('appShell.tools.videoCompressor.label'),
      caption: t('appShell.tools.videoCompressor.caption'),
      icon: Video,
    },
    {
      id: 'audio-converter',
      path: '/tools/audio-converter',
      group: t('appShell.toolGroups.media'),
      label: t('toolAudioConverterTitle'),
      caption: t('appShell.tools.audioConverter.caption'),
      icon: Music,
    },
    {
      id: 'video-to-gif',
      path: '/tools/video-to-gif',
      group: t('appShell.toolGroups.media'),
      label: t('toolVideoToGifTitle'),
      caption: t('appShell.tools.videoToGif.caption'),
      icon: Film,
    },
    {
      id: 'smart-ocr',
      path: '/tools/smart-ocr',
      group: t('appShell.toolGroups.documents'),
      label: t('dashboardCardOcrTitle'),
      caption: t('appShell.tools.smartOcr.caption'),
      icon: Search,
    },
    {
      id: 'pdf-editor',
      path: '/tools/pdf-editor',
      group: t('appShell.toolGroups.documents'),
      label: t('dashboardCardPdfTitle'),
      caption: t('appShell.tools.pdfEditor.caption'),
      icon: FileText,
    },
    {
      id: 'megagrid',
      path: '/tools/megagrid',
      group: t('appShell.toolGroups.network'),
      label: t('appShell.tools.megaGrid.label'),
      caption: t('appShell.tools.megaGrid.caption'),
      icon: Network,
    },
    {
      id: 'api-dashboard',
      path: '/developers',
      aliases: ['/api-dashboard', '/api-overview'],
      group: t('appShell.toolGroups.developers'),
      label: t('appShell.tools.apiDashboard.label'),
      caption: t('appShell.tools.apiDashboard.caption'),
      icon: Code2,
    },
    {
      id: 'archive-manager',
      path: '/tools/archive-manager',
      group: t('appShell.toolGroups.files'),
      label: t('toolArchiveManagerTitle'),
      caption: t('appShell.tools.archiveManager.caption'),
      icon: Archive,
    },
    {
      id: 'batch-watermark',
      path: '/tools/batch-watermark',
      group: t('appShell.toolGroups.media'),
      label: t('toolBatchWatermarkTitle'),
      caption: t('appShell.tools.batchWatermark.caption'),
      icon: Stamp,
    },
    ...BUSINESS_WORKFLOW_CATALOG.map((workflow) => ({
      id: workflow.id,
      path: workflow.route,
      group: workflow.recommendedGroup === 'document'
        ? t('appShell.toolGroups.documents')
        : t('appShell.toolGroups.media'),
      label: t(`${workflow.translationBase}.title`),
      caption: t(`${workflow.translationBase}.paletteCaption`),
      icon: workflow.icon,
    })),
  ], [t]);

  const activeToolMeta = useMemo(
    () => (
      toolItems.find((item) => item.path === location.pathname || item.aliases?.includes(location.pathname))
      || (location.pathname === '/tools'
        ? {
          id: 'tools-portal',
          path: '/tools',
          label: t('toolsPortal.eyebrow'),
        }
        : toolItems[0])
    ),
    [location.pathname, t, toolItems],
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
              <Route path="/tools" element={<ToolsPortalPage />} />
              <Route path="/developers" element={<ApiDashboard />} />
              <Route path="/api-dashboard" element={<ApiDashboard />} />
              <Route path="/tools/image-optimizer" element={<ImageOptimizer />} />
              <Route path="/tools/video-compressor" element={<VideoCompressor />} />
              <Route path="/tools/audio-converter" element={<AudioConverter />} />
              <Route path="/tools/video-to-gif" element={<VideoToGif />} />
              <Route path="/tools/smart-ocr" element={<SmartOcr />} />
              <Route path="/tools/pdf-editor" element={<PdfEditor />} />
              <Route path="/tools/megagrid" element={<MegaGrid />} />
              <Route path="/tools/archive-manager" element={<ArchiveManager />} />
              <Route path="/tools/batch-watermark" element={<BatchWatermark />} />
              <Route
                path="/tools/ai-invoice-scanner"
                element={<BusinessWorkflowPage workflowId="invoiceScanner" />}
              />
              <Route
                path="/tools/strict-pdfa"
                element={<BusinessWorkflowPage workflowId="strictPdfA" />}
              />
              <Route
                path="/tools/redact-sensitive-data"
                element={<BusinessWorkflowPage workflowId="redactSensitiveData" />}
              />
              <Route
                path="/tools/auto-subtitle-generator"
                element={<BusinessWorkflowPage workflowId="autoSubtitleGenerator" />}
              />
              <Route
                path="/tools/exif-metadata-stripper"
                element={<BusinessWorkflowPage workflowId="exifMetadataStripper" />}
              />
              <Route
                path="/tools/smart-brand-watermark"
                element={<BusinessWorkflowPage workflowId="smartBrandWatermark" />}
              />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/cookies" element={<CookiesPage />} />
              <Route
                path="/api-overview"
                element={<Navigate to="/developers" replace />}
              />
              <Route
                path="/pricing"
                element={(
                  <SpotlightPage
                    eyebrow={t('appShell.pricingSpotlight.eyebrow')}
                    title={t('appShell.pricingSpotlight.title')}
                    description={t('appShell.pricingSpotlight.description')}
                    primaryAction={{ label: t('appShell.pricingSpotlight.primaryAction'), to: '/register' }}
                    secondaryAction={{ label: t('appShell.pricingSpotlight.secondaryAction'), to: '/tools' }}
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
        items={toolItems}
        activeTool={activeToolMeta.id}
        installAvailable={Boolean(deferredInstallPrompt)}
        onSelect={handleSelectTool}
      />
    </>
  );
}
