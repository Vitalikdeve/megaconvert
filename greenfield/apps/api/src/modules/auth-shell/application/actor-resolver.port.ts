import type { RequestActor } from '../domain/request-actor';
import type { FastifyRequest } from 'fastify';


export interface ActorResolver {
  resolve(request: FastifyRequest): Promise<RequestActor>;
}
