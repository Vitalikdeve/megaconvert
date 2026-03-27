import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { usersTable } from './users';

export const conversationKindEnum = pgEnum('conversation_kind', ['direct', 'group']);

export const conversationsTable = pgTable(
  'conversations',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => usersTable.id, {
        onDelete: 'restrict',
      }),
    id: uuid('id').defaultRandom().primaryKey(),
    kind: conversationKindEnum('kind').notNull(),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow().notNull(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    lastMessageId: uuid('last_message_id'),
    messageSequence: integer('message_sequence').notNull().default(0),
    title: text('title'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    activityIndex: index('conversations_last_activity_idx').on(table.lastActivityAt, table.id),
    createdByIndex: index('conversations_created_by_user_idx').on(table.createdByUserId),
    kindIndex: index('conversations_kind_idx').on(table.kind),
    lastMessageAtIndex: index('conversations_last_message_at_idx').on(table.lastMessageAt),
  }),
);
