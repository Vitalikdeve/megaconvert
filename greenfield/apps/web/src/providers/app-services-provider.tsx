'use client';

import { createContext, useContext, useMemo } from 'react';
import { useEffect } from 'react';

import { createAppServiceClients, type AppServiceClients } from '@/lib/services/create-app-service-clients';

import type { AppRuntimeConfig } from '@/lib/config/app-runtime-config';
import type { PropsWithChildren } from 'react';

const AppServicesContext = createContext<AppServiceClients | null>(null);

export interface AppServicesProviderProps extends PropsWithChildren {
  runtimeConfig: AppRuntimeConfig;
}

export function AppServicesProvider({ children, runtimeConfig }: AppServicesProviderProps) {
  const services = useMemo(() => createAppServiceClients(runtimeConfig), [runtimeConfig]);

  useEffect(() => {
    return () => {
      services.messagingRealtime.disconnect();
    };
  }, [services]);

  return <AppServicesContext.Provider value={services}>{children}</AppServicesContext.Provider>;
}

export function useAppServiceClients(): AppServiceClients {
  const value = useContext(AppServicesContext);

  if (!value) {
    throw new Error('useAppServiceClients must be used within AppServicesProvider.');
  }

  return value;
}
