import { requestContextStore } from '@megaconvert/server-kit';
import {
  Inject,
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';

import { ACTOR_RESOLVER } from '../../../auth-shell/auth-shell.constants';

import type { ActorResolver } from '../../../auth-shell/application/actor-resolver.port';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class UserActorGuard implements CanActivate {
  public constructor(
    @Inject(ACTOR_RESOLVER) private readonly actorResolver: ActorResolver,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const actor = request.actor ?? (await this.actorResolver.resolve(request));

    request.actor = actor;
    requestContextStore.update({
      actorId: actor.id,
      actorType: actor.kind,
    });

    if (actor.isAuthenticated && actor.kind === 'user') {
      return true;
    }

    throw new ForbiddenException({
      code: 'user_actor_required',
      message: 'A user session is required for this operation.',
    });
  }
}
