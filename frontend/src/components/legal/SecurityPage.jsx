import React from 'react';
import { useTranslation } from 'react-i18next';
import LegalPageLayout from './LegalPageLayout.jsx';

export default function SecurityPage() {
  const { t } = useTranslation();

  return (
    <LegalPageLayout
      title={t('pageSecurityTitle')}
      updatedAt="March 14, 2026"
    >
      <p>{t('legalPages.security.intro')}</p>
      <h2>{t('legalPages.security.hybridTitle')}</h2>
      <p>{t('legalPages.security.hybridBody')}</p>
      <h2>{t('legalPages.security.cloudTitle')}</h2>
      <p>{t('legalPages.security.cloudBody')}</p>
      <h2>{t('legalPages.security.deletionTitle')}</h2>
      <p>{t('legalPages.security.deletionBody')}</p>
      <h2>{t('legalPages.security.complianceTitle')}</h2>
      <p>{t('legalPages.security.complianceBody')}</p>
      <h2>{t('legalPages.security.accountTitle')}</h2>
      <p>{t('legalPages.security.accountBody')}</p>
      <h2>{t('legalPages.security.disclosureTitle')}</h2>
      <p>{t('legalPages.security.disclosureBody')}</p>
    </LegalPageLayout>
  );
}
