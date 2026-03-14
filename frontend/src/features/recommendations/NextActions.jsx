import React from 'react';
import { useTranslation } from 'react-i18next';

export default function NextActions({ actions = [], onPick }) {
  const { t } = useTranslation();
  if (!actions.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs uppercase tracking-widest text-slate-500">{t('sharedUi.nextActions.title')}</div>
      <div className="mt-2 grid gap-2">
        {actions.slice(0, 3).map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onPick?.(action)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}

