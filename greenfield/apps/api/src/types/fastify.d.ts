import type { RequestActor } from '../modules/auth-shell/domain/request-actor';

declare module 'fastify' {
  interface FastifyRequest {
    actor: RequestActor;
  }
}

export {};
