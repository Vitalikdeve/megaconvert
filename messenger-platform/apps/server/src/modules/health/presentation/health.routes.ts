import type { FastifyInstance } from "fastify";

import type { AppEnv } from "../../../config/env";
import {
  supportsApiService,
  supportsRealtimeService
} from "../../../config/env";

export const registerHealthRoutes = (app: FastifyInstance, env: AppEnv) => {
  app.get("/health", async () => ({
    status: "ok",
    service: "messenger-server",
    role: env.SERVER_ROLE,
    now: new Date().toISOString(),
    features: {
      api: supportsApiService(env.SERVER_ROLE),
      realtime: supportsRealtimeService(env.SERVER_ROLE),
      uploadsMultipart: supportsApiService(env.SERVER_ROLE),
      blindRelay: true
    },
    dependencies: {
      postgresConfigured: Boolean(env.DATABASE_URL),
      redisConfigured: Boolean(env.REDIS_URL),
      s3Configured: Boolean(
        env.S3_ENDPOINT && env.S3_ACCESS_KEY && env.S3_SECRET_KEY && env.S3_BUCKET
      )
    }
  }));
};
