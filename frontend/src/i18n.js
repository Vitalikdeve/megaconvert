import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './i18n/en.json';
import zh from './i18n/zh.json';
import es from './i18n/es.json';
import ar from './i18n/ar.json';
import pt from './i18n/pt.json';
import ja from './i18n/ja.json';
import fr from './i18n/fr.json';
import de from './i18n/de.json';
import ru from './i18n/ru.json';
import ko from './i18n/ko.json';
import hi from './i18n/hi.json';
import id from './i18n/id.json';
import it from './i18n/it.json';
import tr from './i18n/tr.json';
import vi from './i18n/vi.json';
import be from './i18n/be.json';

export const SUPPORTED_LANGUAGE_CODES = [
  'en',
  'zh',
  'es',
  'ar',
  'pt',
  'ja',
  'fr',
  'de',
  'ru',
  'ko',
  'hi',
  'id',
  'it',
  'tr',
  'vi',
  'be',
];

export const RTL_LANGUAGE_CODES = ['ar'];

export const HEADER_LANGUAGE_OPTIONS = [
  { code: 'en', nativeLabel: 'English' },
  { code: 'zh', nativeLabel: '中文' },
  { code: 'es', nativeLabel: 'Español' },
  { code: 'ar', nativeLabel: 'العربية' },
  { code: 'pt', nativeLabel: 'Português' },
  { code: 'ja', nativeLabel: '日本語' },
  { code: 'fr', nativeLabel: 'Français' },
  { code: 'de', nativeLabel: 'Deutsch' },
  { code: 'ru', nativeLabel: 'Русский' },
  { code: 'ko', nativeLabel: '한국어' },
  { code: 'hi', nativeLabel: 'हिन्दी' },
  { code: 'id', nativeLabel: 'Bahasa Indonesia' },
  { code: 'it', nativeLabel: 'Italiano' },
  { code: 'tr', nativeLabel: 'Türkçe' },
  { code: 'vi', nativeLabel: 'Tiếng Việt' },
  { code: 'be', nativeLabel: 'Беларуская' },
];

const resources = {
  en: { translation: en },
  zh: { translation: zh },
  es: { translation: es },
  ar: { translation: ar },
  pt: { translation: pt },
  ja: { translation: ja },
  fr: { translation: fr },
  de: { translation: de },
  ru: { translation: ru },
  ko: { translation: ko },
  hi: { translation: hi },
  id: { translation: id },
  it: { translation: it },
  tr: { translation: tr },
  vi: { translation: vi },
  be: { translation: be },
};

const LANGUAGE_ALIAS = {
  en: 'en',
  us: 'en',
  gb: 'en',
  zh: 'zh',
  cn: 'zh',
  tw: 'zh',
  'zh-cn': 'zh',
  'zh-tw': 'zh',
  'zh-hans': 'zh',
  'zh-hant': 'zh',
  'zh-hk': 'zh',
  es: 'es',
  mx: 'es',
  ar: 'ar',
  sa: 'ar',
  ae: 'ar',
  pt: 'pt',
  br: 'pt',
  ja: 'ja',
  jp: 'ja',
  fr: 'fr',
  de: 'de',
  ru: 'ru',
  be: 'be',
  ko: 'ko',
  kr: 'ko',
  hi: 'hi',
  id: 'id',
  in: 'id',
  it: 'it',
  tr: 'tr',
  vi: 'vi',
};

const normalizeLang = (value) => {
  const input = String(value || '').trim().toLowerCase();
  if (!input) return 'en';

  const directMatch = LANGUAGE_ALIAS[input] || input;
  if (SUPPORTED_LANGUAGE_CODES.includes(directMatch)) {
    return directMatch;
  }

  const [shortCode] = input.split('-');
  const shortMatch = LANGUAGE_ALIAS[shortCode] || shortCode;
  if (SUPPORTED_LANGUAGE_CODES.includes(shortMatch)) {
    return shortMatch;
  }

  return 'en';
};

const detectInitialLanguage = () => {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = localStorage.getItem('lang');
    if (stored) return normalizeLang(stored);
  } catch {
    // ignore storage access errors
  }
  return normalizeLang(window.navigator?.language || 'en');
};

const syncLanguageState = (value) => {
  const nextLanguage = normalizeLang(value);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('lang', nextLanguage);
    } catch {
      // ignore storage access errors
    }
  }
};

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: detectInitialLanguage(),
      fallbackLng: 'en',
      supportedLngs: SUPPORTED_LANGUAGE_CODES,
      nonExplicitSupportedLngs: true,
      load: 'languageOnly',
      interpolation: { escapeValue: false }
    });

  i18n.on('languageChanged', syncLanguageState);
}

syncLanguageState(i18n.language);

export { resources, normalizeLang };
export default i18n;
