import { relations, sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { usersTable } from './users';

export const authenticationMethodEnum = pgEnum('authentication_method', [
  'google_oidc',
  'webauthn_passkey',
]);

export const authSessionStatusEnum = pgEnum('auth_session_status', ['active', 'revoked']);

export const authDeviceKindEnum = pgEnum('auth_device_kind', [
  'desktop',
  'mobile',
  'tablet',
  'unknown',
]);

export const authSessionsTable = pgTable(
  'auth_sessions',
  {
    authenticationMethod: authenticationMethodEnum('authentication_method').notNull(),
    browser: text('browser'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    deviceKind: authDeviceKindEnum('device_kind').notNull().default('unknown'),
    deviceLabel: text('device_label'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    id: uuid('id').defaultRandom().primaryKey(),
    ipAddress: text('ip_address'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    operatingSystem: text('operating_system'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),
    status: authSessionStatusEnum('status').notNull().default('active'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, {
        onDelete: 'cascade',
      }),
  },
  (table) => ({
    expiresAtIndex: index('auth_sessions_expires_at_idx').on(table.expiresAt),
    lastSeenAtIndex: index('auth_sessions_last_seen_at_idx').on(table.lastSeenAt),
    statusIndex: index('auth_sessions_status_idx').on(table.status),
    userIndex: index('auth_sessions_user_idx').on(table.userId),
  }),
);

export const authSessionsRelations = relations(authSessionsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [authSessionsTable.userId],
    references: [usersTable.id],
  }),
}));
