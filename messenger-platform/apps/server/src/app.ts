import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import type { Server as SocketServer } from "socket.io";

import {
  loadEnv,
  supportsApiService,
  supportsRealtimeService
} from "./config/env";
import { createLoggerOptions } from "./core/logger";
import { registerHealthRoutes } from "./modules/health/presentation/health.routes";
import { ListMessagesUseCase } from "./modules/messaging/application/list-messages.use-case";
import {
  EditMessageUseCase,
  ReactToMessageUseCase
} from "./modules/messaging/application/mutate-message.use-case";
import { SendMessageUseCase } from "./modules/messaging/application/send-message.use-case";
import { InMemoryMessageRepository } from "./modules/messaging/infra/in-memory-message.repository";
import { RedisMessageRepository } from "./modules/messaging/infra/redis-message.repository";
import { registerMessageRoutes } from "./modules/messaging/presentation/message.routes";
import { registerRealtimeGateway } from "./modules/realtime/presentation/socket.gateway";
import { S3MultipartUploadService } from "./modules/uploads/application/s3-multipart-upload.service";
import { registerUploadRoutes } from "./modules/uploads/presentation/upload.routes";

export const buildApp = async (
  options: {
    serverRole?: ReturnType<typeof loadEnv>["SERVER_ROLE"];
  } = {}
) => {
  const env = loadEnv();
  const runtimeEnv = {
    ...env,
    SERVER_ROLE: options.serverRole ?? env.SERVER_ROLE
  };
  const app = Fastify({
    logger: createLoggerOptions(runtimeEnv),
    trustProxy: runtimeEnv.TRUST_PROXY
  });

  await app.register(cors, {
    origin: runtimeEnv.CORS_ORIGIN.split(",").map((value) => value.trim()),
    credentials: true
  });

  await app.register(helmet, {
    global: true
  });

  await app.register(rateLimit, {
    max: runtimeEnv.RATE_LIMIT_MAX,
    timeWindow: runtimeEnv.RATE_LIMIT_TIME_WINDOW
  });

  const messageRepository = runtimeEnv.REDIS_URL
    ? new RedisMessageRepository(runtimeEnv.REDIS_URL)
    : new InMemoryMessageRepository();

  if (!runtimeEnv.REDIS_URL && runtimeEnv.SERVER_ROLE !== "all") {
    app.log.warn(
      "REDIS_URL is not configured while SERVER_ROLE is split; message history will not be shared across containers."
    );
  }

  const sendMessageUseCase = new SendMessageUseCase(messageRepository);
  const listMessagesUseCase = new ListMessagesUseCase(messageRepository);
  const editMessageUseCase = new EditMessageUseCase(messageRepository);
  const reactToMessageUseCase = new ReactToMessageUseCase(messageRepository);
  const multipartUploadService = new S3MultipartUploadService(runtimeEnv);

  registerHealthRoutes(app, runtimeEnv);

  if (supportsApiService(runtimeEnv.SERVER_ROLE)) {
    await app.register(multipart, {
      limits: {
        fileSize: 10 * 1024 * 1024 * 1024
      }
    });

    registerMessageRoutes(app, {
      sendMessageUseCase,
      listMessagesUseCase,
      editMessageUseCase,
      reactToMessageUseCase
    });
    registerUploadRoutes(app, {
      multipartUploadService
    });
  }

  let websocketServer: SocketServer | undefined;

  if (supportsRealtimeService(runtimeEnv.SERVER_ROLE)) {
    await app.register(websocket);

    websocketServer = await registerRealtimeGateway(app, {
      env: runtimeEnv,
      sendMessageUseCase,
      editMessageUseCase,
      reactToMessageUseCase
    });
  }

  app.addHook("onClose", async () => {
    if (messageRepository instanceof RedisMessageRepository) {
      await messageRepository.close();
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    reply.status(500).send({
      error: error instanceof Error ? error.message : "Unexpected server error.",
      code: "internal_server_error"
    });
  });

  return {
    app,
    websocketServer
  };
};
