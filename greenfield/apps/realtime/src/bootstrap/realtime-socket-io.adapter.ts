import { IoAdapter } from '@nestjs/platform-socket.io';

import type { INestApplicationContext } from '@nestjs/common';
import type { ServerOptions } from 'socket.io';

type SocketIoAdapterFactory = ReturnType<typeof import('@socket.io/redis-adapter').createAdapter>;

export class RealtimeSocketIoAdapter extends IoAdapter {
  public constructor(
    app: INestApplicationContext,
    private readonly corsOrigins: readonly string[],
    private readonly adapterFactory: SocketIoAdapterFactory,
  ) {
    super(app);
  }

  public override createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        credentials: true,
        origin: [...this.corsOrigins],
      },
    });

    server.adapter(this.adapterFactory);

    return server;
  }
}
