import { requestContextStore } from '@megaconvert/server-kit';
import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';


import { ACTOR_RESOLVER } from '../auth-shell.constants';

import type { ActorResolver } from '../application/actor-resolver.port';
import type { FastifyReply, FastifyRequest } from 'fastify';

type MiddlewareNext = (error?: unknown) => void;

@Injectable()
export class ActorContextMiddleware implements NestMiddleware {
  public constructor(
    @Inject(ACTOR_RESOLVER) private readonly actorResolver: ActorResolver,
  ) {}

  public async use(
    request: FastifyRequest,
    _response: FastifyReply,
    next: MiddlewareNext,
  ): Promise<void> {
    try {
      const actor = await this.actorResolver.resolve(request);
      request.actor = actor;
      requestContextStore.update({
        actorId: actor.id,
        actorType: actor.kind,
      });
      next();
    } catch (error) {
      next(error);
    }
  }
}
