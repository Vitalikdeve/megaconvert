import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Archive,
  Download,
  Loader2,
  Sparkles,
  Upload
} from 'lucide-react';

const MAX_FILES = 50;

const formatBytes = (value) => {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

const isImageFile = (file) => {
  if (!file) return false;
  const mime = String(file.type || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  const lowerName = String(file.name || '').toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.avif'].some((ext) => lowerName.endsWith(ext));
};

const getOutputFormat = (type) => {
  const raw = String(type || '').toLowerCase();
  if (raw.includes('png')) return { mime: 'image/png', ext: 'png' };
  if (raw.includes('webp')) return { mime: 'image/webp', ext: 'webp' };
  return { mime: 'image/jpeg', ext: 'jpg' };
};

const stripFileExtension = (name) => {
  const safe = String(name || 'image').trim().replace(/[^\w.-]+/g, '-');
  if (!safe.includes('.')) return safe || 'image';
  return safe.slice(0, safe.lastIndexOf('.')) || 'image';
};

const resolveTextPlacement = (position, width, height, padding) => {
  if (position === 'top-left') return { x: padding, y: padding, align: 'left', baseline: 'top' };
  if (position === 'top-right') return { x: width - padding, y: padding, align: 'right', baseline: 'top' };
  if (position === 'bottom-left') return { x: padding, y: height - padding, align: 'left', baseline: 'bottom' };
  if (position === 'bottom-right') return { x: width - padding, y: height - padding, align: 'right', baseline: 'bottom' };
  return { x: width / 2, y: height / 2, align: 'center', baseline: 'middle' };
};

const fileToImage = (file) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('image_load_failed'));
  };
  image.src = objectUrl;
});

const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('canvas_export_failed'));
  }, type, quality);
});

