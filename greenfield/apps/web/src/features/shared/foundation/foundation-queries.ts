'use client';

import { useQuery } from '@tanstack/react-query';

import { useAppRuntimeConfig } from '@/providers/app-runtime-provider';
import { useAppServiceClients } from '@/providers/app-services-provider';

import { foundationQueryKeys } from './foundation-query-keys';

export function useApiReadinessQuery() {
  const runtimeConfig = useAppRuntimeConfig();
  const { apiSystem } = useAppServiceClients();

  return useQuery({
    queryFn: () => apiSystem.fetchReadiness(),
    queryKey: foundationQueryKeys.apiReadiness(runtimeConfig.services.apiBaseUrl),
  });
}

export function useRealtimeReadinessQuery() {
  const runtimeConfig = useAppRuntimeConfig();
  const { realtimeHealth } = useAppServiceClients();

  return useQuery({
    queryFn: () => realtimeHealth.fetchReadiness(),
    queryKey: foundationQueryKeys.realtimeReadiness(runtimeConfig.services.realtimeBaseUrl),
  });
}

export function useSystemOverviewQuery() {
  const runtimeConfig = useAppRuntimeConfig();
  const { apiSystem } = useAppServiceClients();

  return useQuery({
    queryFn: () => apiSystem.fetchSystemOverview(),
    queryKey: foundationQueryKeys.systemOverview(runtimeConfig.services.apiBaseUrl),
  });
}

export function useWebLivenessQuery() {
  const runtimeConfig = useAppRuntimeConfig();
  const { webHealth } = useAppServiceClients();

  return useQuery({
    queryFn: () => webHealth.fetchLiveness(),
    queryKey: foundationQueryKeys.webLiveness(runtimeConfig.services.appOrigin),
  });
}
