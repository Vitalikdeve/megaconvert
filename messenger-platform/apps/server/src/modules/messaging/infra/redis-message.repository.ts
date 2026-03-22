import { randomUUID } from "node:crypto";

import type { ReactionInput, StoredReaction } from "@messenger/shared";
import { storedMessageSchema } from "@messenger/shared";
import Redis from "ioredis";

import type {
  CreateMessageRecord,
  MessageRepository,
  StoredMessage
} from "../domain/message.entity";
import { seedMessages } from "./seed-messages";

const seedFlagKey = "messenger:bootstrap:seeded";
const conversationListKey = (conversationId: string) =>
  `messenger:conversation:${conversationId}:messages`;
const messageKey = (messageId: string) => `messenger:message:${messageId}`;

export class RedisMessageRepository implements MessageRepository {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3
    });
  }

  async save(input: CreateMessageRecord): Promise<StoredMessage> {
    await this.ensureSeedData();

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

    await this.redis
      .multi()
      .set(messageKey(message.id), JSON.stringify(message))
      .rpush(conversationListKey(input.conversationId), message.id)
      .exec();

    return message;
  }

  async listByConversation(conversationId: string): Promise<StoredMessage[]> {
    await this.ensureSeedData();

    const ids = await this.redis.lrange(conversationListKey(conversationId), 0, -1);

    if (ids.length === 0) {
      return [];
    }

    const payloads = await this.redis.mget(ids.map((id) => messageKey(id)));

    return payloads
      .filter((payload): payload is string => Boolean(payload))
      .map((payload) => storedMessageSchema.parse(JSON.parse(payload)))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async edit(
    messageId: string,
    _editorUserId: string,
    envelope: StoredMessage["envelope"]
  ): Promise<StoredMessage | null> {
    await this.ensureSeedData();

    const current = await this.getMessage(messageId);

    if (!current) {
      return null;
    }

    const updated: StoredMessage = {
      ...current,
      envelope,
      editedAt: new Date().toISOString(),
      deliveryStatusUpdatedAt: new Date().toISOString()
    };

    await this.redis.set(messageKey(messageId), JSON.stringify(updated));
    return updated;
  }

  async addReaction(input: ReactionInput): Promise<StoredMessage | null> {
    await this.ensureSeedData();

    const current = await this.getMessage(input.messageId);

    if (!current) {
      return null;
    }

    const exists = current.reactions.some(
      (reaction: StoredReaction) =>
        reaction.userId === input.userId && reaction.emoji === input.emoji
    );

    if (!exists) {
      const now = new Date().toISOString();
      current.reactions.push({
        userId: input.userId,
        emoji: input.emoji,
        createdAt: now
      });
      current.deliveryStatusUpdatedAt = now;
      await this.redis.set(messageKey(input.messageId), JSON.stringify(current));
    }

    return current;
  }

  async close() {
    if (this.redis.status !== "end") {
      await this.redis.quit();
    }
  }

  private async ensureSeedData() {
    await this.redis.connect().catch((error: unknown) => {
      if (
        error instanceof Error &&
        error.message.includes("Redis is already connecting/connected")
      ) {
        return;
      }

      throw error;
    });

    const seeded = await this.redis.set(seedFlagKey, "true", "NX");

    if (seeded !== "OK") {
      return;
    }

    const pipeline = this.redis.multi();

    for (const message of seedMessages) {
      pipeline.set(messageKey(message.id), JSON.stringify(message));
      pipeline.rpush(conversationListKey(message.conversationId), message.id);
    }

    await pipeline.exec();
  }

  private async getMessage(messageId: string) {
    const payload = await this.redis.get(messageKey(messageId));

    if (!payload) {
      return null;
    }

    return storedMessageSchema.parse(JSON.parse(payload));
  }
}