export default function BatchWatermarkTool() {
  const { t } = useTranslation();
  const positionOptions = useMemo(() => ([
    { value: 'center', label: t('legacyTools.batchWatermark.positions.center') },
    { value: 'top-left', label: t('legacyTools.batchWatermark.positions.topLeft') },
    { value: 'top-right', label: t('legacyTools.batchWatermark.positions.topRight') },
    { value: 'bottom-left', label: t('legacyTools.batchWatermark.positions.bottomLeft') },
    { value: 'bottom-right', label: t('legacyTools.batchWatermark.positions.bottomRight') }
  ]), [t]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [files, setFiles] = useState([]);
  const [watermarkText, setWatermarkText] = useState('MegaConvert');
  const [watermarkColor, setWatermarkColor] = useState('#ffffff');
  const [watermarkPosition, setWatermarkPosition] = useState('center');
  const [status, setStatus] = useState('idle');
  const [statusText, setStatusText] = useState(() => t('legacyTools.batchWatermark.statuses.initial'));
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const fileInputRef = useRef(null);
  const resultUrlRef = useRef(null);

  useEffect(() => () => {
    if (!resultUrlRef.current) return;
    URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
  }, []);

  const appendFiles = useCallback((incomingFiles) => {
    const allFiles = Array.from(incomingFiles || []);
    if (!allFiles.length) return;
    const imageFiles = allFiles.filter(isImageFile);
    if (!imageFiles.length) {
      setError(t('legacyTools.batchWatermark.errors.unsupportedFiles'));
      return;
    }
    setError('');
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }
    setResult(null);
    setStatus('idle');
    setProgress(0);
    setStatusText(t('legacyTools.batchWatermark.statuses.filesAdded'));
    setFiles((prev) => {
      const merged = [...prev, ...imageFiles];
      if (merged.length <= MAX_FILES) return merged;
      setError(t('legacyTools.batchWatermark.errors.maxFiles', { max: MAX_FILES }));
      return merged.slice(0, MAX_FILES);
    });
  }, [t]);

  const onDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    appendFiles(event.dataTransfer?.files || []);
  };

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + Number(file.size || 0), 0), [files]);
  const isBusy = status === 'processing';
  const canSubmit = files.length > 0 && String(watermarkText || '').trim().length > 0 && !isBusy;

  const clearAll = useCallback(() => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }
    setFiles([]);
    setWatermarkText('MegaConvert');
    setWatermarkColor('#ffffff');
    setWatermarkPosition('center');
    setStatus('idle');
    setStatusText(t('legacyTools.batchWatermark.statuses.cleared'));
    setProgress(0);
    setError('');
    setResult(null);
  }, [t]);

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setError('');
    setResult(null);
    setStatus('processing');
    setStatusText(t('legacyTools.batchWatermark.statuses.processing'));
    setProgress(2);

    try {
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
        resultUrlRef.current = null;
      }

      const zip = new JSZip();
      const normalizedText = watermarkText.trim().slice(0, 64);

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const image = await fileToImage(file);
        const width = Math.max(1, image.naturalWidth || image.width || 1);
        const height = Math.max(1, image.naturalHeight || image.height || 1);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('canvas_context_missing');

        context.drawImage(image, 0, 0, width, height);

        const fontSize = Math.max(12, Math.round(Math.min(width, height) * 0.06));
        const padding = Math.max(12, Math.round(Math.min(width, height) * 0.04));
        const placement = resolveTextPlacement(watermarkPosition, width, height, padding);

        context.font = `600 ${fontSize}px "SF Pro Display", "Segoe UI", sans-serif`;
        context.textAlign = placement.align;
        context.textBaseline = placement.baseline;
        context.shadowColor = 'rgba(0,0,0,0.45)';
        context.shadowBlur = Math.max(1, Math.round(fontSize * 0.24));
        context.shadowOffsetX = 0;
        context.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.08));
        context.fillStyle = watermarkColor;
        context.globalAlpha = 0.78;
        context.fillText(normalizedText, placement.x, placement.y);
        context.globalAlpha = 1;
        context.shadowColor = 'transparent';

        const output = getOutputFormat(file.type);
        const processedBlob = await canvasToBlob(
          canvas,
          output.mime,
          output.mime === 'image/jpeg' || output.mime === 'image/webp' ? 0.92 : undefined
        );

        const outputName = `${stripFileExtension(file.name)}-watermarked.${output.ext}`;
        zip.file(outputName, processedBlob);
        setProgress(Math.round(((index + 1) / files.length) * 85));
      }

      setStatusText(t('legacyTools.batchWatermark.statuses.zipping'));
      const archiveBlob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } },
        (meta) => {
          const zipProgress = Math.max(85, Math.round(85 + ((Number(meta.percent || 0) / 100) * 15)));
          setProgress(Math.min(99, zipProgress));
        }
      );

      const archiveName = `megaconvert-watermark-${Date.now()}.zip`;
      const url = URL.createObjectURL(archiveBlob);
      resultUrlRef.current = url;

      setProgress(100);
      setStatus('done');
      setStatusText(t('legacyTools.batchWatermark.statuses.done'));
      setResult({
        fileName: archiveName,
        size: archiveBlob.size,
        url
      });
    } catch (processingError) {
      setStatus('error');
      setStatusText(t('legacyTools.batchWatermark.statuses.failed'));
      setError(String(processingError?.message || t('legacyTools.batchWatermark.errors.processingFailed')));
      setProgress(0);
    }
  }, [
    canSubmit,
    files,
    t,
    watermarkColor,
    watermarkPosition,
    watermarkText
  ]);

  return (
    <section className="mc-card rounded-3xl p-6 md:p-8">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Media / Batch Watermark</div>
        <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {t('legacyTools.batchWatermark.title')}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-3xl">
          {t('legacyTools.batchWatermark.description')}
        </p>
      </div>

      <div
        className={`mt-6 rounded-3xl border-2 border-dashed px-5 py-8 text-center backdrop-blur-xl transition-all duration-300 ease-out ${
          isDragOver
            ? 'border-blue-400/70 bg-blue-50/70 dark:bg-blue-500/10'
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
        <div className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{t('legacyTools.batchWatermark.dropTitle')}</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('legacyTools.batchWatermark.dropHint', { max: MAX_FILES })}</div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-all duration-300 ease-out hover:scale-[1.02]"
          >
            {t('legacyTools.batchWatermark.selectFiles')}
          </button>
          {files.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 transition-all duration-300 ease-out hover:scale-[1.02]"
            >
              {t('btnClear')}
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        multiple
        onChange={(event) => {
          appendFiles(event.target.files || []);
          event.target.value = '';
        }}
      />

      <div className="mt-5 rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t('legacyTools.batchWatermark.filesCount', { count: files.length, max: MAX_FILES })}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {t('legacyTools.batchWatermark.totalSize', { size: formatBytes(totalSize) })}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <label className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl px-4 py-3">
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('legacyTools.batchWatermark.watermarkTextLabel')}</div>
          <input
            type="text"
            maxLength={64}
            value={watermarkText}
            onChange={(event) => setWatermarkText(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
            placeholder={t('legacyTools.batchWatermark.watermarkPlaceholder')}
          />
        </label>

        <label className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl px-4 py-3">
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('legacyTools.batchWatermark.colorLabel')}</div>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="color"
              value={watermarkColor}
              onChange={(event) => setWatermarkColor(event.target.value)}
              className="h-10 w-14 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent p-1"
            />
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">{watermarkColor.toUpperCase()}</div>
          </div>
        </label>

        <label className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl px-4 py-3">
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('legacyTools.batchWatermark.positionLabel')}</div>
          <select
            value={watermarkPosition}
            onChange={(event) => setWatermarkPosition(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
          >
            {positionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {files.length > 0 && (
        <div className="mt-5 rounded-2xl border border-white/40 dark:border-white/10 bg-white/65 dark:bg-white/5 backdrop-blur-xl p-4">
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('legacyTools.batchWatermark.selectedFiles')}</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {files.slice(0, 9).map((file, index) => (
              <div key={`${file.name}-${index}`} className="rounded-xl border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-2">
                <div className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">{file.name}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{formatBytes(file.size)}</div>
              </div>
            ))}
          </div>
          {files.length > 9 && (
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('legacyTools.batchWatermark.moreFiles', { count: files.length - 9 })}</div>
          )}
        </div>
      )}

      <div className="mt-6">
        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={!canSubmit}
          className="rounded-2xl px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.02] inline-flex items-center gap-2"
        >
          {isBusy ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {t('legacyTools.batchWatermark.processingCta')}
            </>
          ) : (
            <>
              <Sparkles size={15} />
              {t('legacyTools.batchWatermark.submit')}
            </>
          )}
        </button>
      </div>

      {(isBusy || progress > 0) && (
        <div className="mt-5 rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <span>{t('legacyTools.batchWatermark.progressLabel')}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="mt-3 h-[4px] rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 transition-all duration-300 ease-out"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{statusText}</div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl border border-red-300/60 dark:border-red-400/20 bg-red-100/70 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-2xl border border-emerald-300/60 dark:border-emerald-300/30 bg-emerald-100/70 dark:bg-emerald-500/10 px-4 py-3">
          <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-100">{t('legacyTools.batchWatermark.archiveReady')}</div>
          <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-200">
            {result.fileName} · {formatBytes(result.size)}
          </div>
          <div className="mt-3">
            <a
              href={result.url}
              download={result.fileName}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/70 dark:border-emerald-300/30 bg-white/85 dark:bg-white/5 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-100 transition-all duration-300 ease-out hover:scale-[1.02]"
            >
              <Archive size={14} />
              {t('legacyTools.batchWatermark.downloadZip')}
              <Download size={14} />
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
