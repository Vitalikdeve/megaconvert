import { describe, expect, it, vi } from 'vitest';

import { createJsonClient } from './json-client';

import type { SchemaParser } from './json-client';

describe('json-client', () => {
  it('preserves absolute URLs when performing direct requests', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: {
          'content-type': 'application/json',
        },
        status: 200,
      }),
    );

    const client = createJsonClient({
      fetchImpl,
    });

    await client.get<{ ok: boolean }>('https://example.test/health/live?scope=web', {
      schema: {
        parse(input) {
          return input as { ok: boolean };
        },
      },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/health/live?scope=web',
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('parses typed payloads through the provided schema', async () => {
    const client = createJsonClient({
      baseUrl: 'https://api.example.test',
      fetchImpl: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok' }), {
          headers: {
            'content-type': 'application/json',
          },
          status: 200,
        }),
      ),
    });

    const payload = await client.get('/health/live', {
      schema: {
        parse(input) {
          return input as { status: string };
        },
      },
    });

    expect(payload.status).toBe('ok');
  });

  it('surfaces request ids from normalized backend errors', async () => {
    const client = createJsonClient({
      baseUrl: 'https://api.example.test',
      fetchImpl: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'service_unavailable',
              details: null,
              message: 'Downstream dependency is unavailable.',
              requestId: 'req_frontend_123',
            },
          }),
          {
            headers: {
              'content-type': 'application/json',
            },
            status: 503,
          },
        ),
      ),
    });

    await expect(client.get('/health/ready')).rejects.toEqual(
      expect.objectContaining({
        kind: 'http',
        message: 'Downstream dependency is unavailable.',
        method: 'GET',
        requestId: 'req_frontend_123',
        statusCode: 503,
        url: 'https://api.example.test/health/ready',
      }),
    );
  });

  it('classifies schema validation failures separately from transport failures', async () => {
    const client = createJsonClient({
      baseUrl: 'https://api.example.test',
      fetchImpl: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok' }), {
          headers: {
            'content-type': 'application/json',
            'x-request-id': 'req_schema_123',
          },
          status: 200,
        }),
      ),
    });

    const schema: SchemaParser<{ status: 'degraded' }> = {
      parse() {
        throw new Error('invalid schema shape');
      },
    };

    await expect(client.get('/health/ready', { schema })).rejects.toEqual(
      expect.objectContaining({
        kind: 'schema_validation',
        message: 'Response validation failed.',
        requestId: 'req_schema_123',
        statusCode: 200,
      }),
    );
  });

  it('classifies invalid JSON responses explicitly', async () => {
    const client = createJsonClient({
      baseUrl: 'https://api.example.test',
      fetchImpl: vi.fn().mockResolvedValue(
        new Response('{invalid json', {
          headers: {
            'content-type': 'application/json',
            'x-request-id': 'req_invalid_json',
          },
          status: 200,
        }),
      ),
    });

    await expect(client.get('/health/live')).rejects.toEqual(
      expect.objectContaining({
        kind: 'invalid_response',
        message: 'Response body was not valid JSON.',
        requestId: 'req_invalid_json',
        statusCode: 200,
      }),
    );
  });

  it('classifies request timeouts separately from general network failures', async () => {
    vi.useFakeTimers();

    const client = createJsonClient({
      baseUrl: 'https://api.example.test',
      fetchImpl: vi.fn().mockImplementation(
        (_input: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => {
                reject(new DOMException('Aborted', 'AbortError'));
              },
              { once: true },
            );
          }),
      ),
      timeoutMs: 25,
    });

    const request = client.get('/health/live');
    const expectation = expect(request).rejects.toEqual(
      expect.objectContaining({
        kind: 'timeout',
        message: 'Request timed out.',
        statusCode: 408,
      }),
    );

    await vi.advanceTimersByTimeAsync(30);
    await expectation;

    vi.useRealTimers();
  });
});
