import React from 'react';
import { useTranslation } from 'react-i18next';
import LegalPageLayout from './LegalPageLayout.jsx';

export default function CookiesPage() {
  const { t } = useTranslation();

  return (
    <LegalPageLayout
      title={t('pageCookiesTitle')}
      updatedAt="March 14, 2026"
    >
      <p>{t('legalPages.cookies.intro')}</p>
      <h2>{t('legalPages.cookies.necessaryTitle')}</h2>
      <p>{t('legalPages.cookies.necessaryBody')}</p>
      <h2>{t('legalPages.cookies.analyticsTitle')}</h2>
      <p>{t('legalPages.cookies.analyticsBody')}</p>
      <h2>{t('legalPages.cookies.localStateTitle')}</h2>
      <p>{t('legalPages.cookies.localStateBody')}</p>
      <h2>{t('legalPages.cookies.preferencesTitle')}</h2>
      <p>{t('legalPages.cookies.preferencesBody')}</p>
      <h2>{t('legalPages.cookies.changesTitle')}</h2>
      <p>{t('legalPages.cookies.changesBody')}</p>
    </LegalPageLayout>
  );
}
