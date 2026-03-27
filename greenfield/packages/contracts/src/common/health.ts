import { z } from 'zod';

export const runtimeEnvironmentSchema = z.enum([
  'development',
  'production',
  'staging',
  'test',
]);

export const serviceDescriptorSchema = z.object({
  commitSha: z.string().min(7).max(40).nullable(),
  displayName: z.string().min(1),
  environment: runtimeEnvironmentSchema,
  name: z.string().min(1),
  startedAt: z.string().datetime(),
  version: z.string().min(1),
});

export const dependencyHealthStatusSchema = z.enum(['down', 'not-configured', 'up']);

export const dependencyKindSchema = z.enum([
  'cache',
  'database',
  'mail',
  'media',
  'other',
  'search',
  'storage',
]);

export const dependencyHealthSchema = z.object({
  detail: z.string().min(1).nullable(),
  kind: dependencyKindSchema,
  latencyMs: z.number().finite().nonnegative().nullable(),
  name: z.string().min(1),
  status: dependencyHealthStatusSchema,
});

export const livenessReportSchema = z.object({
  service: serviceDescriptorSchema,
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
});

export const readinessStatusSchema = z.enum(['degraded', 'down', 'ok']);

export const readinessReportSchema = z.object({
  dependencies: z.array(dependencyHealthSchema),
  service: serviceDescriptorSchema,
  status: readinessStatusSchema,
  timestamp: z.string().datetime(),
});

export type DependencyHealth = z.infer<typeof dependencyHealthSchema>;
export type DependencyHealthStatus = z.infer<typeof dependencyHealthStatusSchema>;
export type LivenessReport = z.infer<typeof livenessReportSchema>;
export type ReadinessReport = z.infer<typeof readinessReportSchema>;
export type RuntimeEnvironment = z.infer<typeof runtimeEnvironmentSchema>;
export type ServiceDescriptor = z.infer<typeof serviceDescriptorSchema>;
