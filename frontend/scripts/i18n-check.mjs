import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const i18nDir = path.join(cwd, 'src', 'i18n');
const strictMode = process.argv.includes('--strict');

const SOFT_LIMITS = [
  { prefix: 'btn', max: 22, label: 'button label' },
  { prefix: 'nav', max: 24, label: 'navigation label' },
  { prefix: 'label', max: 42, label: 'short UI label' },
  { prefix: 'toast', max: 96, label: 'toast text' }
];

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function flattenDict(input, prefix = '') {
  const output = {};

  for (const [key, value] of Object.entries(input || {})) {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(output, flattenDict(value, nextKey));
      continue;
    }

    output[nextKey] = value;
  }

  return output;
}

function getPlaceholders(value) {
  const text = String(value ?? '');
  const matches = text.match(/\{[a-zA-Z0-9_]+\}/g) || [];
  return Array.from(new Set(matches)).sort();
}

function isSoftLimitKey(key) {
  return SOFT_LIMITS.find((rule) => key.startsWith(rule.prefix)) || null;
}

function run() {
  if (!fs.existsSync(i18nDir)) {
    console.error(`[i18n-check] Missing directory: ${i18nDir}`);
    process.exit(1);
  }

  const basePath = path.join(i18nDir, 'en.json');
  if (!fs.existsSync(basePath)) {
    console.error('[i18n-check] Missing base locale file: en.json');
    process.exit(1);
  }

  const base = flattenDict(readJson(basePath));
  const baseKeys = Object.keys(base).sort();
  const localeFiles = fs
    .readdirSync(i18nDir)
    .filter((file) => file.endsWith('.json') && file !== 'en.json')
    .sort();

  let errorCount = 0;
  let warningCount = 0;

  for (const file of localeFiles) {
    const localeCode = file.replace('.json', '');
    const localePath = path.join(i18nDir, file);
    const dict = flattenDict(readJson(localePath));
    const localeKeys = Object.keys(dict).sort();

    const missing = baseKeys.filter((key) => !Object.prototype.hasOwnProperty.call(dict, key));
    const extra = localeKeys.filter((key) => !Object.prototype.hasOwnProperty.call(base, key));

    if (missing.length > 0) {
      errorCount += 1;
      console.error(`[i18n-check] ${localeCode}: missing keys (${missing.length})`);
      console.error(`  ${missing.join(', ')}`);
    }

    if (extra.length > 0) {
      errorCount += 1;
      console.error(`[i18n-check] ${localeCode}: extra keys (${extra.length})`);
      console.error(`  ${extra.join(', ')}`);
    }

    for (const key of baseKeys) {
      const baseValue = base[key];
      const localeValue = dict[key];

      if (localeValue === undefined) continue;
      if (typeof localeValue !== 'string') {
        errorCount += 1;
        console.error(`[i18n-check] ${localeCode}:${key} must be string`);
        continue;
      }

      if (localeValue.trim().length === 0) {
        warningCount += 1;
        console.warn(`[i18n-check] ${localeCode}:${key} is empty`);
      }

      const basePlaceholders = getPlaceholders(baseValue);
      const localePlaceholders = getPlaceholders(localeValue);
      if (basePlaceholders.join('|') !== localePlaceholders.join('|')) {
        errorCount += 1;
        console.error(
          `[i18n-check] ${localeCode}:${key} placeholder mismatch (base=${basePlaceholders.join(' ') || '-'}, locale=${localePlaceholders.join(' ') || '-'})`
        );
      }

      const softRule = isSoftLimitKey(key);
      if (softRule && localeValue.length > softRule.max) {
        warningCount += 1;
        console.warn(
          `[i18n-check] ${localeCode}:${key} too long for ${softRule.label} (${localeValue.length}/${softRule.max})`
        );
      }
    }
  }

  console.log(`[i18n-check] Locales checked: ${localeFiles.length}`);
  console.log(`[i18n-check] Warnings: ${warningCount}`);
  console.log(`[i18n-check] Errors: ${errorCount}`);

  if (errorCount > 0 && strictMode) {
    process.exit(1);
  }
}

run();
