import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  Save,
  Trash2,
  Upload
} from 'lucide-react';

if (GlobalWorkerOptions.workerSrc !== pdfWorkerUrl) {
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

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

const createDocumentId = (file, index) => {
  const raw = `${file.name || 'pdf'}-${file.size || 0}-${file.lastModified || 0}-${index}`;
  return raw.replace(/[^\w.-]+/g, '-');
};

const renderFirstPagePreview = async (bytes) => {
  const loadingTask = getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const safeWidth = Math.max(1, viewport.width);
  const scale = 260 / safeWidth;
  const scaled = page.getViewport({ scale: Math.max(0.25, Math.min(2.6, scale)) });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('canvas_context_missing');
  canvas.width = Math.max(1, Math.floor(scaled.width));
  canvas.height = Math.max(1, Math.floor(scaled.height));
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport: scaled }).promise;
  const dataUrl = canvas.toDataURL('image/png');
  const pageCount = Number(pdf.numPages || 0);
  if (typeof loadingTask.destroy === 'function') loadingTask.destroy();
  if (typeof pdf.cleanup === 'function') pdf.cleanup();
  if (typeof pdf.destroy === 'function') await pdf.destroy();
  return { dataUrl, pageCount: pageCount > 0 ? pageCount : 1 };
};

export default function PdfEditorTool() {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [statusText, setStatusText] = useState(() => t('legacyTools.pdfEditor.statuses.initial'));
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState(null);

  const fileInputRef = useRef(null);
  const resultUrlRef = useRef(null);

  const clearResultLink = useCallback(() => {
    if (!resultUrlRef.current) return;
    URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
  }, []);

  useEffect(() => () => {
    clearResultLink();
  }, [clearResultLink]);

  const removeDocument = useCallback((documentId) => {
    setDocuments((prev) => prev.filter((item) => item.id !== documentId));
    setError('');
    setStatusText(t('legacyTools.pdfEditor.statuses.removed'));
  }, [t]);

  const clearAll = useCallback(() => {
    setDocuments([]);
    setError('');
    setStatusText(t('legacyTools.pdfEditor.statuses.cleared'));
    clearResultLink();
    setResult(null);
  }, [clearResultLink, t]);

  const appendPdfFiles = useCallback(async (incomingFiles) => {
    const files = Array.from(incomingFiles || []);
    if (!files.length) return;

    setError('');
    setStatusText(t('legacyTools.pdfEditor.statuses.extracting'));
    clearResultLink();
    setResult(null);

    const failed = [];
    const parsed = [];
    const existingIds = new Set(documents.map((item) => item.id));

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (!ensurePdfFile(file)) {
        failed.push(`${file.name || `file-${i + 1}`}: ${t('legacyTools.pdfEditor.errors.unsupportedFormat')}`);
        continue;
      }
      const id = createDocumentId(file, i);
      if (existingIds.has(id)) continue;
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const preview = await renderFirstPagePreview(bytes);
        parsed.push({
          id,
          fileName: file.name,
          size: file.size,
          bytes,
          pageCount: preview.pageCount,
          firstPagePreview: preview.dataUrl
        });
      } catch {
        failed.push(`${file.name || `file-${i + 1}`}: ${t('legacyTools.pdfEditor.errors.previewFailed')}`);
      }
    }

    if (parsed.length) {
      setDocuments((prev) => [...prev, ...parsed]);
      setStatusText(t('legacyTools.pdfEditor.statuses.added', { count: parsed.length }));
    }

    if (failed.length) {
      setError(t('legacyTools.pdfEditor.errors.filesSkipped', { details: `${failed.slice(0, 3).join('; ')}${failed.length > 3 ? '...' : ''}` }));
      if (!parsed.length) setStatusText(t('legacyTools.pdfEditor.statuses.loadFailed'));
    }
  }, [clearResultLink, documents, t]);

  const onDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    void appendPdfFiles(event.dataTransfer?.files || []);
  };

  const mergePDFs = useCallback(async () => {
    if (isSaving) return;
    if (!documents.length) {
      setError(t('legacyTools.pdfEditor.errors.addPdfRequired'));
      return;
    }

    setError('');
    setIsSaving(true);
    setStatusText(t('legacyTools.pdfEditor.statuses.merging'));
    clearResultLink();
    setResult(null);

    try {
      const outputDoc = await PDFDocument.create();

      for (const doc of documents) {
        const sourceDoc = await PDFDocument.load(doc.bytes, { ignoreEncryption: false });
        const pageIndices = sourceDoc.getPageIndices();
        const copiedPages = await outputDoc.copyPages(sourceDoc, pageIndices);
        copiedPages.forEach((page) => outputDoc.addPage(page));
      }

      const outputBytes = await outputDoc.save();
      const blob = new Blob([outputBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;
      const fileName = `megaconvert-merged-${Date.now()}.pdf`;

      setResult({ fileName, size: blob.size, url });
      setStatusText(t('legacyTools.pdfEditor.statuses.done'));
    } catch {
      setError(t('legacyTools.pdfEditor.errors.mergeFailed'));
      setStatusText(t('legacyTools.pdfEditor.statuses.failed'));
    } finally {
      setIsSaving(false);
    }
  }, [clearResultLink, documents, isSaving, t]);

  const pageTotal = useMemo(
    () => documents.reduce((sum, item) => sum + Number(item.pageCount || 0), 0),
    [documents]
  );

  return (
    <section className="mc-card rounded-3xl p-6 md:p-8">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('legacyTools.pdfEditor.eyebrow')}</div>
        <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {t('legacyTools.pdfEditor.title')}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-3xl">
          {t('legacyTools.pdfEditor.description')}
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
        <div className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{t('legacyTools.pdfEditor.dropTitle')}</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('legacyTools.pdfEditor.dropHint')}</div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-all duration-300 ease-out hover:scale-[1.02]"
          >
            {t('legacyTools.pdfEditor.addPdf')}
          </button>
          {documents.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 transition-all duration-300 ease-out hover:scale-[1.02]"
            >
              {t('legacyTools.pdfEditor.clearAll')}
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
            {t('legacyTools.pdfEditor.summary', { count: documents.length, pages: pageTotal })}
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
        {documents.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/5 p-8 text-center">
            <FileText size={18} className="mx-auto text-slate-400 dark:text-slate-500" />
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t('legacyTools.pdfEditor.emptyState')}</div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {documents.map((doc, index) => (
              <article
                key={doc.id}
                className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/75 dark:bg-white/5 backdrop-blur-xl p-4 transition-all duration-300 ease-out hover:translate-y-[-1px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('legacyTools.pdfEditor.documentLabel', { index: index + 1 })}</div>
                  <button
                    type="button"
                    onClick={() => removeDocument(doc.id)}
                    className="h-8 w-8 rounded-lg border border-red-200 dark:border-red-300/20 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 flex items-center justify-center transition-all duration-300 ease-out hover:scale-[1.04]"
                    aria-label={t('legacyTools.pdfEditor.removeCardAria')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200/70 dark:border-white/10 bg-white dark:bg-slate-900">
                  {doc.firstPagePreview ? (
                    <img src={doc.firstPagePreview} alt={t('legacyTools.pdfEditor.previewAlt', { name: doc.fileName })} className="h-40 w-full object-contain bg-white" />
                  ) : (
                    <div className="h-40 w-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-300">{t('legacyTools.pdfEditor.previewUnavailable')}</div>
                  )}
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100 break-all">{doc.fileName}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t('legacyTools.pdfEditor.pageCount', { count: doc.pageCount, size: formatBytes(doc.size) })}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void mergePDFs()}
          disabled={isSaving || documents.length === 0}
          className="rounded-2xl px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.02] flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {t('legacyTools.pdfEditor.mergingCta')}
            </>
          ) : (
            <>
              <Save size={16} />
              {t('legacyTools.pdfEditor.mergePdf')}
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
            {t('legacyTools.pdfEditor.downloadResult', { name: result.fileName, size: formatBytes(result.size) })}
          </a>
        )}
      </div>
    </section>
  );
}
