import { Injectable } from '@nestjs/common';

import { anonymousActor } from '../domain/request-actor';

import type { ActorResolver } from '../application/actor-resolver.port';
import type { RequestActor } from '../domain/request-actor';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class AnonymousActorResolver implements ActorResolver {
  public async resolve(_request: FastifyRequest): Promise<RequestActor> {
    return anonymousActor;
  }
}
