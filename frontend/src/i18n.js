import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './i18n/en.json';
import ru from './i18n/ru.json';
import be from './i18n/be.json';
import es from './i18n/es.json';
import pt from './i18n/pt.json';
import fr from './i18n/fr.json';
import de from './i18n/de.json';
import it from './i18n/it.json';
import nl from './i18n/nl.json';
import pl from './i18n/pl.json';
import tr from './i18n/tr.json';
import zh from './i18n/zh.json';
import zhTw from './i18n/zh-tw.json';
import ar from './i18n/ar.json';
import ja from './i18n/ja.json';
import hi from './i18n/hi.json';
import ko from './i18n/ko.json';

const resources = {
  en: { translation: en },
  ru: { translation: ru },
  be: { translation: be },
  es: { translation: es },
  pt: { translation: pt },
  fr: { translation: fr },
  de: { translation: de },
  it: { translation: it },
  nl: { translation: nl },
  pl: { translation: pl },
  tr: { translation: tr },
  zh: { translation: zh },
  'zh-tw': { translation: zhTw },
  ar: { translation: ar },
  ja: { translation: ja },
  hi: { translation: hi },
  ko: { translation: ko }
};

const LANGUAGE_ALIAS = {
  en: 'en',
  ru: 'ru',
  be: 'be',
  es: 'es',
  pt: 'pt',
  fr: 'fr',
  de: 'de',
  it: 'it',
  nl: 'nl',
  pl: 'pl',
  tr: 'tr',
  zh: 'zh',
  cn: 'zh',
  tw: 'zh-tw',
  'zh-tw': 'zh-tw',
  'zh-cn': 'zh',
  ar: 'ar',
  sa: 'ar',
  ja: 'ja',
  jp: 'ja',
  hi: 'hi',
  in: 'hi',
  ko: 'ko',
  kr: 'ko'
};

const normalizeLang = (value) => {
  const input = String(value || '').trim().toLowerCase();
  if (!input) return 'en';
  if (LANGUAGE_ALIAS[input]) return LANGUAGE_ALIAS[input];

  const [shortCode] = input.split('-');
  if (LANGUAGE_ALIAS[shortCode]) return LANGUAGE_ALIAS[shortCode];

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

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: detectInitialLanguage(),
      fallbackLng: 'en',
      interpolation: { escapeValue: false }
    });
}

export { resources, normalizeLang };
export default i18n;
