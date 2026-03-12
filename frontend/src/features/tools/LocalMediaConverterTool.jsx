import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Cloud,
  Cpu,
  Download,
  Loader2,
  Play,
  Sparkles,
  Upload
} from 'lucide-react';
import useLocalConverter from '../../hooks/useLocalConverter.js';
import useAIAudioCleanup from '../../hooks/useAIAudioCleanup.js';

const formatBytes = (value) => {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

const FORMAT_OPTIONS = [
  {
    id: 'mp4',
    label: 'Видео в MP4',
    ext: 'mp4',
    mime: 'video/mp4',
    kind: 'video',
    args: ['-i', '{input}', '-movflags', '+faststart', '{output}']
  },
  {
    id: 'webm',
    label: 'Видео в WebM',
    ext: 'webm',
    mime: 'video/webm',
    kind: 'video',
    args: ['-i', '{input}', '{output}']
  },
  {
    id: 'gif',
    label: 'Видео в GIF',
    ext: 'gif',
    mime: 'image/gif',
    kind: 'video',
    args: ['-i', '{input}', '-vf', 'fps=12,scale=960:-1:flags=lanczos', '-loop', '0', '{output}']
  },
  {
    id: 'mp3',
    label: 'Аудио в MP3',
    ext: 'mp3',
    mime: 'audio/mpeg',
    kind: 'audio',
    args: ['-i', '{input}', '-vn', '-b:a', '192k', '{output}']
  },
  {
    id: 'wav',
    label: 'Аудио в WAV',
    ext: 'wav',
    mime: 'audio/wav',
    kind: 'audio',
    args: ['-i', '{input}', '-vn', '-ar', '44100', '-ac', '2', '{output}']
  }
];

const clampProgress = (value) => {
  const next = Number(value || 0);
  if (!Number.isFinite(next)) return 0;
  return Math.max(0, Math.min(100, next));
};

export default function LocalMediaConverterTool({ onCloudFallback }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [sourceFile, setSourceFile] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState(FORMAT_OPTIONS[0].id);
  const [aiCleanupEnabled, setAICleanupEnabled] = useState(false);
  const fileInputRef = useRef(null);

  const {
    status,
    progress,
    error,
    statusText,
    result,
    engineReady,
    isSupported,
    isBusy,
    unsupportedMessage,
    loadEngine,
    startConversion,
    reset,
    clearError
  } = useLocalConverter();
  const {
    progress: aiProgress,
    error: aiError,
    statusText: aiStatusText,
    modelReady: aiModelReady,
    modelDevice,
    lastCleanup,
    isSupported: isAiCleanupSupported,
    isBusy: isAiBusy,
    loadEngine: loadAiEngine,
    cleanupAudio,
    reset: resetAiCleanup,
    clearError: clearAiError
  } = useAIAudioCleanup();

  useEffect(() => {
    if (!isSupported) return undefined;
    void loadEngine({ silent: true }).catch(() => {
      // Keep first paint fast and let the user retry from the CTA.
    });
    return undefined;
  }, [isSupported, loadEngine]);

  const allowedFormats = useMemo(() => {
    const fileType = String(sourceFile?.type || '').toLowerCase();
    if (fileType.startsWith('audio/')) {
      return FORMAT_OPTIONS.filter((item) => item.kind === 'audio');
    }
    return FORMAT_OPTIONS;
  }, [sourceFile?.type]);

  const activeSelectedFormat = allowedFormats.some((item) => item.id === selectedFormat)
    ? selectedFormat
    : (allowedFormats[0]?.id || FORMAT_OPTIONS[0].id);
  const activeFormat = allowedFormats.find((item) => item.id === activeSelectedFormat) || allowedFormats[0] || FORMAT_OPTIONS[0];
  const isAudioSource = String(sourceFile?.type || '').toLowerCase().startsWith('audio/');
  const isAICleanupAvailable = Boolean(sourceFile && isAudioSource && activeFormat?.kind === 'audio');
  const effectiveAICleanupEnabled = aiCleanupEnabled && isAICleanupAvailable;
  const isWorking = isBusy || isAiBusy;

  const setSelectedFile = (file) => {
    if (!file) return;
    const nextIsAudioSource = String(file?.type || '').toLowerCase().startsWith('audio/');
    setSourceFile(file);
    if (!nextIsAudioSource) {
      setAICleanupEnabled(false);
    }
    reset();
    resetAiCleanup();
  };

  const clearSelection = () => {
    setSourceFile(null);
    setAICleanupEnabled(false);
    reset();
    resetAiCleanup();
  };

  useEffect(() => {
    if (!effectiveAICleanupEnabled || !isAiCleanupSupported) return undefined;
    void loadAiEngine({ silent: true }).catch((error) => {
      console.warn('[MegaConvert][ai-audio-load]', error);
    });
    return undefined;
  }, [effectiveAICleanupEnabled, isAiCleanupSupported, loadAiEngine]);

  const handleConvert = async () => {
    if (isWorking) return;
    if (!isSupported) return;
    if (!sourceFile) return;

    const target = activeFormat;
    try {
      let inputFile = sourceFile;

      if (effectiveAICleanupEnabled) {
        const cleanupResult = await cleanupAudio(sourceFile);
        inputFile = cleanupResult.file;
      }

      await startConversion(inputFile, {
        ext: target.ext,
        mime: target.mime,
        args: target.args
      });
    } catch {
      // Error state is already handled inside the hook.
    }
  };

  const onDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const droppedFile = event.dataTransfer?.files?.[0] || null;
    if (droppedFile) setSelectedFile(droppedFile);
  };

  const displayStatusText = status === 'idle'
    ? sourceFile
      ? 'Файл загружен. Готово к конвертации'
      : 'Готов к локальной обработке'
    : statusText;
  const primaryProgress = isAiBusy ? aiProgress : progress;
  const primaryStatusText = isAiBusy ? aiStatusText : displayStatusText;
  const progressStyle = { width: `${clampProgress(primaryProgress)}%` };
  const aiCoverageLabel = lastCleanup?.speechCoverage != null
    ? `${Math.round(Number(lastCleanup.speechCoverage || 0) * 100)}% дорожки`
    : null;

  return (
    <section className="mc-card rounded-3xl p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Media / WebAssembly</div>
          <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Локальная конвертация медиа
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
            Обработка выполняется прямо в браузере пользователя через FFmpeg.wasm без отправки исходного файла на сервер.
          </p>
        </div>
        <div className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3 backdrop-blur-xl">
          <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">FFmpeg Worker</div>
          <div className={`mt-1 text-sm font-semibold ${engineReady ? 'text-emerald-700 dark:text-emerald-200' : 'text-slate-700 dark:text-slate-200'}`}>
            {engineReady ? 'Ядро загружено' : 'Инициализация в фоне'}
          </div>
        </div>
      </div>

      {!isSupported && (
        <div className="mt-5 rounded-2xl border border-red-300/60 dark:border-red-400/20 bg-red-100/70 dark:bg-red-500/10 backdrop-blur-xl px-4 py-3 text-sm text-red-700 dark:text-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{unsupportedMessage}</span>
          </div>
          {typeof onCloudFallback === 'function' && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => onCloudFallback()}
                className="inline-flex items-center gap-2 rounded-xl border border-red-300/60 dark:border-red-300/30 bg-white/80 dark:bg-white/5 px-3 py-2 text-xs font-semibold transition-all duration-300 ease-out hover:scale-[1.02]"
              >
                <Cloud size={14} />
                Перейти в облачный конвертер
              </button>
            </div>
          )}
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
            <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Выбран файл</div>
            <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100 break-all">{sourceFile.name}</div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formatBytes(sourceFile.size)}</div>
          </div>
        ) : (
          <div>
            <div className="mx-auto h-12 w-12 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-200">
              <Upload size={18} />
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Перетащите медиафайл сюда</div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">или выберите файл вручную</div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-all duration-300 ease-out hover:scale-[1.02]"
          >
            Выбрать файл
          </button>
          {sourceFile && (
            <button
              type="button"
              onClick={clearSelection}
              disabled={isWorking}
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
        accept="video/*,audio/*"
        disabled={isWorking}
        onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
      />

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto]">
        <label className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl px-4 py-3">
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Формат результата</div>
          <select
            value={activeSelectedFormat}
            onChange={(event) => setSelectedFormat(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
            disabled={isWorking || !isSupported}
          >
            {allowedFormats.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => void handleConvert()}
          disabled={isWorking || !isSupported || !sourceFile}
          className="rounded-2xl px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.02] flex items-center justify-center gap-2"
        >
          {isWorking ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {isAiBusy
                ? 'AI очищает звук...'
                : (status === 'loading' ? 'Загрузка FFmpeg...' : 'Обрабатываем...')}
            </>
          ) : (
            <>
              <Play size={16} />
              Начать локальную конвертацию
            </>
          )}
        </button>
      </div>

      {isAudioSource && (
        <div className="mt-4 rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl px-4 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
                <Sparkles size={14} />
                Neural Edge / Audio
              </div>
              <div className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                AI-очистка звука перед конвертацией
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Speech-aware пайплайн выделяет голосовые участки через Transformers.js и мягко подавляет фон в браузере до запуска FFmpeg.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAICleanupEnabled((current) => !current)}
              disabled={!isAICleanupAvailable || !isAiCleanupSupported || isWorking}
              className={`inline-flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all duration-300 ease-out ${
                aiCleanupEnabled
                  ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200'
                  : 'border-slate-200 dark:border-white/10 bg-white/85 dark:bg-white/5 text-slate-700 dark:text-slate-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span
                className={`relative h-6 w-11 rounded-full transition-colors duration-300 ${
                  aiCleanupEnabled ? 'bg-cyan-500/80' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${
                    aiCleanupEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </span>
              {aiCleanupEnabled ? 'AI включен' : 'AI выключен'}
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="rounded-2xl border border-white/50 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
                <span>Inference</span>
                {aiModelReady && (
                  <span className="rounded-full border border-emerald-300/60 dark:border-emerald-300/20 bg-emerald-100/80 dark:bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-200">
                    Модель готова
                  </span>
                )}
                {modelDevice && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-200">
                    <Cpu size={11} />
                    {modelDevice === 'webgpu' ? 'WebGPU' : 'WASM fallback'}
                  </span>
                )}
              </div>
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {isAICleanupAvailable
                  ? (effectiveAICleanupEnabled
                    ? aiStatusText
                    : 'AI-режим готов. При запуске мы сначала очистим дорожку, потом передадим ее в FFmpeg.')
                  : 'AI-очистка активируется для аудиофайлов при экспорте в аудиоформат.'}
              </div>
            </div>

            {lastCleanup && (
              <div className="rounded-2xl border border-cyan-300/40 dark:border-cyan-300/20 bg-cyan-50/70 dark:bg-cyan-500/10 px-4 py-3 text-sm text-cyan-800 dark:text-cyan-100">
                <div className="font-semibold">Последняя AI-обработка</div>
                <div className="mt-1 text-xs text-cyan-700 dark:text-cyan-200">
                  {aiCoverageLabel || 'Речь оценена'}
                  {modelDevice ? ` · ${modelDevice === 'webgpu' ? 'WebGPU' : 'WASM'}` : ''}
                </div>
              </div>
            )}
          </div>

          {(effectiveAICleanupEnabled || aiError) && (
            <div className="mt-4 rounded-2xl border border-white/50 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
                <span>AI Progress</span>
                <span>{Math.round(clampProgress(aiProgress))}%</span>
              </div>
              <div className="mt-3 h-[4px] rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 transition-all duration-300 ease-out"
                  style={{ width: `${clampProgress(aiProgress)}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{aiStatusText}</div>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
          <span>Прогресс</span>
          <span>{Math.round(clampProgress(primaryProgress))}%</span>
        </div>
        <div className="mt-3 h-[4px] rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 transition-all duration-300 ease-out"
            style={progressStyle}
          />
        </div>
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{primaryStatusText}</div>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-300/60 dark:border-red-400/20 bg-red-100/70 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          <div className="flex items-start justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={clearError}
              className="shrink-0 text-xs font-semibold text-red-700 dark:text-red-200 hover:underline"
            >
              Скрыть
            </button>
          </div>
        </div>
      )}

      {aiError && (
        <div className="mt-4 rounded-2xl border border-red-300/60 dark:border-red-400/20 bg-red-100/70 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          <div className="flex items-start justify-between gap-3">
            <span>{aiError}</span>
            <button
              type="button"
              onClick={clearAiError}
              className="shrink-0 text-xs font-semibold text-red-700 dark:text-red-200 hover:underline"
            >
              Скрыть
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-2xl border border-emerald-300/60 dark:border-emerald-400/20 bg-emerald-100/70 dark:bg-emerald-500/10 px-4 py-3">
          <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-100">Файл готов</div>
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
              Скачать результат
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
