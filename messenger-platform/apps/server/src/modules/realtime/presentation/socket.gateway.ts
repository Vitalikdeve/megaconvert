import {
  callAnswerSchema,
  callEndSchema,
  callIceCandidateSchema,
  callOfferSchema,
  conversationJoinSchema,
  jwtClaimsSchema,
  legacyCallEventNames,
  messageEditCommandSchema,
  messageCreatedEventSchema,
  messageDeliveryStatusEventSchema,
  messageEditedEventSchema,
  messageReactionCommandSchema,
  messageReactionUpdatedEventSchema,
  messageSendCommandSchema,
  realtimeEventNames,
  typingEventSchema
} from "@messenger/shared";
import type { FastifyInstance } from "fastify";
import Redis from "ioredis";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { WebSocket } from "ws";

import type { AppEnv } from "../../../config/env";
import type { PushNotificationService } from "../../notifications/application/push-notification.service";
import type { DistributedRateLimitService } from "../../security/application/distributed-rate-limit.service";
import { CallSignalingService } from "../../calls/application/call-signaling.service";
import type { EditMessageUseCase, ReactToMessageUseCase } from "../../messaging/application/mutate-message.use-case";
import type { SendMessageUseCase } from "../../messaging/application/send-message.use-case";
import type { RealtimeFanoutService } from "../application/realtime-fanout.service";
import type { UserPresenceService } from "../application/user-presence.service";

export const legacyRealtimeEventNames = {
  sendMessage: "send_message",
  receiveMessage: "receive_message",
  typing: "typing",
  userTyping: "user_typing"
} as const;

