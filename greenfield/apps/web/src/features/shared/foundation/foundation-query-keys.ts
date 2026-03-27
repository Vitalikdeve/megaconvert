export const foundationQueryKeys = {
  apiReadiness: (apiBaseUrl: string) => ['foundation', 'api', 'readiness', apiBaseUrl] as const,
  realtimeReadiness: (realtimeBaseUrl: string) =>
    ['foundation', 'realtime', 'readiness', realtimeBaseUrl] as const,
  systemOverview: (apiBaseUrl: string) =>
    ['foundation', 'api', 'system-overview', apiBaseUrl] as const,
  webLiveness: (appOrigin: string) => ['foundation', 'web', 'liveness', appOrigin] as const,
} as const;
