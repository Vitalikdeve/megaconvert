import { requestContextStore } from '@megaconvert/server-kit';
import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';

import { ApiConfigService } from '../../config/api-config.service';

import type { FastifyReply, FastifyRequest } from 'fastify';

type MiddlewareNext = (error?: unknown) => void;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  public constructor(
    @Inject(ApiConfigService) private readonly configService: ApiConfigService,
  ) {}

  public use(
    request: FastifyRequest,
    response: FastifyReply,
    next: MiddlewareNext,
  ): void {
    const correlationId = typeof request.id === 'string' ? request.id : 'unknown-request-id';

    this.setCorrelationHeader(response, this.configService.http.requestIdHeader, correlationId);
    requestContextStore.run(
      {
        actorId: null,
        actorType: null,
        correlationId,
        ipAddress: request.ip ?? null,
        method: request.method,
        path: request.url,
        userAgent:
          typeof request.headers['user-agent'] === 'string'
            ? request.headers['user-agent']
            : null,
      },
      next,
    );
  }

  private setCorrelationHeader(
    response: FastifyReply,
    headerName: string,
    headerValue: string,
  ): void {
    if (typeof response.header === 'function') {
      response.header(headerName, headerValue);
      return;
    }

    const rawResponse = response as unknown as {
      setHeader(name: string, value: string): void;
    };

    rawResponse.setHeader(headerName, headerValue);
  }
}
