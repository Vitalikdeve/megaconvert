import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import piexif from 'piexifjs';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Download,
  EyeOff,
  Loader2,
  ShieldCheck,
  Upload
} from 'lucide-react';

const formatBytes = (value) => {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

const isJpeg = (file) => {
  const type = String(file?.type || '').toLowerCase();
  if (type === 'image/jpeg') return true;
  return String(file?.name || '').toLowerCase().endsWith('.jpg') || String(file?.name || '').toLowerCase().endsWith('.jpeg');
};

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('file_read_failed'));
  reader.readAsDataURL(file);
});

const dataUrlToBlob = async (dataUrl) => {
  const response = await fetch(dataUrl);
  return response.blob();
};

const countExifTags = (exifObject) => {
  if (!exifObject || typeof exifObject !== 'object') return 0;
  let count = 0;
  Object.values(exifObject).forEach((value) => {
    if (!value || typeof value !== 'object') return;
    count += Object.keys(value).length;
  });
  return count;
};

const buildDownloadName = (fileName) => {
  const safe = String(fileName || 'image').trim().replace(/[^\w.-]+/g, '-');
  const base = safe.includes('.') ? safe.slice(0, safe.lastIndexOf('.')) : safe;
  const ext = safe.includes('.') ? safe.slice(safe.lastIndexOf('.') + 1) : 'jpg';
  return `${base || 'image'}-private.${ext || 'jpg'}`;
};

