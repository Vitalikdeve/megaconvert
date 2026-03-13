import React from 'react';
import { useTranslation } from 'react-i18next';
import LegalPageLayout from './LegalPageLayout.jsx';

export default function TermsPage() {
  const { t } = useTranslation();

  return (
    <LegalPageLayout
      title={t('pageTermsTitle')}
      updatedAt="March 14, 2026"
    >
      <p>{t('legalPages.terms.intro')}</p>
      <h2>{t('legalPages.terms.acceptanceTitle')}</h2>
      <p>{t('legalPages.terms.acceptanceBody')}</p>
      <h2>{t('legalPages.terms.eligibilityTitle')}</h2>
      <p>{t('legalPages.terms.eligibilityBody')}</p>
      <h2>{t('legalPages.terms.permittedTitle')}</h2>
      <p>{t('legalPages.terms.permittedBody')}</p>
      <h2>{t('legalPages.terms.localTitle')}</h2>
      <p>{t('legalPages.terms.localBody')}</p>
      <h2>{t('legalPages.terms.sanctionsTitle')}</h2>
      <p>{t('legalPages.terms.sanctionsBody1')}</p>
      <p>{t('legalPages.terms.sanctionsBody2')}</p>
      <h2>{t('legalPages.terms.availabilityTitle')}</h2>
      <p>{t('legalPages.terms.availabilityBody')}</p>
      <h2>{t('legalPages.terms.disclaimersTitle')}</h2>
      <p>{t('legalPages.terms.disclaimersBody')}</p>
      <h2>{t('legalPages.terms.liabilityTitle')}</h2>
      <p>{t('legalPages.terms.liabilityBody')}</p>
      <h2>{t('legalPages.terms.terminationTitle')}</h2>
      <p>{t('legalPages.terms.terminationBody')}</p>
      <h2>{t('legalPages.terms.contactTitle')}</h2>
      <p>{t('legalPages.terms.contactBody')}</p>
    </LegalPageLayout>
  );
}
