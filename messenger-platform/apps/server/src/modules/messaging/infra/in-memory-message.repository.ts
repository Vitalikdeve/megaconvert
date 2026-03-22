import { randomUUID } from "node:crypto";

import type { MessageEnvelope, ReactionInput, StoredReaction } from "@messenger/shared";

import type {
  CreateMessageRecord,
  MessageRepository,
  StoredMessage
} from "../domain/message.entity";
import { seedMessages } from "./seed-messages";

export class InMemoryMessageRepository implements MessageRepository {
  private readonly messagesByConversation = new Map<string, StoredMessage[]>();

  constructor() {
    this.messagesByConversation.set("vision-labs", [...seedMessages]);
  }

  async save(input: CreateMessageRecord): Promise<StoredMessage> {
    const now = new Date().toISOString();
    const message: StoredMessage = {
      id: randomUUID(),
      clientMessageId: input.clientMessageId,
      conversationId: input.conversationId,
      senderUserId: input.senderUserId,
      senderDeviceId: input.senderDeviceId,
      envelope: input.envelope,
      createdAt: now,
      reactions: [],
      deliveryStatus: "delivered",
      deliveryStatusUpdatedAt: now
    };

    const list = this.messagesByConversation.get(input.conversationId) ?? [];
    list.push(message);
    this.messagesByConversation.set(input.conversationId, list);

    return message;
  }

  async listByConversation(conversationId: string): Promise<StoredMessage[]> {
    return [...(this.messagesByConversation.get(conversationId) ?? [])];
  }

  async edit(
    messageId: string,
    _editorUserId: string,
    envelope: MessageEnvelope
  ): Promise<StoredMessage | null> {
    for (const [conversationId, messages] of this.messagesByConversation.entries()) {
      const target = messages.find((message) => message.id === messageId);

      if (!target) {
        continue;
      }

      target.envelope = envelope;
      target.editedAt = new Date().toISOString();
      target.deliveryStatusUpdatedAt = target.editedAt;
      this.messagesByConversation.set(conversationId, messages);
      return target;
    }

    return null;
  }

  async addReaction(input: ReactionInput): Promise<StoredMessage | null> {
    const messages = this.messagesByConversation.get(input.conversationId) ?? [];
    const target = messages.find((message) => message.id === input.messageId);

    if (!target) {
      return null;
    }

    const exists = target.reactions.some(
      (reaction: StoredReaction) => reaction.userId === input.userId && reaction.emoji === input.emoji
    );

    if (!exists) {
      const now = new Date().toISOString();
      target.reactions.push({
        userId: input.userId,
        emoji: input.emoji,
        createdAt: now
      });
      target.deliveryStatusUpdatedAt = now;
    }

    return target;
  }
}
