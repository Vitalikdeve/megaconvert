import type { ServiceDescriptor } from '@megaconvert/contracts';

export interface SystemOverviewResponse {
  modules: {
    auditShell: {
      persistenceEnabled: boolean;
      storage: 'postgres';
    };
    authShell: {
      defaultActorKind: 'anonymous';
      guardAvailable: boolean;
      resolverMode: 'anonymous-shell';
    };
    database: {
      migrationsOnBoot: boolean;
      provider: 'drizzle-postgres';
      seedHooksEnabled: boolean;
    };
    logging: {
      correlationHeader: string;
      structured: true;
    };
    realtimeShell: {
      mode: 'log-only' | 'redis-pubsub';
      transport: 'gateway-shell' | 'redis-channel';
    };
    redis: {
      configured: boolean;
      keyPrefix: string;
    };
  };
  runtime: {
    corsOrigins: readonly string[];
    environment: ServiceDescriptor['environment'];
    globalPrefix: string | null;
    publicOrigin: string;
  };
  service: ServiceDescriptor;
}
