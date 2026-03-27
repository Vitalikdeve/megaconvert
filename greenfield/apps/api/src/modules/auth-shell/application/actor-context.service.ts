import { Injectable, UnauthorizedException } from '@nestjs/common';

import type { AuthenticatedActor, RequestActor } from '../domain/request-actor';
import type { FastifyRequest } from 'fastify';


@Injectable()
export class ActorContextService {
  public getActor(request: FastifyRequest): RequestActor {
    return request.actor;
  }

  public requireAuthenticatedActor(request: FastifyRequest): AuthenticatedActor {
    const actor = this.getActor(request);

    if (!actor.isAuthenticated) {
      throw new UnauthorizedException('Authentication is required.');
    }

    return actor;
  }
}
