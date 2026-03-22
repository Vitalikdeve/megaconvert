import type { FastifyInstance } from "fastify";

import { buildApp } from "./app";
import {
  loadEnv,
  supportsApiService,
  supportsRealtimeService
} from "./config/env";

interface RunningService {
  app: FastifyInstance;
  name: "api" | "realtime";
  port: number;
}

const closeServices = async (services: RunningService[]) => {
  await Promise.allSettled(
    services.map(async ({ app }) => {
      await app.close();
    })
  );
};

const registerShutdownHooks = (services: RunningService[]) => {
  const shutdown = async () => {
    await closeServices(services);
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown();
  });

  process.once("SIGTERM", () => {
    void shutdown();
  });
};

const startService = async (
  host: string,
  port: number,
  role: RunningService["name"]
): Promise<RunningService> => {
  const { app } = await buildApp({
    serverRole: role
  });

  await app.listen({
    host,
    port
  });

  app.log.info({ service: role, port }, `${role} service listening`);

  return {
    app,
    name: role,
    port
  };
};

const start = async () => {
  const env = loadEnv();
  const services: RunningService[] = [];

  try {
    if (supportsApiService(env.SERVER_ROLE)) {
      services.push(await startService(env.HOST, env.API_PORT, "api"));
    }

    if (supportsRealtimeService(env.SERVER_ROLE)) {
      services.push(await startService(env.HOST, env.REALTIME_PORT, "realtime"));
    }

    registerShutdownHooks(services);
  } catch (error) {
    await closeServices(services);
    console.error(error);
    process.exit(1);
  }
};

void start();
