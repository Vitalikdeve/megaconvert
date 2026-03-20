import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function Footer() {
  const { t } = useTranslation();
  const footerLinks = [
    { label: t('navBlog', 'Blog'), to: '/blog' },
    { label: 'Privacy Policy', to: '/legal/privacy' },
    { label: 'Terms of Service', to: '/legal/terms' },
    { label: 'Law Enforcement Guide', to: '/legal/law-enforcement' },
    { label: 'Transparency Report', to: '/legal/transparency' },
    { label: t('navSecurity'), to: '/security' },
    { label: t('navCookies'), to: '/cookies' },
  ];

  return (
    <footer className="border-t border-white/[0.05] bg-[#030303]">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-8 text-sm text-white/42 md:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)] md:items-start">
        <div className="space-y-3 text-center md:text-left">
          <div className="text-white/78">{t('footerCopyright', { year: 2026 })}</div>
          <p className="max-w-md text-sm leading-6 text-white/36">
            {t('footerTagline')}
          </p>
        </div>

        <nav
          aria-label={t('navLegal')}
          className="grid grid-cols-2 gap-x-6 gap-y-3 text-center md:grid-cols-3 md:text-left"
        >
          {footerLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-white/52 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
