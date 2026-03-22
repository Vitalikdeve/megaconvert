import {
  editMessageInputSchema,
  reactionInputSchema,
  sendMessageInputSchema
} from "@messenger/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { EditMessageUseCase, ReactToMessageUseCase } from "../application/mutate-message.use-case";
import type { ListMessagesUseCase } from "../application/list-messages.use-case";
import type { SendMessageUseCase } from "../application/send-message.use-case";

const conversationParamsSchema = z.object({
  conversationId: z.string().min(1)
});

const messageParamsSchema = z.object({
  messageId: z.string().min(1)
});

export const registerMessageRoutes = (
  app: FastifyInstance,
  dependencies: {
    sendMessageUseCase: SendMessageUseCase;
    listMessagesUseCase: ListMessagesUseCase;
    editMessageUseCase: EditMessageUseCase;
    reactToMessageUseCase: ReactToMessageUseCase;
  }
) => {
  app.get("/v1/conversations/:conversationId/messages", async (request) => {
    const params = conversationParamsSchema.parse(request.params);
    const data = await dependencies.listMessagesUseCase.execute(params.conversationId);

    return {
      data
    };
  });

  app.post("/v1/messages", async (request, reply) => {
    const body = sendMessageInputSchema.parse(request.body);
    const message = await dependencies.sendMessageUseCase.execute(body);
    reply.code(201);

    return {
      data: message
    };
  });

  app.patch("/v1/messages/:messageId", async (request, reply) => {
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

    return {
      data: edited
    };
  });

  app.post("/v1/messages/:messageId/reactions", async (request, reply) => {
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

    return {
      data: updated
    };
  });
};

