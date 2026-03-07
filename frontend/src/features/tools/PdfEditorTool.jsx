import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Download,
  FileText,
  Loader2,
  Save,
  Trash2,
  Upload
} from 'lucide-react';

const formatBytes = (value) => {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

const ensurePdfFile = (file) => {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  if (type === 'application/pdf') return true;
  return String(file.name || '').toLowerCase().endsWith('.pdf');
};

const createSourceId = (file, index) => {
  const key = `${file.name || 'pdf'}-${file.size || 0}-${file.lastModified || 0}-${index}`;
  return key.replace(/[^\w.-]+/g, '-');
};

export default function PdfEditorTool() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [sources, setSources] = useState({});
  const [pages, setPages] = useState([]);
  const [statusText, setStatusText] = useState('Загрузите один или несколько PDF');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState(null);

  const fileInputRef = useRef(null);
  const resultUrlRef = useRef(null);

  const cleanupResultUrl = useCallback(() => {
    if (!resultUrlRef.current) return;
    URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
  }, []);

  useEffect(() => () => {
    cleanupResultUrl();
  }, [cleanupResultUrl]);

  const removePageById = useCallback((pageId) => {
    setPages((prev) => prev.filter((item) => item.id !== pageId));
    setError('');
    setStatusText('Страница удалена из финального PDF');
  }, []);

  const movePage = useCallback((index, direction) => {
    setPages((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
    setError('');
    setStatusText('Порядок страниц обновлен');
  }, []);

  const clearAll = useCallback(() => {
    setSources({});
    setPages([]);
    setError('');
    setStatusText('Редактор очищен');
    cleanupResultUrl();
    setResult(null);
  }, [cleanupResultUrl]);

  const appendPdfFiles = useCallback(async (incomingFiles) => {
    const files = Array.from(incomingFiles || []);
    if (!files.length) return;

    setError('');
    setStatusText('Подготавливаем PDF для редактирования...');
    cleanupResultUrl();
    setResult(null);

    const nextSources = {};
    const nextPages = [];
    const failed = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (!ensurePdfFile(file)) {
        failed.push(`${file.name || `file-${i + 1}`}: неподдерживаемый формат`);
        continue;
      }
      const sourceId = createSourceId(file, i);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
        const pageCount = doc.getPageCount();
        if (!pageCount) {
          failed.push(`${file.name || `file-${i + 1}`}: пустой PDF`);
          continue;
        }

        nextSources[sourceId] = {
          id: sourceId,
          fileName: file.name,
          bytes,
          pageCount
        };

        for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
          nextPages.push({
            id: `${sourceId}-${pageIndex + 1}`,
            sourceId,
            sourceName: file.name,
            sourcePageIndex: pageIndex,
            pageNumber: pageIndex + 1
          });
        }
      } catch {
        failed.push(`${file.name || `file-${i + 1}`}: не удалось прочитать PDF`);
      }
    }

    if (Object.keys(nextSources).length > 0) {
      setSources((prev) => ({ ...prev, ...nextSources }));
      setPages((prev) => [...prev, ...nextPages]);
      setStatusText(`Добавлено страниц: ${nextPages.length}`);
    }

    if (failed.length > 0) {
      setError(`Некоторые файлы пропущены: ${failed.slice(0, 3).join('; ')}${failed.length > 3 ? '...' : ''}`);
      if (!nextPages.length) {
        setStatusText('Не удалось загрузить PDF');
      }
    }
  }, [cleanupResultUrl]);

  const onDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    void appendPdfFiles(event.dataTransfer?.files || []);
  };

  const saveNewPdf = useCallback(async () => {
    if (isSaving) return;
    if (!pages.length) {
      setError('Добавьте хотя бы одну страницу для сохранения PDF.');
      return;
    }
    setError('');
    setIsSaving(true);
    setStatusText('Собираем новый PDF...');
    cleanupResultUrl();
    setResult(null);

    try {
      const outputDoc = await PDFDocument.create();
      const sourceDocCache = new Map();

      for (const page of pages) {
        const source = sources[page.sourceId];
        if (!source || !(source.bytes instanceof Uint8Array)) {
          throw new Error('source_missing');
        }
        let sourceDoc = sourceDocCache.get(page.sourceId);
        if (!sourceDoc) {
          sourceDoc = await PDFDocument.load(source.bytes, { ignoreEncryption: false });
          sourceDocCache.set(page.sourceId, sourceDoc);
        }
        const [copiedPage] = await outputDoc.copyPages(sourceDoc, [page.sourcePageIndex]);
        outputDoc.addPage(copiedPage);
      }

      const outputBytes = await outputDoc.save();
      const blob = new Blob([outputBytes], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);
      resultUrlRef.current = objectUrl;
      const outputName = `megaconvert-edited-${Date.now()}.pdf`;

      setResult({
        fileName: outputName,
        size: blob.size,
        url: objectUrl
      });
      setStatusText('Новый PDF готов к скачиванию');
    } catch {
      setError('Не удалось собрать новый PDF. Проверьте исходные файлы и попробуйте снова.');
      setStatusText('Ошибка сохранения PDF');
    } finally {
      setIsSaving(false);
    }
  }, [cleanupResultUrl, isSaving, pages, sources]);

  const sourceCount = useMemo(() => Object.keys(sources).length, [sources]);

  return (
    <section className="mc-card rounded-3xl p-6 md:p-8">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">PDF / Editor</div>
        <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Визуальный PDF-редактор
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-3xl">
          Загружайте несколько PDF, удаляйте страницы, меняйте их порядок и сохраняйте новый файл полностью в браузере.
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
        <div className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Перетащите PDF-файлы сюда</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">или выберите один/несколько файлов вручную</div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-all duration-300 ease-out hover:scale-[1.02]"
          >
            Добавить PDF
          </button>
          {(sourceCount > 0 || pages.length > 0) && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 transition-all duration-300 ease-out hover:scale-[1.02]"
            >
              Очистить всё
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="application/pdf,.pdf"
        multiple
        onChange={(event) => {
          void appendPdfFiles(event.target.files || []);
          event.target.value = '';
        }}
      />

      <div className="mt-5 rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Источников: {sourceCount} · Страниц в сборке: {pages.length}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{statusText}</div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-300/60 dark:border-red-400/20 bg-red-100/70 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="mt-6">
        {pages.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-8 text-center">
            <FileText size={18} className="mx-auto text-slate-400 dark:text-slate-500" />
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">Загрузите PDF, чтобы начать редактирование страниц.</div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((page, index) => (
              <div
                key={page.id}
                className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/75 dark:bg-white/5 backdrop-blur-xl p-4 transition-all duration-300 ease-out hover:translate-y-[-1px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Страница {index + 1}</div>
                  <button
                    type="button"
                    onClick={() => removePageById(page.id)}
                    className="h-8 w-8 rounded-lg border border-red-200 dark:border-red-300/20 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 flex items-center justify-center transition-all duration-300 ease-out hover:scale-[1.04]"
                    aria-label="Удалить страницу"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100 break-all">{page.sourceName}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Исходная страница: {page.pageNumber}</div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => movePage(index, -1)}
                    disabled={index === 0}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.02]"
                  >
                    <ArrowLeft size={13} />
                    Влево
                  </button>
                  <button
                    type="button"
                    onClick={() => movePage(index, 1)}
                    disabled={index === pages.length - 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.02]"
                  >
                    <ArrowRight size={13} />
                    Вправо
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void saveNewPdf()}
          disabled={isSaving || pages.length === 0}
          className="rounded-2xl px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.02] flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Собираем PDF...
            </>
          ) : (
            <>
              <Save size={16} />
              Сохранить новый PDF
            </>
          )}
        </button>

        {result && (
          <a
            href={result.url}
            download={result.fileName}
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/60 dark:border-emerald-300/30 bg-emerald-100/70 dark:bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-800 dark:text-emerald-100 transition-all duration-300 ease-out hover:scale-[1.02]"
          >
            <Download size={15} />
            Скачать {result.fileName} ({formatBytes(result.size)})
          </a>
        )}
      </div>
    </section>
  );
}
