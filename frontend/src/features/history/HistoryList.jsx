import React from 'react';
import { useTranslation } from 'react-i18next';

export default function HistoryList({ items = [], getLabel }) {
  const { t } = useTranslation();

  if (!items.length) {
    return <div className="text-sm text-slate-500">{t('sharedUi.historyList.empty')}</div>;
  }

  return (
    <div className="space-y-2">
      {items.slice(0, 20).map((item) => (
        <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <span className="text-slate-700">{getLabel ? getLabel(item) : item.id}</span>
          <span className="text-slate-500">{item.ts ? new Date(item.ts).toLocaleString() : t('sharedUi.historyList.notAvailable')}</span>
        </div>
      ))}
    </div>
  );
}
