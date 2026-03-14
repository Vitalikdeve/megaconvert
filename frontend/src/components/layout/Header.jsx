import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Check, Globe, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import logoImage from '../../assets/logo.jpg';
import { useAuthModal } from '../../features/auth/components/AuthModalProvider.jsx';
import { normalizeLang } from '../../i18n.js';
import { getSupportedLanguage, SUPPORTED_LANGUAGES } from '../../lib/languages.js';
import GlassPanel from '../ui/GlassPanel.jsx';

const NAV_ITEMS = [
  {
    labelKey: 'headerTools',
    to: '/tools',
    match: (pathname) => pathname === '/tools' || pathname.startsWith('/tools/'),
  },
  {
    labelKey: 'headerApi',
    to: '/developers',
    match: (pathname) => pathname === '/developers' || pathname === '/api-dashboard' || pathname === '/api-overview',
  },
  {
    labelKey: 'headerPricing',
    fallback: 'Pricing',
    to: '/pricing',
    match: (pathname) => pathname === '/pricing',
  },
  {
    labelKey: 'headerEditors',
    fallback: 'Editors',
    to: '/editors',
    match: (pathname) => pathname === '/editors' || pathname.startsWith('/editors/'),
  },
  {
    labelKey: 'headerBlog',
    fallback: 'Blog',
    to: '/blog',
    match: (pathname) => pathname === '/blog' || pathname.startsWith('/blog/'),
  },
];

export default function Header() {
  const location = useLocation();
  const { openAuthModal } = useAuthModal();
  const { t, i18n } = useTranslation();
  const menuRef = useRef(null);
  const [languageMenuPath, setLanguageMenuPath] = useState(null);
  const isLanguageMenuOpen = languageMenuPath === location.pathname;
  const currentLanguage = normalizeLang(i18n.resolvedLanguage || i18n.language || 'en');
  const currentLanguageOption = getSupportedLanguage(currentLanguage);

  useEffect(() => {
    if (!isLanguageMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setLanguageMenuPath(null);
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
          className="flex items-center gap-2"
        >
          <img
            src={logoImage}
            alt="MegaConvert Logo"
            className="h-10 w-auto object-contain mix-blend-screen transition-opacity hover:opacity-90 sm:h-12"
          />
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
              {t(item.labelKey, item.fallback)}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          to={{ pathname: '/', hash: '#meet-launcher' }}
          className="inline-flex h-10 min-w-[3rem] items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 text-white/72 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white sm:min-w-[7.5rem]"
        >
          <Video className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          <span className="hidden text-sm sm:inline">
            {t('headerMeet', 'Meet')}
          </span>
        </Link>

        <div
          ref={menuRef}
          className="relative"
        >
          <button
            type="button"
            onClick={() => setLanguageMenuPath((current) => (
              current === location.pathname ? null : location.pathname
            ))}
            aria-expanded={isLanguageMenuOpen}
            aria-haspopup="menu"
            className="inline-flex h-10 min-w-[3rem] items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 text-white/72 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white sm:min-w-[10rem] sm:justify-between lg:min-w-[11.25rem]"
          >
            <span className="inline-flex items-center gap-2 truncate">
              <Globe className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              <span className="hidden truncate text-sm sm:inline">
                {currentLanguageOption.native}
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
                className="absolute right-0 top-[calc(100%+0.75rem)] z-10 max-h-[min(70vh,32rem)] w-[220px] overflow-y-auto rounded-[28px] border-white/[0.1] bg-[#0a0a0a]/92 p-2 shadow-[0_34px_120px_-48px_rgba(0,0,0,0.92)]"
              >
                {SUPPORTED_LANGUAGES.map((option) => {
                  const isSelected = option.code === currentLanguage;

                  return (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => {
                        void i18n.changeLanguage(option.code);
                        setLanguageMenuPath(null);
                      }}
                      className={[
                        'flex h-12 w-full items-center justify-between rounded-[20px] px-4 text-sm transition-colors duration-300',
                        isSelected
                          ? 'bg-white/[0.08] text-white'
                          : 'text-white/64 hover:bg-white/[0.05] hover:text-white',
                      ].join(' ')}
                    >
                      <span className="truncate">{option.native}</span>
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
          className="inline-flex min-w-[7.75rem] items-center justify-center whitespace-nowrap rounded-full border border-white/65 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(226,232,240,0.94))] px-6 py-2 text-sm font-semibold tracking-[0.01em] text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_18px_44px_rgba(255,255,255,0.18)] transition-all duration-300 hover:scale-105 hover:border-white hover:bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(241,245,249,0.96))] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.22),0_20px_52px_rgba(255,255,255,0.24)]"
        >
          {t('headerSignIn')}
        </button>
      </div>
    </header>
  );
}
