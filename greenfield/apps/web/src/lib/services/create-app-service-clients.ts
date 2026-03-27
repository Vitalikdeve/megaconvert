'use client';

import {
  createJsonClient,
  createMessagingClient,
  createMessagingRealtimeClient,
  createSystemClient,
  createUsersClient,
  type JsonClient,
  type MessagingClient,
  type MessagingRealtimeClient,
  type SystemClient,
  type UsersClient,
} from '@megaconvert/client-sdk';
import { livenessReportSchema, readinessReportSchema, type LivenessReport, type ReadinessReport } from '@megaconvert/contracts';

import type { AppRuntimeConfig } from '@/lib/config/app-runtime-config';

export interface RealtimeHealthClient {
  fetchReadiness(): Promise<ReadinessReport>;
}

export interface WebHealthClient {
  fetchLiveness(): Promise<LivenessReport>;
}

export interface AppServiceClients {
  apiSystem: SystemClient;
  messaging: MessagingClient;
  messagingRealtime: MessagingRealtimeClient;
  realtimeHealth: RealtimeHealthClient;
  users: UsersClient;
  webHealth: WebHealthClient;
}

export function createAppServiceClients(runtimeConfig: AppRuntimeConfig): AppServiceClients {
  return {
    apiSystem: createSystemClient({
      baseUrl: runtimeConfig.services.apiBaseUrl,
    }),
    messaging: createMessagingClient({
      baseUrl: runtimeConfig.services.apiBaseUrl,
    }),
    messagingRealtime: createMessagingRealtimeClient({
      url: runtimeConfig.services.realtimeBaseUrl,
      withCredentials: true,
    }),
    realtimeHealth: createRealtimeHealthClient(runtimeConfig.services.realtimeBaseUrl),
    users: createUsersClient({
      baseUrl: runtimeConfig.services.apiBaseUrl,
    }),
    webHealth: createWebHealthClient(runtimeConfig.services.appOrigin),
  };
}

function createRealtimeHealthClient(baseUrl: string): RealtimeHealthClient {
  const client = createRuntimeClient(baseUrl, 8_000);

  return {
    fetchReadiness: () => client.get('/health/ready', { schema: readinessReportSchema }),
  };
}

function createWebHealthClient(appOrigin: string): WebHealthClient {
  const client = createRuntimeClient(appOrigin, 6_000);

  return {
    fetchLiveness: () => client.get('/api/health', { schema: livenessReportSchema }),
  };
}

function createRuntimeClient(baseUrl: string, timeoutMs: number): JsonClient {
  return createJsonClient({
    baseUrl,
    timeoutMs,
  });
}
