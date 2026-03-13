import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import {
  ArrowLeft,
  Download,
  FileText,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useNavigate } from 'react-router-dom';
import GlassPanel from '../ui/GlassPanel.jsx';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MotionToolScene = motion.div;
const sceneTransition = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1],
};

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isPdfFile(file) {
  if (!file) {
    return false;
  }

  const fileName = String(file.name || '').toLowerCase();
  return file.type === 'application/pdf' || fileName.endsWith('.pdf');
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

async function renderPdfPagePreview(page) {
  const viewport = page.getViewport({ scale: 0.72 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const context = canvas.getContext('2d', { alpha: false });
  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return {
    previewUrl: canvas.toDataURL('image/jpeg', 0.88),
    width: canvas.width,
    height: canvas.height,
  };
}

async function unpackPdfFile(file) {
  const sourceId = createId();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data: bytes }).promise;
  const pages = [];

  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex + 1);
    const preview = await renderPdfPagePreview(page);

    pages.push({
      id: createId(),
      sourceId,
      sourceName: file.name,
      pageIndex,
      pageNumber: pageIndex + 1,
      previewUrl: preview.previewUrl,
      width: preview.width,
      height: preview.height,
    });

    page.cleanup?.();
  }

  return {
    source: {
      id: sourceId,
      name: file.name,
      bytes,
      pageCount: pdf.numPages,
    },
    pages,
  };
}

