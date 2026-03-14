import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { AnimatePresence, motion, useAnimationControls, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  Archive,
  ArrowRight,
  ArrowLeft,
  ChevronsLeftRight,
  Check,
  Cloud,
  Download,
  FileText,
  Image as ImageIcon,
  Minimize2,
  Music,
  Plus,
  QrCode,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  Smartphone,
  Trash2,
  Video,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import useAI from '../hooks/useAI.js';
import useCloudConvert from '../hooks/useCloudConvert.js';
import useFFmpeg from '../hooks/useFFmpeg.js';
import useMegaDrop from '../hooks/useMegaDrop.js';
import useSoundDesign from '../hooks/useSoundDesign.js';
import {
  OCR_FILE_HANDOFF_KEY,
  PDF_EDITOR_HANDOFF_KEY,
  writeTempMemory,
} from '../lib/osMemory.js';
import {
  detectFileExtension,
  detectFileCategory,
  getAvailableTargetFormats,
  getDetectedFormatMeta,
  getFormatCategoryLabelKey,
  getFormatGroupLabelKey,
  groupTargetFormats,
  resolveConversionTool,
  resolveLocalFallbackAction,
} from '../lib/formatMatrix.js';

const baseGlow = '0 0 80px -20px rgba(120, 119, 198, 0.30), inset 0 0 40px rgba(79, 70, 229, 0.08)';
const hoverGlow = '0 0 110px -16px rgba(120, 119, 198, 0.48), inset 0 0 56px rgba(79, 70, 229, 0.16)';
const springTransition = {
  type: 'spring',
  stiffness: 180,
  damping: 22,
  mass: 0.9,
};

const MotionPortal = motion.div;
const MotionSection = motion.div;
const MotionButton = motion.button;
const checkerboardStyle = {
  backgroundImage: `
    linear-gradient(45deg, rgba(255,255,255,0.045) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255,255,255,0.045) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.045) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.045) 75%)
  `,
  backgroundSize: '28px 28px',
  backgroundPosition: '0 0, 0 14px, 14px -14px, -14px 0',
};

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 KB';
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getSmartActions(file, t) {
  if (!file) {
    return [];
  }

  const category = detectFileCategory(file);
  if (isPdfLikeFile(file)) {
    return [
      { label: t('portalActionOpenPdfEditor'), icon: FileText, actionType: 'open_pdf_editor' },
      { label: t('portalActionOpenPdfOcr'), icon: Search, actionType: 'open_pdf_ocr' },
    ];
  }

  if (category === 'images' || category === 'design') {
    if (isHeicLikeFile(file)) {
      return [
        { label: t('portalActionImageToJpg'), icon: ImageIcon, actionType: 'image_to_jpg' },
      ];
    }

    return [
      { label: t('portalActionRemoveBackground'), icon: Sparkles, actionType: 'remove_background_ai' },
      { label: t('portalActionSmartCompress'), icon: Minimize2, actionType: 'compress_image' },
    ];
  }

  if (category === 'video') {
    return [
      { label: t('portalActionCompressMp4'), icon: Video, actionType: 'compress_mp4' },
      { label: t('portalActionExtractAudio'), icon: Music, actionType: 'extract_audio' },
    ];
  }

  if (category === 'audio') {
    return [
      { label: t('portalActionCompressAudio'), icon: Minimize2, actionType: 'compress_audio' },
    ];
  }

  return [];
}

function detectPrimaryActionType(file) {
  if (!file) {
    return null;
  }

  const category = detectFileCategory(file);
  if (isPdfLikeFile(file)) {
    return 'open_pdf_editor';
  }

  const name = String(file.name || '').toLowerCase();

  if (category === 'images' || category === 'design') {
    const aiHints = ['portrait', 'avatar', 'profile', 'product', 'logo', 'subject', 'cutout', 'person'];
    if (isHeicLikeFile(file)) {
      return 'image_to_jpg';
    }
    return aiHints.some((hint) => name.includes(hint)) ? 'remove_background_ai' : 'compress_image';
  }

  if (category === 'video') {
    return 'compress_mp4';
  }

  if (category === 'audio') {
    return 'compress_audio';
  }

  return null;
}

function getFileTypeIcon(category) {
  switch (category) {
    case 'images':
      return ImageIcon;
    case 'video':
      return Video;
    case 'audio':
      return Music;
    case 'documents':
    case 'spreadsheets':
    case 'presentations':
    case 'ebooks':
    case 'data':
    case 'design':
      return FileText;
    case 'archives':
      return Archive;
    default:
      return RefreshCw;
  }
}

function isPdfLikeFile(file) {
  if (!file) {
    return false;
  }

  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();

  return type === 'application/pdf' || name.endsWith('.pdf');
}

function isHeicLikeFile(file) {
  if (!file) {
    return false;
  }

  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();

  return (
    type === 'image/heic' ||
    type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}

function resolveCloudTargetFormat(inputExt, actionType, actionOptions = {}) {
  const normalizedInputExt = String(inputExt || '').trim().toLowerCase();
  const requestedTarget = String(actionOptions.targetFormat || '').trim().toLowerCase();

  if (requestedTarget) {
    return requestedTarget;
  }

  if (actionType === 'image_to_jpg') {
    return 'jpg';
  }

  if (actionType === 'extract_audio' || actionType === 'audio_to_mp3') {
    return 'mp3';
  }

  if (actionType === 'compress_image' && normalizedInputExt && normalizedInputExt !== 'jpg') {
    return 'jpg';
  }

  if (actionType === 'compress_mp4' && normalizedInputExt && normalizedInputExt !== 'mp4') {
    return 'mp4';
  }

  if (actionType === 'compress_audio' && normalizedInputExt && normalizedInputExt !== 'mp3') {
    return 'mp3';
  }

  return '';
}

function shouldUseLocalFallback(error) {
  const status = Number(error?.status || 0);
  const code = String(error?.code || '').trim().toUpperCase();
  const message = String(error?.message || '').trim().toLowerCase();

  if ([500, 502, 503, 504].includes(status)) {
    return true;
  }

  if (code === 'CLOUD_TIMEOUT' || code === 'CLOUD_NETWORK') {
    return true;
  }

  return message.includes('timed out')
    || message.includes('failed to fetch')
    || message.includes('network');
}

function normalizeMegaDropRoomCode(value) {
  return String(value || '').trim().replace(/\D+/g, '').slice(0, 6);
}

function getInitialReceiveContext() {
  if (typeof window === 'undefined') {
    return {
      isReceiverMode: false,
      roomCode: '',
    };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    isReceiverMode: window.location.pathname === '/receive',
    roomCode: normalizeMegaDropRoomCode(params.get('room')),
  };
}

function isImageLikeResult(resultFile) {
  if (!resultFile) {
    return false;
  }

  const mimeType = String(resultFile.mimeType || '').toLowerCase();
  const fileName = String(resultFile.fileName || '').toLowerCase();

  return mimeType.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif|bmp|avif)$/i.test(fileName);
}

function CompareSlider({
  beforeSrc,
  afterSrc,
  beforeAlt,
  afterAlt,
  showTransparencyGrid = false,
}) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const [sliderPosition, setSliderPosition] = useState(58);
  const [isPointerDown, setIsPointerDown] = useState(false);

  const updateSlider = useCallback((clientX) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0) {
      return;
    }

    const relativeX = clientX - bounds.left;
    const nextPosition = Math.max(0, Math.min(100, (relativeX / bounds.width) * 100));
    setSliderPosition(nextPosition);
  }, []);

  const handlePointerDown = useCallback((event) => {
    setIsPointerDown(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateSlider(event.clientX);
  }, [updateSlider]);

  const handlePointerMove = useCallback((event) => {
    if (!isPointerDown) {
      return;
    }

    updateSlider(event.clientX);
  }, [isPointerDown, updateSlider]);

  const handlePointerUp = useCallback((event) => {
    setIsPointerDown(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  return (
    <div
      ref={containerRef}
      className="group relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={(event) => {
        if (isPointerDown) {
          handlePointerUp(event);
        }
      }}
    >
      <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-white/70 opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
        {t('portalCompareBefore')}
      </div>

      <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-white/70 opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
        {t('portalCompareAfter')}
      </div>

      <img
        src={beforeSrc}
        alt={beforeAlt}
        className="block max-h-[250px] w-full rounded-2xl object-contain shadow-[0_18px_50px_rgba(0,0,0,0.32)]"
      />

      <div
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${sliderPosition}%` }}
      >
        <div className="relative h-full w-full">
          {showTransparencyGrid && (
            <div
              className="absolute inset-0 opacity-60"
              style={checkerboardStyle}
            />
          )}

          <motion.img
            src={afterSrc}
            alt={afterAlt}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="relative block max-h-[250px] w-full rounded-2xl object-contain shadow-[0_18px_50px_rgba(0,0,0,0.32)]"
          />
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-y-0 z-10"
        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
      >
        <div className="relative h-full w-px bg-white/80">
          <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.16] bg-white/[0.08] text-white/90 backdrop-blur-2xl shadow-[0_10px_32px_rgba(0,0,0,0.32)]">
            <ChevronsLeftRight className="h-4 w-4" strokeWidth={1.9} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ZenPortal({ variant = 'standalone' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const receiveContext = useMemo(() => getInitialReceiveContext(), []);
  const fileInputRef = useRef(null);
  const aiResultUrlRef = useRef(null);
  const sourcePreviewUrlRef = useRef(null);
  const portalRef = useRef(null);
  const portalControls = useAnimationControls();
  const magneticResetTimeoutRef = useRef(null);
  const previousModelLoadingRef = useRef(false);
  const previousResultUrlRef = useRef(null);
  const receiverAutoJoinRef = useRef(false);
  const cursorOrbitX = useMotionValue(0);
  const cursorOrbitY = useMotionValue(0);
  const orbitTranslateX = useTransform(cursorOrbitX, [-1, 1], [-18, 18]);
  const orbitTranslateY = useTransform(cursorOrbitY, [-1, 1], [-18, 18]);
  const orbitRotateY = useTransform(cursorOrbitX, [-1, 1], [-8, 8]);
  const orbitRotateX = useTransform(cursorOrbitY, [-1, 1], [8, -8]);
  const springX = useSpring(orbitTranslateX, { stiffness: 150, damping: 15 });
  const springY = useSpring(orbitTranslateY, { stiffness: 150, damping: 15 });
  const springRotateX = useSpring(orbitRotateX, { stiffness: 150, damping: 15 });
  const springRotateY = useSpring(orbitRotateY, { stiffness: 150, damping: 15 });
  const isReceiverMode = receiveContext.isReceiverMode;
  const receiveRoomCode = receiveContext.roomCode;
  const [isDragging, setIsDragging] = useState(false);
  const [isMegaDropOpen, setIsMegaDropOpen] = useState(isReceiverMode);
  const [activeFile, setActiveFile] = useState(null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState('');
  const [primaryActionType, setPrimaryActionType] = useState(null);
  const [activeActionType, setActiveActionType] = useState(null);
  const [formatSearch, setFormatSearch] = useState('');
  const [progressMessageOverride, setProgressMessageOverride] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [rippleConfig, setRippleConfig] = useState(null);
  const {
    isReady,
    isConverting,
    progress,
    result,
    error,
    isSupported,
    loadFFmpeg,
    processMedia,
    resetSession,
    clearError,
  } = useFFmpeg();
  const {
    isModelLoading,
    isProcessing,
    modelProgress,
    modelDevice,
    error: aiError,
    clearError: clearAiError,
    removeBackground,
    resetSession: resetAiSession,
  } = useAI();
  const {
    phase: cloudPhase,
    progress: cloudProgress,
    error: cloudError,
    isBusy: isCloudBusy,
    uploadAndConvertToCloud,
    resetSession: resetCloudSession,
  } = useCloudConvert();
  const {
    primeAudio,
    playDrop,
    playSuccess,
    playAIWakeup,
  } = useSoundDesign();
  const {
    webRtcSupported,
    roomId: megaDropRoomId,
    shareUrl: megaDropShareUrl,
    statusText: megaDropStatusText,
    error: megaDropError,
    transferPhase: megaDropPhase,
    transferProgress,
    downloadUrl: megaDropDownloadUrl,
    downloadName: megaDropDownloadName,
    isConnected: megaDropConnected,
    isComplete: megaDropComplete,
    isJoining: megaDropJoining,
    startHosting,
    joinRoom,
    resetMegaDrop,
  } = useMegaDrop();

  const actionItems = useMemo(() => getSmartActions(activeFile, t), [activeFile, t]);
  const detectedFormatMeta = useMemo(() => getDetectedFormatMeta(activeFile), [activeFile]);
  const detectedFileCategory = detectedFormatMeta.category || detectFileCategory(activeFile);
  const FileTypeIcon = useMemo(() => getFileTypeIcon(detectedFileCategory), [detectedFileCategory]);
  const conversionTargets = useMemo(() => getAvailableTargetFormats(activeFile), [activeFile]);
  const groupedConversionTargets = useMemo(
    () => groupTargetFormats(conversionTargets),
    [conversionTargets],
  );
  const availableFormatCount = conversionTargets.length;
  const finalResult = aiResult || result;
  const isNeuralBusy = isModelLoading || isProcessing;
  const cloudStatusLabel = cloudPhase === 'checking'
    ? t('portalStatusCloudConnecting')
    : cloudPhase === 'uploading'
      ? t('portalStatusCloudUploading')
      : cloudPhase === 'queued'
        ? t('portalStatusCloudQueued')
        : cloudPhase === 'processing'
          ? t('portalStatusCloudProcessing', { progress: Math.round(cloudProgress) })
          : cloudPhase === 'downloading'
            ? t('portalStatusCloudDownloading')
            : '';
  const isBusy = isConverting || isNeuralBusy || isCloudBusy;
  const effectiveProgressMessageOverride = finalResult || (!isBusy && activeFile)
    ? ''
    : (progressMessageOverride ? t(progressMessageOverride) : '');
  const hasForcedProgressState = Boolean(effectiveProgressMessageOverride);
  const isImagePreview = isImageLikeResult(finalResult);
  const showCompareSlider = Boolean(
    isImagePreview
    && sourcePreviewUrl
    && activeFile
    && ['images', 'design'].includes(detectedFileCategory)
    && !isHeicLikeFile(activeFile)
    && ['remove_background_ai', 'image_to_jpg', 'compress_image', 'convert'].includes(String(activeActionType || ''))
  );
  const showMegaDropPortal = isReceiverMode || isMegaDropOpen;

  const megaDropProgressRatio = Math.max(0, Math.min(1, (Number(transferProgress) || 0) / 100));
  const isMegaDropTransferActive = megaDropConnected && !megaDropComplete && ['transferring', 'receiving', 'awaiting-confirmation'].includes(String(megaDropPhase || ''));
  const portalMode = showMegaDropPortal
    ? 'megadrop'
    : !activeFile
      ? 'drop'
      : finalResult
        ? 'success'
        : (isBusy || hasForcedProgressState)
          ? 'progress'
          : 'actions';
  useEffect(() => {
    setFormatSearch('');
  }, [activeFile, portalMode]);
  const progressRatio = isModelLoading
    ? Math.max(0, Math.min(1, modelProgress / 100))
    : isCloudBusy
      ? Math.max(0.04, Math.min(1, cloudProgress / 100))
    : isConverting
      ? Math.max(0, Math.min(1, progress / 100))
      : hasForcedProgressState
        ? 0.02
        : 1;
  const statusLabel = effectiveProgressMessageOverride || (isModelLoading
    ? t('portalStatusAiWaking', { progress: Math.round(modelProgress) })
    : isCloudBusy
      ? cloudStatusLabel
    : isProcessing
      ? t('portalStatusProcessing')
      : t('portalStatusConverting', { progress: Math.round(progress) }));
  const indicatorLabel = isProcessing && !isModelLoading ? 'AI' : `${Math.round(progressRatio * 100)}%`;
  const surfaceError = aiError || error || cloudError;
  const showTransparencyGrid = Boolean(aiResult) && String(finalResult?.mimeType || '').toLowerCase() === 'image/png';
  const isEmbedded = variant === 'embedded';
  const usedCloudResult = cloudPhase === 'completed' && Boolean(finalResult);
  const footerLabel = portalMode === 'megadrop'
    ? (megaDropRoomId
      ? t('portalFooterMegaDropWithRoom', { roomCode: megaDropRoomId })
      : t('portalFooterMegaDrop'))
    : isCloudBusy || usedCloudResult
      ? t('portalFooterCloud')
    : isModelLoading || isProcessing
      ? (modelDevice
        ? t('portalFooterNeuralEdgeDevice', { device: String(modelDevice).toUpperCase() })
        : t('portalFooterNeuralEdge'))
      : isPdfLikeFile(activeFile)
        ? t('portalFooterSmartHandoff')
      : isReady
        ? (activeActionType === 'image_to_jpg' && isHeicLikeFile(activeFile) && !finalResult
          ? t('portalFooterZeroClick')
          : t('portalFooterFfmpeg'))
        : '';

  const clearAiResult = useCallback(() => {
    if (aiResultUrlRef.current) {
      URL.revokeObjectURL(aiResultUrlRef.current);
      aiResultUrlRef.current = null;
    }

    setAiResult(null);
  }, []);

  const clearSourcePreview = useCallback(() => {
    if (sourcePreviewUrlRef.current) {
      URL.revokeObjectURL(sourcePreviewUrlRef.current);
      sourcePreviewUrlRef.current = null;
    }

    setSourcePreviewUrl('');
  }, []);

  const applyPortalResult = useCallback((nextResult) => {
    if (!(nextResult?.blob instanceof Blob)) {
      throw new Error('Conversion result blob is missing.');
    }

    clearAiResult();

    const url = URL.createObjectURL(nextResult.blob);
    aiResultUrlRef.current = url;

    setAiResult({
      ...nextResult,
      url,
      fileName: String(nextResult.fileName || 'result.bin'),
      mimeType: String(nextResult.mimeType || nextResult.blob.type || 'application/octet-stream'),
      size: Number(nextResult.size || nextResult.blob.size || 0),
    });
  }, [clearAiResult]);

  const runLocalAction = useCallback(async (file, actionType, actionOptions = {}) => {
    const localActionType = actionType === 'convert'
      ? resolveLocalFallbackAction(file, actionOptions.targetFormat)
      : actionType;

    if (localActionType === 'remove_background_ai') {
      const nextResult = await removeBackground(file);
      applyPortalResult(nextResult);
      return nextResult;
    }

    return processMedia(file, localActionType);
  }, [applyPortalResult, processMedia, removeBackground]);

  useEffect(() => {
    if (!isSupported) {
      return undefined;
    }

    void loadFFmpeg({ silent: true }).catch(() => {
      // Keep the portal visually silent until the user explicitly triggers an action.
    });

    return undefined;
  }, [isSupported, loadFFmpeg]);

  useEffect(() => () => {
    if (aiResultUrlRef.current) {
      URL.revokeObjectURL(aiResultUrlRef.current);
      aiResultUrlRef.current = null;
    }

    if (sourcePreviewUrlRef.current) {
      URL.revokeObjectURL(sourcePreviewUrlRef.current);
      sourcePreviewUrlRef.current = null;
    }

    if (magneticResetTimeoutRef.current) {
      window.clearTimeout(magneticResetTimeoutRef.current);
      magneticResetTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isModelLoading && !previousModelLoadingRef.current) {
      void playAIWakeup();
    }

    previousModelLoadingRef.current = isModelLoading;
  }, [isModelLoading, playAIWakeup]);

  useEffect(() => {
    const nextResultUrl = finalResult?.url || null;

    if (nextResultUrl && nextResultUrl !== previousResultUrlRef.current) {
      void playSuccess();
    }

    previousResultUrlRef.current = nextResultUrl;
  }, [finalResult, playSuccess]);

  useEffect(() => {
    if (!isReceiverMode || !receiveRoomCode || receiverAutoJoinRef.current) {
      return;
    }

    receiverAutoJoinRef.current = true;
    void joinRoom(receiveRoomCode).catch(() => {
      // The MegaDrop hook already exposes a subtle inline error state.
    });
  }, [isReceiverMode, joinRoom, receiveRoomCode]);

  useEffect(() => {
    void portalControls.start({
      opacity: 1,
      scale: 1,
      boxShadow: isDragging ? hoverGlow : baseGlow,
      transition: springTransition,
    });
  }, [isDragging, portalControls]);

  const resetMagneticOrbit = useCallback(() => {
    cursorOrbitX.set(0);
    cursorOrbitY.set(0);
  }, [cursorOrbitX, cursorOrbitY]);

  const updateMagneticOrbit = useCallback((clientX, clientY) => {
    const halfWidth = window.innerWidth / 2;
    const halfHeight = window.innerHeight / 2;
    const normalizedX = Math.max(-1, Math.min(1, (clientX - halfWidth) / halfWidth));
    const normalizedY = Math.max(-1, Math.min(1, (clientY - halfHeight) / halfHeight));

    cursorOrbitX.set(normalizedX);
    cursorOrbitY.set(normalizedY);
  }, [cursorOrbitX, cursorOrbitY]);

  const scheduleMagneticReset = useCallback(() => {
    if (magneticResetTimeoutRef.current) {
      window.clearTimeout(magneticResetTimeoutRef.current);
    }

    magneticResetTimeoutRef.current = window.setTimeout(() => {
      setIsDragging(false);
      resetMagneticOrbit();
    }, 90);
  }, [resetMagneticOrbit]);

  const runSwallowAnimation = useCallback(async () => {
    await portalControls.start({
      scale: 0.95,
      boxShadow: '0 0 140px -8px rgba(120, 119, 198, 0.72), inset 0 0 72px rgba(79, 70, 229, 0.22)',
      transition: {
        duration: 0.18,
        ease: [0.22, 1, 0.36, 1],
      },
    });

    await portalControls.start({
      scale: 1,
      boxShadow: hoverGlow,
      transition: {
        type: 'spring',
        stiffness: 280,
        damping: 18,
        mass: 0.8,
      },
    });
  }, [portalControls]);

  const activateFile = useCallback(
    async (file) => {
      if (!file) {
        return;
      }

      setIsMegaDropOpen(false);
      void resetMegaDrop();
      clearAiResult();
      clearSourcePreview();
      resetSession();
      resetAiSession();
      resetCloudSession();
      clearError();
      clearAiError();
      setProgressMessageOverride('');
      setActiveActionType(null);
      setActiveFile(file);
      if (String(file.type || '').toLowerCase().startsWith('image/') && !isHeicLikeFile(file)) {
        const nextSourceUrl = URL.createObjectURL(file);
        sourcePreviewUrlRef.current = nextSourceUrl;
        setSourcePreviewUrl(nextSourceUrl);
      }
      const detectedPrimaryAction = detectPrimaryActionType(file);
      setPrimaryActionType(detectedPrimaryAction);

      if (isSupported && !isPdfLikeFile(file)) {
        void loadFFmpeg({ silent: true }).catch(() => {
          // Defer error display until the user starts processing.
        });
      }
    },
    [clearAiError, clearAiResult, clearError, clearSourcePreview, isSupported, loadFFmpeg, resetAiSession, resetCloudSession, resetMegaDrop, resetSession],
  );

  const handleDrop = useCallback(
    async (event) => {
      event.preventDefault();

      const [file] = Array.from(event.dataTransfer?.files ?? []);
      if (!file) {
        if (magneticResetTimeoutRef.current) {
          window.clearTimeout(magneticResetTimeoutRef.current);
          magneticResetTimeoutRef.current = null;
        }
        setIsDragging(false);
        resetMagneticOrbit();
        return;
      }

      if (magneticResetTimeoutRef.current) {
        window.clearTimeout(magneticResetTimeoutRef.current);
        magneticResetTimeoutRef.current = null;
      }

      const bounds = portalRef.current?.getBoundingClientRect();
      if (bounds) {
        setRippleConfig({
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
          key: Date.now(),
        });
      }

      void playDrop();
      await runSwallowAnimation();
      setIsDragging(false);
      resetMagneticOrbit();
      await activateFile(file);
    },
    [activateFile, playDrop, resetMagneticOrbit, runSwallowAnimation],
  );

  const handleScreenDragOver = useCallback((event) => {
    event.preventDefault();
    if (magneticResetTimeoutRef.current) {
      window.clearTimeout(magneticResetTimeoutRef.current);
      magneticResetTimeoutRef.current = null;
    }
    setIsDragging(true);
    updateMagneticOrbit(event.clientX, event.clientY);
  }, [updateMagneticOrbit]);

  const handleScreenDragLeave = useCallback((event) => {
    event.preventDefault();
    scheduleMagneticReset();
  }, [scheduleMagneticReset]);

  const handleFileChange = useCallback(
    async (event) => {
      const [file] = Array.from(event.target.files ?? []);
      event.target.value = '';
      if (!file) {
        return;
      }

      void primeAudio();
      await runSwallowAnimation();
      resetMagneticOrbit();
      await activateFile(file);
    },
    [activateFile, primeAudio, resetMagneticOrbit, runSwallowAnimation],
  );

  const handlePortalClick = useCallback(() => {
    if (!activeFile) {
      void primeAudio();
      fileInputRef.current?.click();
    }
  }, [activeFile, primeAudio]);

  const handleReset = useCallback(
    (event) => {
      event?.stopPropagation?.();
      setIsMegaDropOpen(false);
      setActiveFile(null);
      setPrimaryActionType(null);
      setActiveActionType(null);
      setProgressMessageOverride('');
      setIsDragging(false);
      if (magneticResetTimeoutRef.current) {
        window.clearTimeout(magneticResetTimeoutRef.current);
        magneticResetTimeoutRef.current = null;
      }
      resetMagneticOrbit();
      clearAiResult();
      clearSourcePreview();
      resetSession();
      resetAiSession();
      resetCloudSession();
      void resetMegaDrop();
      clearError();
      clearAiError();

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [clearAiError, clearAiResult, clearError, clearSourcePreview, resetAiSession, resetCloudSession, resetMagneticOrbit, resetMegaDrop, resetSession],
  );

  const runStrictCloudFirstAction = useCallback(async (file, actionType, actionOptions = {}) => {
    const inputExt = String(
      actionOptions.inputFormat || detectFileExtension(file) || '',
    ).trim().toLowerCase();
    const targetFormat = resolveCloudTargetFormat(inputExt, actionType, actionOptions);

    if (!targetFormat) {
      return runLocalAction(file, actionType, actionOptions);
    }

    setProgressMessageOverride('portalStatusCloudSubmitting');

    try {
      const cloudRequest = uploadAndConvertToCloud(
        file,
        targetFormat,
        actionOptions.settings || {},
      );
      setProgressMessageOverride('');

      const nextResult = await cloudRequest;
      applyPortalResult(nextResult);
      toast.success(t('portalToastCloudSuccess'));
      return nextResult;
    } catch (cloudProcessingError) {
      if (!shouldUseLocalFallback(cloudProcessingError)) {
        setProgressMessageOverride('');
        throw cloudProcessingError;
      }

      console.warn('Server is unavailable. Switching to local fallback:', cloudProcessingError);
      resetCloudSession();
      setProgressMessageOverride('portalStatusLocalFallback');
      toast.info(t('portalToastCloudFallback'), { duration: 4000 });

      try {
        return await runLocalAction(file, actionType, {
          ...actionOptions,
          targetFormat,
        });
      } catch (localProcessingError) {
        toast.error(t('portalToastLocalFailure'));
        throw localProcessingError;
      } finally {
        setProgressMessageOverride('');
      }
    }
  }, [applyPortalResult, resetCloudSession, runLocalAction, t, uploadAndConvertToCloud]);

  const handleActionClick = useCallback(
    async (actionType, actionOptions = {}) => {
      if (!activeFile || isBusy) {
        return;
      }

      void primeAudio();
      clearError();
      clearAiError();
      clearAiResult();
      resetSession();
      resetCloudSession();
      setProgressMessageOverride('');
      setActiveActionType(actionType);

      try {
        if (actionType === 'open_pdf_editor') {
          writeTempMemory(PDF_EDITOR_HANDOFF_KEY, {
            file: activeFile,
            origin: 'zen-portal',
          });
          navigate('/tools/pdf-editor', {
            state: {
              pdfEditorImportKey: PDF_EDITOR_HANDOFF_KEY,
            },
          });
          return;
        }

        if (actionType === 'open_pdf_ocr') {
          writeTempMemory(OCR_FILE_HANDOFF_KEY, {
            file: activeFile,
            origin: 'zen-portal',
          });
          navigate('/tools/smart-ocr', {
            state: {
              ocrFileImportKey: OCR_FILE_HANDOFF_KEY,
            },
          });
          return;
        }

        await runStrictCloudFirstAction(activeFile, actionType, {
          ...actionOptions,
          tool: actionType === 'convert'
            ? String(
              actionOptions.tool
                || resolveConversionTool(detectedFormatMeta.ext, actionOptions.targetFormat),
            ).trim()
            : actionOptions.tool,
          inputFormat: detectedFormatMeta.ext,
        });
      } catch {
        // The hooks already store a subtle inline error state.
      }
    },
    [activeFile, clearAiError, clearAiResult, clearError, detectedFormatMeta.ext, isBusy, navigate, primeAudio, resetCloudSession, resetSession, runStrictCloudFirstAction],
  );

  const handleOpenMegaDrop = useCallback(async () => {
    if (!finalResult || isBusy) {
      return;
    }

    const resultBlob = finalResult.blob instanceof Blob
      ? finalResult.blob
      : null;

    if (!resultBlob) {
      return;
    }

    setIsMegaDropOpen(true);

    try {
      await startHosting({
        blob: resultBlob,
        fileName: finalResult.fileName,
        mimeType: finalResult.mimeType || resultBlob.type || 'application/octet-stream',
      });
    } catch {
      // The hook already exposes the inline status and error state.
    }
  }, [finalResult, isBusy, startHosting]);

  const handleCloseMegaDrop = useCallback(() => {
    void resetMegaDrop();
    setIsMegaDropOpen(false);

    if (isReceiverMode) {
      navigate('/');
    }
  }, [isReceiverMode, navigate, resetMegaDrop]);

  return (
    <div
      className={[
        'relative flex flex-col items-center justify-center text-white',
        isEmbedded
          ? 'w-full overflow-visible'
          : 'min-h-[calc(100vh-4rem)] w-full overflow-hidden bg-[#030303] px-4',
      ].join(' ')}
      onDragOver={handleScreenDragOver}
      onDragEnter={handleScreenDragOver}
      onDragLeave={handleScreenDragLeave}
      onDropCapture={(event) => {
        event.preventDefault();
        if (magneticResetTimeoutRef.current) {
          window.clearTimeout(magneticResetTimeoutRef.current);
          magneticResetTimeoutRef.current = null;
        }
        setIsDragging(false);
        resetMagneticOrbit();
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />

      <MotionPortal
        ref={portalRef}
        layout
        role={portalMode === 'drop' ? 'button' : 'region'}
        tabIndex={portalMode === 'drop' ? 0 : -1}
        aria-label={portalMode === 'drop' ? t('portalDropPrompt') : undefined}
        className={[
          'flex overflow-hidden rounded-[40px] border border-white/[0.08] bg-white/[0.02] backdrop-blur-3xl',
          'shadow-[0_0_80px_-20px_rgba(120,119,198,0.3)]',
          isEmbedded ? 'w-full max-w-[760px]' : 'max-w-[calc(100vw-2rem)]',
          portalMode === 'drop' ? (isEmbedded ? 'min-h-[320px] items-center justify-center p-6 sm:p-8' : 'h-[300px] w-[600px] items-center justify-center') : '',
          portalMode === 'actions' ? (isEmbedded ? 'min-h-[400px] p-6 sm:p-8' : 'min-h-[400px] w-[700px] p-8') : '',
          portalMode === 'progress' ? (isEmbedded ? 'min-h-[320px] p-6 sm:p-8' : 'min-h-[320px] w-[620px] p-8') : '',
          portalMode === 'megadrop' ? (isEmbedded ? 'min-h-[440px] p-6 sm:p-8' : 'min-h-[440px] w-[700px] p-8') : '',
          portalMode === 'success' ? (
            isEmbedded
              ? (isImagePreview ? 'min-h-[560px] p-6 sm:p-8' : 'min-h-[320px] p-6 sm:p-8')
              : (isImagePreview ? 'min-h-[560px] w-[760px] p-8' : 'min-h-[320px] w-[620px] p-8')
          ) : '',
          portalMode === 'drop' ? 'cursor-pointer' : 'cursor-default',
          isDragging ? 'border-white/[0.16] bg-white/[0.035]' : '',
        ].join(' ')}
        initial={{ opacity: 0, scale: 0.985 }}
        animate={portalControls}
        transition={springTransition}
        style={{
          x: springX,
          y: springY,
          rotateX: springRotateX,
          rotateY: springRotateY,
          transformPerspective: 1400,
        }}
        whileHover={{
          scale: portalMode === 'drop' ? 1.02 : 1.01,
          boxShadow: hoverGlow,
        }}
        onClick={portalMode === 'drop' ? handlePortalClick : undefined}
        onKeyDown={(event) => {
          if (portalMode === 'drop' && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            handlePortalClick();
          }
        }}
        onDrop={portalMode === 'megadrop' ? undefined : handleDrop}
      >
        <AnimatePresence>
          {rippleConfig && (
            <motion.div
              key={rippleConfig.key}
              initial={{ scale: 0, opacity: 0.34 }}
              animate={{ scale: 52, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
              onAnimationComplete={() => {
                setRippleConfig((current) => (current?.key === rippleConfig.key ? null : current));
              }}
              className="pointer-events-none absolute z-0 h-10 w-10 rounded-full blur-2xl"
              style={{
                left: rippleConfig.x,
                top: rippleConfig.y,
                transform: 'translate(-50%, -50%)',
                background: 'radial-gradient(circle, rgba(255,255,255,0.24) 0%, rgba(129,140,248,0.24) 28%, rgba(56,189,248,0.12) 48%, rgba(255,255,255,0) 72%)',
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence initial={false} mode="wait">
          {portalMode === 'drop' && (
            <MotionSection
              key="drop-state"
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none relative z-10 flex h-full w-full flex-col items-center justify-center gap-5 px-8 text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/70 shadow-[inset_0_0_24px_rgba(255,255,255,0.04)]">
                <Sparkles className="h-7 w-7" strokeWidth={1.6} />
              </div>

              <p className="text-2xl font-medium tracking-wide text-white/60">
                {t('portalDropPrompt')}
              </p>
            </MotionSection>
          )}

          {portalMode === 'actions' && activeFile && (
            <MotionSection
              key="action-panel"
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 flex w-full flex-col gap-6"
            >
              <div className="flex items-start gap-4 rounded-[28px] border border-white/[0.08] bg-white/[0.03] px-5 py-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-white/[0.08] bg-white/[0.04] text-white/82 shadow-[inset_0_0_28px_rgba(255,255,255,0.04)]">
                  <FileTypeIcon className="h-6 w-6" strokeWidth={1.75} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-lg font-medium text-white/88">
                      {activeFile.name}
                    </div>
                    <div className="inline-flex max-w-full items-center rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white/52">
                      {t('portalDetectedBadge')}
                      {' '}
                      <span className="ml-2 truncate text-white/76">
                        {t(getFormatCategoryLabelKey(detectedFileCategory))}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/45">
                    <span>{formatFileSize(activeFile.size)}</span>
                    <span>{t('portalDetectedFormatLabel', { format: detectedFormatMeta.label })}</span>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label={t('portalResetFileAria')}
                  onClick={handleReset}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/68 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  <Trash2 className="h-4.5 w-4.5" strokeWidth={1.75} />
                </button>
              </div>

              {actionItems.length > 0 && (
                <div className="space-y-3">
                  <div className="text-[11px] uppercase tracking-[0.32em] text-white/34">
                    {t('portalSectionSmartActions')}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {actionItems.map(({ label, icon, actionType }) => {
                      const isPrimary = actionType === primaryActionType;

                      return (
                        <MotionButton
                          key={actionType}
                          type="button"
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.985 }}
                          transition={springTransition}
                          onClick={() => void handleActionClick(actionType)}
                          className={[
                            'flex min-h-[102px] items-center gap-4 rounded-[28px] px-5 py-4 text-left transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                            isPrimary
                              ? 'border border-indigo-300/20 bg-white/[0.08] text-white shadow-[0_0_44px_-22px_rgba(129,140,248,0.75)] hover:bg-white/[0.11]'
                              : 'border border-white/10 bg-white/[0.04] text-white/84 hover:bg-white/10',
                          ].join(' ')}
                        >
                          <div className={[
                            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-white/[0.03]',
                            isPrimary ? 'border-indigo-200/20 text-white' : 'border-white/[0.08] text-white/72',
                          ].join(' ')}>
                            {React.createElement(icon, {
                              className: 'h-5 w-5',
                              strokeWidth: 1.8,
                            })}
                          </div>

                          <span className="text-base font-medium tracking-tight">
                            {label}
                          </span>
                        </MotionButton>
                      );
                    })}
                  </div>
                </div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                className="space-y-4 rounded-[30px] border border-white/[0.08] bg-white/[0.025] px-5 py-5"
              >
                <div className="space-y-1">
                  <div className="text-[11px] uppercase tracking-[0.32em] text-white/34">
                    {t('portalSectionUniversal')}
                  </div>
                  <div className="text-base font-medium text-white/82">
                    {t('portalSectionUniversalTitle')}
                  </div>
                  <div className="text-sm text-white/46">
                    {t('portalFormatSearchHint', { count: availableFormatCount })}
                  </div>
                </div>

                {groupedConversionTargets.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
                  >
                    <Command
                      shouldFilter
                      loop
                      className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-black/25 shadow-[0_18px_56px_rgba(0,0,0,0.28)] backdrop-blur-3xl [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:pt-4 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.3em] [&_[cmdk-group-heading]]:text-white/28"
                    >
                      <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-white/72">
                          <Search className="h-4.5 w-4.5" strokeWidth={1.85} />
                        </div>
                        <Command.Input
                          value={formatSearch}
                          onValueChange={setFormatSearch}
                          placeholder={t('portalFormatSearchPlaceholder')}
                          className="h-11 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/28"
                        />
                      </div>

                      <div className="border-b border-white/[0.05] px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-white/22">
                        {t('portalFormatSearchCount', { count: availableFormatCount })}
                      </div>

                      <Command.List className="max-h-[360px] overflow-y-auto p-3">
                        <Command.Empty className="rounded-[22px] border border-white/[0.08] bg-white/[0.03] px-4 py-5 text-sm text-white/52">
                          {t('portalFormatSearchEmpty')}
                        </Command.Empty>

                        {groupedConversionTargets.map((group) => (
                          <Command.Group
                            key={group.category}
                            heading={t(getFormatGroupLabelKey(group.category))}
                          >
                            {group.options.map((option) => (
                              <Command.Item
                                key={`${group.category}-${option.ext}`}
                                value={option.searchValue}
                                disabled={isBusy}
                                onSelect={() => void handleActionClick('convert', {
                                  targetFormat: option.ext,
                                  tool: option.toolId,
                                })}
                                className="group mt-1 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-transparent px-3 py-3 text-left outline-none transition-all duration-200 data-[selected=true]:border-white/[0.08] data-[selected=true]:bg-white/[0.08] data-[selected=true]:shadow-[0_0_30px_-18px_rgba(129,140,248,0.85)]"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium tracking-tight text-white">
                                    {option.label}
                                  </div>
                                  <div className="mt-1 text-xs text-white/38">
                                    {option.cloudOnly ? t('portalFormatBadgeCloud') : t('portalFormatBadgeReady')}
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                  {option.cloudOnly ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/18 bg-sky-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-sky-100/80">
                                      <Cloud className="h-3 w-3" strokeWidth={1.8} />
                                      {t('portalFormatBadgeCloudShort')}
                                    </span>
                                  ) : (
                                    <span className="inline-flex rounded-full border border-emerald-300/18 bg-emerald-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-emerald-100/80">
                                      {t('portalFormatBadgeDirect')}
                                    </span>
                                  )}

                                  <ArrowRight className="h-4 w-4 text-white/34 transition-transform duration-200 group-data-[selected=true]:translate-x-0.5 group-data-[selected=true]:text-white/72" strokeWidth={1.9} />
                                </div>
                              </Command.Item>
                            ))}
                          </Command.Group>
                        ))}
                      </Command.List>
                    </Command>
                  </motion.div>
                ) : (
                  <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.03] px-4 py-4 text-sm text-white/52">
                    {t('portalNoFormatsAvailable')}
                  </div>
                )}
              </motion.div>

              {surfaceError && (
                <div className="rounded-[24px] border border-red-400/20 bg-red-500/8 px-4 py-3 text-sm text-red-100/75">
                  <div className="flex items-center justify-between gap-4">
                    <span>{surfaceError}</span>
                    <button
                      type="button"
                      onClick={() => {
                        clearError();
                        clearAiError();
                        resetCloudSession();
                      }}
                      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-white/60 transition-colors duration-300 hover:text-white"
                    >
                      {t('portalHideError')}
                    </button>
                  </div>
                </div>
              )}
            </MotionSection>
          )}

          {portalMode === 'progress' && activeFile && (
            <MotionSection
              key="progress-panel"
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 flex w-full flex-col items-center justify-center gap-8 text-center"
            >
              <div className="text-sm tracking-[0.28em] text-white/32">
                {activeFile.name}
              </div>

              <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02]">
                {isProcessing && !isModelLoading ? (
                  <motion.div
                    className="absolute inset-0 rounded-full border border-indigo-300/25"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2.4, ease: 'linear', repeat: Infinity }}
                    style={{
                      borderTopColor: 'rgba(129, 140, 248, 0.95)',
                      borderRightColor: 'rgba(56, 189, 248, 0.65)',
                    }}
                  />
                ) : (
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(rgba(129, 140, 248, 0.95) ${progressRatio * 360}deg, rgba(255,255,255,0.05) 0deg)`,
                      mask: 'radial-gradient(farthest-side, transparent calc(100% - 7px), white calc(100% - 6px))',
                      WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 7px), white calc(100% - 6px))',
                    }}
                  />
                )}

                <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full border border-white/[0.06] bg-[#050505] text-xl font-medium text-white/78">
                  {indicatorLabel}
                </div>
              </div>

              <div className="w-full max-w-[440px] space-y-3">
                <div className="h-[6px] overflow-hidden rounded-full bg-white/[0.06]">
                  {isProcessing && !isModelLoading ? (
                    <motion.div
                      className="h-full w-[36%] rounded-full bg-[linear-gradient(90deg,rgba(129,140,248,0),rgba(129,140,248,0.92),rgba(56,189,248,0))]"
                      animate={{ x: ['-20%', '220%'] }}
                      transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity }}
                    />
                  ) : (
                    <motion.div
                      className="h-full rounded-full bg-[linear-gradient(90deg,rgba(129,140,248,0.95),rgba(56,189,248,0.9))]"
                      animate={{ width: `${Math.round(progressRatio * 100)}%` }}
                      transition={{ duration: 0.24, ease: 'easeOut' }}
                    />
                  )}
                </div>

                <div className="animate-pulse text-lg font-medium text-white/58">
                  {statusLabel}
                </div>
              </div>
            </MotionSection>
          )}

          {portalMode === 'megadrop' && (
            <MotionSection
              key="megadrop-panel"
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 flex w-full flex-col items-center justify-center gap-6 text-center"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-white/58">
                <Radio className="h-3.5 w-3.5" strokeWidth={1.8} />
                {t('legacyV3.megaDrop.title')}
              </div>

              {!webRtcSupported ? (
                <div className="w-full max-w-[520px] rounded-[28px] border border-red-400/20 bg-red-500/8 px-5 py-5 text-sm text-red-100/80">
                  {t('portalMegaDropUnsupported')}
                </div>
              ) : megaDropComplete ? (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400/10 text-emerald-200">
                    <Check className="h-7 w-7" strokeWidth={1.8} />
                  </div>

                  <div className="space-y-2">
                    <div className="text-3xl font-medium tracking-tight text-white/88">
                      {isReceiverMode ? t('portalMegaDropReceived') : t('portalMegaDropComplete')}
                    </div>
                    <div className="text-sm text-white/46">
                      {megaDropStatusText}
                    </div>
                  </div>

                  <div className="flex w-full max-w-[460px] flex-col gap-3 sm:flex-row">
                    {isReceiverMode && megaDropDownloadUrl && (
                      <a
                        href={megaDropDownloadUrl}
                        download={megaDropDownloadName || 'megadrop-download'}
                        className="flex min-h-[60px] flex-1 items-center justify-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.06] px-5 text-base font-medium text-white/84 transition-colors duration-300 hover:bg-white/10"
                      >
                        <Download className="h-5 w-5" strokeWidth={1.8} />
                        {t('portalDownload')}
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={handleCloseMegaDrop}
                      className="flex min-h-[60px] flex-1 items-center justify-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] px-5 text-base font-medium text-white/72 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white"
                    >
                      <Plus className="h-5 w-5" strokeWidth={1.8} />
                      {t('portalBack')}
                    </button>
                  </div>
                </>
              ) : isMegaDropTransferActive ? (
                <>
                  <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02]">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `conic-gradient(rgba(129, 140, 248, 0.95) ${megaDropProgressRatio * 360}deg, rgba(255,255,255,0.05) 0deg)`,
                        mask: 'radial-gradient(farthest-side, transparent calc(100% - 7px), white calc(100% - 6px))',
                        WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 7px), white calc(100% - 6px))',
                      }}
                    />

                    <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full border border-white/[0.06] bg-[#050505] text-xl font-medium text-white/78">
                      {Math.round(megaDropProgressRatio * 100)}%
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-2xl font-medium tracking-tight text-white/82">
                      {t('portalDirectTransfer')}
                    </div>
                    <div className="text-sm text-white/44">
                      {megaDropStatusText}
                    </div>
                  </div>
                </>
              ) : !isReceiverMode ? (
                <>
                  <div className="flex w-full flex-col items-center gap-5">
                    <div className="rounded-[32px] border border-white/[0.08] bg-white/[0.03] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
                      <div className="rounded-[28px] bg-white/[0.92] p-4 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">
                        {megaDropShareUrl ? (
                          <QRCodeSVG
                            value={megaDropShareUrl}
                            size={220}
                            marginSize={0}
                            bgColor="transparent"
                            fgColor="#050816"
                          />
                        ) : (
                          <div className="flex h-[220px] w-[220px] items-center justify-center text-slate-500">
                            <RefreshCw className="h-7 w-7 animate-spin" strokeWidth={1.8} />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 text-lg font-medium text-white/82">
                        <Smartphone className="h-5 w-5" strokeWidth={1.8} />
                        {t('portalPointCamera')}
                      </div>
                      <div className="text-sm text-white/44">
                        {megaDropStatusText}
                      </div>
                    </div>

                    {megaDropRoomId && (
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs uppercase tracking-[0.28em] text-white/64">
                        <QrCode className="h-3.5 w-3.5" strokeWidth={1.8} />
                        {megaDropRoomId}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseMegaDrop}
                    className="flex min-h-[54px] items-center justify-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] px-6 text-sm font-medium text-white/72 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white"
                  >
                    <ArrowLeft className="h-4.5 w-4.5" strokeWidth={1.8} />
                    {t('portalBack')}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/70 shadow-[inset_0_0_24px_rgba(255,255,255,0.04)]">
                    <Smartphone className="h-7 w-7" strokeWidth={1.6} />
                  </div>

                  <div className="space-y-2">
                    <div className="text-3xl font-medium tracking-tight text-white/88">
                      {megaDropJoining ? t('portalConnecting') : t('portalWaitingTransfer')}
                    </div>
                    <div className="text-sm text-white/44">
                      {receiveRoomCode ? megaDropStatusText : t('portalMegaDropRoomMissing')}
                    </div>
                  </div>

                  {receiveRoomCode && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs uppercase tracking-[0.28em] text-white/64">
                      <QrCode className="h-3.5 w-3.5" strokeWidth={1.8} />
                      {receiveRoomCode}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleCloseMegaDrop}
                    className="flex min-h-[54px] items-center justify-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] px-6 text-sm font-medium text-white/72 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white"
                  >
                    <ArrowLeft className="h-4.5 w-4.5" strokeWidth={1.8} />
                    {t('portalBack')}
                  </button>
                </>
              )}

              {megaDropError && (
                <div className="w-full max-w-[520px] rounded-[24px] border border-red-400/20 bg-red-500/8 px-4 py-3 text-sm text-red-100/75">
                  {megaDropError}
                </div>
              )}
            </MotionSection>
          )}

          {portalMode === 'success' && finalResult && (
            <MotionSection
              key="success-panel"
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 flex w-full flex-col items-center justify-center gap-6 text-center"
            >
              {isImagePreview ? (
                <div className="flex w-full flex-col items-center gap-5">
                  <div className="relative flex w-full items-center justify-center overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.02] px-4 py-5">
                    {showCompareSlider ? (
                      <CompareSlider
                        beforeSrc={sourcePreviewUrl}
                        afterSrc={finalResult.url}
                        beforeAlt={t('portalCompareBeforeAlt', {
                          name: activeFile?.name || t('portalCompareSource'),
                        })}
                        afterAlt={t('portalCompareAfterAlt', {
                          name: finalResult.fileName,
                        })}
                        showTransparencyGrid={showTransparencyGrid}
                      />
                    ) : (
                      <>
                        {showTransparencyGrid && (
                          <div
                            className="absolute inset-0 opacity-60"
                            style={checkerboardStyle}
                          />
                        )}

                        <motion.img
                          src={finalResult.url}
                          alt={finalResult.fileName}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                          className="relative max-h-[250px] w-full rounded-2xl object-contain shadow-[0_18px_50px_rgba(0,0,0,0.32)]"
                        />
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400/10 text-emerald-200">
                      <Check className="h-5 w-5" strokeWidth={1.8} />
                    </div>
                    <div className="max-w-[520px] truncate text-sm text-white/44">
                      {finalResult.fileName}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400/10 text-emerald-200">
                    <Check className="h-7 w-7" strokeWidth={1.8} />
                  </div>

                  <div className="space-y-2">
                    <div className="text-3xl font-medium tracking-tight text-white/88">
                      {t('portalDone')}
                    </div>
                    <div className="max-w-[460px] truncate text-sm text-white/44">
                      {finalResult.fileName}
                    </div>
                  </div>
                </>
              )}

              <div className="grid w-full max-w-[560px] gap-3 sm:grid-cols-3">
                <a
                  href={finalResult.url}
                  download={finalResult.fileName}
                  className="flex min-h-[60px] flex-1 items-center justify-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.06] px-5 text-base font-medium text-white/84 transition-colors duration-300 hover:bg-white/10"
                >
                  <Download className="h-5 w-5" strokeWidth={1.8} />
                  {t('portalDownload')}
                </a>

                <button
                  type="button"
                  onClick={handleReset}
                  className="flex min-h-[60px] flex-1 items-center justify-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] px-5 text-base font-medium text-white/72 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white"
                >
                  <Plus className="h-5 w-5" strokeWidth={1.8} />
                  {t('portalNewFile')}
                </button>

                <button
                  type="button"
                  onClick={() => void handleOpenMegaDrop()}
                  className="flex min-h-[60px] flex-1 items-center justify-center gap-3 rounded-[24px] border border-indigo-300/20 bg-white/[0.08] px-5 text-base font-medium text-white shadow-[0_0_44px_-22px_rgba(129,140,248,0.75)] transition-colors duration-300 hover:bg-white/[0.11]"
                >
                  <Smartphone className="h-5 w-5" strokeWidth={1.8} />
                  {t('legacyV3.megaDrop.title')}
                </button>
              </div>
            </MotionSection>
          )}
        </AnimatePresence>
      </MotionPortal>

      {portalMode !== 'drop' && (
        <div
          className={[
            'pointer-events-none text-xs tracking-[0.24em] text-white/18',
            isEmbedded ? 'mt-6' : 'absolute bottom-8',
          ].join(' ')}
        >
          {footerLabel}
        </div>
      )}
    </div>
  );
}