export const registerRealtimeGateway = async (
  app: FastifyInstance,
  dependencies: {
    env: AppEnv;
    sendMessageUseCase: SendMessageUseCase;
    editMessageUseCase: EditMessageUseCase;
    reactToMessageUseCase: ReactToMessageUseCase;
    rateLimitService: DistributedRateLimitService;
    realtimeFanoutService: RealtimeFanoutService;
    userPresenceService: UserPresenceService;
    pushNotificationService: PushNotificationService;
  }
) => {
  const io = new Server(app.server, {
    path: "/socket.io",
    cors: {
      origin: dependencies.env.CORS_ORIGIN.split(",").map((value) => value.trim()),
      credentials: true
    }
  });

  let pubClient: Redis | undefined;
  let subClient: Redis | undefined;

  if (dependencies.env.REDIS_URL) {
    pubClient = new Redis(dependencies.env.REDIS_URL);
    subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
  }

  const emitFanoutEnvelope = (
    eventName: string,
    room: string,
    payload: unknown
  ) => {
    if (dependencies.realtimeFanoutService.distributed) {
      return dependencies.realtimeFanoutService.publish({
        room,
        eventName,
        payload
      });
    }

    dependencies.realtimeFanoutService.emitLocal(io, {
      room,
      eventName,
      payload
    });

    return Promise.resolve();
  };

  await dependencies.realtimeFanoutService.subscribe((envelope) => {
    dependencies.realtimeFanoutService.emitLocal(io, envelope);
  });

  io.use(async (socket, next) => {
    const rawToken =
      (typeof socket.handshake.auth.token === "string"
        ? socket.handshake.auth.token
        : undefined) ??
      (typeof socket.handshake.headers.authorization === "string"
        ? socket.handshake.headers.authorization
        : undefined);

    if (!rawToken) {
      next(new Error("authentication_required"));
      return;
    }

    try {
      const token = rawToken.replace(/^Bearer\s+/i, "");
      const claims = jwtClaimsSchema.parse(await app.jwt.verify(token));
      socket.data.auth = claims;
      socket.data.userId = claims.userId;
      socket.data.deviceId = claims.deviceId;
      next();
    } catch (error) {
      next(
        new Error(
          error instanceof Error ? error.message : "authentication_failed"
        )
      );
    }
  });

  const callSignalingService = new CallSignalingService(
    io,
    dependencies.userPresenceService,
    dependencies.pushNotificationService
  );

  io.on("connection", (socket) => {
    const auth = socket.data.auth as { userId: string; deviceId: string };
    void dependencies.userPresenceService.markConnected(auth.userId, socket.id);
    socket.join(`user:${auth.userId}`);

    socket.on(legacyRealtimeEventNames.sendMessage, (data: unknown) => {
      io.emit(legacyRealtimeEventNames.receiveMessage, data);
    });

    socket.on(legacyRealtimeEventNames.typing, (data: unknown) => {
      socket.broadcast.emit(legacyRealtimeEventNames.userTyping, data);
    });

    socket.on(realtimeEventNames.joinConversation, (payload: unknown, acknowledge?: (value: unknown) => void) => {
      try {
        const parsed = conversationJoinSchema.parse(payload);
        socket.join(parsed.conversationId);
        socket.join(`user:${auth.userId}`);
        socket.data.userId = auth.userId;
        acknowledge?.({ ok: true });
      } catch (error) {
        acknowledge?.({
          ok: false,
          error: error instanceof Error ? error.message : "invalid_payload"
        });
      }
    });

    socket.on(realtimeEventNames.typingStart, (payload: unknown) => {
      const parsed = typingEventSchema.parse(payload);
      socket.to(parsed.conversationId).emit(realtimeEventNames.typingStart, {
        ...parsed,
        userId: auth.userId,
        deviceId: auth.deviceId
      });
    });

    socket.on(realtimeEventNames.typingStop, (payload: unknown) => {
      const parsed = typingEventSchema.parse(payload);
      socket.to(parsed.conversationId).emit(realtimeEventNames.typingStop, {
        ...parsed,
        userId: auth.userId,
        deviceId: auth.deviceId
      });
    });

    socket.on(realtimeEventNames.messageSend, async (payload: unknown, acknowledge?: (value: unknown) => void) => {
      try {
        const parsed = messageSendCommandSchema.parse(payload);
        const rateLimit = await dependencies.rateLimitService.check(
          `messages:${auth.userId}`,
          {
            limit: dependencies.env.MESSAGE_RATE_LIMIT_MAX,
            windowSeconds: dependencies.env.MESSAGE_RATE_LIMIT_WINDOW_SECONDS
          }
        );

        if (!rateLimit.allowed) {
          acknowledge?.({
            ok: false,
            error: "message_rate_limited",
            resetAt: rateLimit.resetAt
          });
          return;
        }

        const stored = await dependencies.sendMessageUseCase.execute(parsed);
        const createdEvent = messageCreatedEventSchema.parse({
          message: stored
        });
        const deliveryEvent = messageDeliveryStatusEventSchema.parse({
          conversationId: parsed.conversationId,
          clientMessageId: parsed.clientMessageId,
          messageId: stored.id,
          status: stored.deliveryStatus,
          occurredAt: stored.deliveryStatusUpdatedAt
        });

        await emitFanoutEnvelope(
          realtimeEventNames.messageCreated,
          parsed.conversationId,
          createdEvent
        );
        socket.emit(realtimeEventNames.messageDeliveryStatus, deliveryEvent);
        await dependencies.pushNotificationService.notifyUsers(
          parsed.recipientUserIds ?? [],
          {
            title: "New message",
            body: `${parsed.senderUserId} sent an encrypted message.`,
            tag: parsed.conversationId,
            data: {
              conversationId: parsed.conversationId,
              messageId: stored.id
            }
          }
        );
        acknowledge?.({ ok: true, data: stored });
      } catch (error) {
        acknowledge?.({
          ok: false,
          error: error instanceof Error ? error.message : "invalid_payload"
        });
      }
    });

    socket.on(realtimeEventNames.messageEdit, async (payload: unknown, acknowledge?: (value: unknown) => void) => {
      try {
        const parsed = messageEditCommandSchema.parse(payload);
        const updated = await dependencies.editMessageUseCase.executeFromInput(parsed);

        if (!updated) {
          acknowledge?.({
            ok: false,
            error: "message_not_found"
          });
          return;
        }

        const event = messageEditedEventSchema.parse({
          message: updated
        });

        await emitFanoutEnvelope(
          realtimeEventNames.messageEdited,
          updated.conversationId,
          event
        );
        acknowledge?.({
          ok: true,
          data: updated
        });
      } catch (error) {
        acknowledge?.({
          ok: false,
          error: error instanceof Error ? error.message : "invalid_payload"
        });
      }
    });

    socket.on(
      realtimeEventNames.messageReaction,
      async (payload: unknown, acknowledge?: (value: unknown) => void) => {
        try {
          const parsed = messageReactionCommandSchema.parse(payload);
          const updated = await dependencies.reactToMessageUseCase.execute(parsed);

          if (!updated) {
            acknowledge?.({
              ok: false,
              error: "message_not_found"
            });
            return;
          }

          const event = messageReactionUpdatedEventSchema.parse({
            message: updated
          });

          await emitFanoutEnvelope(
            realtimeEventNames.messageReactionUpdated,
            updated.conversationId,
            event
          );
          acknowledge?.({
            ok: true,
            data: updated
          });
        } catch (error) {
          acknowledge?.({
            ok: false,
            error: error instanceof Error ? error.message : "invalid_payload"
          });
        }
      }
    );

    socket.on(realtimeEventNames.callOffer, async (payload: unknown) => {
      const parsed = callOfferSchema.parse(payload);
      await callSignalingService.forwardOffer(parsed);
    });

    socket.on(legacyCallEventNames.callOffer, async (payload: unknown) => {
      const parsed = callOfferSchema.parse(payload);
      await callSignalingService.forwardOffer(parsed);
    });

    socket.on(realtimeEventNames.callAnswer, (payload: unknown) => {
      const parsed = callAnswerSchema.parse(payload);
      callSignalingService.forwardAnswer(parsed);
    });

    socket.on(legacyCallEventNames.callAnswer, (payload: unknown) => {
      const parsed = callAnswerSchema.parse(payload);
      callSignalingService.forwardAnswer(parsed);
    });

    socket.on(realtimeEventNames.callIceCandidate, (payload: unknown) => {
      const parsed = callIceCandidateSchema.parse(payload);
      callSignalingService.forwardIceCandidate(parsed);
    });

    socket.on(legacyCallEventNames.callIceCandidate, (payload: unknown) => {
      const parsed = callIceCandidateSchema.parse(payload);
      callSignalingService.forwardIceCandidate(parsed);
    });

    socket.on(realtimeEventNames.callEnd, (payload: unknown) => {
      const parsed = callEndSchema.parse(payload);
      callSignalingService.forwardEnd(parsed);
    });

    socket.on("disconnect", () => {
      void dependencies.userPresenceService.markDisconnected(socket.id);
    });
  });

  app.get("/ws/health", { websocket: true }, (socket: WebSocket) => {
    socket.send(
      JSON.stringify({
        status: "ok",
        now: new Date().toISOString()
      })
    );

    socket.on("message", (message: Buffer | string) => {
      socket.send(
        JSON.stringify({
          echo: message.toString()
        })
      );
    });
  });

  app.addHook("onClose", async () => {
    io.close();

    if (pubClient) {
      await pubClient.quit();
    }

    if (subClient) {
      await subClient.quit();
    }
  });

  return io;
};
