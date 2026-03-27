import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { usersTable } from './users';

export const authIdentityProviderEnum = pgEnum('auth_identity_provider', [
  'google_oidc',
  'webauthn_passkey',
]);

export const userIdentitiesTable = pgTable(
  'user_identities',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    email: text('email'),
    id: uuid('id').defaultRandom().primaryKey(),
    lastAuthenticatedAt: timestamp('last_authenticated_at', { withTimezone: true }),
    profile: jsonb('profile')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    provider: authIdentityProviderEnum('provider').notNull(),
    providerSubject: text('provider_subject').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, {
        onDelete: 'cascade',
      }),
  },
  (table) => ({
    providerSubjectUniqueIndex: uniqueIndex('user_identities_provider_subject_uidx').on(
      table.provider,
      table.providerSubject,
    ),
    userIndex: index('user_identities_user_idx').on(table.userId),
  }),
);
