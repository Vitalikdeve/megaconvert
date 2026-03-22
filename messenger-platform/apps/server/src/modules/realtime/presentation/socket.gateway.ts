import {
  callAnswerSchema,
  callEndSchema,
  callIceCandidateSchema,
  callOfferSchema,
  conversationJoinSchema,
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
import type { EditMessageUseCase, ReactToMessageUseCase } from "../../messaging/application/mutate-message.use-case";
import type { SendMessageUseCase } from "../../messaging/application/send-message.use-case";

export const legacyRealtimeEventNames = {
  sendMessage: "send_message",
  receiveMessage: "receive_message"
} as const;

export const registerRealtimeGateway = async (
  app: FastifyInstance,
  dependencies: {
    env: AppEnv;
    sendMessageUseCase: SendMessageUseCase;
    editMessageUseCase: EditMessageUseCase;
    reactToMessageUseCase: ReactToMessageUseCase;
  }
) => {
  const emitToPeerRoom = (targetUserId: string, eventName: string, payload: unknown) => {
    io.to(`user:${targetUserId}`).emit(eventName, payload);
  };

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

  io.on("connection", (socket) => {
    socket.on(legacyRealtimeEventNames.sendMessage, (data: unknown) => {
      io.emit(legacyRealtimeEventNames.receiveMessage, data);
    });

    socket.on(realtimeEventNames.joinConversation, (payload: unknown, acknowledge?: (value: unknown) => void) => {
      try {
        const parsed = conversationJoinSchema.parse(payload);
        socket.join(parsed.conversationId);
        socket.join(`user:${parsed.userId}`);
        socket.data.userId = parsed.userId;
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
      socket.to(parsed.conversationId).emit(realtimeEventNames.typingStart, parsed);
    });

    socket.on(realtimeEventNames.typingStop, (payload: unknown) => {
      const parsed = typingEventSchema.parse(payload);
      socket.to(parsed.conversationId).emit(realtimeEventNames.typingStop, parsed);
    });

    socket.on(realtimeEventNames.messageSend, async (payload: unknown, acknowledge?: (value: unknown) => void) => {
      try {
        const parsed = messageSendCommandSchema.parse(payload);
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

        io.to(parsed.conversationId).emit(realtimeEventNames.messageCreated, createdEvent);
        socket.emit(realtimeEventNames.messageDeliveryStatus, deliveryEvent);
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

        io.to(updated.conversationId).emit(realtimeEventNames.messageEdited, event);
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

          io.to(updated.conversationId).emit(realtimeEventNames.messageReactionUpdated, event);
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

    socket.on(realtimeEventNames.callOffer, (payload: unknown) => {
      const parsed = callOfferSchema.parse(payload);
      emitToPeerRoom(parsed.toUserId, realtimeEventNames.callOffer, parsed);
    });

    socket.on(realtimeEventNames.callAnswer, (payload: unknown) => {
      const parsed = callAnswerSchema.parse(payload);
      emitToPeerRoom(parsed.toUserId, realtimeEventNames.callAnswer, parsed);
    });

    socket.on(realtimeEventNames.callIceCandidate, (payload: unknown) => {
      const parsed = callIceCandidateSchema.parse(payload);
      emitToPeerRoom(parsed.toUserId, realtimeEventNames.callIceCandidate, parsed);
    });

    socket.on(realtimeEventNames.callEnd, (payload: unknown) => {
      const parsed = callEndSchema.parse(payload);
      emitToPeerRoom(parsed.toUserId, realtimeEventNames.callEnd, parsed);
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
