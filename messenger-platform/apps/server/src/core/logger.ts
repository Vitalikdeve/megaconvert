import type { AppEnv } from "../config/env";

export const createLoggerOptions = (env: AppEnv) => ({
  level: env.NODE_ENV === "development" ? "debug" : env.LOG_LEVEL,
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard"
          }
        }
      : undefined
});
