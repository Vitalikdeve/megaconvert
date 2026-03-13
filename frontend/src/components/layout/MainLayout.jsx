import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Footer from './Footer.jsx';
import Header from './Header.jsx';
import { normalizeLang } from '../../i18n.js';

export default function MainLayout({ children }) {
  const { i18n } = useTranslation();

  useEffect(() => {
    const currentLang = normalizeLang(i18n.language || 'en');
    const isRtl = currentLang.startsWith('ar');

    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;
  }, [i18n.language]);

  return (
    <div className="flex min-h-screen flex-col bg-[#030303] text-white">
      <Header />
      <main className="flex-1 pt-16">
        {children}
      </main>
      <Footer />
    </div>
  );
}
