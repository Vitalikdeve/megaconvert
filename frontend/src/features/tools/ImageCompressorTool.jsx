import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import {
  AlertTriangle,
  Download,
  Loader2,
  SlidersHorizontal,
  Upload
} from 'lucide-react';

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value || 0)));

const formatBytes = (value) => {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

const toCompressedName = (name, type) => {
  const safe = String(name || 'image')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/\.+/g, '.');
  const base = safe.includes('.') ? safe.slice(0, safe.lastIndexOf('.')) : safe;
  const extFromType = String(type || '').toLowerCase().includes('webp')
    ? 'webp'
    : String(type || '').toLowerCase().includes('png')
      ? 'png'
      : String(type || '').toLowerCase().includes('jpeg')
        ? 'jpg'
        : (safe.split('.').pop() || 'jpg');
  return `${String(base || 'image').replace(/[-_.]+$/g, '') || 'image'}-compressed.${extFromType}`;
};

const isImageFile = (file) => {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  if (type.startsWith('image/')) return true;
  const name = String(file.name || '').toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].some((suffix) => name.endsWith(suffix));
};

export default function ImageCompressorTool() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [sourceFile, setSourceFile] = useState(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [compressedFile, setCompressedFile] = useState(null);
  const [compressedUrl, setCompressedUrl] = useState('');
  const [quality, setQuality] = useState(75);
  const [lastComputedQuality, setLastComputedQuality] = useState(null);
  const [comparePosition, setComparePosition] = useState(50);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('Загрузите фото для интерактивного сжатия');
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);
  const sourceUrlRef = useRef(null);
  const compressedUrlRef = useRef(null);
  const jobRef = useRef(0);

  const clearSourceUrl = useCallback(() => {
    if (!sourceUrlRef.current) return;
    URL.revokeObjectURL(sourceUrlRef.current);
    sourceUrlRef.current = null;
  }, []);

  const clearCompressedUrl = useCallback(() => {
    if (!compressedUrlRef.current) return;
    URL.revokeObjectURL(compressedUrlRef.current);
    compressedUrlRef.current = null;
  }, []);

  useEffect(() => () => {
    clearSourceUrl();
    clearCompressedUrl();
  }, [clearCompressedUrl, clearSourceUrl]);

  const setSelectedFile = useCallback((file) => {
    if (!file) return;
    if (!isImageFile(file)) {
      setError('Поддерживаются только изображения (JPG, PNG, WEBP, GIF).');
      return;
    }
    clearSourceUrl();
    clearCompressedUrl();
    const nextSourceUrl = URL.createObjectURL(file);
    sourceUrlRef.current = nextSourceUrl;
    setSourceFile(file);
    setSourceUrl(nextSourceUrl);
    setCompressedFile(null);
    setCompressedUrl('');
    setLastComputedQuality(null);
    setQuality(75);
    setComparePosition(50);
    setError('');
    setStatusText('Двигаете ползунок качества — оценка и превью обновляются');
  }, [clearCompressedUrl, clearSourceUrl]);

  const clearAll = useCallback(() => {
    setSourceFile(null);
    setSourceUrl('');
    setCompressedFile(null);
    setCompressedUrl('');
    setLastComputedQuality(null);
    setQuality(75);
    setComparePosition(50);
    setIsProcessing(false);
    setError('');
    setStatusText('Редактор очищен');
    clearSourceUrl();
    clearCompressedUrl();
  }, [clearCompressedUrl, clearSourceUrl]);

  const runCompressionPreview = useCallback(async (file, targetQuality, jobId) => {
    if (!file) return;
    setIsProcessing(true);
    setError('');
    setStatusText('Пересчитываем сжатие...');
    try {
      const maxSizeMb = Math.max(0.05, Number(file.size || 0) / (1024 * 1024));
      const resultFile = await imageCompression(file, {
        useWebWorker: true,
        maxIteration: 10,
        maxSizeMB: maxSizeMb,
        initialQuality: clamp(targetQuality, 1, 100) / 100,
        fileType: String(file.type || '').trim() || undefined
      });
      if (jobId !== jobRef.current) return;
      clearCompressedUrl();
      const nextUrl = URL.createObjectURL(resultFile);
      compressedUrlRef.current = nextUrl;
      setCompressedFile(resultFile);
      setCompressedUrl(nextUrl);
      setLastComputedQuality(clamp(targetQuality, 1, 100));
      setStatusText('Превью и размер обновлены');
    } catch {
      if (jobId !== jobRef.current) return;
      setError('Не удалось выполнить сжатие. Попробуйте другой файл.');
      setStatusText('Ошибка сжатия');
    } finally {
      if (jobId === jobRef.current) {
        setIsProcessing(false);
      }
    }
  }, [clearCompressedUrl]);

  useEffect(() => {
    if (!sourceFile) return;
    const nextJobId = jobRef.current + 1;
    jobRef.current = nextJobId;
    const timer = window.setTimeout(() => {
      void runCompressionPreview(sourceFile, quality, nextJobId);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [quality, runCompressionPreview, sourceFile]);

  const onDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const nextFile = event.dataTransfer?.files?.[0] || null;
    if (nextFile) setSelectedFile(nextFile);
  };

  const heuristicSize = useMemo(() => {
    if (!sourceFile) return 0;
    const q = clamp(quality, 1, 100) / 100;
    const ratio = Math.max(0.06, Math.min(1, 0.08 + (0.92 * Math.pow(q, 1.65))));
    return Math.round((sourceFile.size || 0) * ratio);
  }, [quality, sourceFile]);

  const shownCompressedSize = useMemo(() => {
    if (compressedFile && lastComputedQuality === quality) return compressedFile.size;
    return heuristicSize;
  }, [compressedFile, heuristicSize, lastComputedQuality, quality]);

  const canDownload = Boolean(compressedFile && compressedUrl);
  const outputName = toCompressedName(sourceFile?.name, compressedFile?.type || sourceFile?.type);

  return (
    <section className="mc-card rounded-3xl p-6 md:p-8">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Media / Image Compression</div>
        <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Интерактивное сжатие изображений
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-3xl">
          Настраивайте качество и сразу сравнивайте исходник с результатом на split-экране.
        </p>
      </div>

      <div
        className={`mt-6 rounded-3xl border-2 border-dashed px-5 py-8 text-center backdrop-blur-xl transition-all duration-300 ease-out ${
          isDragOver
            ? 'border-cyan-400/70 bg-cyan-50/70 dark:bg-cyan-500/10'
            : 'border-slate-300/70 dark:border-white/15 bg-white/70 dark:bg-white/5'
        }`}
        onDragEnter={() => setIsDragOver(true)}
        onDragLeave={() => setIsDragOver(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDrop={onDrop}
      >
        <div className="mx-auto h-12 w-12 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-200">
          <Upload size={18} />
        </div>
        <div className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Перетащите фото сюда</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">или выберите изображение вручную</div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-all duration-300 ease-out hover:scale-[1.02]"
          >
            Выбрать изображение
          </button>
          {sourceFile && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 transition-all duration-300 ease-out hover:scale-[1.02]"
            >
              Очистить
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
      />

      {sourceFile && (
        <>
          <div className="mt-6 rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
              <SlidersHorizontal size={13} />
              Качество
            </div>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={100}
                value={quality}
                onChange={(event) => setQuality(clamp(Number(event.target.value || 75), 1, 100))}
                className="w-full accent-cyan-600"
              />
              <div className="w-12 text-right text-sm font-semibold text-slate-800 dark:text-slate-100">{quality}%</div>
            </div>
            <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Оригинал: <span className="font-semibold text-slate-900 dark:text-slate-100">{formatBytes(sourceFile.size)}</span>
              {' '}→{' '}
              После сжатия: <span className="font-semibold text-slate-900 dark:text-slate-100">~{formatBytes(shownCompressedSize)}</span>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 dark:border-white/10 h-[340px] bg-slate-100 dark:bg-slate-900">
              {sourceUrl && (
                <img
                  src={sourceUrl}
                  alt="before"
                  className="absolute inset-0 h-full w-full object-contain select-none pointer-events-none"
                />
              )}
              {compressedUrl && (
                <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${comparePosition}%` }}>
                  <img
                    src={compressedUrl}
                    alt="after"
                    className="absolute inset-0 h-full w-full object-contain select-none pointer-events-none"
                  />
                </div>
              )}

              <div className="absolute inset-0 pointer-events-none">
                <div
                  className="absolute top-0 h-full w-[2px] bg-white/80 shadow-[0_0_0_1px_rgba(15,23,42,0.22)]"
                  style={{ left: `calc(${comparePosition}% - 1px)` }}
                />
                <div className="absolute left-3 top-3 rounded-lg bg-black/45 px-2 py-1 text-xs font-semibold text-white">До</div>
                <div className="absolute right-3 top-3 rounded-lg bg-cyan-500/80 px-2 py-1 text-xs font-semibold text-white">После</div>
              </div>
            </div>
            <div className="mt-4">
              <input
                type="range"
                min={0}
                max={100}
                value={comparePosition}
                onChange={(event) => setComparePosition(clamp(Number(event.target.value || 50), 0, 100))}
                className="w-full accent-cyan-600"
              />
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Ползунок До/После</div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              {isProcessing && <Loader2 size={14} className="animate-spin" />}
              {statusText}
            </div>
            {canDownload && (
              <a
                href={compressedUrl}
                download={outputName}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/60 dark:border-emerald-300/30 bg-emerald-100/70 dark:bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:text-emerald-100 transition-all duration-300 ease-out hover:scale-[1.02]"
              >
                <Download size={15} />
                Скачать сжатое
              </a>
            )}
          </div>
        </>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-red-300/60 dark:border-red-400/20 bg-red-100/70 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}
    </section>
  );
}
