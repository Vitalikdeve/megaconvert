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
  FileText,
  Image,
  Network,
  Search,
  Sparkles,
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
import GlassPanel from './components/ui/GlassPanel.jsx';
import { LAST_TOOL_KEY, writeStoredJson } from './lib/osMemory.js';

const ZenPortal = lazy(() => import('./components/ZenPortal.jsx'));
const ImageOptimizer = lazy(() => import('./components/tools/ImageOptimizer.jsx'));
const VideoCompressor = lazy(() => import('./components/tools/VideoCompressor.jsx'));
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
    caption: 'Zero-UI entry point',
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
];

function RouteFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#030303] px-4 text-white">
      <GlassPanel className="flex h-[320px] w-[min(620px,calc(100vw-2rem))] flex-col items-center justify-center gap-5 px-8 text-center">
        <div className="h-16 w-16 animate-pulse rounded-full border border-white/[0.08] bg-white/[0.04]" />
        <div className="text-sm uppercase tracking-[0.28em] text-white/28">
          Loading Module
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
      <AnimatePresence mode="wait">
        <Suspense fallback={<RouteFallback />}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<ZenPortal />} />
            <Route path="/receive" element={<ZenPortal />} />
            <Route path="/tools/image-optimizer" element={<ImageOptimizer />} />
            <Route path="/tools/video-compressor" element={<VideoCompressor />} />
            <Route path="/tools/smart-ocr" element={<SmartOcr />} />
            <Route path="/tools/pdf-editor" element={<PdfEditor />} />
            <Route path="/tools/megagrid" element={<MegaGrid />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AnimatePresence>

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
