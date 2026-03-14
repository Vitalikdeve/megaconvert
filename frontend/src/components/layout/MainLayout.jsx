import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ComplianceGuard from '../legal/ComplianceGuard.jsx';
import Footer from './Footer.jsx';
import Header from './Header.jsx';
import { normalizeLang } from '../../i18n.js';
import { getSupportedLanguage } from '../../lib/languages.js';

export default function MainLayout({ children }) {
  const { i18n } = useTranslation();

  useEffect(() => {
    const currentLang = normalizeLang(i18n.language || 'en');
    const currentLanguage = getSupportedLanguage(currentLang);
    const isRtl = currentLanguage.dir === 'rtl';

    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;
  }, [i18n.language]);

  return (
    <ComplianceGuard>
      <div className="flex min-h-screen flex-col bg-[#030303] text-white">
        <Header />
        <main className="flex-1 pt-16">
          {children}
        </main>
        <Footer />
      </div>
    </ComplianceGuard>
  );
}
