import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';

import { ActorContextService } from '../../application/actor-context.service';

import type { FastifyRequest } from 'fastify';

@Injectable()
export class AuthenticatedActorGuard implements CanActivate {
  public constructor(
    @Inject(ActorContextService)
    private readonly actorContextService: ActorContextService,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    this.actorContextService.requireAuthenticatedActor(request);
    return true;
  }
}
