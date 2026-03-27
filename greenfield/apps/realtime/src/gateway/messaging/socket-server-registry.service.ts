import { Injectable } from '@nestjs/common';

import type { Server } from 'socket.io';

@Injectable()
export class SocketServerRegistryService {
  private server: Server | null = null;

  public getServer(): Server | null {
    return this.server;
  }

  public setServer(server: Server): void {
    this.server = server;
  }
}
