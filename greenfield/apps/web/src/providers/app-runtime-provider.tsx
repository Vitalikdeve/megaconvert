'use client';

import { createContext, useContext } from 'react';

import type { AppRuntimeConfig } from '@/lib/config/app-runtime-config';
import type { PropsWithChildren } from 'react';


const AppRuntimeContext = createContext<AppRuntimeConfig | null>(null);

export interface AppRuntimeProviderProps extends PropsWithChildren {
  runtimeConfig: AppRuntimeConfig;
}

export function AppRuntimeProvider({ children, runtimeConfig }: AppRuntimeProviderProps) {
  return (
    <AppRuntimeContext.Provider value={runtimeConfig}>{children}</AppRuntimeContext.Provider>
  );
}

export function useAppRuntimeConfig(): AppRuntimeConfig {
  const value = useContext(AppRuntimeContext);

  if (!value) {
    throw new Error('useAppRuntimeConfig must be used within AppRuntimeProvider.');
  }

  return value;
}