export default function ExifScrubberTool() {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(true);
  const [sourceFile, setSourceFile] = useState(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [processedBlob, setProcessedBlob] = useState(null);
  const [processedUrl, setProcessedUrl] = useState('');
  const [detectedTags, setDetectedTags] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState(() => t('legacyTools.exifScrubber.statuses.initial'));
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);
  const sourceUrlRef = useRef(null);
  const processedUrlRef = useRef(null);

  const clearSourceUrl = useCallback(() => {
    if (!sourceUrlRef.current) return;
    URL.revokeObjectURL(sourceUrlRef.current);
    sourceUrlRef.current = null;
  }, []);

  const clearProcessedUrl = useCallback(() => {
    if (!processedUrlRef.current) return;
    URL.revokeObjectURL(processedUrlRef.current);
    processedUrlRef.current = null;
  }, []);

  useEffect(() => () => {
    clearSourceUrl();
    clearProcessedUrl();
  }, [clearProcessedUrl, clearSourceUrl]);

  const onSelectFile = useCallback(async (file) => {
    if (!file) return;
    clearSourceUrl();
    clearProcessedUrl();
    const objectUrl = URL.createObjectURL(file);
    sourceUrlRef.current = objectUrl;
    setSourceFile(file);
    setSourceUrl(objectUrl);
    setProcessedBlob(null);
    setProcessedUrl('');
    setError('');
    setStatusText(t('legacyTools.exifScrubber.statuses.fileLoaded'));

    if (!isJpeg(file)) {
      setDetectedTags(0);
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      const exifObject = piexif.load(dataUrl);
      setDetectedTags(countExifTags(exifObject));
    } catch {
      setDetectedTags(0);
    }
  }, [clearProcessedUrl, clearSourceUrl, t]);

  const runScrub = useCallback(async () => {
    if (!sourceFile || isProcessing) return;
    setError('');
    setIsProcessing(true);
    setStatusText(t('legacyTools.exifScrubber.statuses.processing'));

    try {
      if (!privacyMode) {
        setProcessedBlob(sourceFile);
        clearProcessedUrl();
        const url = URL.createObjectURL(sourceFile);
        processedUrlRef.current = url;
        setProcessedUrl(url);
        setStatusText(t('legacyTools.exifScrubber.statuses.privacyOff'));
        return;
      }

      if (!isJpeg(sourceFile)) {
        setProcessedBlob(sourceFile);
        clearProcessedUrl();
        const url = URL.createObjectURL(sourceFile);
        processedUrlRef.current = url;
        setProcessedUrl(url);
        setStatusText(t('legacyTools.exifScrubber.statuses.nonJpeg'));
        return;
      }

      const dataUrl = await fileToDataUrl(sourceFile);
      const cleanedDataUrl = piexif.remove(dataUrl);
      const cleanedBlob = await dataUrlToBlob(cleanedDataUrl);
      setProcessedBlob(cleanedBlob);
      clearProcessedUrl();
      const cleanedUrl = URL.createObjectURL(cleanedBlob);
      processedUrlRef.current = cleanedUrl;
      setProcessedUrl(cleanedUrl);
      setStatusText(t('legacyTools.exifScrubber.statuses.done'));
    } catch {
      setError(t('legacyTools.exifScrubber.errors.scrubFailed'));
      setStatusText(t('legacyTools.exifScrubber.statuses.failed'));
    } finally {
      setIsProcessing(false);
    }
  }, [clearProcessedUrl, isProcessing, privacyMode, sourceFile, t]);

  const onDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer?.files?.[0] || null;
    if (file) {
      void onSelectFile(file);
    }
  };

  const downloadName = useMemo(() => buildDownloadName(sourceFile?.name), [sourceFile?.name]);
  const canDownload = Boolean(processedBlob && processedUrl);

  return (
    <section className="mc-card rounded-3xl p-6 md:p-8">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Privacy / EXIF</div>
        <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          EXIF Scrubber
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-3xl">
          {t('legacyTools.exifScrubber.description')}
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4">
        <label className="inline-flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={privacyMode}
            onChange={(event) => setPrivacyMode(event.target.checked)}
            className="h-4 w-4 accent-cyan-600"
          />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-2">
            <ShieldCheck size={16} />
            Privacy Mode
          </span>
        </label>
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
        <div className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{t('legacyTools.exifScrubber.dropTitle')}</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('legacyTools.exifScrubber.dropHint')}</div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-all duration-300 ease-out hover:scale-[1.02]"
          >
            {t('btnSelect')}
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={(event) => {
          void onSelectFile(event.target.files?.[0] || null);
          event.target.value = '';
        }}
      />

      {sourceFile && (
        <div className="mt-5 rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-all">{sourceFile.name}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t('legacyTools.exifScrubber.fileStats', { size: formatBytes(sourceFile.size), count: detectedTags })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void runScrub()}
              disabled={isProcessing}
              className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.02] inline-flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {t('processing')}
                </>
              ) : (
                <>
                  <EyeOff size={15} />
                  {t('legacyTools.exifScrubber.run')}
                </>
              )}
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{statusText}</div>
        </div>
      )}

      {(sourceUrl || processedUrl) && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-3">
            <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('legacyTools.exifScrubber.sourceLabel')}</div>
            {sourceUrl ? (
              <img src={sourceUrl} alt="source-preview" className="mt-2 h-56 w-full rounded-xl object-contain bg-slate-100 dark:bg-slate-900" />
            ) : null}
          </div>
          <div className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-3">
            <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('legacyTools.exifScrubber.processedLabel')}</div>
            {processedUrl ? (
              <img src={processedUrl} alt="processed-preview" className="mt-2 h-56 w-full rounded-xl object-contain bg-slate-100 dark:bg-slate-900" />
            ) : (
              <div className="mt-2 h-56 w-full rounded-xl border border-slate-200/70 dark:border-white/10 bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                {t('legacyTools.exifScrubber.resultPending')}
              </div>
            )}
          </div>
        </div>
      )}

      {canDownload && (
        <div className="mt-5">
          <a
            href={processedUrl}
            download={downloadName}
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/60 dark:border-emerald-300/30 bg-emerald-100/70 dark:bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:text-emerald-100 transition-all duration-300 ease-out hover:scale-[1.02]"
          >
            <Download size={15} />
            {t('legacyTools.exifScrubber.downloadPrivate', { size: formatBytes(processedBlob?.size || 0) })}
          </a>
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
    </section>
  );
}
