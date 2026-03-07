import React from 'react';
import { Link2, Loader2 } from 'lucide-react';

export default function ShareButton({
  onCreateLink,
  disabled = false,
  busy = false
}) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      <button
        type="button"
        onClick={() => onCreateLink?.('one_day')}
        disabled={disabled || busy}
        className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/60 dark:border-cyan-300/30 bg-cyan-100/80 dark:bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-800 dark:text-cyan-100 backdrop-blur-xl transition-all duration-300 ease-out hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
        {busy ? 'Генерируем ссылку...' : 'Поделиться (24 часа)'}
      </button>
    </div>
  );
}
