import React from 'react';
import { FileText } from 'lucide-react';

const formatSize = (size) => `${(Math.max(0, Number(size || 0)) / (1024 * 1024)).toFixed(1)} MB`;

const statusLabel = (status) => {
  if (status === 'done') return 'Готово';
  if (status === 'error') return 'Ошибка';
  if (status === 'processing') return 'Обработка';
  return 'В очереди';
};

const normalizeProgress = (value) => Math.max(0, Math.min(100, Number(value || 0)));

const ItemCard = ({ item, index }) => {
  const progress = normalizeProgress(item.progress);
  const animated = item.status === 'processing';
  const z = Math.max(1, 100 - index);

  return (
    <div
      className={`relative rounded-2xl border border-white/40 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-2xl px-4 py-3 shadow-[0_14px_36px_rgba(15,23,42,0.06)] transition-all duration-300 ease-out ${animated ? 'dynamic-file-processing' : ''}`}
      style={{ zIndex: z }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={15} className="shrink-0 text-slate-600 dark:text-slate-300" />
            <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{item.name}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatSize(item.size)}</div>
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-300">{statusLabel(item.status)}</span>
      </div>
      <div className="mt-3 h-[3px] rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default function DynamicBatchStack({
  items = [],
  overallProgress = 0,
  status = 'idle'
}) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <section className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/75 dark:bg-white/5 backdrop-blur-2xl p-4 md:p-5 transition-all duration-300 ease-out">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Dynamic Queue</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{Math.round(normalizeProgress(overallProgress))}%</div>
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <ItemCard key={item.id || `${item.name}-${index}`} item={item} index={index} />
        ))}
      </div>
      <div className="mt-4 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-500 transition-all duration-300 ease-out ${status === 'processing' ? 'dynamic-queue-live' : ''}`}
          style={{ width: `${normalizeProgress(overallProgress)}%` }}
        />
      </div>
    </section>
  );
}
