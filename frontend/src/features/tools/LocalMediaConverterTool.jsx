import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import {
  AlertTriangle,
  Cloud,
  Download,
  Loader2,
  Play,
  Upload
} from 'lucide-react';

const FFMPEG_CORE_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
const UNSUPPORTED_SAB_MESSAGE = 'Ваш браузер не поддерживает локальную конвертацию. Пожалуйста, воспользуйтесь облачным конвертером';

const formatBytes = (value) => {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

const getExtension = (name) => {
  const parts = String(name || '').trim().toLowerCase().split('.');
  if (parts.length < 2) return '';
  return parts.pop() || '';
};

const toSafeOutputName = (sourceName, ext) => {
  const cleaned = String(sourceName || 'converted-file')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/\.+/g, '.');
  const base = cleaned.includes('.') ? cleaned.slice(0, cleaned.lastIndexOf('.')) : cleaned;
  const normalizedBase = String(base || 'converted-file').replace(/[-_.]+$/g, '') || 'converted-file';
  return `${normalizedBase}.${ext}`;
};

const clampProgress = (value) => {
  const next = Number(value || 0);
  if (!Number.isFinite(next)) return 0;
  return Math.max(0, Math.min(100, next));
};

const FORMAT_OPTIONS = [
  {
    id: 'mp4',
    label: 'Видео в MP4',
    ext: 'mp4',
    mime: 'video/mp4',
    kind: 'video',
    args: (inputName, outputName) => ['-i', inputName, '-movflags', '+faststart', outputName]
  },
  {
    id: 'webm',
    label: 'Видео в WebM',
    ext: 'webm',
    mime: 'video/webm',
    kind: 'video',
    args: (inputName, outputName) => ['-i', inputName, outputName]
  },
  {
    id: 'gif',
    label: 'Видео в GIF',
    ext: 'gif',
    mime: 'image/gif',
    kind: 'video',
    args: (inputName, outputName) => ['-i', inputName, '-vf', 'fps=12,scale=960:-1:flags=lanczos', '-loop', '0', outputName]
  },
  {
    id: 'mp3',
    label: 'Аудио в MP3',
    ext: 'mp3',
    mime: 'audio/mpeg',
    kind: 'audio',
    args: (inputName, outputName) => ['-i', inputName, '-vn', '-b:a', '192k', outputName]
  },
  {
    id: 'wav',
    label: 'Аудио в WAV',
    ext: 'wav',
    mime: 'audio/wav',
    kind: 'audio',
    args: (inputName, outputName) => ['-i', inputName, '-vn', '-ar', '44100', '-ac', '2', outputName]
  }
];

