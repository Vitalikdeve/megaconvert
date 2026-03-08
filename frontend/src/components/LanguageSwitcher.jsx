import React from 'react';
import { useTranslation } from 'react-i18next';

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'be', label: 'Беларуская' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'zh', label: '中文 (CN)' },
  { code: 'zh-tw', label: '繁體中文 (TW)' },
  { code: 'ar', label: 'العربية (SA)' },
  { code: 'ja', label: '日本語 (JP)' },
  { code: 'hi', label: 'हिन्दी (IN)' },
  { code: 'ko', label: '한국어 (KR)' }
];

export default function LanguageSwitcher({ value = 'en', onChange, className = '' }) {
  const { t, i18n } = useTranslation();
  const selectedValue = SUPPORTED_LANGUAGES.some((language) => language.code === value) ? value : 'en';

  const handleChange = (event) => {
    const nextLang = String(event.target.value || 'en');
    if (typeof onChange === 'function') onChange(nextLang);
    if (i18n.language !== nextLang) {
      void i18n.changeLanguage(nextLang);
    }
  };

  return (
    <div
      className={`inline-flex items-center rounded-2xl border border-white/30 bg-white/60 px-2 py-1 backdrop-blur-md shadow-[0_8px_28px_rgba(15,23,42,0.12)] dark:border-white/15 dark:bg-white/10 ${className}`}
    >
      <label className="sr-only" htmlFor="language-switcher">{t('menu.language', 'Language')}</label>
      <select
        id="language-switcher"
        value={selectedValue}
        onChange={handleChange}
        className="min-w-[140px] appearance-none rounded-xl bg-transparent px-2 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-100 outline-none"
      >
        {SUPPORTED_LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
    </div>
  );
}
