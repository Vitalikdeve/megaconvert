import { findFreePort } from '@megaconvert/testing';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';

import { createRealtimeApp } from '../src/bootstrap/create-realtime-app';

import type { RealtimeEnvironment } from '@megaconvert/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';


describe('realtime gateway foundation', () => {
  let app: NestFastifyApplication;
  let socket: Socket | undefined;
  let port: number;

  beforeAll(async () => {
    port = await findFreePort();

    const environment: RealtimeEnvironment = {
      APP_COMMIT_SHA: null,
      APP_VERSION: '0.1.0-test',
      HOST: '127.0.0.1',
      LOG_LEVEL: 'silent',
      NODE_ENV: 'test',
      PORT: port,
      PUBLIC_ORIGIN: `http://127.0.0.1:${port}`,
      REDIS_URL: 'redis://127.0.0.1:6399',
    };

    app = await createRealtimeApp(environment);
    await app.listen(port, '127.0.0.1');
  });

  afterEach(async () => {
    if (!socket) {
      return;
    }

    await new Promise<void>((resolve) => {
      socket?.once('disconnect', () => resolve());
      socket?.disconnect();

      if (!socket?.connected) {
        resolve();
      }
    });

    socket.removeAllListeners();
    socket = undefined;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns liveness information', async () => {
    const response = await request(app.getHttpServer()).get('/health/live').expect(200);

    expect(response.body.service.name).toBe('realtime');
    expect(response.body.status).toBe('ok');
  });

  it('returns a failing readiness response when redis is unavailable', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready').expect(503);

    expect(response.body.status).toBe('down');
    expect(response.body.dependencies[0].name).toBe('redis');
  });

  it('responds to system ping events', async () => {
    socket = io(`http://127.0.0.1:${port}/system`, {
      forceNew: true,
      reconnection: false,
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      socket?.on('connect', () => resolve());
      socket?.on('connect_error', (error) => reject(error));
    });

    const response = await new Promise<{
      requestId: string | null;
      service: string;
      timestamp: string;
      type: string;
    }>((resolve) => {
      socket?.emit('system.ping', { requestId: 'foundation-check' }, resolve);
    });

    expect(response.service).toBe('realtime');
    expect(response.requestId).toBe('foundation-check');
    expect(response.type).toBe('system.pong');
  });
});
