const en = require('./locales/en.json');
const ru = require('./locales/ru.json');
const es = require('./locales/es.json');
const de = require('./locales/de.json');
const fr = require('./locales/fr.json');
const zh = require('./locales/zh.json');
const ar = require('./locales/ar.json');
const pt = require('./locales/pt.json');
const hi = require('./locales/hi.json');
const ja = require('./locales/ja.json');
const ko = require('./locales/ko.json');
const tr = require('./locales/tr.json');

const DEFAULT_LANGUAGE = 'en';

const LOCALES = {
  en,
  ru,
  es,
  de,
  fr,
  zh,
  ar,
  pt,
  hi,
  ja,
  ko,
  tr
};

const SUPPORTED_LANGUAGES = Object.keys(LOCALES);

const getByPath = (obj, path) => {
  const parts = String(path || '').split('.').filter(Boolean);
  let cur = obj;
  for (const part of parts) {
    if (!cur || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, part)) {
      return undefined;
    }
    cur = cur[part];
  }
  return cur;
};

const interpolate = (text, vars = {}) => String(text || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
  if (!Object.prototype.hasOwnProperty.call(vars, key)) return `{${key}}`;
  const value = vars[key];
  if (value === null || value === undefined) return '';
  return String(value);
});

const normalizeLanguage = (code) => {
  const raw = String(code || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  if (!raw) return DEFAULT_LANGUAGE;
  if (LOCALES[raw]) return raw;
  const shortCode = raw.split('-')[0];
  if (LOCALES[shortCode]) return shortCode;
  return DEFAULT_LANGUAGE;
};

const t = (language, key, vars = {}) => {
  const code = normalizeLanguage(language);
  const direct = getByPath(LOCALES[code], key);
  if (typeof direct === 'string') return interpolate(direct, vars);
  const fallback = getByPath(LOCALES[DEFAULT_LANGUAGE], key);
  if (typeof fallback === 'string') return interpolate(fallback, vars);
  return String(key || '');
};

const getLanguageLabel = (language) => {
  const code = normalizeLanguage(language);
  return t(code, 'meta.languageName');
};

module.exports = {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
  t,
  getLanguageLabel
};