export default function PdfEditor() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [pdfFiles, setPdfFiles] = useState([]);
  const [pages, setPages] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState('');

  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedPageId) || null,
    [pages, selectedPageId],
  );

  const handleImportPdfs = useCallback(async (incomingFiles) => {
    const pdfOnly = Array.from(incomingFiles || []).filter(isPdfFile);
    if (!pdfOnly.length) {
      setError('Нужны PDF-файлы. Изображения и другие форматы сюда не подойдут.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const nextSources = [];
      const nextPages = [];

      for (let index = 0; index < pdfOnly.length; index += 1) {
        const file = pdfOnly[index];
        setProgressLabel(`Подготавливаем ${file.name}...`);
        const unpacked = await unpackPdfFile(file);
        nextSources.push(unpacked.source);
        nextPages.push(...unpacked.pages);
      }

      setPdfFiles((current) => [...current, ...nextSources]);
      setPages((current) => [...current, ...nextPages]);

      if (!selectedPageId && nextPages[0]) {
        setSelectedPageId(nextPages[0].id);
      }
    } catch (pdfError) {
      setError(String(pdfError?.message || 'Не удалось открыть PDF локально.'));
    } finally {
      setIsLoading(false);
      setProgressLabel('');
    }
  }, [selectedPageId]);

  const handleDrop = useCallback(async (event) => {
    event.preventDefault();
    setIsDragOver(false);
    await handleImportPdfs(event.dataTransfer?.files);
  }, [handleImportPdfs]);

  const handleFileChange = useCallback(async (event) => {
    const fileList = event.target.files;
    event.target.value = '';
    await handleImportPdfs(fileList);
  }, [handleImportPdfs]);

  const handleDeletePage = useCallback((pageId) => {
    setPages((currentPages) => {
      const filteredPages = currentPages.filter((page) => page.id !== pageId);
      const remainingSourceIds = new Set(filteredPages.map((page) => page.sourceId));
      setPdfFiles((currentSources) => currentSources.filter((source) => remainingSourceIds.has(source.id)));

      if (selectedPageId === pageId) {
        setSelectedPageId(filteredPages[0]?.id || '');
      }

      return filteredPages;
    });
  }, [selectedPageId]);

  const handleExportToOcr = useCallback(() => {
    if (!selectedPage) {
      return;
    }

    const sourceBaseName = selectedPage.sourceName.replace(/\.pdf$/i, '');
    navigate('/tools/smart-ocr', {
      state: {
        ocrImport: {
          dataUrl: selectedPage.previewUrl,
          name: `${sourceBaseName}-page-${selectedPage.pageNumber}.png`,
          origin: 'pdf-editor',
        },
      },
    });
  }, [navigate, selectedPage]);

  const handleDownloadPdf = useCallback(async () => {
    if (!pages.length) {
      return;
    }

    setError('');
    setIsLoading(true);
    setProgressLabel('Собираем новый PDF...');

    try {
      const output = await PDFDocument.create();
      const sourceCache = new Map();

      for (const pageEntry of pages) {
        let sourceDoc = sourceCache.get(pageEntry.sourceId);

        if (!sourceDoc) {
          const source = pdfFiles.find((file) => file.id === pageEntry.sourceId);
          if (!source) {
            continue;
          }

          sourceDoc = await PDFDocument.load(source.bytes);
          sourceCache.set(pageEntry.sourceId, sourceDoc);
        }

        const [copiedPage] = await output.copyPages(sourceDoc, [pageEntry.pageIndex]);
        output.addPage(copiedPage);
      }

      const bytes = await output.save();
      downloadBlob(
        new Blob([bytes], { type: 'application/pdf' }),
        `megaconvert-assembled-${Date.now()}.pdf`,
      );
    } catch (exportError) {
      setError(String(exportError?.message || 'Не удалось собрать PDF локально.'));
    } finally {
      setIsLoading(false);
      setProgressLabel('');
    }
  }, [pages, pdfFiles]);

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
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <GlassPanel className="flex h-[min(88vh,720px)] w-[min(1180px,calc(100vw-2rem))] flex-col overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="inline-flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/80">
              <FileText className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.32em] text-white/28">
                Visual PDF Editor
              </div>
              <h2 className="mt-1 text-xl font-medium text-white/82">PDF Редактор</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] px-4 py-2.5 text-sm text-white/72 transition-colors duration-300 hover:bg-white/[0.1] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
            Назад
          </button>
        </div>

        {!pages.length ? (
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
              'flex flex-1 items-center justify-center rounded-[36px] border border-dashed px-6 text-center transition-colors duration-300',
              isDragOver
                ? 'border-white/20 bg-white/[0.07]'
                : 'border-white/[0.08] bg-white/[0.03]',
            ].join(' ')}
          >
            <div className="flex max-w-[520px] flex-col items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/76">
                <Upload className="h-6 w-6" strokeWidth={1.8} />
              </div>

              <div className="space-y-3">
                <div className="text-xl font-medium tracking-tight text-white/78">
                  Перетащите один или несколько PDF файлов
                </div>
                <div className="text-sm leading-7 text-white/38">
                  Страницы разложатся в визуальную ленту прямо в браузере. Никакой серверной обработки.
                </div>
              </div>
            </div>
          </button>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[10px] uppercase tracking-[0.28em] text-white/46">
                {pages.length} стр.
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[10px] uppercase tracking-[0.28em] text-white/46">
                {pdfFiles.length} PDF
              </div>
              {selectedPage ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[10px] uppercase tracking-[0.28em] text-white/46">
                  Выбрана стр. {selectedPage.pageNumber}
                </div>
              ) : null}
            </div>

            <div
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
                'min-h-0 flex-1 overflow-y-auto rounded-[32px] border border-white/[0.08] px-4 py-4 transition-colors duration-300 sm:px-5',
                isDragOver ? 'bg-white/[0.05]' : 'bg-white/[0.02]',
              ].join(' ')}
            >
              <Reorder.Group
                axis="y"
                layoutScroll
                values={pages}
                onReorder={setPages}
                className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4"
              >
                <AnimatePresence>
                  {pages.map((page) => {
                    const isSelected = page.id === selectedPageId;

                    return (
                      <Reorder.Item
                        key={page.id}
                        value={page}
                        layout
                        initial={{ opacity: 0, scale: 0.94, y: 14 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.88, y: -12 }}
                        transition={sceneTransition}
                        whileDrag={{
                          scale: 1.05,
                          zIndex: 50,
                          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                        }}
                        className={[
                          'group relative list-none cursor-grab active:cursor-grabbing',
                          isSelected ? 'z-10' : '',
                        ].join(' ')}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedPageId(page.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedPageId(page.id);
                            }
                          }}
                          className={[
                            'relative w-full overflow-hidden rounded-[24px] border p-3 text-left transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
                            isSelected
                              ? 'border-indigo-300/40 bg-white/[0.07] shadow-[0_0_42px_-18px_rgba(99,102,241,0.5)]'
                              : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]',
                          ].join(' ')}
                        >
                          <button
                            type="button"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeletePage(page.id);
                            }}
                            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-red-400/18 bg-red-500/10 text-red-100/78 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                          </button>

                          <div className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#060606]">
                            <img
                              src={page.previewUrl}
                              alt={`${page.sourceName} page ${page.pageNumber}`}
                              className="h-[260px] w-full object-contain"
                            />
                          </div>

                          <div className="mt-3 space-y-1">
                            <div className="truncate text-sm font-medium text-white/76">
                              {page.sourceName}
                            </div>
                            <div className="text-xs text-white/34">
                              Страница {page.pageNumber}
                            </div>
                          </div>
                        </div>
                      </Reorder.Item>
                    );
                  })}
                </AnimatePresence>
              </Reorder.Group>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-3 backdrop-blur-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] px-4 py-2.5 text-sm text-white/72 transition-colors duration-300 hover:bg-white/[0.1] hover:text-white"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.8} />
                  Добавить PDF
                </button>

                <button
                  type="button"
                  onClick={handleExportToOcr}
                  disabled={!selectedPage}
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] px-4 py-2.5 text-sm text-white/72 transition-colors duration-300 hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Search className="h-4 w-4" strokeWidth={1.8} />
                  Экспорт в OCR
                </button>
              </div>

              <button
                type="button"
                onClick={() => void handleDownloadPdf()}
                disabled={!pages.length || isLoading}
                className="inline-flex items-center gap-2 rounded-full border border-transparent bg-[linear-gradient(135deg,rgba(99,102,241,0.92),rgba(56,189,248,0.9))] px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_40px_-18px_rgba(99,102,241,0.75)] transition-transform duration-300 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" strokeWidth={1.8} />
                Скачать PDF
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="mt-5 rounded-[22px] border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/64">
            {progressLabel || 'Подготавливаем документ...'}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-[22px] border border-red-400/20 bg-red-500/8 px-4 py-3 text-sm text-red-100/75">
            {error}
          </div>
        ) : null}
      </GlassPanel>
    </MotionToolScene>
  );
}
