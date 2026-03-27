import request from 'supertest';

import { createWorkerApp } from '../src/bootstrap/create-worker-app';

import type { WorkerEnvironment } from '@megaconvert/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';


describe('worker health endpoints', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const environment: WorkerEnvironment = {
      APP_COMMIT_SHA: null,
      APP_VERSION: '0.1.0-test',
      DATABASE_URL: 'postgresql://megaconvert:megaconvert@127.0.0.1:5999/megaconvert',
      HEALTHCHECK_ORIGIN: 'http://127.0.0.1:0',
      HOST: '127.0.0.1',
      LOG_LEVEL: 'silent',
      NODE_ENV: 'test',
      PORT: 0,
      REDIS_URL: undefined,
      S3_ENDPOINT: undefined,
    };

    app = await createWorkerApp(environment);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns liveness information', async () => {
    const response = await request(app.getHttpServer()).get('/health/live').expect(200);

    expect(response.body.service.name).toBe('worker');
    expect(response.body.status).toBe('ok');
  });

  it('returns a failing readiness response when the database is unavailable', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready').expect(503);

    expect(response.body.status).toBe('down');
  });
});
