import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  Copy,
  RefreshCcw,
  Search,
  Upload,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import Tesseract from 'tesseract.js';
import GlassPanel from '../ui/GlassPanel.jsx';
import {
  consumeTempMemory,
  OCR_FILE_HANDOFF_KEY,
  OCR_SESSION_KEY,
} from '../../lib/osMemory.js';
import i18n from '../../i18n.js';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MotionToolScene = motion.div;
const MotionSection = motion.div;

const sceneTransition = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1],
};

function fileToNamedFile(file, fallbackName) {
  if (!file) {
    return null;
  }

  if (file.name) {
    return file;
  }

  return new File([file], fallbackName, {
    type: file.type || 'application/octet-stream',
    lastModified: Date.now(),
  });
}

function isPdfFile(file) {
  if (!file) {
    return false;
  }

  const fileName = String(file.name || '').toLowerCase();
  return file.type === 'application/pdf' || fileName.endsWith('.pdf');
}

function formatSourceMeta(meta) {
  if (!meta?.name) {
    return '';
  }

  if (meta.kind === 'pdf' && meta.pageCount > 1) {
    return `${meta.name} · ${meta.pageCount} стр.`;
  }

  return meta.name;
}

function canvasToBlob(canvas, type = 'image/png', quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error(i18n.t('smartOcr.errors.pagePreviewFailed')));
    }, type, quality);
  });
}

async function buildImagePreviewDataUrl(file) {
  const maxDimension = 1400;

  if (typeof window.createImageBitmap === 'function') {
    try {
      const bitmap = await window.createImageBitmap(file);
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));

      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close?.();

      return canvas.toDataURL('image/jpeg', 0.9);
    } catch {
      // Fall through to FileReader below.
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(i18n.t('smartOcr.errors.imagePreviewFailed')));
    reader.readAsDataURL(file);
  });
}

async function renderPdfPagePreview(page) {
  const viewport = page.getViewport({ scale: 1.45 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const context = canvas.getContext('2d', { alpha: false });
  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return canvas.toDataURL('image/jpeg', 0.92);
}

function persistOcrSession(session) {
  try {
    localStorage.setItem(OCR_SESSION_KEY, JSON.stringify(session));
  } catch {
    try {
      localStorage.setItem(
        OCR_SESSION_KEY,
        JSON.stringify({
          ...session,
          previewUrl: '',
        }),
      );
    } catch {
      // Keep silent; OCR should still work even if persistence quota is full.
    }
  }
}

async function dataUrlToFile(dataUrl, fileName) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, {
    type: blob.type || 'image/png',
    lastModified: Date.now(),
  });
}

async function readClipboardImport() {
  if (!navigator.clipboard?.read) {
    throw new Error(i18n.t('smartOcr.errors.clipboardDirectReadUnavailable'));
  }

  const clipboardItems = await navigator.clipboard.read();

  for (const clipboardItem of clipboardItems) {
    const imageType = clipboardItem.types.find((type) => type.startsWith('image/'));
    if (imageType) {
      const blob = await clipboardItem.getType(imageType);
      return new File([blob], 'clipboard-capture.png', {
        type: imageType,
        lastModified: Date.now(),
      });
    }

    if (clipboardItem.types.includes('application/pdf')) {
      const blob = await clipboardItem.getType('application/pdf');
      return new File([blob], 'clipboard-document.pdf', {
        type: 'application/pdf',
        lastModified: Date.now(),
      });
    }
  }

  throw new Error(i18n.t('smartOcr.errors.clipboardEmpty'));
}

