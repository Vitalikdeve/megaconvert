'use client';

import { createContext, startTransition, useContext, useEffect, useEffectEvent, useMemo, useState } from 'react';


import { useShellPreferencesStore } from '@/features/shared/state/preferences-store';

import type { MotionMode } from '@/features/shared/state/preferences-store';
import type { ResolvedTheme, ThemeMode } from '@megaconvert/design-system';
import type { PropsWithChildren } from 'react';

interface ThemeContextValue {
  motionMode: MotionMode;
  resolvedMotionMode: Exclude<MotionMode, 'system'>;
  resolvedTheme: ResolvedTheme;
  setMotionMode(value: MotionMode): void;
  setThemeMode(value: ThemeMode): void;
  themeMode: ThemeMode;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps extends PropsWithChildren {
  defaultMotionMode: MotionMode;
  defaultThemeMode: ThemeMode;
}

export function ThemeProvider({
  children,
  defaultMotionMode,
  defaultThemeMode,
}: ThemeProviderProps) {
  const motionMode = useShellPreferencesStore((state) => state.motionMode);
  const setMotionMode = useShellPreferencesStore((state) => state.setMotionMode);
  const setThemeMode = useShellPreferencesStore((state) => state.setThemeMode);
  const storedThemeMode = useShellPreferencesStore((state) => state.themeMode);
  const [prefersDark, setPrefersDark] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const themeMode = storedThemeMode || defaultThemeMode;
  const effectiveMotionMode = motionMode || defaultMotionMode;

  const syncPreferences = useEffectEvent(() => {
    const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    setPrefersDark(darkMediaQuery.matches);
    setPrefersReducedMotion(reducedMotionMediaQuery.matches);
  });

  useEffect(() => {
    syncPreferences();

    const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => {
      syncPreferences();
    };

    subscribeToMediaQuery(darkMediaQuery, handleChange);
    subscribeToMediaQuery(reducedMotionMediaQuery, handleChange);

    return () => {
      unsubscribeFromMediaQuery(darkMediaQuery, handleChange);
      unsubscribeFromMediaQuery(reducedMotionMediaQuery, handleChange);
    };
  }, [syncPreferences]);

  const resolvedTheme: ResolvedTheme =
    themeMode === 'system' ? (prefersDark ? 'dark' : 'light') : themeMode;
  const resolvedMotionMode: Exclude<MotionMode, 'system'> =
    effectiveMotionMode === 'system'
      ? prefersReducedMotion
        ? 'reduced'
        : 'full'
      : effectiveMotionMode;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      motionMode: effectiveMotionMode,
      resolvedMotionMode,
      resolvedTheme,
      setMotionMode: (value) => {
        startTransition(() => {
          setMotionMode(value);
        });
      },
      setThemeMode: (value) => {
        startTransition(() => {
          setThemeMode(value);
        });
      },
      themeMode,
    }),
    [effectiveMotionMode, resolvedMotionMode, resolvedTheme, setMotionMode, setThemeMode, themeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreferences(): ThemeContextValue {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error('useThemePreferences must be used within ThemeProvider.');
  }

  return value;
}

function subscribeToMediaQuery(query: MediaQueryList, listener: () => void) {
  if ('addEventListener' in query) {
    query.addEventListener('change', listener);
    return;
  }

  const legacyQuery = query as MediaQueryList & {
    addListener?: (listener: () => void) => void;
  };

  legacyQuery.addListener?.(listener);
}

function unsubscribeFromMediaQuery(query: MediaQueryList, listener: () => void) {
  if ('removeEventListener' in query) {
    query.removeEventListener('change', listener);
    return;
  }

  const legacyQuery = query as MediaQueryList & {
    removeListener?: (listener: () => void) => void;
  };

  legacyQuery.removeListener?.(listener);
}
