import {
  conversationPresenceEventSchema,
  inboxChangedEventSchema,
  messageCreatedEventSchema,
  messageDeletedEventSchema,
  messageUpdatedEventSchema,
  messagingSocketAckSchema,
  readStateUpdatedEventSchema,
  typingUpdatedEventSchema,
  type ConversationPresenceEvent,
  type InboxChangedEvent,
  type MessageCreatedEvent,
  type MessageDeletedEvent,
  type MessageUpdatedEvent,
  type MessagingSocketAck,
  type ReadStateUpdatedEvent,
  type TypingUpdatedEvent,
} from '@megaconvert/contracts';
import { io, type Socket } from 'socket.io-client';
import { z } from 'zod';

type MessagingServerEventMap = {
  'messaging.conversation.presence.updated': ConversationPresenceEvent;
  'messaging.inbox.changed': InboxChangedEvent;
  'messaging.message.created': MessageCreatedEvent;
  'messaging.message.deleted': MessageDeletedEvent;
  'messaging.message.updated': MessageUpdatedEvent;
  'messaging.read-state.updated': ReadStateUpdatedEvent;
  'messaging.typing.updated': TypingUpdatedEvent;
};

interface MessagingReadyEvent {
  sessionId: string;
  timestamp: string;
  type: 'messaging.ready';
  userId: string;
}

type MessagingRealtimeEventName = keyof MessagingServerEventMap;

export interface MessagingRealtimeClientOptions {
  getAccessToken?: () => Promise<string | null> | string | null;
  namespacePath?: string;
  timeoutMs?: number;
  url: string;
  withCredentials?: boolean;
}

export interface MessagingRealtimeClient {
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  onConnect(listener: () => void): () => void;
  onConnectError(listener: (error: Error) => void): () => void;
  onDisconnect(listener: (reason: string) => void): () => void;
  onEvent<TEventName extends MessagingRealtimeEventName>(
    eventName: TEventName,
    listener: (event: MessagingServerEventMap[TEventName]) => void,
  ): () => void;
  onReady(listener: (event: MessagingReadyEvent) => void): () => void;
  subscribe(conversationId: string): Promise<MessagingSocketAck>;
  typingStart(conversationId: string): Promise<MessagingSocketAck>;
  typingStop(conversationId: string): Promise<MessagingSocketAck>;
  unsubscribe(conversationId: string): Promise<MessagingSocketAck>;
}

export function createMessagingRealtimeClient(
  options: MessagingRealtimeClientOptions,
): MessagingRealtimeClient {
  const socket = io(`${options.url}${options.namespacePath ?? '/messaging'}`, {
    autoConnect: false,
    timeout: options.timeoutMs ?? 8_000,
    transports: ['websocket'],
    withCredentials: options.withCredentials ?? true,
  });

  return {
    async connect() {
      const accessToken = options.getAccessToken ? await options.getAccessToken() : null;
      socket.auth = accessToken ? { accessToken } : {};

      if (socket.connected) {
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const handleConnect = () => {
          cleanup();
          resolve();
        };
        const handleError = (error: Error) => {
          cleanup();
          reject(error);
        };
        const cleanup = () => {
          socket.off('connect', handleConnect);
          socket.off('connect_error', handleError);
        };

        socket.on('connect', handleConnect);
        socket.on('connect_error', handleError);
        socket.connect();
      });
    },
    disconnect() {
      socket.disconnect();
    },
    isConnected() {
      return socket.connected;
    },
    onConnect(listener) {
      socket.on('connect', listener);
      return () => {
        socket.off('connect', listener);
      };
    },
    onConnectError(listener) {
      socket.on('connect_error', listener);
      return () => {
        socket.off('connect_error', listener);
      };
    },
    onDisconnect(listener) {
      socket.on('disconnect', listener);
      return () => {
        socket.off('disconnect', listener);
      };
    },
    onEvent(eventName, listener) {
      const parser = getEventParser(eventName);
      const wrappedListener = (payload: unknown) => {
        listener(parser.parse(payload) as MessagingServerEventMap[typeof eventName]);
      };

      socket.on(eventName, wrappedListener);

      return () => {
        socket.off(eventName, wrappedListener);
      };
    },
    onReady(listener) {
      const wrappedListener = (payload: unknown) => {
        listener(messagingReadyEventSchema.parse(payload));
      };

      socket.on('messaging.ready', wrappedListener);

      return () => {
        socket.off('messaging.ready', wrappedListener);
      };
    },
    subscribe(conversationId) {
      return emitAck(socket, 'messaging.subscribe', { conversationId });
    },
    typingStart(conversationId) {
      return emitAck(socket, 'messaging.typing.start', { conversationId });
    },
    typingStop(conversationId) {
      return emitAck(socket, 'messaging.typing.stop', { conversationId });
    },
    unsubscribe(conversationId) {
      return emitAck(socket, 'messaging.unsubscribe', { conversationId });
    },
  };
}

const messagingReadyEventSchema = z.object({
  sessionId: z.string().uuid(),
  timestamp: z.string().datetime(),
  type: z.literal('messaging.ready'),
  userId: z.string().uuid(),
});

function emitAck(
  socket: Socket,
  eventName:
    | 'messaging.subscribe'
    | 'messaging.typing.start'
    | 'messaging.typing.stop'
    | 'messaging.unsubscribe',
  payload: {
    conversationId: string;
  },
): Promise<MessagingSocketAck> {
  return new Promise<MessagingSocketAck>((resolve, reject) => {
    socket.emit(eventName, payload, (ack: unknown) => {
      try {
        resolve(messagingSocketAckSchema.parse(ack));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function getEventParser(eventName: MessagingRealtimeEventName) {
  switch (eventName) {
    case 'messaging.conversation.presence.updated':
      return conversationPresenceEventSchema;
    case 'messaging.inbox.changed':
      return inboxChangedEventSchema;
    case 'messaging.message.created':
      return messageCreatedEventSchema;
    case 'messaging.message.deleted':
      return messageDeletedEventSchema;
    case 'messaging.message.updated':
      return messageUpdatedEventSchema;
    case 'messaging.read-state.updated':
      return readStateUpdatedEventSchema;
    case 'messaging.typing.updated':
      return typingUpdatedEventSchema;
    default: {
      const exhaustiveCheck: never = eventName;
      throw new Error(`Unsupported realtime event: ${exhaustiveCheck as string}`);
    }
  }
}
