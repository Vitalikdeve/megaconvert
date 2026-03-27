import request from 'supertest';

import { createTestApiApp } from './support/create-test-api-app';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';

describe('api system endpoint', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApiApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a normalized system overview response', async () => {
    const response = await request(app.getHttpServer())
      .get('/?verbose=true')
      .set('x-correlation-id', 'test-correlation-id')
      .expect(200);

    expect(response.body.meta.requestId).toBe('test-correlation-id');
    expect(response.body.data.service.name).toBe('api');
    expect(response.body.data.modules.logging.structured).toBe(true);
    expect(response.headers['x-correlation-id']).toBe('test-correlation-id');
  });

  it('returns a validation error for malformed query flags', async () => {
    const response = await request(app.getHttpServer()).get('/?verbose=maybe').expect(400);

    expect(response.body.error.code).toBe('validation_error');
  });
});
