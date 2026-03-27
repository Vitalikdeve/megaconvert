import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { RequestActor } from '../../domain/request-actor';
import type { FastifyRequest } from 'fastify';


export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestActor =>
    context.switchToHttp().getRequest<FastifyRequest>().actor,
);
