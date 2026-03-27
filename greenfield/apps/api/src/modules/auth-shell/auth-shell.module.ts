import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';

import { ActorContextService } from './application/actor-context.service';
import { ACTOR_RESOLVER } from './auth-shell.constants';
import { ActorContextMiddleware } from './infrastructure/actor-context.middleware';
import { SessionActorResolver } from './infrastructure/session-actor.resolver';
import { AuthenticatedActorGuard } from './interfaces/http/authenticated-actor.guard';

@Module({
  imports: [DatabaseModule],
  exports: [
    ACTOR_RESOLVER,
    ActorContextMiddleware,
    ActorContextService,
    AuthenticatedActorGuard,
  ],
  providers: [
    {
      provide: ACTOR_RESOLVER,
      useClass: SessionActorResolver,
    },
    ActorContextMiddleware,
    ActorContextService,
    AuthenticatedActorGuard,
    SessionActorResolver,
  ],
})
export class AuthShellModule {}
