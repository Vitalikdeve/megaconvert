import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Copy,
  Download,
  Loader2,
  ScanText,
  Upload
} from 'lucide-react';

const LANGUAGE_OPTIONS = [
  { value: 'rus', label: 'Русский' },
  { value: 'eng', label: 'Английский' }
];

const clampProgress = (value) => {
  const next = Number(value || 0);
  if (!Number.isFinite(next)) return 0;
  return Math.max(0, Math.min(100, next));
};

const formatBytes = (value) => {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

const getTxtFileName = (fileName) => {
  const safeName = String(fileName || 'ocr-result')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/\.+/g, '.');
  const baseName = safeName.includes('.') ? safeName.slice(0, safeName.lastIndexOf('.')) : safeName;
  const cleaned = String(baseName || 'ocr-result').replace(/[-_.]+$/g, '') || 'ocr-result';
  return `${cleaned}.txt`;
};

const prettifyStatus = (status) => {
  const normalized = String(status || '').trim();
  if (!normalized) return '';
  return normalized
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (symbol) => symbol.toUpperCase());
};

export default function OcrRecognitionTool() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [sourceFile, setSourceFile] = useState(null);
  const [language, setLanguage] = useState(LANGUAGE_OPTIONS[0].value);
  const [status, setStatus] = useState('idle');
  const [statusText, setStatusText] = useState('Готово к распознаванию');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [recognizedText, setRecognizedText] = useState('');
  const [copyState, setCopyState] = useState('idle');

  const fileInputRef = useRef(null);
  const copyResetRef = useRef(null);

  useEffect(() => () => {
    if (copyResetRef.current) {
      clearTimeout(copyResetRef.current);
      copyResetRef.current = null;
    }
  }, []);

  const progressValue = clampProgress(progress);
  const isRecognizing = status === 'recognizing';
  const resultFileName = useMemo(() => getTxtFileName(sourceFile?.name), [sourceFile?.name]);

  const setSelectedFile = useCallback((file) => {
    if (!file) return;
    setSourceFile(file);
    setError('');
    setStatus('idle');
    setProgress(0);
    setStatusText('Файл загружен. Готово к распознаванию');
    setRecognizedText('');
    setCopyState('idle');
  }, []);

  const onDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const droppedFile = event.dataTransfer?.files?.[0] || null;
    if (droppedFile) setSelectedFile(droppedFile);
  };

  const onCopyText = useCallback(async () => {
    const text = String(recognizedText || '').trim();
    if (!text) return;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API недоступен');
      }
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
      copyResetRef.current = setTimeout(() => setCopyState('idle'), 1800);
    } catch {
      setCopyState('error');
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
      copyResetRef.current = setTimeout(() => setCopyState('idle'), 2200);
    }
  }, [recognizedText]);

  const onDownloadTxt = useCallback(() => {
    const text = String(recognizedText || '');
    if (!text.trim()) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = resultFileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }, [recognizedText, resultFileName]);

  const runOcr = useCallback(async () => {
    if (isRecognizing) return;
    if (!sourceFile) {
      setError('Сначала загрузите изображение или скан для OCR.');
      return;
    }

    setError('');
    setStatus('recognizing');
    setStatusText('Инициализация OCR...');
    setProgress(3);
    setRecognizedText('');
    setCopyState('idle');

    try {
      const moduleRef = await import('tesseract.js');
      const recognize = moduleRef?.recognize || moduleRef?.default?.recognize;
      if (typeof recognize !== 'function') {
        throw new Error('OCR-модуль не инициализирован.');
      }

      const result = await recognize(sourceFile, language, {
        logger: (message) => {
          if (!message) return;
          const nextProgress = clampProgress(Math.round(Number(message.progress || 0) * 100));
          if (nextProgress > 0) {
            setProgress((prev) => Math.max(prev, nextProgress));
          }
          const prettyStatus = prettifyStatus(message.status);
          if (prettyStatus) {
            setStatusText(`OCR: ${prettyStatus}`);
          }
        }
      });

      const extractedText = String(result?.data?.text || '');
      setRecognizedText(extractedText);
      setProgress(100);
      setStatus('done');
      setStatusText(
        extractedText.trim()
          ? 'Распознавание завершено. Вы можете отредактировать результат.'
          : 'Распознавание завершено. Текст не обнаружен.'
      );
    } catch (recognitionError) {
      setStatus('error');
      setStatusText('Распознавание завершилось с ошибкой');
      setError(String(recognitionError?.message || 'Не удалось распознать текст.'));
    }
  }, [isRecognizing, language, sourceFile]);

  const ringRadius = 42;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (ringCircumference * progressValue) / 100;
  const canUseResult = Boolean(String(recognizedText || '').trim());

  return (
    <section className="mc-card rounded-3xl p-6 md:p-8">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">AI / OCR</div>
        <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Умное распознавание текста
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-3xl">
          Загрузите фото или скан документа и извлеките текст прямо в браузере через Tesseract.js.
        </p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div
            className={`rounded-3xl border-2 border-dashed px-5 py-8 text-center backdrop-blur-xl transition-all duration-300 ease-out ${
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
                <div className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Перетащите изображение или скан</div>
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
                    setStatusText('Готово к распознаванию');
                    setProgress(0);
                    setError('');
                    setRecognizedText('');
                    setCopyState('idle');
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
            accept="image/*"
            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
          />

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
            <label className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl px-4 py-3">
              <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Язык распознавания</div>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
                disabled={isRecognizing}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => void runOcr()}
              disabled={!sourceFile || isRecognizing}
              className="rounded-2xl px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              {isRecognizing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Распознаем...
                </>
              ) : (
                <>
                  <ScanText size={16} />
                  Начать распознавание
                </>
              )}
            </button>
          </div>

          {sourceFile && (
            <div className="mt-5 rounded-3xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl px-4 py-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative h-24 w-24 shrink-0">
                  <svg viewBox="0 0 100 100" className="h-24 w-24">
                    <circle
                      cx="50"
                      cy="50"
                      r={ringRadius}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6"
                      className="text-slate-200 dark:text-slate-700"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={ringRadius}
                      fill="none"
                      stroke="url(#ocrProgressGradient)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                      transform="rotate(-90 50 50)"
                      className="transition-all duration-300 ease-out"
                    />
                    <defs>
                      <linearGradient id="ocrProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {Math.round(progressValue)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Прогресс OCR</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{statusText}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Язык: {LANGUAGE_OPTIONS.find((option) => option.value === language)?.label || 'Русский'}
                  </div>
                </div>
              </div>
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
        </div>

        <div className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Результат</div>
              <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">Извлеченный текст</h3>
            </div>
          </div>

          <textarea
            value={recognizedText}
            onChange={(event) => setRecognizedText(event.target.value)}
            placeholder="Здесь появится распознанный текст. После этого вы сможете его отредактировать."
            className="mt-4 h-[340px] w-full resize-y rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onCopyText()}
              disabled={!canUseResult}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.02]"
            >
              <Copy size={14} />
              {copyState === 'copied' ? 'Скопировано' : 'Скопировать текст'}
            </button>

            <button
              type="button"
              onClick={onDownloadTxt}
              disabled={!canUseResult}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/60 dark:border-cyan-300/30 bg-cyan-100/70 dark:bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-800 dark:text-cyan-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.02]"
            >
              <Download size={14} />
              Скачать как .txt
            </button>
          </div>

          {copyState === 'error' && (
            <div className="mt-3 text-xs text-red-600 dark:text-red-300">
              Не удалось скопировать в буфер обмена. Попробуйте вручную.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
