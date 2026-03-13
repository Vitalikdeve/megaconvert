import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LocaleSwitcher({ locales = [], value, onChange }) {
  const { t } = useTranslation();

  return (
    <select
      aria-label={t('localeSwitcher.ariaLabel')}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
    >
      {locales.map((item) => (
        <option key={item.code} value={item.code}>
          {item.flag ? `${item.flag} ` : ''}{item.name}
        </option>
      ))}
    </select>
  );
}

