import { Inject } from '@nestjs/common';
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayConnection,
} from '@nestjs/websockets';

import {
  REALTIME_RUNTIME_CONTEXT,
  type RealtimeRuntimeContext,
} from '../../bootstrap/runtime-context';

import type { Socket } from 'socket.io';


interface PingPayload {
  requestId?: string;
}

interface PongPayload {
  requestId: string | null;
  service: string;
  timestamp: string;
  type: 'system.pong';
}

@WebSocketGateway({
  cors: {
    credentials: true,
    origin: ['http://localhost:3000'],
  },
  namespace: '/system',
})
export class SystemGateway implements OnGatewayConnection {
  public constructor(
    @Inject(REALTIME_RUNTIME_CONTEXT)
    private readonly runtimeContext: RealtimeRuntimeContext,
  ) {}

  public handleConnection(client: Socket): void {
    client.emit('system.ready', {
      service: this.runtimeContext.service.name,
      timestamp: new Date().toISOString(),
      type: 'system.ready',
    });
  }

  @SubscribeMessage('system.ping')
  public handlePing(@MessageBody() payload?: PingPayload): PongPayload {
    return {
      requestId: payload?.requestId ?? null,
      service: this.runtimeContext.service.name,
      timestamp: new Date().toISOString(),
      type: 'system.pong',
    };
  }
}
