import React from 'react';
import { X } from 'lucide-react';

const ModalBody = ({ type, previewUrl, textContent, error, loading }) => {
  if (loading) {
    return (
      <div className="h-full min-h-[360px] rounded-2xl border border-white/20 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-2xl flex items-center justify-center text-sm text-slate-600 dark:text-slate-300">
        Загружаем предпросмотр...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full min-h-[360px] rounded-2xl border border-red-300/60 dark:border-red-400/20 bg-red-100/70 dark:bg-red-500/10 backdrop-blur-2xl flex items-center justify-center text-sm text-red-700 dark:text-red-200 px-6 text-center">
        {error}
      </div>
    );
  }

  if (type === 'image') {
    return (
      <img
        src={previewUrl}
        alt="Quick Look"
        className="w-full max-h-[78vh] object-contain rounded-2xl border border-white/20 dark:border-white/10 bg-black/5"
      />
    );
  }

  if (type === 'pdf' || type === 'doc') {
    return (
      <iframe
        title="Quick Look"
        src={previewUrl}
        className="w-full h-[78vh] rounded-2xl border border-white/20 dark:border-white/10 bg-white"
      />
    );
  }

  if (type === 'text') {
    return (
      <pre className="h-[78vh] overflow-auto rounded-2xl border border-white/20 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-5 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">
        {textContent || 'Файл пустой.'}
      </pre>
    );
  }

  return (
    <div className="h-full min-h-[360px] rounded-2xl border border-white/20 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-2xl flex items-center justify-center text-sm text-slate-600 dark:text-slate-300">
      Предпросмотр для этого формата недоступен.
    </div>
  );
};

export default function QuickLookModal({
  open = false,
  title = '',
  type = '',
  previewUrl = '',
  textContent = '',
  loading = false,
  error = '',
  onClose
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-black/40 backdrop-blur-3xl transition-all duration-300 ease-out">
      <div className="h-full w-full px-3 py-4 md:px-8 md:py-6">
        <div className="h-full rounded-3xl border border-white/20 dark:border-white/10 bg-white/25 dark:bg-black/30 backdrop-blur-2xl p-4 md:p-6 flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Quick Look</div>
              <div className="text-lg md:text-xl font-semibold text-slate-900 dark:text-slate-100 truncate">{title || 'Предпросмотр'}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 rounded-2xl border border-white/40 dark:border-white/10 bg-white/70 dark:bg-white/5 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all duration-300 ease-out hover:scale-[1.03]"
              aria-label="Закрыть предпросмотр"
            >
              <X size={18} />
            </button>
          </div>
          <ModalBody
            type={type}
            previewUrl={previewUrl}
            textContent={textContent}
            error={error}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}
