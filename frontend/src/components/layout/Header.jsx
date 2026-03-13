import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Check, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useAuthModal } from '../../features/auth/components/AuthModalProvider.jsx';
import GlassPanel from '../ui/GlassPanel.jsx';

const NAV_ITEMS = [
  {
    labelKey: 'headerTools',
    to: '/tools',
    match: (pathname) => pathname === '/tools' || pathname.startsWith('/tools/'),
  },
  {
    labelKey: 'headerApi',
    to: '/api-overview',
    match: (pathname) => pathname === '/api-overview',
  },
  {
    labelKey: 'headerPricing',
    to: '/pricing',
    match: (pathname) => pathname === '/pricing',
  },
];

const LANGUAGE_OPTIONS = [
  { code: 'en', labelKey: 'headerLanguageEnglish' },
  { code: 'ru', labelKey: 'headerLanguageRussian' },
];

export default function Header() {
  const location = useLocation();
  const { openAuthModal } = useAuthModal();
  const { t, i18n } = useTranslation();
  const menuRef = useRef(null);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const currentLanguage = String(i18n.resolvedLanguage || i18n.language || 'en')
    .trim()
    .toLowerCase()
    .startsWith('ru')
    ? 'ru'
    : 'en';

  useEffect(() => {
    setIsLanguageMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isLanguageMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setIsLanguageMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isLanguageMenuOpen]);

  return (
    <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-white/[0.05] bg-[#030303]/70 px-6 backdrop-blur-2xl">
      <div className="flex min-w-0 items-center">
        <Link
          to="/"
          className="text-sm font-medium tracking-[0.02em] text-white/90 transition-opacity duration-300 hover:opacity-90"
        >
          <span className="bg-gradient-to-r from-white via-white/90 to-cyan-200 bg-clip-text text-transparent drop-shadow-[0_0_14px_rgba(255,255,255,0.16)]">
            MegaConvert
          </span>
        </Link>
      </div>

      <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-3 md:flex">
        {NAV_ITEMS.map((item) => {
          const isActive = item.match(location.pathname);
          return (
            <Link
              key={item.labelKey}
              to={item.to}
              className={[
                'min-w-[6.5rem] truncate px-2 text-center text-sm transition-colors',
                isActive ? 'text-white' : 'text-white/60 hover:text-white',
              ].join(' ')}
            >
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 sm:gap-3">
        <div
          ref={menuRef}
          className="relative"
        >
          <button
            type="button"
            onClick={() => setIsLanguageMenuOpen((current) => !current)}
            className="inline-flex h-10 min-w-[3rem] items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 text-white/72 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white sm:min-w-[9rem] sm:justify-between"
          >
            <span className="inline-flex items-center gap-2 truncate">
              <Globe className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              <span className="hidden truncate text-sm sm:inline">
                {currentLanguage === 'ru' ? t('headerLanguageRussian') : t('headerLanguageEnglish')}
              </span>
            </span>
            <span className="hidden text-[10px] uppercase tracking-[0.22em] text-white/34 lg:inline">
              {t('headerLanguage')}
            </span>
          </button>

          <AnimatePresence>
            {isLanguageMenuOpen ? (
              <GlassPanel
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="absolute right-0 top-[calc(100%+0.75rem)] z-10 w-[210px] rounded-[28px] border-white/[0.1] bg-[#0a0a0a]/92 p-2 shadow-[0_34px_120px_-48px_rgba(0,0,0,0.92)]"
              >
                {LANGUAGE_OPTIONS.map((option) => {
                  const isSelected = option.code === currentLanguage;

                  return (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => {
                        void i18n.changeLanguage(option.code);
                        setIsLanguageMenuOpen(false);
                      }}
                      className={[
                        'flex h-12 w-full items-center justify-between rounded-[20px] px-4 text-sm transition-colors duration-300',
                        isSelected
                          ? 'bg-white/[0.08] text-white'
                          : 'text-white/64 hover:bg-white/[0.05] hover:text-white',
                      ].join(' ')}
                    >
                      <span className="truncate">{t(option.labelKey)}</span>
                      {isSelected ? <Check className="h-4 w-4 shrink-0" strokeWidth={1.8} /> : null}
                    </button>
                  );
                })}
              </GlassPanel>
            ) : null}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={() => openAuthModal('login')}
          className="inline-flex min-w-[7rem] items-center justify-center rounded-full bg-white px-4 py-1.5 text-sm font-medium text-black transition-transform hover:scale-105 hover:bg-white/90"
        >
          {t('headerSignIn')}
        </button>
      </div>
    </header>
  );
}
