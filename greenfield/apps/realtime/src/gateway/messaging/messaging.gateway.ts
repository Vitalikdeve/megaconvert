import {
  buildConversationRoom,
  buildUserRoom,
  conversationPresenceEventSchema,
  messagingSocketAckSchema,
  messagingSocketSubscriptionSchema,
  messagingTypingEventSchema,
  typingUpdatedEventSchema,
  type ConversationPresenceEvent,
  type MessagingSocketAck,
  type MessagingSocketSubscription,
  type MessagingTypingEvent,
  type TypingUpdatedEvent,
} from '@megaconvert/contracts';
import { conversationMembershipsTable, type DatabaseClient } from '@megaconvert/database';
import { Inject } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import { and, eq } from 'drizzle-orm';

import {
  REALTIME_RUNTIME_CONTEXT,
  type RealtimeRuntimeContext,
} from '../../bootstrap/runtime-context';
import { REALTIME_DATABASE_CLIENT } from '../../modules/database/database.constants';
import { REALTIME_REDIS_COMMAND_CLIENT } from '../../modules/redis/redis.constants';

import { MessagingSocketAuthService, type SocketActor } from './messaging-socket-auth.service';
import { SocketServerRegistryService } from './socket-server-registry.service';

import type { RedisClient } from '@megaconvert/server-kit';
import type {
  DisconnectReason,
  Server,
  Socket,
} from 'socket.io';

interface MessagingReadyEvent {
  sessionId: string;
  timestamp: string;
  type: 'messaging.ready';
  userId: string;
}

interface MessagingClientToServerEvents {
  'messaging.subscribe': (
    payload: MessagingSocketSubscription,
    callback: (ack: MessagingSocketAck) => void,
  ) => void;
  'messaging.typing.start': (
    payload: MessagingTypingEvent,
    callback: (ack: MessagingSocketAck) => void,
  ) => void;
  'messaging.typing.stop': (
    payload: MessagingTypingEvent,
    callback: (ack: MessagingSocketAck) => void,
  ) => void;
  'messaging.unsubscribe': (
    payload: MessagingSocketSubscription,
    callback: (ack: MessagingSocketAck) => void,
  ) => void;
}

interface MessagingServerToClientEvents {
  'messaging.conversation.presence.updated': (event: ConversationPresenceEvent) => void;
  'messaging.inbox.changed': (event: import('@megaconvert/contracts').InboxChangedEvent) => void;
  'messaging.message.created': (event: import('@megaconvert/contracts').MessageCreatedEvent) => void;
  'messaging.message.deleted': (event: import('@megaconvert/contracts').MessageDeletedEvent) => void;
  'messaging.message.updated': (event: import('@megaconvert/contracts').MessageUpdatedEvent) => void;
  'messaging.read-state.updated': (
    event: import('@megaconvert/contracts').ReadStateUpdatedEvent,
  ) => void;
  'messaging.ready': (event: MessagingReadyEvent) => void;
  'messaging.typing.updated': (event: TypingUpdatedEvent) => void;
}

interface MessagingInterServerEvents {}

interface MessagingSocketData {
  actor?: SocketActor;
  subscribedConversationIds?: string[];
}

type MessagingSocket = Socket<
  MessagingClientToServerEvents,
  MessagingServerToClientEvents,
  MessagingInterServerEvents,
  MessagingSocketData
>;

type MessagingServer = Server<
  MessagingClientToServerEvents,
  MessagingServerToClientEvents,
  MessagingInterServerEvents,
  MessagingSocketData
>;

