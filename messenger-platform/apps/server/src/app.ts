import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
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
import { createRedisClient } from "./core/redis";
import { AuthService } from "./modules/auth/application/auth.service";
import {
  InMemoryAuthRepository,
  RedisAuthRepository
} from "./modules/auth/infrastructure/redis-auth.repository";
import { registerAuthRoutes } from "./modules/auth/presentation/auth.routes";
import { DeviceBundleService } from "./modules/encryption/application/device-bundle.service";
import {
  InMemoryDeviceBundleRepository,
  RedisDeviceBundleRepository
} from "./modules/encryption/infrastructure/redis-device-bundle.repository";
import { registerEncryptionRoutes } from "./modules/encryption/presentation/encryption.routes";
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
import { PushNotificationService } from "./modules/notifications/application/push-notification.service";
import {
  InMemoryNotificationSubscriptionRepository,
  RedisNotificationSubscriptionRepository
} from "./modules/notifications/infrastructure/redis-notification.repository";
import { registerNotificationRoutes } from "./modules/notifications/presentation/notification.routes";
import { RealtimeFanoutService } from "./modules/realtime/application/realtime-fanout.service";
import {
  InMemoryUserPresenceService,
  RedisUserPresenceService
} from "./modules/realtime/application/user-presence.service";
import { registerRealtimeGateway } from "./modules/realtime/presentation/socket.gateway";
import { DistributedRateLimitService } from "./modules/security/application/distributed-rate-limit.service";
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

  await app.register(jwt, {
    secret: runtimeEnv.JWT_SECRET
  });

  app.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({
        error: "Unauthorized",
        code: "unauthorized"
      });
    }
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

  const operationalRedisClient = runtimeEnv.REDIS_URL
    ? createRedisClient(runtimeEnv.REDIS_URL, "messenger-operations")
    : undefined;
  const authRepository = runtimeEnv.REDIS_URL
    ? new RedisAuthRepository(runtimeEnv.REDIS_URL)
    : new InMemoryAuthRepository();
  const deviceBundleRepository = runtimeEnv.REDIS_URL
    ? new RedisDeviceBundleRepository(runtimeEnv.REDIS_URL)
    : new InMemoryDeviceBundleRepository();
  const notificationSubscriptionRepository = runtimeEnv.REDIS_URL
    ? new RedisNotificationSubscriptionRepository(runtimeEnv.REDIS_URL)
    : new InMemoryNotificationSubscriptionRepository();
  const userPresenceService = runtimeEnv.REDIS_URL
    ? new RedisUserPresenceService(runtimeEnv.REDIS_URL)
    : new InMemoryUserPresenceService();
  const rateLimitService = new DistributedRateLimitService(operationalRedisClient);
  const realtimeFanoutService = new RealtimeFanoutService(runtimeEnv.REDIS_URL);
  const authService = new AuthService(authRepository);
  const deviceBundleService = new DeviceBundleService(deviceBundleRepository);
  const pushNotificationService = new PushNotificationService(
    notificationSubscriptionRepository,
    runtimeEnv,
    (userId) => userPresenceService.isUserOnline(userId)
  );
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

    registerAuthRoutes(app, {
      authService,
      env: runtimeEnv,
      rateLimitService
    });
    registerMessageRoutes(app, {
      env: runtimeEnv,
      sendMessageUseCase,
      listMessagesUseCase,
      editMessageUseCase,
      reactToMessageUseCase,
      rateLimitService,
      realtimeFanoutService,
      pushNotificationService
    });
    registerEncryptionRoutes(app, {
      deviceBundleService
    });
    registerNotificationRoutes(app, {
      pushNotificationService
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
      reactToMessageUseCase,
      rateLimitService,
      realtimeFanoutService,
      userPresenceService,
      pushNotificationService
    });
  }

  app.addHook("onClose", async () => {
    if (messageRepository instanceof RedisMessageRepository) {
      await messageRepository.close();
    }

    if (authRepository instanceof RedisAuthRepository) {
      await authRepository.close();
    }

    if (deviceBundleRepository instanceof RedisDeviceBundleRepository) {
      await deviceBundleRepository.close();
    }

    if (
      notificationSubscriptionRepository instanceof
      RedisNotificationSubscriptionRepository
    ) {
      await notificationSubscriptionRepository.close();
    }

    if (userPresenceService instanceof RedisUserPresenceService) {
      await userPresenceService.close();
    }

    await realtimeFanoutService.close();

    if (operationalRedisClient && operationalRedisClient.status !== "end") {
      await operationalRedisClient.quit();
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
