import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export default function useWorkspaceLocale() {
  const { i18n } = useTranslation();
  const language = String(i18n.resolvedLanguage || i18n.language || 'en').trim().toLowerCase();
  const isRussian = language.startsWith('ru') || language.startsWith('be');

  const pick = useCallback((ruText, enText) => (isRussian ? ruText : enText), [isRussian]);

  return {
    language,
    isRussian,
    pick
  };
}
