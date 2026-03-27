import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { usersTable } from './users';

export const blockedUsersTable = pgTable(
  'blocked_users',
  {
    blockedAt: timestamp('blocked_at', { withTimezone: true }).defaultNow().notNull(),
    blockedUserId: uuid('blocked_user_id')
      .notNull()
      .references(() => usersTable.id, {
        onDelete: 'cascade',
      }),
    blockedUserUsername: text('blocked_user_username').notNull(),
    id: uuid('id').defaultRandom().primaryKey(),
    note: text('note'),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, {
        onDelete: 'cascade',
      }),
  },
  (table) => ({
    blockedUserIndex: index('blocked_users_blocked_user_idx').on(table.blockedUserId),
    userIndex: index('blocked_users_user_idx').on(table.userId),
    userBlockedUserUniqueIndex: uniqueIndex('blocked_users_user_blocked_user_uidx').on(
      table.userId,
      table.blockedUserId,
    ),
  }),
);
