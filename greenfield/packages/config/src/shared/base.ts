import path from 'node:path';

import dotenv from 'dotenv';
import { z } from 'zod';

export const runtimeEnvironmentSchema = z.enum([
  'development',
  'production',
  'staging',
  'test',
]);

export const logLevelSchema = z.enum([
  'debug',
  'error',
  'fatal',
  'info',
  'silent',
  'trace',
  'warn',
]);

export const hostSchema = z.string().min(1).default('0.0.0.0');

export const portSchema = z.coerce.number().int().min(1).max(65535);

export const positiveIntegerSchema = z.coerce.number().int().positive();

export const nonNegativeIntegerSchema = z.coerce.number().int().min(0);

export const booleanStringSchema = z
  .union([z.boolean(), z.string().trim().min(1)])
  .transform((value) => {
    if (typeof value === 'boolean') {
      return value;
    }

    const normalizedValue = value.toLowerCase();

    if (['1', 'on', 'true', 'yes'].includes(normalizedValue)) {
      return true;
    }

    if (['0', 'false', 'no', 'off'].includes(normalizedValue)) {
      return false;
    }

    throw new Error(`Invalid boolean value: ${value}`);
  });

export const commaSeparatedStringSchema = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

export const optionalUrlSchema = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? undefined : value))
  .pipe(z.string().url().optional());

export const requiredUrlSchema = z.string().url();

export const requestIdHeaderSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]+$/)
  .default('x-correlation-id');

export const sharedRuntimeSchema = z.object({
  APP_COMMIT_SHA: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .default(null),
  APP_VERSION: z.string().min(1).default('0.1.0'),
  LOG_LEVEL: logLevelSchema.default('info'),
  NODE_ENV: runtimeEnvironmentSchema.default('development'),
});

export type SharedRuntimeEnvironment = z.infer<typeof sharedRuntimeSchema>;

export interface LoadEnvironmentOptions {
  cwd?: string;
}

export function loadDotenvFiles(options?: LoadEnvironmentOptions): void {
  const cwd = options?.cwd ?? process.cwd();
  const defaultNodeEnvironment = process.env.NODE_ENV ?? 'development';

  dotenv.config({
    path: path.join(cwd, '.env'),
    quiet: true,
  });

  dotenv.config({
    override: true,
    path: path.join(cwd, `.env.${defaultNodeEnvironment}`),
    quiet: true,
  });

  dotenv.config({
    override: true,
    path: path.join(cwd, '.env.local'),
    quiet: true,
  });

  dotenv.config({
    override: true,
    path: path.join(cwd, `.env.${defaultNodeEnvironment}.local`),
    quiet: true,
  });
}

export function parseEnvironment<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  options?: LoadEnvironmentOptions,
): z.infer<TSchema> {
  loadDotenvFiles(options);

  return schema.parse(process.env);
}
