import {
  editMessageInputSchema,
  messageCreatedEventSchema,
  messageEditedEventSchema,
  messageReactionUpdatedEventSchema,
  reactionInputSchema,
  sendMessageInputSchema
} from "@messenger/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { DistributedRateLimitService } from "../../security/application/distributed-rate-limit.service";
import type { PushNotificationService } from "../../notifications/application/push-notification.service";
import type { AppEnv } from "../../../config/env";
import type { EditMessageUseCase, ReactToMessageUseCase } from "../application/mutate-message.use-case";
import type { ListMessagesUseCase } from "../application/list-messages.use-case";
import type { SendMessageUseCase } from "../application/send-message.use-case";
import type { RealtimeFanoutService } from "../../realtime/application/realtime-fanout.service";

const conversationParamsSchema = z.object({
  conversationId: z.string().min(1)
});

const messageParamsSchema = z.object({
  messageId: z.string().min(1)
});

export const registerMessageRoutes = (
  app: FastifyInstance,
  dependencies: {
    env: AppEnv;
    sendMessageUseCase: SendMessageUseCase;
    listMessagesUseCase: ListMessagesUseCase;
    editMessageUseCase: EditMessageUseCase;
    reactToMessageUseCase: ReactToMessageUseCase;
    rateLimitService: DistributedRateLimitService;
    realtimeFanoutService: RealtimeFanoutService;
    pushNotificationService: PushNotificationService;
  }
) => {
  app.get(
    "/v1/conversations/:conversationId/messages",
    {
      preHandler: [app.authenticate]
    },
    async (request) => {
    const params = conversationParamsSchema.parse(request.params);
    const data = await dependencies.listMessagesUseCase.execute(params.conversationId);

    return {
      data
    };
    }
  );

  app.post(
    "/v1/messages",
    {
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
    const body = sendMessageInputSchema.parse(request.body);
    const user = request.user as { userId: string; deviceId: string };
    const rateLimit = await dependencies.rateLimitService.check(
      `messages:${user.userId}`,
      {
        limit: dependencies.env.MESSAGE_RATE_LIMIT_MAX,
        windowSeconds: dependencies.env.MESSAGE_RATE_LIMIT_WINDOW_SECONDS
      }
    );

    if (!rateLimit.allowed) {
      reply.code(429);
      return {
        error: "Message rate limit exceeded.",
        resetAt: rateLimit.resetAt
      };
    }

    const message = await dependencies.sendMessageUseCase.execute(body);
    const event = messageCreatedEventSchema.parse({
      message
    });

    await dependencies.realtimeFanoutService.publish({
      room: body.conversationId,
      eventName: "message:created",
      payload: event
    });
    await dependencies.pushNotificationService.notifyUsers(
      body.recipientUserIds ?? [],
      {
        title: "New message",
        body: `${body.senderUserId} sent an encrypted message.`,
        tag: body.conversationId,
        data: {
          conversationId: body.conversationId,
          messageId: message.id
        }
      }
    );
    reply.code(201);

    return {
      data: message
    };
    }
  );

  app.patch(
    "/v1/messages/:messageId",
    {
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
    const params = messageParamsSchema.parse(request.params);
    const body = editMessageInputSchema.omit({ messageId: true }).parse(request.body);

    const edited = await dependencies.editMessageUseCase.execute(
      params.messageId,
      body.editorUserId,
      body.envelope
    );

    if (!edited) {
      reply.code(404);
      return {
        error: "message_not_found"
      };
    }

    await dependencies.realtimeFanoutService.publish({
      room: edited.conversationId,
      eventName: "message:edited",
      payload: messageEditedEventSchema.parse({
        message: edited
      })
    });

    return {
      data: edited
    };
    }
  );

  app.post(
    "/v1/messages/:messageId/reactions",
    {
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
    const params = messageParamsSchema.parse(request.params);
    const body = reactionInputSchema.omit({ messageId: true }).parse(request.body);

    const updated = await dependencies.reactToMessageUseCase.execute({
      ...body,
      messageId: params.messageId
    });

    if (!updated) {
      reply.code(404);
      return {
        error: "message_not_found"
      };
    }

    await dependencies.realtimeFanoutService.publish({
      room: updated.conversationId,
      eventName: "message:reaction-updated",
      payload: messageReactionUpdatedEventSchema.parse({
        message: updated
      })
    });

    return {
      data: updated
    };
    }
  );
};
