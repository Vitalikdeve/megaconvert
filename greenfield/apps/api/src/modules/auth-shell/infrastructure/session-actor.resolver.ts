import { authSessionsTable, type DatabaseClient } from '@megaconvert/database';
import { parseCookieHeader } from '@megaconvert/server-kit';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { ApiConfigService } from '../../config/api-config.service';
import { DATABASE_CLIENT } from '../../database/database.constants';
import { anonymousActor } from '../domain/request-actor';

import type { ActorResolver } from '../application/actor-resolver.port';
import type { RequestActor } from '../domain/request-actor';
import type { FastifyRequest } from 'fastify';

interface AccessTokenClaims {
  aud: string | string[];
  exp: number;
  iat?: number;
  sid: string;
  sub: string;
  typ?: string;
}

const ONE_MINUTE_IN_MS = 60_000;

@Injectable()
export class SessionActorResolver implements ActorResolver {
  private readonly accessTokenSecret: Uint8Array;

  public constructor(
    @Inject(ApiConfigService) private readonly configService: ApiConfigService,
    @Inject(DATABASE_CLIENT) private readonly databaseClient: DatabaseClient,
  ) {
    this.accessTokenSecret = new TextEncoder().encode(configService.auth.accessTokenSecret);
  }

  public async resolve(request: FastifyRequest): Promise<RequestActor> {
    const accessToken = extractAccessToken(
      request.headers.authorization,
      typeof request.headers.cookie === 'string' ? request.headers.cookie : undefined,
      this.configService.auth.accessCookieName,
    );

    if (!accessToken) {
      return anonymousActor;
    }

    try {
      const { jwtVerify } = await loadJoseModule();
      const verification = await jwtVerify<AccessTokenClaims>(accessToken, this.accessTokenSecret, {
        audience: this.configService.auth.accessTokenAudience,
      });

      const claims = verification.payload;

      if (claims.typ && claims.typ !== 'access') {
        return anonymousActor;
      }

      if (typeof claims.sub !== 'string' || typeof claims.sid !== 'string') {
        return anonymousActor;
      }

      const session = await this.databaseClient.query.authSessionsTable.findFirst({
        where: and(
          eq(authSessionsTable.id, claims.sid),
          eq(authSessionsTable.status, 'active'),
          eq(authSessionsTable.userId, claims.sub),
        ),
        with: {
          user: true,
        },
      });

      if (!session || session.expiresAt.getTime() <= Date.now()) {
        return anonymousActor;
      }

      if (session.user.accountStatus !== 'active') {
        return anonymousActor;
      }

      await this.touchSessionIfStale(session.id, session.lastSeenAt);

      return {
        id: session.userId,
        isAuthenticated: true,
        kind: 'user',
        sessionId: session.id,
      };
    } catch {
      return anonymousActor;
    }
  }

  private async touchSessionIfStale(sessionId: string, lastSeenAt: Date): Promise<void> {
    if (Date.now() - lastSeenAt.getTime() < ONE_MINUTE_IN_MS) {
      return;
    }

    const now = new Date();

    await this.databaseClient
      .update(authSessionsTable)
      .set({
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(eq(authSessionsTable.id, sessionId));
  }
}

function extractAccessToken(
  authorizationHeader: string | undefined,
  cookieHeader: string | undefined,
  accessCookieName: string,
): string | null {
  const bearerToken = extractBearerToken(authorizationHeader);

  if (bearerToken) {
    return bearerToken;
  }

  const cookieToken = parseCookieHeader(cookieHeader).get(accessCookieName);

  return cookieToken && cookieToken.length > 0 ? cookieToken : null;
}

function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

async function loadJoseModule(): Promise<{
  jwtVerify: JoseJwtVerify;
}> {
  return dynamicImport('jose') as Promise<{
    jwtVerify: JoseJwtVerify;
  }>;
}

const dynamicImport = new Function(
  'specifier',
  'return import(specifier);',
) as (specifier: string) => Promise<unknown>;

type JoseJwtVerify = <Claims extends object>(
  jwt: string,
  secret: Uint8Array,
  options: {
    audience: string;
  },
) => Promise<{
  payload: Claims;
}>;
