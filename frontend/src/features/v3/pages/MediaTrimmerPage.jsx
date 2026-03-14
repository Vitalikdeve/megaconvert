import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Download, Loader2, Scissors, Upload } from 'lucide-react';

const clamp = (value, min, max) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
};

const clampProgress = (value) => clamp(value, 0, 100);

const formatBytes = (value) => {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
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

const getExtension = (name) => {
  const raw = String(name || '').trim();
  if (!raw.includes('.')) return '';
  return String(raw.split('.').pop() || '').toLowerCase();
};

const getTrimmedOutputName = (sourceName, fallbackExt = 'mp4') => {
  const safeName = String(sourceName || 'media')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/\.+/g, '.');
  const hasExt = safeName.includes('.');
  const base = hasExt ? safeName.slice(0, safeName.lastIndexOf('.')) : safeName;
  const ext = hasExt ? getExtension(safeName) : fallbackExt;
  const normalizedBase = String(base || 'media').replace(/[-_.]+$/g, '') || 'media';
  return `${normalizedBase}-trimmed.${ext || fallbackExt}`;
};

export default function MediaTrimmerPage() {
  const { t } = useTranslation();
  const unsupportedSabMessage = t('legacyTools.mediaTrimmer.errors.unsupportedBrowser');
  const supportsSharedArrayBuffer = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const hasSharedArrayBuffer = typeof window.SharedArrayBuffer !== 'undefined';
    return hasSharedArrayBuffer && window.crossOriginIsolated === true;
  }, []);

  const [sourceFile, setSourceFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState('idle');
  const [statusText, setStatusText] = useState(() => t('legacyTools.mediaTrimmer.statuses.initial'));
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [ffmpegReady, setFfmpegReady] = useState(false);
  const [result, setResult] = useState(null);

  const fileInputRef = useRef(null);
  const ffmpegRef = useRef(null);
  const ffmpegLoadedRef = useRef(false);
  const previewUrlRef = useRef('');
  const resultUrlRef = useRef('');
  const currentJobRef = useRef(0);

  const mediaKind = useMemo(() => {
    const type = String(sourceFile?.type || '').toLowerCase();
    if (type.startsWith('audio/')) return 'audio';
    return 'video';
  }, [sourceFile?.type]);

  const cleanupPreviewUrl = useCallback(() => {
    if (!previewUrlRef.current) return;
    URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
  }, []);

  const cleanupResultUrl = useCallback(() => {
    if (!resultUrlRef.current) return;
    URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = '';
  }, []);

  useEffect(() => () => {
    cleanupPreviewUrl();
    cleanupResultUrl();
    if (ffmpegRef.current) {
      try {
        ffmpegRef.current.terminate();
      } catch {
        // ignore
      }
      ffmpegRef.current = null;
      ffmpegLoadedRef.current = false;
    }
  }, [cleanupPreviewUrl, cleanupResultUrl]);

  const loadFFmpeg = useCallback(async ({ silent = false } = {}) => {
    if (!supportsSharedArrayBuffer) return null;

    if (!ffmpegRef.current) {
      ffmpegRef.current = new FFmpeg();
      ffmpegRef.current.on('progress', ({ progress: rawProgress }) => {
        const nextProgress = clampProgress(Math.round(Number(rawProgress || 0) * 100));
        setProgress((prev) => Math.max(prev, nextProgress));
      });
    }

    if (ffmpegLoadedRef.current) {
      setFfmpegReady(true);
      return ffmpegRef.current;
    }

    if (!silent) {
      setStatus('loading');
      setStatusText(t('legacyTools.mediaTrimmer.statuses.loadingCore'));
      setProgress(3);
      setError('');
    }

    try {
      await ffmpegRef.current.load({ coreURL, wasmURL });
      ffmpegLoadedRef.current = true;
      setFfmpegReady(true);
      if (!silent) setStatusText(t('legacyTools.mediaTrimmer.statuses.coreReady'));
      return ffmpegRef.current;
    } catch (loadError) {
      setFfmpegReady(false);
      if (!silent) {
        setStatus('error');
        setStatusText(t('legacyTools.mediaTrimmer.statuses.coreFailed'));
        setError(String(loadError?.message || t('legacyTools.mediaTrimmer.errors.initFailed')));
      }
      throw loadError;
    }
  }, [supportsSharedArrayBuffer, t]);

  const resetFileState = useCallback(() => {
    setSourceFile(null);
    setPreviewUrl('');
    setDuration(0);
    setStartTime(0);
    setEndTime(0);
    setProgress(0);
    setStatus('idle');
    setStatusText(t('legacyTools.mediaTrimmer.statuses.initial'));
    setError('');
    setResult(null);
    cleanupPreviewUrl();
    cleanupResultUrl();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [cleanupPreviewUrl, cleanupResultUrl, t]);

  const handleSelectFile = useCallback((file) => {
    if (!file) return;
    cleanupPreviewUrl();
    cleanupResultUrl();
    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
    setSourceFile(file);
    setDuration(0);
    setStartTime(0);
    setEndTime(0);
    setResult(null);
    setStatus('idle');
    setStatusText(t('legacyTools.mediaTrimmer.statuses.fileLoaded'));
    setProgress(0);
    setError('');
  }, [cleanupPreviewUrl, cleanupResultUrl, t]);

  const handleLoadedMetadata = useCallback((event) => {
    const rawDuration = Number(event.currentTarget?.duration || 0);
    const nextDuration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0;
    setDuration(nextDuration);
    setStartTime(0);
    setEndTime(nextDuration);
    setStatusText(nextDuration > 0 ? t('legacyTools.mediaTrimmer.statuses.selectRange') : t('legacyTools.mediaTrimmer.statuses.metadataFailed'));
  }, [t]);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    setIsDragOver(false);
    const droppedFile = event.dataTransfer?.files?.[0] || null;
    if (droppedFile) handleSelectFile(droppedFile);
  }, [handleSelectFile]);

  const handleStartChange = useCallback((raw) => {
    if (!duration) return;
    const nextStart = clamp(raw, 0, duration);
    setStartTime(nextStart);
    setEndTime((prevEnd) => Math.max(nextStart, clamp(prevEnd, 0, duration)));
  }, [duration]);

  const handleEndChange = useCallback((raw) => {
    if (!duration) return;
    const nextEnd = clamp(raw, 0, duration);
    setEndTime(nextEnd);
    setStartTime((prevStart) => Math.min(clamp(prevStart, 0, duration), nextEnd));
  }, [duration]);

  const handleTrim = useCallback(async () => {
    if (status === 'loading' || status === 'trimming') return;

    if (!supportsSharedArrayBuffer) {
      setError(unsupportedSabMessage);
      return;
    }

    if (!sourceFile) {
      setError(t('legacyTools.mediaTrimmer.errors.selectFile'));
      return;
    }

    if (!duration || duration <= 0) {
      setError(t('legacyTools.mediaTrimmer.errors.durationMissing'));
      return;
    }

    const safeStart = clamp(startTime, 0, duration);
    const safeEnd = clamp(endTime, 0, duration);
    if (safeEnd <= safeStart) {
      setError(t('legacyTools.mediaTrimmer.errors.invalidRange'));
      return;
    }

    const jobId = Date.now();
    currentJobRef.current = jobId;
    cleanupResultUrl();
    setResult(null);
    setError('');
    setProgress(4);

    try {
      const ffmpeg = await loadFFmpeg();
      if (jobId !== currentJobRef.current) return;

      setStatus('trimming');
      setStatusText(t('legacyTools.mediaTrimmer.statuses.trimming'));

      const sourceExt = getExtension(sourceFile.name) || (mediaKind === 'audio' ? 'mp3' : 'mp4');
      const inputName = `input-${jobId}.${sourceExt}`;
      const outputName = `output-${jobId}.${sourceExt}`;
      const outputDownloadName = getTrimmedOutputName(sourceFile.name, sourceExt);

      await ffmpeg.writeFile(inputName, await fetchFile(sourceFile));
      await ffmpeg.exec([
        '-i',
        inputName,
        '-ss',
        String(safeStart),
        '-to',
        String(safeEnd),
        '-c',
        'copy',
        outputName
      ]);

      const outputData = await ffmpeg.readFile(outputName);
      const bytes = outputData instanceof Uint8Array ? outputData : new Uint8Array(outputData);
      const fallbackType = mediaKind === 'audio' ? 'audio/mpeg' : 'video/mp4';
      const blob = new Blob([bytes], { type: sourceFile.type || fallbackType });
      const objectUrl = URL.createObjectURL(blob);
      resultUrlRef.current = objectUrl;

      setResult({
        url: objectUrl,
        fileName: outputDownloadName,
        size: blob.size
      });
      setProgress(100);
      setStatus('done');
      setStatusText(t('legacyTools.mediaTrimmer.statuses.done'));

      await Promise.allSettled([
        ffmpeg.deleteFile(inputName),
        ffmpeg.deleteFile(outputName)
      ]);
    } catch (trimError) {
      setStatus('error');
      setStatusText(t('legacyTools.mediaTrimmer.statuses.failed'));
      setError(String(trimError?.message || t('legacyTools.mediaTrimmer.errors.trimFailed')));
    }
  }, [
    cleanupResultUrl,
    duration,
    endTime,
    loadFFmpeg,
    mediaKind,
    sourceFile,
    startTime,
    status,
    supportsSharedArrayBuffer,
    t,
    unsupportedSabMessage
  ]);

  const progressStyle = { width: `${clampProgress(progress)}%` };
  const isBusy = status === 'loading' || status === 'trimming';
  const trimDuration = Math.max(0, endTime - startTime);

  return (
    <section className="mc-card rounded-3xl p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('legacyTools.mediaTrimmer.eyebrow')}</div>
          <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t('legacyTools.mediaTrimmer.title')}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
            {t('legacyTools.mediaTrimmer.description')}
          </p>
        </div>
        <div className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl px-4 py-3 text-right min-w-[190px]">
          <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('legacyTools.mediaTrimmer.engineLabel')}</div>
          <div className={`mt-1 text-sm font-semibold ${ffmpegReady ? 'text-emerald-700 dark:text-emerald-200' : 'text-slate-700 dark:text-slate-200'}`}>
            {ffmpegReady ? t('legacyTools.mediaTrimmer.engineReady') : t('legacyTools.mediaTrimmer.engineLoading')}
          </div>
        </div>
      </div>

      {!supportsSharedArrayBuffer && (
        <div className="mt-5 rounded-2xl border border-red-300/60 dark:border-red-400/20 bg-red-100/70 dark:bg-red-500/10 backdrop-blur-xl px-4 py-3 text-sm text-red-700 dark:text-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{unsupportedSabMessage}</span>
          </div>
        </div>
      )}

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
        {sourceFile ? (
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('legacyTools.mediaTrimmer.fileForTrim')}</div>
            <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100 break-all">{sourceFile.name}</div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formatBytes(sourceFile.size)}</div>
          </div>
        ) : (
          <div>
            <div className="mx-auto h-12 w-12 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-200">
              <Upload size={18} />
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{t('legacyTools.mediaTrimmer.dropTitle')}</div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('legacyTools.mediaTrimmer.dropHint')}</div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-all duration-300 ease-out hover:scale-[1.02]"
          >
            {t('btnSelect')}
          </button>
          {sourceFile && (
            <button
              type="button"
              onClick={resetFileState}
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
        accept="video/*,audio/*"
        onChange={(event) => handleSelectFile(event.target.files?.[0] || null)}
      />

      {sourceFile && previewUrl && (
        <div className="mt-6 rounded-3xl border border-white/40 dark:border-white/10 bg-white/75 dark:bg-white/5 backdrop-blur-xl p-4">
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('legacyTools.mediaTrimmer.previewSource')}</div>
          <div className="mt-3">
            {mediaKind === 'audio' ? (
              <audio
                key={previewUrl}
                src={previewUrl}
                controls
                preload="metadata"
                onLoadedMetadata={handleLoadedMetadata}
                className="w-full"
              />
            ) : (
              <video
                key={previewUrl}
                src={previewUrl}
                controls
                preload="metadata"
                onLoadedMetadata={handleLoadedMetadata}
                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-black/90"
              />
            )}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {t('legacyTools.mediaTrimmer.totalDuration', { duration: duration > 0 ? formatTimelineTime(duration) : t('legacyTools.mediaTrimmer.readingMetadata') })}
          </div>
        </div>
      )}

      {sourceFile && (
        <div className="mt-6 rounded-3xl border border-white/40 dark:border-white/10 bg-white/75 dark:bg-white/5 backdrop-blur-xl p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('legacyTools.mediaTrimmer.timelineLabel')}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {t('legacyTools.mediaTrimmer.clipLength')} <span className="font-semibold text-slate-800 dark:text-slate-100">{formatTimelineTime(trimDuration)}</span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('legacyTools.mediaTrimmer.startSeconds')}</div>
              <input
                type="number"
                min={0}
                max={duration || 0}
                step="0.1"
                value={Number.isFinite(startTime) ? startTime.toFixed(1) : '0.0'}
                disabled={!duration || isBusy}
                onChange={(event) => handleStartChange(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
              />
            </label>

            <label className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('legacyTools.mediaTrimmer.endSeconds')}</div>
              <input
                type="number"
                min={0}
                max={duration || 0}
                step="0.1"
                value={Number.isFinite(endTime) ? endTime.toFixed(1) : '0.0'}
                disabled={!duration || isBusy}
                onChange={(event) => handleEndChange(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('legacyTools.mediaTrimmer.shiftStart')}</div>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step="0.1"
                value={Math.min(startTime, endTime)}
                disabled={!duration || isBusy}
                onChange={(event) => handleStartChange(Number(event.target.value))}
                className="mt-2 w-full accent-blue-600"
              />
            </label>

            <label className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('legacyTools.mediaTrimmer.shiftEnd')}</div>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step="0.1"
                value={Math.max(endTime, startTime)}
                disabled={!duration || isBusy}
                onChange={(event) => handleEndChange(Number(event.target.value))}
                className="mt-2 w-full accent-cyan-600"
              />
            </label>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <span>{t('legacyTools.mediaTrimmer.progressLabel')}</span>
            <span>{Math.round(clampProgress(progress))}%</span>
          </div>
          <div className="mt-3 h-[4px] rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 transition-all duration-300 ease-out"
              style={progressStyle}
            />
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{statusText}</div>
        </div>

        <button
          type="button"
          onClick={() => void handleTrim()}
          disabled={isBusy || !sourceFile || !duration || !supportsSharedArrayBuffer}
          className="rounded-2xl px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.02] flex items-center justify-center gap-2"
        >
          {isBusy ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {status === 'loading' ? t('legacyTools.mediaTrimmer.loadingCta') : t('legacyTools.mediaTrimmer.trimmingCta')}
            </>
          ) : (
            <>
              <Scissors size={16} />
              {t('legacyTools.mediaTrimmer.trimFragment')}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-300/60 dark:border-red-400/20 bg-red-100/70 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-2xl border border-emerald-300/60 dark:border-emerald-400/20 bg-emerald-100/70 dark:bg-emerald-500/10 px-4 py-3">
          <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-100">{t('legacyTools.mediaTrimmer.fragmentReady')}</div>
          <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-200">
            {result.fileName} · {formatBytes(result.size)}
          </div>
          <div className="mt-3">
            <a
              href={result.url}
              download={result.fileName}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/70 dark:border-emerald-300/30 bg-white/85 dark:bg-white/5 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-100 transition-all duration-300 ease-out hover:scale-[1.02]"
            >
              <Download size={14} />
              {t('legacyTools.mediaTrimmer.downloadTrimmed')}
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