@WebSocketGateway({
  namespace: '/messaging',
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: MessagingServer;

  public constructor(
    @Inject(REALTIME_RUNTIME_CONTEXT)
    private readonly runtimeContext: RealtimeRuntimeContext,
    @Inject(REALTIME_DATABASE_CLIENT) private readonly databaseClient: DatabaseClient,
    @Inject(REALTIME_REDIS_COMMAND_CLIENT) private readonly redisClient: RedisClient,
    @Inject(MessagingSocketAuthService)
    private readonly messagingSocketAuthService: MessagingSocketAuthService,
    @Inject(SocketServerRegistryService)
    private readonly socketServerRegistry: SocketServerRegistryService,
  ) {}

  public afterInit(server: MessagingServer): void {
    this.socketServerRegistry.setServer(server);
  }

  public async handleConnection(client: MessagingSocket): Promise<void> {
    const actor = await this.messagingSocketAuthService.authenticate(client);

    if (!actor) {
      client.disconnect(true);
      return;
    }

    client.data.actor = actor;
    client.data.subscribedConversationIds = [];

    await client.join(buildUserRoom(actor.userId));
    client.emit('messaging.ready', {
      sessionId: actor.sessionId,
      timestamp: new Date().toISOString(),
      type: 'messaging.ready',
      userId: actor.userId,
    });
  }

  public async handleDisconnect(
    client: MessagingSocket,
    _reason: DisconnectReason,
  ): Promise<void> {
    const actor = client.data.actor;
    const conversationIds = client.data.subscribedConversationIds ?? [];

    if (!actor) {
      return;
    }

    for (const conversationId of conversationIds) {
      await this.clearTypingState(actor.userId, conversationId);
      this.emitTypingUpdate(conversationId, actor.userId, 'stopped', client.id);
      await this.publishPresence(conversationId);
    }
  }

  @SubscribeMessage('messaging.subscribe')
  public async subscribeToConversation(
    @ConnectedSocket() client: MessagingSocket,
    @MessageBody() payload: MessagingSocketSubscription,
  ): Promise<MessagingSocketAck> {
    const actor = this.requireActor(client);
    const parsedPayload = messagingSocketSubscriptionSchema.parse(payload);

    if (!(await this.hasConversationMembership(actor.userId, parsedPayload.conversationId))) {
      return buildSocketAck(false, parsedPayload.conversationId, 'conversation_not_found');
    }

    await client.join(buildConversationRoom(parsedPayload.conversationId));
    client.data.subscribedConversationIds = [
      ...new Set([...(client.data.subscribedConversationIds ?? []), parsedPayload.conversationId]),
    ];

    await this.publishPresence(parsedPayload.conversationId);

    return buildSocketAck(true, parsedPayload.conversationId);
  }

  @SubscribeMessage('messaging.unsubscribe')
  public async unsubscribeFromConversation(
    @ConnectedSocket() client: MessagingSocket,
    @MessageBody() payload: MessagingSocketSubscription,
  ): Promise<MessagingSocketAck> {
    const actor = this.requireActor(client);
    const parsedPayload = messagingSocketSubscriptionSchema.parse(payload);

    if (!(await this.hasConversationMembership(actor.userId, parsedPayload.conversationId))) {
      return buildSocketAck(false, parsedPayload.conversationId, 'conversation_not_found');
    }

    await client.leave(buildConversationRoom(parsedPayload.conversationId));
    client.data.subscribedConversationIds = (client.data.subscribedConversationIds ?? []).filter(
      (conversationId) => conversationId !== parsedPayload.conversationId,
    );

    await this.clearTypingState(actor.userId, parsedPayload.conversationId);
    this.emitTypingUpdate(parsedPayload.conversationId, actor.userId, 'stopped', client.id);
    await this.publishPresence(parsedPayload.conversationId);

    return buildSocketAck(true, parsedPayload.conversationId);
  }

  @SubscribeMessage('messaging.typing.start')
  public async typingStart(
    @ConnectedSocket() client: MessagingSocket,
    @MessageBody() payload: MessagingTypingEvent,
  ): Promise<MessagingSocketAck> {
    return this.handleTyping(client, payload, 'started');
  }

  @SubscribeMessage('messaging.typing.stop')
  public async typingStop(
    @ConnectedSocket() client: MessagingSocket,
    @MessageBody() payload: MessagingTypingEvent,
  ): Promise<MessagingSocketAck> {
    return this.handleTyping(client, payload, 'stopped');
  }

  private async handleTyping(
    client: MessagingSocket,
    payload: MessagingTypingEvent,
    state: 'started' | 'stopped',
  ): Promise<MessagingSocketAck> {
    const actor = this.requireActor(client);
    const parsedPayload = messagingTypingEventSchema.parse(payload);

    if (!(await this.hasConversationMembership(actor.userId, parsedPayload.conversationId))) {
      return buildSocketAck(false, parsedPayload.conversationId, 'conversation_not_found');
    }

    if (state === 'started') {
      await this.recordTypingState(actor.userId, parsedPayload.conversationId);
    } else {
      await this.clearTypingState(actor.userId, parsedPayload.conversationId);
    }

    this.emitTypingUpdate(parsedPayload.conversationId, actor.userId, state, client.id);

    return buildSocketAck(true, parsedPayload.conversationId);
  }

  private emitTypingUpdate(
    conversationId: string,
    userId: string,
    state: 'started' | 'stopped',
    excludeSocketId: string | null,
  ): void {
    const room = buildConversationRoom(conversationId);
    let emitter = this.server.to(room);

    if (excludeSocketId) {
      emitter = emitter.except(excludeSocketId);
    }

    emitter.emit(
      'messaging.typing.updated',
      typingUpdatedEventSchema.parse({
        conversationId,
        expiresAt:
          state === 'started'
            ? new Date(
                Date.now() + this.runtimeContext.environment.TYPING_TTL_SECONDS * 1_000,
              ).toISOString()
            : new Date().toISOString(),
        state,
        type: 'messaging.typing.updated',
        userId,
      }),
    );
  }

  private async hasConversationMembership(userId: string, conversationId: string): Promise<boolean> {
    const rows = await this.databaseClient
      .select({
        id: conversationMembershipsTable.id,
      })
      .from(conversationMembershipsTable)
      .where(
        and(
          eq(conversationMembershipsTable.conversationId, conversationId),
          eq(conversationMembershipsTable.userId, userId),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }

  private async publishPresence(conversationId: string): Promise<void> {
    const sockets = await this.server.in(buildConversationRoom(conversationId)).fetchSockets();
    const activeUserIds = [
      ...new Set(
        sockets
          .map((socket) => socket.data.actor?.userId)
          .filter((value): value is string => typeof value === 'string'),
      ),
    ];

    this.server.to(buildConversationRoom(conversationId)).emit(
      'messaging.conversation.presence.updated',
      conversationPresenceEventSchema.parse({
        activeCount: activeUserIds.length,
        activeUserIds,
        conversationId,
        type: 'messaging.conversation.presence.updated',
      }),
    );
  }

  private async clearTypingState(userId: string, conversationId: string): Promise<void> {
    await this.redisClient.del(buildTypingRedisKey(conversationId, userId));
  }

  private async recordTypingState(userId: string, conversationId: string): Promise<void> {
    await this.redisClient.set(
      buildTypingRedisKey(conversationId, userId),
      '1',
      'EX',
      this.runtimeContext.environment.TYPING_TTL_SECONDS,
    );
  }

  private requireActor(client: MessagingSocket): SocketActor {
    const actor = client.data.actor;

    if (!actor) {
      client.disconnect(true);
      throw new Error('Messaging socket actor is missing.');
    }

    return actor;
  }
}

function buildSocketAck(
  ok: boolean,
  conversationId: string | null,
  code: string | null = null,
): MessagingSocketAck {
  return messagingSocketAckSchema.parse({
    code,
    conversationId,
    ok,
  });
}

function buildTypingRedisKey(conversationId: string, userId: string): string {
  return `messaging:typing:${conversationId}:${userId}`;
}
