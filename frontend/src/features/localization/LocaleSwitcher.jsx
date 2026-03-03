import React from 'react';

export default function LocaleSwitcher({ locales = [], value, onChange }) {
  return (
    <select
      aria-label="Locale switcher"
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

