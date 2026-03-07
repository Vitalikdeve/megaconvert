import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'mc_theme_v2';

const normalizeTheme = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return 'system';
};

const getSystemTheme = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const readStoredTheme = () => {
  if (typeof window === 'undefined') return 'system';
  try {
    return normalizeTheme(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'system';
  }
};

const applyThemeClass = (resolvedTheme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark', 'theme-light', 'theme-dark');
  const normalized = resolvedTheme === 'light' ? 'light' : 'dark';
  root.classList.add(normalized, `theme-${normalized}`);
  root.setAttribute('data-theme', normalized);
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(readStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState(() => (theme === 'system' ? getSystemTheme() : theme));

  useEffect(() => {
    const nextResolved = theme === 'system' ? getSystemTheme() : theme;
    setResolvedTheme(nextResolved);
    applyThemeClass(nextResolved);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // ignore localStorage errors
      }
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (theme !== 'system') return;
      const nextResolved = media.matches ? 'dark' : 'light';
      setResolvedTheme(nextResolved);
      applyThemeClass(nextResolved);
    };
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, [theme]);

  const setTheme = (value) => {
    setThemeState(normalizeTheme(value));
  };

  const toggleTheme = () => {
    const active = resolvedTheme === 'dark' ? 'dark' : 'light';
    setThemeState(active === 'dark' ? 'light' : 'dark');
  };

  const value = useMemo(() => ({
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme
  }), [theme, resolvedTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
