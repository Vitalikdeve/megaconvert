import request from 'supertest';

import { createTestApiApp } from './support/create-test-api-app';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';


describe('api health endpoints', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApiApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns liveness information', async () => {
    const response = await request(app.getHttpServer()).get('/health/live').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.service.name).toBe('api');
  });

  it('returns a failing readiness response when the database is unavailable', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready').expect(503);

    expect(response.body.status).toBe('down');
    expect(response.body.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'postgres',
          status: 'down',
        }),
        expect.objectContaining({
          name: 'redis',
          status: 'not-configured',
        }),
      ]),
    );
  });
});
