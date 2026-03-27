import { z } from 'zod';

import { serviceDescriptorSchema } from './health';

export const systemOverviewSchema = z.object({
  modules: z.object({
    auditShell: z.object({
      persistenceEnabled: z.boolean(),
      storage: z.literal('postgres'),
    }),
    authShell: z.object({
      defaultActorKind: z.literal('anonymous'),
      guardAvailable: z.boolean(),
      resolverMode: z.literal('anonymous-shell'),
    }),
    database: z.object({
      migrationsOnBoot: z.boolean(),
      provider: z.literal('drizzle-postgres'),
      seedHooksEnabled: z.boolean(),
    }),
    logging: z.object({
      correlationHeader: z.string().min(1),
      structured: z.literal(true),
        }),
        realtimeShell: z.object({
          mode: z.enum(['log-only', 'redis-pubsub']),
          transport: z.enum(['gateway-shell', 'redis-channel']),
        }),
        redis: z.object({
          configured: z.boolean(),
      keyPrefix: z.string().min(1),
    }),
  }),
  runtime: z.object({
    corsOrigins: z.array(z.string().min(1)),
    environment: serviceDescriptorSchema.shape.environment,
    globalPrefix: z.string().min(1).nullable(),
    publicOrigin: z.string().url(),
  }),
  service: serviceDescriptorSchema,
});

export type SystemOverview = z.infer<typeof systemOverviewSchema>;
