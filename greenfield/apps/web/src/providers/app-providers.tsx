'use client';



import { AppRuntimeProvider } from './app-runtime-provider';
import { AppServicesProvider } from './app-services-provider';
import { MotionProvider } from './motion-provider';
import { QueryProvider } from './query-provider';
import { ThemeProvider } from './theme-provider';

import type { AppRuntimeConfig } from '@/lib/config/app-runtime-config';
import type { PropsWithChildren } from 'react';

export interface AppProvidersProps extends PropsWithChildren {
  runtimeConfig: AppRuntimeConfig;
}

export function AppProviders({ children, runtimeConfig }: AppProvidersProps) {
  return (
    <AppRuntimeProvider runtimeConfig={runtimeConfig}>
      <AppServicesProvider runtimeConfig={runtimeConfig}>
        <ThemeProvider
          defaultMotionMode={runtimeConfig.appearance.defaultMotionMode}
          defaultThemeMode={runtimeConfig.appearance.defaultThemeMode}
        >
          <MotionProvider>
            <QueryProvider>{children}</QueryProvider>
          </MotionProvider>
        </ThemeProvider>
      </AppServicesProvider>
    </AppRuntimeProvider>
  );
}
