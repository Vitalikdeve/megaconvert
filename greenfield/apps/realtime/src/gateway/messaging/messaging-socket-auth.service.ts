import { authSessionsTable, usersTable, type DatabaseClient } from '@megaconvert/database';
import { parseCookieHeader } from '@megaconvert/server-kit';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import {
  REALTIME_RUNTIME_CONTEXT,
  type RealtimeRuntimeContext,
} from '../../bootstrap/runtime-context';
import { REALTIME_DATABASE_CLIENT } from '../../modules/database/database.constants';

import type { Socket } from 'socket.io';

interface AccessTokenClaims {
  aud: string | string[];
  exp: number;
  iat?: number;
  sid: string;
  sub: string;
  typ?: string;
}

export interface SocketActor {
  sessionId: string;
  userId: string;
}

@Injectable()
export class MessagingSocketAuthService {
  private readonly accessTokenSecret: Uint8Array;

  public constructor(
    @Inject(REALTIME_DATABASE_CLIENT) private readonly databaseClient: DatabaseClient,
    @Inject(REALTIME_RUNTIME_CONTEXT)
    private readonly runtimeContext: RealtimeRuntimeContext,
  ) {
    this.accessTokenSecret = new TextEncoder().encode(
      runtimeContext.environment.AUTH_ACCESS_TOKEN_SECRET,
    );
  }

  public async authenticate(client: Socket): Promise<SocketActor | null> {
    const accessToken = extractSocketToken(
      client,
      this.runtimeContext.environment.AUTH_ACCESS_COOKIE_NAME,
    );

    if (!accessToken) {
      return null;
    }

    try {
      const { jwtVerify } = await loadJoseModule();
      const verification = await jwtVerify<AccessTokenClaims>(accessToken, this.accessTokenSecret, {
        audience: this.runtimeContext.environment.AUTH_ACCESS_TOKEN_AUDIENCE,
      });

      const claims = verification.payload;

      if (claims.typ && claims.typ !== 'access') {
        return null;
      }

      if (typeof claims.sub !== 'string' || typeof claims.sid !== 'string') {
        return null;
      }

      const rows = await this.databaseClient
        .select({
          session: authSessionsTable,
          user: usersTable,
        })
        .from(authSessionsTable)
        .innerJoin(usersTable, eq(authSessionsTable.userId, usersTable.id))
        .where(
          and(
            eq(authSessionsTable.id, claims.sid),
            eq(authSessionsTable.status, 'active'),
            eq(authSessionsTable.userId, claims.sub),
          ),
        )
        .limit(1);

      const record = rows[0];

      if (!record || record.session.expiresAt.getTime() <= Date.now()) {
        return null;
      }

      if (record.user.accountStatus !== 'active') {
        return null;
      }

      return {
        sessionId: record.session.id,
        userId: record.session.userId,
      };
    } catch {
      return null;
    }
  }
}

function extractSocketToken(client: Socket, accessCookieName: string): string | null {
  const authorizationHeader = client.handshake.headers.authorization;

  if (typeof authorizationHeader === 'string') {
    const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);
    if (scheme?.toLowerCase() === 'bearer' && token) {
      return token;
    }
  }

  const authPayload = client.handshake.auth;

  if (authPayload && typeof authPayload === 'object') {
    const accessToken = Reflect.get(authPayload, 'accessToken');
    if (typeof accessToken === 'string' && accessToken.length > 0) {
      return accessToken;
    }
  }

  const cookieHeader =
    typeof client.handshake.headers.cookie === 'string'
      ? client.handshake.headers.cookie
      : undefined;
  const cookieToken = parseCookieHeader(cookieHeader).get(accessCookieName);

  if (cookieToken && cookieToken.length > 0) {
    return cookieToken;
  }

  return null;
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