export default function LocalMediaConverterTool({ onCloudFallback }) {
  const supportsSharedArrayBuffer = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const hasSharedArrayBuffer = typeof window.SharedArrayBuffer !== 'undefined';
    return hasSharedArrayBuffer && window.crossOriginIsolated === true;
  }, []);

  const [isDragOver, setIsDragOver] = useState(false);
  const [sourceFile, setSourceFile] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState(FORMAT_OPTIONS[0].id);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState('Готов к локальной обработке');
  const [result, setResult] = useState(null);

  const ffmpegRef = useRef(null);
  const ffmpegLoadedRef = useRef(false);
  const fileInputRef = useRef(null);
  const currentObjectUrlRef = useRef(null);
  const currentJobRef = useRef(0);

  const cleanupResultUrl = useCallback(() => {
    if (!currentObjectUrlRef.current) return;
    URL.revokeObjectURL(currentObjectUrlRef.current);
    currentObjectUrlRef.current = null;
  }, []);

  useEffect(() => () => {
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
  }, [cleanupResultUrl]);

  const setSelectedFile = useCallback((file) => {
    if (!file) return;
    setSourceFile(file);
    setError('');
    setStatus('idle');
    setProgress(0);
    setStatusText('Файл загружен. Готово к конвертации');
    cleanupResultUrl();
    setResult(null);
  }, [cleanupResultUrl]);

  const allowedFormats = useMemo(() => {
    const fileType = String(sourceFile?.type || '').toLowerCase();
    if (fileType.startsWith('audio/')) {
      return FORMAT_OPTIONS.filter((item) => item.kind === 'audio');
    }
    return FORMAT_OPTIONS;
  }, [sourceFile?.type]);

  useEffect(() => {
    if (!allowedFormats.some((item) => item.id === selectedFormat)) {
      setSelectedFormat(allowedFormats[0]?.id || FORMAT_OPTIONS[0].id);
    }
  }, [allowedFormats, selectedFormat]);

  const ensureFfmpegLoaded = useCallback(async () => {
    if (!ffmpegRef.current) {
      ffmpegRef.current = new FFmpeg();
      ffmpegRef.current.on('progress', ({ progress: rawProgress }) => {
        const nextProgress = clampProgress(Math.round(Number(rawProgress || 0) * 100));
        setProgress((prev) => Math.max(prev, nextProgress));
      });
    }
    if (ffmpegLoadedRef.current) return ffmpegRef.current;

    setStatus('loading');
    setStatusText('Загружаем FFmpeg ядро...');
    const coreURL = await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript');
    const wasmURL = await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm');
    const workerURL = await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.worker.js`, 'text/javascript');
    await ffmpegRef.current.load({ coreURL, wasmURL, workerURL });
    ffmpegLoadedRef.current = true;
    return ffmpegRef.current;
  }, []);

  const runLocalConversion = useCallback(async () => {
    if (status === 'loading' || status === 'converting') return;
    if (!supportsSharedArrayBuffer) {
      setError(UNSUPPORTED_SAB_MESSAGE);
      return;
    }
    if (!sourceFile) {
      setError('Сначала загрузите файл для локальной конвертации.');
      return;
    }
    const target = allowedFormats.find((item) => item.id === selectedFormat) || allowedFormats[0] || FORMAT_OPTIONS[0];
    const jobId = Date.now();
    currentJobRef.current = jobId;
    cleanupResultUrl();
    setResult(null);
    setError('');
    setProgress(2);

    try {
      const ffmpeg = await ensureFfmpegLoaded();
      if (jobId !== currentJobRef.current) return;

      setStatus('converting');
      setStatusText('Локальная конвертация в процессе...');
      const inputExt = getExtension(sourceFile.name) || 'bin';
      const inputName = `input-${jobId}.${inputExt}`;
      const outputName = toSafeOutputName(sourceFile.name, target.ext);
      const outputPath = `output-${jobId}.${target.ext}`;

      await ffmpeg.writeFile(inputName, await fetchFile(sourceFile));
      await ffmpeg.exec(target.args(inputName, outputPath));
      const data = await ffmpeg.readFile(outputPath);
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      const blob = new Blob([bytes], { type: target.mime });
      const objectUrl = URL.createObjectURL(blob);
      currentObjectUrlRef.current = objectUrl;

      setResult({
        fileName: outputName,
        size: blob.size,
        url: objectUrl
      });
      setProgress(100);
      setStatus('done');
      setStatusText('Конвертация завершена. Файл готов к скачиванию.');

      await Promise.allSettled([
        ffmpeg.deleteFile(inputName),
        ffmpeg.deleteFile(outputPath)
      ]);
    } catch (conversionError) {
      setStatus('error');
      setStatusText('Конвертация завершилась с ошибкой');
      setError(String(conversionError?.message || 'Не удалось выполнить локальную конвертацию.'));
    }
  }, [allowedFormats, cleanupResultUrl, ensureFfmpegLoaded, selectedFormat, sourceFile, status, supportsSharedArrayBuffer]);

  const onDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const droppedFile = event.dataTransfer?.files?.[0] || null;
    if (droppedFile) setSelectedFile(droppedFile);
  };

  const progressStyle = { width: `${clampProgress(progress)}%` };
  const disabledBySupport = !supportsSharedArrayBuffer;
  const isBusy = status === 'loading' || status === 'converting';

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
      </div>

      {disabledBySupport && (
        <div className="mt-5 rounded-2xl border border-red-300/60 dark:border-red-400/20 bg-red-100/70 dark:bg-red-500/10 backdrop-blur-xl px-4 py-3 text-sm text-red-700 dark:text-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{UNSUPPORTED_SAB_MESSAGE}</span>
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
              onClick={() => {
                setSourceFile(null);
                setStatus('idle');
                setProgress(0);
                setError('');
                setStatusText('Готов к локальной обработке');
                cleanupResultUrl();
                setResult(null);
              }}
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
        onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
      />

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto]">
        <label className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl px-4 py-3">
          <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Формат результата</div>
          <select
            value={selectedFormat}
            onChange={(event) => setSelectedFormat(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
            disabled={isBusy || disabledBySupport}
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
          onClick={() => void runLocalConversion()}
          disabled={isBusy || disabledBySupport || !sourceFile}
          className="rounded-2xl px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.02] flex items-center justify-center gap-2"
        >
          {isBusy ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {status === 'loading' ? 'Загрузка FFmpeg...' : 'Обрабатываем...'}
            </>
          ) : (
            <>
              <Play size={16} />
              Начать локальную конвертацию
            </>
          )}
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
          <span>Прогресс</span>
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

      {error && (
        <div className="mt-4 rounded-2xl border border-red-300/60 dark:border-red-400/20 bg-red-100/70 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          {error}
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
