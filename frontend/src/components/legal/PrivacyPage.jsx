import React from 'react';
import { useTranslation } from 'react-i18next';
import LegalPageLayout from './LegalPageLayout.jsx';

export default function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <LegalPageLayout
      title={t('pagePrivacyTitle')}
      updatedAt="March 14, 2026"
    >
      <p>{t('legalPages.privacy.intro')}</p>
      <h2>{t('legalPages.privacy.regulatoryTitle')}</h2>
      <p>{t('legalPages.privacy.regulatoryBody')}</p>
      <h2>{t('legalPages.privacy.collectTitle')}</h2>
      <p>{t('legalPages.privacy.collectBody')}</p>
      <h2>{t('legalPages.privacy.localFirstTitle')}</h2>
      <p>{t('legalPages.privacy.localFirstBody')}</p>
      <h2>{t('legalPages.privacy.usageTitle')}</h2>
      <ul>
        <li>{t('legalPages.privacy.usageItem1')}</li>
        <li>{t('legalPages.privacy.usageItem2')}</li>
        <li>{t('legalPages.privacy.usageItem3')}</li>
        <li>{t('legalPages.privacy.usageItem4')}</li>
        <li>{t('legalPages.privacy.usageItem5')}</li>
      </ul>
      <h2>{t('legalPages.privacy.noSaleTitle')}</h2>
      <p>{t('legalPages.privacy.noSaleBody')}</p>
      <h2>{t('legalPages.privacy.sharingTitle')}</h2>
      <p>{t('legalPages.privacy.sharingBody')}</p>
      <h2>{t('legalPages.privacy.retentionTitle')}</h2>
      <p>{t('legalPages.privacy.retentionBody')}</p>
      <h2>{t('legalPages.privacy.rightsTitle')}</h2>
      <p>{t('legalPages.privacy.rightsBody')}</p>
      <h2>{t('legalPages.privacy.securityTitle')}</h2>
      <p>{t('legalPages.privacy.securityBody')}</p>
      <h2>{t('legalPages.privacy.cookiesTitle')}</h2>
      <p>{t('legalPages.privacy.cookiesBody')}</p>
      <h2>{t('legalPages.privacy.changesTitle')}</h2>
      <p>{t('legalPages.privacy.changesBody')}</p>
      <h2>{t('legalPages.privacy.contactTitle')}</h2>
      <p>{t('legalPages.privacy.contactBody')}</p>
    </LegalPageLayout>
  );
}
