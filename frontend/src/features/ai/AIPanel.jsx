import React from 'react';
import { useTranslation } from 'react-i18next';

export default function AIPanel({
  entry,
  insights = [],
  actions = [],
  explanations = [],
  predictiveActions = [],
  onAction
}) {
  const { t } = useTranslation();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="text-xs uppercase tracking-widest text-slate-500">{t('sharedUi.aiPanel.label')}</div>
      <h3 className="mt-2 text-lg font-semibold text-slate-900">{entry || t('sharedUi.aiPanel.emptyTitle')}</h3>

      <div className="mt-4 grid gap-2">
        {insights.slice(0, 4).map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-600">{item.label}</span>
            <span className="font-semibold text-slate-900">{item.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2">
        {actions.slice(0, 3).map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction?.(action)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
          >
            <div className="font-semibold text-slate-900">{action.title}</div>
            <div className="text-slate-600">{action.desc}</div>
          </button>
        ))}
      </div>

      {explanations.length > 0 && (
        <div className="mt-4 text-xs text-slate-600">
          {explanations.slice(0, 2).map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}

      {predictiveActions.length > 0 && (
        <div className="mt-3 text-xs text-slate-500">
          {predictiveActions.slice(0, 2).map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}
    </section>
  );
}

