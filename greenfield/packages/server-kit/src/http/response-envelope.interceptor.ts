import { Injectable } from '@nestjs/common';
import { map, type Observable } from 'rxjs';

import { RESPONSE_ENVELOPE_METADATA_KEY } from './response-envelope.decorator';

import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  public constructor(private readonly reflector: Reflector) {}

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const shouldNormalizeResponse = this.reflector.getAllAndOverride<boolean>(
      RESPONSE_ENVELOPE_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!shouldNormalizeResponse) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          requestId: typeof request.id === 'string' ? request.id : null,
          timestamp: new Date().toISOString(),
        },
      })),
    );
  }
}
