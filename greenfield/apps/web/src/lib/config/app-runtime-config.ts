import { getPublicEnvironment } from '@/lib/env/public-env';

import type { ThemeMode } from '@megaconvert/design-system';

export interface AppRuntimeConfig {
  appearance: {
    defaultMotionMode: 'system';
    defaultThemeMode: ThemeMode;
  };
  branding: {
    appName: string;
    appTagline: string;
    shortName: string;
  };
  environment: {
    commitSha: string | null;
    nodeEnvironment: 'development' | 'production' | 'staging' | 'test';
    version: string;
  };
  services: {
    apiBaseUrl: string;
    appOrigin: string;
    realtimeBaseUrl: string;
  };
}

export function getAppRuntimeConfig(): AppRuntimeConfig {
  const environment = getPublicEnvironment();

  return {
    appearance: {
      defaultMotionMode: 'system',
      defaultThemeMode: 'system',
    },
    branding: {
      appName: 'Megaconvert Messenger',
      appTagline: 'Signal-first messaging, meetings, and workspace orchestration.',
      shortName: 'Megaconvert',
    },
    environment: {
      commitSha: environment.APP_COMMIT_SHA,
      nodeEnvironment: environment.NODE_ENV,
      version: environment.APP_VERSION,
    },
    services: {
      apiBaseUrl: environment.NEXT_PUBLIC_API_BASE_URL,
      appOrigin: environment.NEXT_PUBLIC_APP_ORIGIN,
      realtimeBaseUrl: environment.NEXT_PUBLIC_REALTIME_BASE_URL,
    },
  };
}
