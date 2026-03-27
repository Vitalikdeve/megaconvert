import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { authSessionsTable } from './auth-sessions';

export const authRefreshTokensTable = pgTable(
  'auth_refresh_tokens',
  {
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    id: uuid('id').defaultRandom().primaryKey(),
    issuedFromIpAddress: text('issued_from_ip_address'),
    issuedUserAgent: text('issued_user_agent'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => authSessionsTable.id, {
        onDelete: 'cascade',
      }),
    tokenHash: text('token_hash').notNull(),
  },
  (table) => ({
    expiresAtIndex: index('auth_refresh_tokens_expires_at_idx').on(table.expiresAt),
    sessionIndex: index('auth_refresh_tokens_session_idx').on(table.sessionId),
    tokenHashIndex: uniqueIndex('auth_refresh_tokens_token_hash_uidx').on(table.tokenHash),
  }),
);