export default function SmartOcr() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const copyResetTimeoutRef = useRef(null);

  const [selectedImage, setSelectedImage] = useState('');
  const [sourceMeta, setSourceMeta] = useState({
    name: '',
    kind: '',
    pageCount: 0,
    origin: '',
    restored: false,
  });
  const [extractedText, setExtractedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState('');

  const resetCopyState = useCallback(() => {
    if (copyResetTimeoutRef.current) {
      window.clearTimeout(copyResetTimeoutRef.current);
      copyResetTimeoutRef.current = null;
    }
    setIsCopied(false);
  }, []);

  const resetSession = useCallback(() => {
    resetCopyState();
    setSelectedImage('');
    setSourceMeta({
      name: '',
      kind: '',
      pageCount: 0,
      origin: '',
      restored: false,
    });
    setExtractedText('');
    setProgress(0);
    setIsDragOver(false);
    setError('');

    try {
      localStorage.removeItem(OCR_SESSION_KEY);
    } catch {
      // Ignore storage cleanup issues.
    }
  }, [resetCopyState]);

  const handleCopy = useCallback(async () => {
    if (!extractedText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(extractedText);
      setIsCopied(true);

      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }

      copyResetTimeoutRef.current = window.setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch {
      setError(t('smartOcr.errors.copyFailed'));
    }
  }, [extractedText, t]);

  const runImageOcr = useCallback(async (file, nextMeta) => {
    const previewUrl = await buildImagePreviewDataUrl(file);
    setSelectedImage(previewUrl);
    setSourceMeta(nextMeta);

    const result = await Tesseract.recognize(file, 'rus+eng', {
      logger: (message) => {
        if (typeof message.progress === 'number') {
          const normalizedProgress = message.progress <= 1
            ? message.progress * 100
            : message.progress;
          setProgress(Math.max(0, Math.min(100, normalizedProgress)));
        }
      },
    });

    return {
      previewUrl,
      text: String(result?.data?.text || '').trim(),
    };
  }, []);

  const runPdfOcr = useCallback(async (file, nextMeta) => {
    const pdfData = await file.arrayBuffer();
    const document = await getDocument({ data: pdfData }).promise;
    const totalPages = document.numPages;

    const normalizedMeta = {
      ...nextMeta,
      pageCount: totalPages,
    };

    setSourceMeta(normalizedMeta);
    setProgress(4);

    let previewUrl = '';
    const pageTexts = [];

    for (let index = 0; index < totalPages; index += 1) {
      const page = await document.getPage(index + 1);

      if (!previewUrl) {
        previewUrl = await renderPdfPagePreview(page);
        setSelectedImage(previewUrl);
      }

      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const context = canvas.getContext('2d', { alpha: false });
      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      const pageBlob = await canvasToBlob(canvas, 'image/png');

      const result = await Tesseract.recognize(pageBlob, 'rus+eng', {
        logger: (message) => {
          if (typeof message.progress === 'number') {
            const progressWithinPage = Math.max(0, Math.min(1, message.progress));
            const totalProgress = ((index + progressWithinPage) / totalPages) * 100;
            setProgress(Math.max(0, Math.min(100, totalProgress)));
          }
        },
      });

      const pageText = String(result?.data?.text || '').trim();
      if (pageText) {
        pageTexts.push(pageText);
      }

      canvas.width = 0;
      canvas.height = 0;
      page.cleanup?.();
    }

    return {
      previewUrl,
      text: pageTexts.join('\n\n'),
      meta: normalizedMeta,
    };
  }, []);

  const handleExtractText = useCallback(async (incomingFile, origin = 'upload') => {
    const file = incomingFile?.name
      ? incomingFile
      : fileToNamedFile(
        incomingFile,
        incomingFile?.type === 'application/pdf' ? 'clipboard-document.pdf' : 'clipboard-capture.png',
      );

    if (!file) {
      return;
    }

    resetCopyState();
    setExtractedText('');
    setError('');
    setProgress(0);
    setIsProcessing(true);

    const nextMeta = {
      name: file.name || (isPdfFile(file) ? 'document.pdf' : 'clipboard-capture.png'),
      kind: isPdfFile(file) ? 'pdf' : 'image',
      pageCount: isPdfFile(file) ? 1 : 0,
      origin,
      restored: false,
    };

    try {
      const result = isPdfFile(file)
        ? await runPdfOcr(file, nextMeta)
        : await runImageOcr(file, nextMeta);

      setSourceMeta(result.meta || nextMeta);
      setSelectedImage(result.previewUrl || '');
      setExtractedText(result.text || '');
      setProgress(100);
    } catch (ocrError) {
      setError(String(ocrError?.message || t('smartOcr.errors.recognitionFailed')));
    } finally {
      setIsProcessing(false);
    }
  }, [resetCopyState, runImageOcr, runPdfOcr, t]);

  const handleDrop = useCallback(async (event) => {
    event.preventDefault();
    setIsDragOver(false);

    const [file] = Array.from(event.dataTransfer?.files ?? []);
    if (!file) {
      return;
    }

    await handleExtractText(file, 'drop');
  }, [handleExtractText]);

  const handleFileChange = useCallback(async (event) => {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!file) {
      return;
    }

    await handleExtractText(file, 'upload');
  }, [handleExtractText]);

  useEffect(() => {
    try {
      const rawSession = localStorage.getItem(OCR_SESSION_KEY);
      if (!rawSession) {
        return undefined;
      }

      const session = JSON.parse(rawSession);
      if (!session?.extractedText && !session?.previewUrl) {
        return undefined;
      }

      setSelectedImage(String(session.previewUrl || ''));
      setExtractedText(String(session.extractedText || ''));
      setSourceMeta({
        name: String(session.sourceMeta?.name || ''),
        kind: String(session.sourceMeta?.kind || ''),
        pageCount: Number(session.sourceMeta?.pageCount || 0),
        origin: String(session.sourceMeta?.origin || 'memory'),
        restored: true,
      });

      return undefined;
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (isProcessing || (!selectedImage && !extractedText && !sourceMeta.name)) {
      return;
    }

    persistOcrSession({
      previewUrl: selectedImage,
      extractedText,
      sourceMeta,
      updatedAt: Date.now(),
    });
  }, [extractedText, isProcessing, selectedImage, sourceMeta]);

  useEffect(() => {
    if (selectedImage || isProcessing) {
      return undefined;
    }

    const handlePaste = (event) => {
      const items = event.clipboardData?.items;
      if (!items?.length) {
        return;
      }

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          const file = item.getAsFile();
          if (file) {
            void handleExtractText(file, 'clipboard');
          }
          break;
        }

        if (item.type === 'application/pdf') {
          event.preventDefault();
          const file = item.getAsFile();
          if (file) {
            void handleExtractText(file, 'clipboard');
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [handleExtractText, isProcessing, selectedImage]);

  useEffect(() => () => {
    if (copyResetTimeoutRef.current) {
      window.clearTimeout(copyResetTimeoutRef.current);
      copyResetTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const state = location.state;
    if (
      !state?.clipboardRequestId
      && !state?.ocrImport
      && state?.ocrFileImportKey !== OCR_FILE_HANDOFF_KEY
    ) {
      return undefined;
    }

    let isActive = true;

    const handleExternalImport = async () => {
      try {
        if (state.clipboardRequestId) {
          const file = await readClipboardImport();
          if (isActive) {
            await handleExtractText(file, 'clipboard');
          }
          return;
        }

        if (state.ocrImport?.dataUrl) {
          const file = await dataUrlToFile(
            state.ocrImport.dataUrl,
            state.ocrImport.name || 'pdf-page.png',
          );

          if (isActive) {
            await handleExtractText(file, state.ocrImport.origin || 'pdf-editor');
          }
          return;
        }

        if (state.ocrFileImportKey === OCR_FILE_HANDOFF_KEY) {
          const handoff = consumeTempMemory(OCR_FILE_HANDOFF_KEY, null);
          const file = handoff?.file;

          if (!file) {
            throw new Error(t('smartOcr.errors.handoffExpired'));
          }

          if (isActive) {
            await handleExtractText(file, handoff.origin || 'zen-portal');
          }
        }
      } catch (importError) {
        if (isActive) {
          setError(String(importError?.message || t('smartOcr.errors.externalImportFailed')));
        }
      } finally {
        if (isActive) {
          navigate(location.pathname, { replace: true, state: null });
        }
      }
    };

    void handleExternalImport();

    return () => {
      isActive = false;
    };
  }, [handleExtractText, location.pathname, location.state, navigate, t]);

  const sourceKindLabel = sourceMeta.kind === 'pdf' ? t('smartOcr.sourceKindPdf') : t('smartOcr.sourceKindImage');
  const progressLabel = sourceMeta.kind === 'pdf'
    ? t('smartOcr.progress.pdf', { progress: Math.round(progress) })
    : t('smartOcr.progress.document', { progress: Math.round(progress) });
  const hasSession = Boolean(selectedImage || extractedText || sourceMeta.name);

  return (
    <MotionToolScene
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={sceneTransition}
      className="flex h-screen w-screen items-center justify-center bg-[#030303] px-4 text-white"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      <GlassPanel
        layout
        className="flex h-[min(84vh,660px)] w-[min(1120px,calc(100vw-2rem))] flex-col overflow-hidden px-6 py-6 sm:px-8 sm:py-8"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="inline-flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/80">
              <Search className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.32em] text-white/28">
                {t('smartOcr.eyebrow')}
              </div>
              <h2 className="mt-1 text-xl font-medium text-white/82">{t('smartOcr.title')}</h2>
              {sourceMeta.restored ? (
                <div className="mt-2 inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-white/48">
                  {t('smartOcr.sessionRestored')}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasSession ? (
              <button
                type="button"
                onClick={resetSession}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] px-4 py-2.5 text-sm text-white/72 transition-colors duration-300 hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCcw className="h-4 w-4" strokeWidth={1.8} />
                {t('portalNewFile')}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] px-4 py-2.5 text-sm text-white/72 transition-colors duration-300 hover:bg-white/[0.1] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
              {t('portalBack')}
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!hasSession ? (
            <MotionSection
              key="ocr-empty"
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={sceneTransition}
              className="flex flex-1 items-center justify-center"
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDrop={(event) => void handleDrop(event)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragOver(true);
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragOver(false);
                }}
                className={[
                  'flex h-full min-h-[360px] w-full items-center justify-center rounded-[32px] border border-dashed px-6 text-center transition-colors duration-300',
                  isDragOver
                    ? 'border-white/20 bg-white/[0.07]'
                    : 'border-white/[0.08] bg-white/[0.03]',
                ].join(' ')}
              >
                <div className="flex max-w-[500px] flex-col items-center gap-5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/76">
                    <Upload className="h-6 w-6" strokeWidth={1.8} />
                  </div>

                  <div className="space-y-3">
                    <div className="text-xl font-medium tracking-tight text-white/78">
                      {t('smartOcr.dropTitle')}
                    </div>
                    <div className="text-sm leading-7 text-white/38">
                      {t('smartOcr.dropBody')}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-white/46">
                      {t('smartOcr.capabilityClipboard')}
                    </div>
                    <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-white/46">
                      PDF
                    </div>
                    <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-white/46">
                      {t('smartOcr.capabilityLanguages')}
                    </div>
                  </div>
                </div>
              </button>
            </MotionSection>
          ) : isProcessing ? (
            <MotionSection
              key="ocr-processing"
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={sceneTransition}
              className="flex flex-1 flex-col items-center justify-center gap-8 text-center"
            >
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02]">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(rgba(129, 140, 248, 0.95) ${Math.round(progress * 3.6)}deg, rgba(255,255,255,0.05) 0deg)`,
                    mask: 'radial-gradient(farthest-side, transparent calc(100% - 7px), white calc(100% - 6px))',
                    WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 7px), white calc(100% - 6px))',
                  }}
                />
                <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full border border-white/[0.06] bg-[#050505] text-xl font-medium text-white/78">
                  {Math.round(progress)}%
                </div>
              </div>

              <div className="w-full max-w-[460px] space-y-3">
                <div className="h-[6px] overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    className="h-full rounded-full bg-[linear-gradient(90deg,rgba(129,140,248,0.95),rgba(56,189,248,0.9))]"
                    animate={{ width: `${Math.max(4, Math.round(progress))}%` }}
                    transition={{ duration: 0.24, ease: 'easeOut' }}
                  />
                </div>

                <div className="animate-pulse text-lg font-medium text-white/58">
                  {progressLabel}
                </div>

                <div className="text-xs uppercase tracking-[0.28em] text-white/28">
                  {sourceKindLabel}
                </div>
              </div>
            </MotionSection>
          ) : (
            <MotionSection
              key="ocr-success"
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={sceneTransition}
              className="grid flex-1 gap-5 lg:grid-cols-[0.95fr_1.05fr]"
            >
              <div className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-white/48">
                    {sourceKindLabel}
                  </div>
                  {sourceMeta.origin ? (
                    <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-white/38">
                      {sourceMeta.origin}
                    </div>
                  ) : null}
                </div>

                <div className="min-h-0 flex-1 overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#060606]">
                  {selectedImage ? (
                    <img
                      src={selectedImage}
                      alt={t('smartOcr.sourceAlt')}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm leading-7 text-white/34">
                      {t('smartOcr.previewMissing')}
                    </div>
                  )}
                </div>

                {sourceMeta.name ? (
                  <div className="mt-4 truncate text-sm text-white/46">
                    {formatSourceMeta(sourceMeta)}
                  </div>
                ) : null}
              </div>

              <div className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.32em] text-white/28">
                      {t('smartOcr.extractedTitle')}
                    </div>
                    <div className="mt-1 text-sm text-white/36">
                      {t('smartOcr.extractedSubtitle')}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-sm text-white/72 transition-colors duration-300 hover:bg-white/[0.1] hover:text-white"
                  >
                    {isCopied ? (
                      <Check className="h-4 w-4" strokeWidth={1.8} />
                    ) : (
                      <Copy className="h-4 w-4" strokeWidth={1.8} />
                    )}
                    {isCopied ? t('smartOcr.copied') : t('smartOcr.copy')}
                  </button>
                </div>

                <textarea
                  value={extractedText}
                  onChange={(event) => setExtractedText(event.target.value)}
                  className="min-h-0 flex-1 resize-none rounded-2xl border border-white/[0.08] bg-white/[0.05] px-4 py-4 text-sm leading-7 text-white/76 outline-none placeholder:text-white/24"
                  placeholder={t('smartOcr.placeholder')}
                />
              </div>
            </MotionSection>
          )}
        </AnimatePresence>

        {error ? (
          <div className="mt-5 rounded-[22px] border border-red-400/20 bg-red-500/8 px-4 py-3 text-sm text-red-100/75">
            {error}
          </div>
        ) : null}
      </GlassPanel>
    </MotionToolScene>
  );
}
