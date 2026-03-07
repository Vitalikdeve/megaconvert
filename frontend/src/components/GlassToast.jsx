import React from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

const ICONS = {
  error: AlertTriangle,
  success: CheckCircle2,
  info: Info
};

const CLASSES = {
  error: 'border-red-300/60 dark:border-red-400/20 bg-red-100/70 dark:bg-red-500/15 text-red-700 dark:text-red-200',
  success: 'border-emerald-300/60 dark:border-emerald-400/20 bg-emerald-100/70 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-200',
  info: 'border-blue-300/60 dark:border-blue-400/20 bg-blue-100/70 dark:bg-blue-500/15 text-blue-700 dark:text-blue-200'
};

export default function GlassToast({ toast = null, onClose }) {
  if (!toast) return null;
  const tone = toast.type && CLASSES[toast.type] ? toast.type : 'info';
  const Icon = ICONS[tone];

  return (
    <div className="fixed right-4 bottom-4 z-[100] max-w-sm w-[calc(100%-2rem)]">
      <div className={`rounded-2xl border backdrop-blur-2xl shadow-[0_20px_40px_rgba(15,23,42,0.12)] px-4 py-3 transition-all duration-300 ease-out ${CLASSES[tone]}`}>
        <div className="flex items-start gap-3">
          <Icon size={18} className="mt-0.5 shrink-0" />
          <div className="text-sm leading-relaxed">{toast.message}</div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-xs font-semibold opacity-70 hover:opacity-100 transition-all duration-300 ease-out"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
