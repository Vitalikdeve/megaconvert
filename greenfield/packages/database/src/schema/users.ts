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

export const accountStatusEnum = pgEnum('account_status', ['active', 'suspended']);

export const usersTable = pgTable(
  'users',
  {
    accountStatus: accountStatusEnum('account_status').notNull().default('active'),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    displayName: text('display_name').notNull(),
    email: text('email').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    familyName: text('family_name'),
    givenName: text('given_name'),
    id: uuid('id').defaultRandom().primaryKey(),
    lastAuthenticatedAt: timestamp('last_authenticated_at', { withTimezone: true }),
    locale: text('locale'),
    profile: jsonb('profile')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    statusText: text('status_text'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    username: text('username').notNull(),
  },
  (table) => ({
    accountStatusIndex: index('users_account_status_idx').on(table.accountStatus),
    createdAtIndex: index('users_created_at_idx').on(table.createdAt),
    emailUniqueIndex: uniqueIndex('users_email_uidx').on(table.email),
    usernameUniqueIndex: uniqueIndex('users_username_uidx').on(table.username),
  }),
);
