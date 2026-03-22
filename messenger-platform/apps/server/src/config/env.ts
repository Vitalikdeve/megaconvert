import { z } from "zod";

const booleanFromString = z
  .string()
  .optional()
  .transform((value) => value === "true");

export const serverRoleSchema = z.enum(["all", "api", "realtime"]);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SERVER_ROLE: serverRoleSchema.default("all"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().optional(),
  API_PORT: z.coerce.number().int().positive().optional(),
  REALTIME_PORT: z.coerce.number().int().positive().optional(),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  TRUST_PROXY: booleanFromString.default(false),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_TIME_WINDOW: z.string().default("1 minute"),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().default("messenger-media"),
  S3_FORCE_PATH_STYLE: booleanFromString.default(true)
});

export interface AppEnv extends z.infer<typeof envSchema> {
  API_PORT: number;
  REALTIME_PORT: number;
}

const resolveApiPort = (env: z.infer<typeof envSchema>) => env.API_PORT ?? env.PORT ?? 4000;

const resolveRealtimePort = (env: z.infer<typeof envSchema>) =>
  env.REALTIME_PORT ?? (env.SERVER_ROLE === "realtime" ? env.PORT : undefined) ?? 4001;

export const loadEnv = (input: NodeJS.ProcessEnv = process.env): AppEnv => {
  const env = envSchema.parse(input);

  return {
    ...env,
    API_PORT: resolveApiPort(env),
    REALTIME_PORT: resolveRealtimePort(env)
  };
};

export const supportsApiService = (role: AppEnv["SERVER_ROLE"]) =>
  role === "all" || role === "api";

export const supportsRealtimeService = (role: AppEnv["SERVER_ROLE"]) =>
  role === "all" || role === "realtime";
