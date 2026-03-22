import type { Server as SocketServer } from "socket.io";
import Redis from "ioredis";

import { createRedisClient, ensureRedisConnection } from "../../../core/redis";

export interface FanoutEnvelope {
  room: string;
  eventName: string;
  payload: unknown;
}

const realtimeChannel = "messenger:realtime:fanout";

type FanoutHandler = (envelope: FanoutEnvelope) => void | Promise<void>;

export class RealtimeFanoutService {
  private readonly pubClient?: Redis;

  private readonly subClient?: Redis;

  readonly distributed: boolean;

  constructor(private readonly redisUrl?: string) {
    if (redisUrl) {
      this.pubClient = createRedisClient(redisUrl, "messenger-fanout-publisher");
      this.subClient = createRedisClient(redisUrl, "messenger-fanout-subscriber");
    }

    this.distributed = Boolean(redisUrl);
  }

  async publish(envelope: FanoutEnvelope) {
    if (!this.pubClient) {
      return;
    }

    await ensureRedisConnection(this.pubClient);
    await this.pubClient.publish(realtimeChannel, JSON.stringify(envelope));
  }

  async subscribe(handler: FanoutHandler) {
    if (!this.subClient) {
      return;
    }

    await ensureRedisConnection(this.subClient);
    await this.subClient.subscribe(realtimeChannel);
    this.subClient.on("message", (channel, payload) => {
      if (channel !== realtimeChannel) {
        return;
      }

      void handler(JSON.parse(payload) as FanoutEnvelope);
    });
  }

  emitLocal(io: SocketServer, envelope: FanoutEnvelope) {
    io.to(envelope.room).emit(envelope.eventName, envelope.payload);
  }

  async close() {
    if (this.pubClient && this.pubClient.status !== "end") {
      await this.pubClient.quit();
    }

    if (this.subClient && this.subClient.status !== "end") {
      await this.subClient.quit();
    }
  }
}
