import { boolean, index, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { usersTable } from './users';

export const profileVisibilityScopeEnum = pgEnum('profile_visibility_scope', [
  'contacts_only',
  'everyone',
  'nobody',
]);

export const userPrivacySettingsTable = pgTable(
  'user_privacy_settings',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    directMessageScope: profileVisibilityScopeEnum('direct_message_scope')
      .notNull()
      .default('everyone'),
    discoverableByEmail: boolean('discoverable_by_email').notNull().default(true),
    discoverableByUsername: boolean('discoverable_by_username').notNull().default(true),
    meetingPresenceScope: profileVisibilityScopeEnum('meeting_presence_scope')
      .notNull()
      .default('everyone'),
    presenceScope: profileVisibilityScopeEnum('presence_scope').notNull().default('everyone'),
    profileScope: profileVisibilityScopeEnum('profile_scope').notNull().default('everyone'),
    readReceiptsEnabled: boolean('read_receipts_enabled').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    userId: uuid('user_id')
      .primaryKey()
      .references(() => usersTable.id, {
        onDelete: 'cascade',
      }),
  },
  (table) => ({
    profileScopeIndex: index('user_privacy_settings_profile_scope_idx').on(table.profileScope),
  }),
);
