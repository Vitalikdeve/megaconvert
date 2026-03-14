import React from 'react';
import { useTranslation } from 'react-i18next';

export default function BatchUploader({ files = [], onFilesSelected }) {
  const { t } = useTranslation();

  return (
    <label className="block rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
      <div className="font-semibold text-slate-800">{t('sharedUi.batchUploader.title')}</div>
      <div className="mt-1">{t('sharedUi.batchUploader.description')}</div>
      <input
        type="file"
        multiple
        className="mt-3 block w-full text-sm"
        onChange={(event) => onFilesSelected?.(event.target.files)}
      />
      {!!files.length && <div className="mt-2 text-xs text-slate-500">{t('sharedUi.batchUploader.selected', { count: files.length })}</div>}
    </label>
  );
}

